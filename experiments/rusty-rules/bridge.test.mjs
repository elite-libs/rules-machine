import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {RustBridge} from './bridge.mjs';
import {encode,decode,preflightJSON,MAX_WIRE_BYTES} from './wire.mjs';
const binary=resolve('experiments/rusty-rules/target/release/rusty-rules-experiment');
function worker(options={}){return new RustBridge({binary,...options});}
function fake(source,options={}){return new RustBridge({binary:process.execPath,args:['-e',source],...options});}
async function dead(bridge){await bridge.close();assert.equal(bridge.pendingCount,0);if(bridge.pid)assert.throws(()=>process.kill(bridge.pid,0),{code:'ESRCH'});}

test('persistent prepare/run framing, data values and separate instances',async()=>{
 const a=worker(),b=worker();try{const id=await a.prepare(['x=missing',{return:'[x,NULL,-0,1/0]'}]);const results=await Promise.all(Array.from({length:20},(_,i)=>a.run(id,{sequence:i,tag:['undefined']})));for(let i=0;i<20;i++){assert.equal(results[i].input.sequence,i);assert.equal(Object.hasOwn(results[i].input,'x'),true);assert.deepEqual(results[i].result,[undefined,null,-0,Infinity]);assert.deepEqual(results[i].input.tag,['undefined']);}assert.equal((await a.stats()).completed,20);assert.equal((await b.stats()).completed,0);assert.equal(await a.release(id),true);await assert.rejects(a.run(id,{}),{code:'RULE_ERROR'});assert.equal((await a.execute('2+3')).result,5);}finally{await Promise.all([dead(a),dead(b)]);}
});
test('roundtrip has no tag-object collisions and preserves undefined ownership',()=>{const value={a:undefined,b:null,tag:'undefined',nested:[['undefined'],{type:'number',value:'NaN'}],minus:-0,nan:NaN};assert.deepEqual(decode(encode(value)),value);assert.throws(()=>encode({f(){}}));const cycle={};cycle.self=cycle;assert.throws(()=>encode(cycle));assert.throws(()=>encode([,]));assert.throws(()=>encode(Object.defineProperty({},'x',{enumerable:true,get(){throw Error('not invoked');}})));assert.throws(()=>decode(['object',[['x',['null']],['x',['undefined']]]]));});
test('rule errors do not poison the worker or leak scope',async()=>{const bridge=worker();try{await assert.rejects(bridge.execute('ABS("bad")'),{code:'RULE_ERROR'});assert.deepEqual(await bridge.execute([{try:{map:'items',run:'ABS("bad")'},catch:'fallback=4'},{return:'fallback'}],{items:[1]}),{result:4,input:{items:[1],fallback:4}});assert.equal((await bridge.execute('7')).result,7);}finally{await dead(bridge);}});
test('pending and queued-byte backpressure reject before writing',async()=>{const bridge=fake('process.stdin.resume();setInterval(()=>{},1000)',{maxPending:1});try{const first=bridge.request('stats',{}, {timeoutMs:500});const rejection=assert.rejects(first,{code:'CLOSED'});await assert.rejects(bridge.request('stats'),{code:'BACKPRESSURE'});await bridge.close();await rejection;}finally{await dead(bridge);}const bytes=fake('process.stdin.resume();setInterval(()=>{},1000)',{maxQueuedBytes:10});try{await assert.rejects(bytes.request('stats'),{code:'BACKPRESSURE'});}finally{await dead(bytes);}});
test('deadline kills worker and rejects every pending request',async()=>{const bridge=fake('process.stdin.resume();setInterval(()=>{},1000)');const a=bridge.request('stats',{}, {timeoutMs:30});const b=bridge.request('stats',{}, {timeoutMs:300});await Promise.all([assert.rejects(a,{code:'TIMEOUT'}),assert.rejects(b,{code:'TIMEOUT'})]);await dead(bridge);});
test('abort before submission leaves healthy worker; submitted abort kills owned worker',async()=>{const bridge=worker();const pre=new AbortController();pre.abort();await assert.rejects(bridge.stats({signal:pre.signal}),{code:'ABORTED'});assert.equal((await bridge.execute('2')).result,2);await dead(bridge);const hanging=fake('process.stdin.resume();setInterval(()=>{},1000)');const signal=new AbortController();const promise=hanging.stats({signal:signal.signal});const rejected=assert.rejects(promise,{code:'ABORTED'});signal.abort();await rejected;await dead(hanging);});
test('spawn failure, premature process exit, malformed and wrong-id responses clean pending requests',async()=>{for(const [source,code]of [['process.exit(2)','WORKER_EXIT'],['process.stdin.once("data",()=>process.stdout.write("garbage\\n"))','INVALID_RESPONSE'],['process.stdin.once("data",()=>process.stdout.write("null\\n"))','INVALID_RESPONSE'],['process.stdin.once("data",()=>process.stdout.write(JSON.stringify({id:999,result:{}})+"\\n"))','INVALID_RESPONSE']]){const bridge=fake(source);await assert.rejects(bridge.stats(),{code});await dead(bridge);}const missing=new RustBridge({binary:'/tmp/rules-machine-no-such-worker'});await assert.rejects(missing.stats(),{code:'SPAWN_FAILED'});await dead(missing);});
test('frame limits are enforced for requests and partial responses',async()=>{const bridge=worker({maxFrameBytes:100});try{await assert.rejects(bridge.execute('1',{payload:'x'.repeat(200)}),{code:'FRAME_LIMIT'});}finally{await dead(bridge);}const oversized=fake('process.stdin.once("data",()=>process.stdout.write("x".repeat(101)))',{maxFrameBytes:100});await assert.rejects(oversized.stats(),{code:'FRAME_LIMIT'});await dead(oversized);});
test('close rejects pending work and is idempotent',async()=>{const bridge=fake('process.stdin.resume();setInterval(()=>{},1000)');const rejection=assert.rejects(bridge.stats(),{code:'CLOSED'});await bridge.close();await rejection;await bridge.close();await assert.rejects(bridge.stats(),{code:'CLOSED'});await dead(bridge);});

