import { spawn } from 'node:child_process';
import { encode, decode } from './wire.mjs';
export class RustBridgeError extends Error {
  constructor(code,message,options){super(message,options);this.name='RustBridgeError';this.code=code;}
}
/** One owned sequential worker. Cancellation/timeout terminates the worker and
 * rejects all requests, ensuring timed-out work cannot keep consuming resources. */
export class RustBridge {
  #child; #pending=new Map(); #next=0; #closed=false; #buffer=Buffer.alloc(0); #stderr=''; #queuedBytes=0; #closePromise; #resolveClose;
  constructor({binary,args=[],timeoutMs=5000,maxPending=128,maxFrameBytes=8*1024*1024,maxQueuedBytes=16*1024*1024,env=process.env}={}) {
    if(typeof binary!=='string'||!binary)throw new TypeError('binary is required');
    for(const [name,n]of Object.entries({timeoutMs,maxPending,maxFrameBytes,maxQueuedBytes}))if(!Number.isSafeInteger(n)||n<=0)throw new TypeError(`${name} must be a positive integer`);
    if(maxFrameBytes>8*1024*1024)throw new TypeError('maxFrameBytes cannot exceed worker limit');
    this.maxQueuedBytes=maxQueuedBytes;this.timeoutMs=timeoutMs;this.maxPending=maxPending;this.maxFrameBytes=maxFrameBytes;
    this.#closePromise=new Promise(resolve=>{this.#resolveClose=resolve;});
    this.#child=spawn(binary,args,{stdio:['pipe','pipe','pipe'],env,windowsHide:true});
    this.#child.stdout.on('data',chunk=>this.#data(chunk));
    this.#child.stderr.on('data',chunk=>{this.#stderr=(this.#stderr+chunk.toString('utf8')).slice(-4096);});
    this.#child.on('error',error=>this.#fail(new RustBridgeError('SPAWN_FAILED',error.message,{cause:error})));
    this.#child.on('close',(code,signal)=>{this.#fail(new RustBridgeError('WORKER_EXIT',`Rust worker exited (${code??signal})${this.#stderr?`: ${this.#stderr}`:''}`),false);this.#resolveClose();});
    this.#child.stdin.on('error',error=>this.#fail(new RustBridgeError('WRITE_FAILED',error.message,{cause:error})));
  }
  get pid(){return this.#child.pid;}
  get closed(){return this.#closed;}
  get pendingCount(){return this.#pending.size;}
  #fail(error,kill=true){
    this.#closed=true;this.#buffer=Buffer.alloc(0);
    for(const request of this.#pending.values()){request.cleanup();request.reject(error);}
    this.#pending.clear();this.#queuedBytes=0;
    if(kill&&!this.#child.killed)this.#child.kill('SIGKILL');
  }
  #data(chunk){
    if(this.#closed)return;
    this.#buffer=Buffer.concat([this.#buffer,chunk]);
    for(;;){const end=this.#buffer.indexOf(10);if(end<0)break;
      if(end+1>this.maxFrameBytes){this.#fail(new RustBridgeError('FRAME_LIMIT','Worker response frame exceeds limit'));return;}
      const line=this.#buffer.subarray(0,end);this.#buffer=end+1===this.#buffer.length?Buffer.alloc(0):this.#buffer.subarray(end+1);
      let response;try{response=JSON.parse(line.toString('utf8'));}catch(error){this.#fail(new RustBridgeError('INVALID_RESPONSE','Worker emitted invalid JSON',{cause:error}));return;}
      if(!response||typeof response!=='object'||Array.isArray(response)||!Object.hasOwn(response,'id')||Object.hasOwn(response,'result')===Object.hasOwn(response,'error')){this.#fail(new RustBridgeError('INVALID_RESPONSE','Invalid response envelope'));return;}
      const request=this.#pending.get(response.id);
      if(!request){this.#fail(new RustBridgeError('INVALID_RESPONSE','Worker returned unknown request id'));return;}
      this.#pending.delete(response.id);this.#queuedBytes-=request.bytes;request.cleanup();
      if(response.error){request.reject(new RustBridgeError(response.error.code||'RULE_ERROR',String(response.error.message)));}
      else if(Object.hasOwn(response,'result'))request.resolve(response.result);
      else{this.#fail(new RustBridgeError('INVALID_RESPONSE','Worker omitted result/error'));request.reject(new RustBridgeError('INVALID_RESPONSE','Worker omitted result/error'));return;}
    }
    if(this.#buffer.length>this.maxFrameBytes)this.#fail(new RustBridgeError('FRAME_LIMIT','Worker response exceeds frame limit'));
  }
  request(op,payload={}, {signal,timeoutMs=this.timeoutMs}={}) {
    if(this.#closed)return Promise.reject(new RustBridgeError('CLOSED','Bridge is closed'));
    if(signal?.aborted)return Promise.reject(new RustBridgeError('ABORTED','Request aborted before submission'));
    if(!Number.isSafeInteger(timeoutMs)||timeoutMs<=0)return Promise.reject(new TypeError('timeoutMs must be positive integer'));
    if(this.#pending.size>=this.maxPending)return Promise.reject(new RustBridgeError('BACKPRESSURE','Bridge pending request limit reached'));
    const id=++this.#next;let frame;
    try{frame=JSON.stringify({...payload,op,id})+'\n';}catch(error){return Promise.reject(error);}
    const bytes=Buffer.byteLength(frame);
    if(this.#queuedBytes+bytes>this.maxQueuedBytes)return Promise.reject(new RustBridgeError('BACKPRESSURE','Queued request byte limit reached'));
    if(bytes>this.maxFrameBytes)return Promise.reject(new RustBridgeError('FRAME_LIMIT','Request exceeds frame limit'));
    return new Promise((resolve,reject)=>{
      const abort=()=>this.#fail(new RustBridgeError('ABORTED','Request aborted; owned worker terminated'));
      const timer=setTimeout(()=>this.#fail(new RustBridgeError('TIMEOUT','Request timed out; owned worker terminated')),timeoutMs);
      const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);};
      this.#pending.set(id,{resolve,reject,cleanup,bytes});this.#queuedBytes+=bytes;signal?.addEventListener('abort',abort,{once:true});
      // Node streams buffer writes in order. maxPending/maxFrameBytes bound queued
      // data; callback errors fail all pending work rather than losing a request.
      this.#child.stdin.write(frame,error=>{if(error)this.#fail(new RustBridgeError('WRITE_FAILED',error.message,{cause:error}));});
    });
  }
  async prepare(rules,options){return (await this.request('prepare',{rules},options)).program;}
  async execute(rules,input={}, {options={},...requestOptions}={}) {
    const output=await this.request('execute',{rules,input:encode(input),options},requestOptions);
    return this.#decode(output);
  }
  async run(program,input={}, {options={},...requestOptions}={}) {
    const output=await this.request('run',{program,input:encode(input),options},requestOptions);
    return this.#decode(output);
  }
  #decode(output){try{return {result:decode(output.result),input:decode(output.input)};}catch(error){this.#fail(new RustBridgeError('INVALID_RESPONSE','Invalid tagged worker result',{cause:error}));throw error;}}
  async release(program,options){return (await this.request('release',{program},options)).released;}
  stats(options){return this.request('stats',{},options);}
  async close(){if(!this.#closed)this.#fail(new RustBridgeError('CLOSED','Bridge closed by caller'));await this.#closePromise;}
}