test('wire preflight bounds aliased expansion before constructing a frame',()=>{
  // Only 36 distinct arrays: expanding their aliases would create 2^35 leaves.
  let aliased=1;
  for(let depth=0;depth<35;depth++)aliased=[aliased,aliased];
  assert.throws(()=>encode(aliased),{code:'FRAME_LIMIT'});
  // Large primitive and key costs must count on every expanded occurrence.
  for(const leaf of ['x'.repeat(4096),{['k'.repeat(4096)]:undefined}]){
    let shared=leaf;
    for(let depth=0;depth<12;depth++)shared=[shared,shared];
    assert.throws(()=>encode(shared),{code:'FRAME_LIMIT'});
  }
  const shared={sentinel:['undefined'],value:undefined,nan:NaN,negativeZero:-0};
  const normal={left:shared,right:shared,escaped:'\0\n\t"\\😀'};
  assert.deepEqual(decode(encode(normal)),normal);
});

test('wire memoization preserves depth limits for aliases reached at deeper paths',()=>{
  let subtree=0;
  for(let depth=0;depth<30;depth++)subtree=[subtree];
  let deeper=subtree;
  for(let depth=0;depth<10;depth++)deeper=[deeper];
  // First visit caches subtree at depth1; the second must still check its height.
  assert.throws(()=>encode([subtree,deeper]),/nesting exceeds 40/);
  let allowed=0;
  for(let depth=0;depth<40;depth++)allowed=[allowed];
  assert.deepEqual(decode(encode(allowed)),allowed);
});

test('wire preflight rejects accessors and proxies without host callbacks',()=>{
  let calls=0;
  const getter=()=>{calls++;return 1;};
  const accessor=Object.defineProperty({},'value',{enumerable:true,get:getter});
  assert.throws(()=>encode(accessor),/accessor/);
  const proxy=new Proxy({}, {ownKeys(){calls++;return [];},getPrototypeOf(){calls++;return Object.prototype;}});
  assert.throws(()=>encode(proxy),/Proxy/);
  const array=[1];
  Object.defineProperty(array,'constructor',{get:getter});
  assert.throws(()=>encode(array),/arrays/);
  assert.equal(calls,0);
});

test('raw JSON preflight bounds aliases and retains room for tagged depth40',()=>{
  let alias=0;
  for(let depth=0;depth<35;depth++)alias=[alias,alias];
  assert.throws(()=>preflightJSON({options:alias}),{code:'FRAME_LIMIT'});
  let deep=1;
  for(let depth=0;depth<40;depth++)deep={nested:deep};
  const envelope={payload:{input:encode(deep),options:{trace:false,atomic:true,limits:{maxOperations:1000}}},op:'run',id:1};
  const estimate=preflightJSON(envelope);
  assert.ok(estimate.bytes<=MAX_WIRE_BYTES);
  assert.ok(Buffer.byteLength(JSON.stringify(envelope))<=estimate.bytes);
  assert.deepEqual(decode(envelope.payload.input),deep);
});

test('raw request and options validation reject expansion and host hooks before submission',async()=>{
  const bridge=fake('process.stdin.resume();setInterval(()=>{},1000)');
  try{
    let alias=0;
    for(let depth=0;depth<35;depth++)alias=[alias,alias];
    await assert.rejects(bridge.request('stats',{extra:alias}),{code:'FRAME_LIMIT'});
    await assert.rejects(bridge.run('program',{}, {options:{extra:alias}}),{code:'FRAME_LIMIT'});
    let calls=0;
    const getter=()=>{calls++;return 1;};
    await assert.rejects(bridge.request('stats',Object.defineProperty({},'extra',{enumerable:true,get:getter})),/accessor/);
    await assert.rejects(bridge.run('program',{}, {options:{toJSON(){calls++;return {};}}}),/ordinary JSON/);
    await assert.rejects(bridge.run('program',{}, {options:Object.defineProperty({},'trace',{enumerable:true,get:getter})}),/accessor/);
    const proxy=new Proxy({}, {ownKeys(){calls++;return [];},getPrototypeOf(){calls++;return Object.prototype;}});
    await assert.rejects(bridge.request('stats',proxy),/Proxy/);
    await assert.rejects(bridge.run('program',{}, {options:proxy}),/Proxy/);
    assert.equal(calls,0);
    assert.equal(bridge.pendingCount,0);
  }finally{await dead(bridge);}
});

test('normal raw request options survive conservative envelope validation',async()=>{
  const source='process.stdin.on("data",chunk=>{for(const line of chunk.toString().trim().split("\\n")){const request=JSON.parse(line);process.stdout.write(JSON.stringify({id:request.id,result:{options:request.options}})+"\\n");}})';
  const bridge=fake(source);
  try{
    const options={trace:false,atomic:true,limits:{maxOperations:1000,maxArrayLength:20}};
    assert.deepEqual(await bridge.request('stats',{options}),{options});
  }finally{await dead(bridge);}
});

test('malformed error fields fail closed without coercion or orphaned pending requests',async()=>{
  const malformed=[null,false,0,'error',[],{}, {code:'RULE_ERROR'}, {code:1,message:'failure'}, {code:'',message:'failure'}, {code:'RULE_ERROR',message:null}, {code:'RULE_ERROR',message:{toString:null,valueOf:null}}];
  for(const error of malformed){
    const response=JSON.stringify({id:1,error});
    const bridge=fake(`process.stdin.once('data',()=>process.stdout.write(${JSON.stringify(response+'\n')}));`);
    const first=bridge.stats(),second=bridge.stats();
    await Promise.all([assert.rejects(first,{code:'INVALID_RESPONSE'}),assert.rejects(second,{code:'INVALID_RESPONSE'})]);
    await dead(bridge);
  }
});

test('well-formed worker errors preserve code and empty messages without closing a healthy worker',async()=>{
  const source='let first=true;process.stdin.on("data",chunk=>{for(const line of chunk.toString().trim().split("\\n")){const request=JSON.parse(line);process.stdout.write(JSON.stringify(first?(first=false,{id:request.id,error:{code:"RULE_ERROR",message:""}}):{id:request.id,result:{ok:true}})+"\\n");}})';
  const bridge=fake(source);
  try{
    await assert.rejects(bridge.stats(),{code:'RULE_ERROR',message:''});
    assert.deepEqual(await bridge.request('stats'),{ok:true});
  }finally{await dead(bridge);}
});

test('malformed typed command results fail closed with stable protocol errors',async()=>{
  for(const [method,result]of [['prepare',null],['prepare',{program:1}],['release',{}],['release',{released:1}],['stats',{}],['execute',null],['execute',{result:['bad'],input:['object',[]]}],['execute',{result:['null'],input:['number',1]}]]){
    const response=JSON.stringify({id:1,result});
    const bridge=fake(`process.stdin.once('data',()=>process.stdout.write(${JSON.stringify(response+'\n')}));`);
    try{
      const promise=method==='prepare'?bridge.prepare('1'):method==='release'?bridge.release('p1'):method==='execute'?bridge.execute('1'):bridge.stats();
      await assert.rejects(promise,{code:'INVALID_RESPONSE'});
      assert.equal(bridge.closed,true);
    }finally{await dead(bridge);}
  }
});

test('invalid typed result rejects later responses in the same stdout chunk',async()=>{
  const source='let data="";process.stdin.on("data",chunk=>{data+=chunk;const lines=data.trim().split("\\n");if(lines.length<2)return;const [a,b]=lines.map(JSON.parse);process.stdout.write(JSON.stringify({id:a.id,result:{program:1}})+"\\n"+JSON.stringify({id:b.id,result:{ok:true}})+"\\n");});';
  const bridge=fake(source);
  try{
    const first=bridge.prepare('1'),second=bridge.request('stats');
    await Promise.all([assert.rejects(first,{code:'INVALID_RESPONSE'}),assert.rejects(second,{code:'INVALID_RESPONSE'})]);
  }finally{await dead(bridge);}
});

test('tagged decoding rejects lone UTF-16 surrogates in values and keys',()=>{
  assert.throws(()=>decode(['string','\ud800']),/surrogate/);
  assert.throws(()=>decode(['object',[['\udc00',['null']]]]),/surrogate/);
  assert.equal(decode(['string','😀']),'😀');
  assert.deepEqual(decode(['object',[['😀',['null']]]]),{'😀':null});
});
