import {performance} from 'node:perf_hooks';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {deepStrictEqual} from 'node:assert';
import {RustBridge} from '../../experiments/rusty-rules/bridge.mjs';
import {fixtures,expected} from '../comparison/fixtures.mjs';
import {digest,batchDigest} from '../comparison/digest.mjs';
const [modulePath,binary,mode='warm',block='0',schedule='{}']=process.argv.slice(2);
const {ruleFactory}=await import(pathToFileURL(modulePath));
const config=JSON.parse(schedule);const raw=[];
function memory(bridge){let child;try{const s=readFileSync(`/proc/${bridge.pid}/status`,'utf8');child=Object.fromEntries([...s.matchAll(/^(VmRSS|VmHWM):\s+(\d+) kB/gm)].map(m=>[m[1],Number(m[2])*1024]));}catch(e){child={unavailable:e.code};}return{parent:process.memoryUsage(),child};}
async function validate(bridge,program,fixture){for(let i=0;i<fixture.inputs.length;i++){const output=await bridge.run(program,fixture.inputs[i]);deepStrictEqual(output,expected(fixture)[i]);}}
if(mode==='warm'||mode==='pilot'){
 const bridge=new RustBridge({binary,timeoutMs:10000});try{
 for(const fixture of fixtures){const program=await bridge.prepare(fixture.rules);const execute=ruleFactory(fixture.rules);const n=mode==='pilot'?2:config[fixture.name];const warmup=mode==='pilot'?1:Math.max(2,Math.floor(n/5));await validate(bridge,program,fixture);
 const arms=mode==='pilot'?['bridge']:Number(block)%2?['bridge','ts']:['ts','bridge'];
 async function batch(arm,count){let completed=0,checksum=0,last;const start=performance.now();for(let i=0;i<count;i++)for(let j=0;j<fixture.inputs.length;j++){if(arm==='bridge'){last=await bridge.run(program,fixture.inputs[j]);}else{const input=structuredClone(fixture.inputs[j]);last={result:execute(input),input};}completed++;checksum=(checksum+Math.imul(digest(last.result),j+1))>>>0;}const elapsedNs=(performance.now()-start)*1e6;deepStrictEqual(last,expected(fixture).at(-1));if(completed!==count*fixture.inputs.length||checksum!==(Math.imul(batchDigest(expected(fixture)),count)>>>0))throw Error('Completed work/digest gate');return{elapsedNs,completed,checksum};}
 for(const arm of arms){await batch(arm,warmup);const before=await bridge.stats();const data=await batch(arm,n);const after=await bridge.stats();if(arm==='bridge'&&after.completed-before.completed!==data.completed)throw Error('Worker completed counter mismatch');raw.push({fixture:fixture.name,arm,iterations:n,...data,memory:memory(bridge)});}
 await bridge.release(program);
 }
 }finally{await bridge.close();}
}else if(mode==='cold'){
 for(let i=0;i<10;i++){const start=performance.now();const bridge=new RustBridge({binary});try{const program=await bridge.prepare(['out=price*quantity',{return:'out'}]);const output=await bridge.run(program,{price:17,quantity:3});deepStrictEqual(output,{result:51,input:{price:17,quantity:3,out:51}});raw.push({iteration:i,elapsedNs:(performance.now()-start)*1e6});}finally{await bridge.close();}}
}else if(mode==='retention'||mode==='retention-ts'){
 if(!global.gc)throw Error('Retention mode requires --expose-gc');
 const isTs=mode==='retention-ts';const bridge=isTs?undefined:new RustBridge({binary,timeoutMs:10000});try{
 const snapshots=[];const weak=[];let completed=0;const mutableRules=['value + 0'];const tsExecute=ruleFactory(mutableRules);
 async function snapshot(label,stats){await new Promise(resolve=>setImmediate(resolve));global.gc();await new Promise(resolve=>setImmediate(resolve));global.gc();snapshots.push({label,stats,...(isTs?{parent:process.memoryUsage()}:memory(bridge)),sampledInputsAlive:weak.filter(ref=>ref.deref()!==undefined).length,sampledInputs:weak.length});}
 await snapshot('startup',isTs?{syntaxCache:'factory-local, implementation bounded'}:await bridge.stats());
 let last;for(let i=0;i<2000;i++){if(isTs){mutableRules[0]=`value + ${i}`;const result=tsExecute({value:1});if(result!==i+1)throw Error('TS unique source oracle');}else{last=await bridge.prepare(`value + ${i}`);}if(i===127||i===511||i===1999)await snapshot(`unique-programs-${i+1}`,isTs?{}:await bridge.stats());}
 if(!isTs){const output=await bridge.run(last,{value:1});deepStrictEqual(output,{result:2000,input:{value:1}});const stats=await bridge.stats();if(stats.programs>128||stats.programSourceBytes>stats.sourceByteLimit||stats.retainedInputs!==0)throw Error('Cache resource gate');}
 const program=isTs?undefined:await bridge.prepare([{return:'value + 1'}]);const execute=ruleFactory([{return:'value + 1'}]);
 async function inputs(count,size){for(let i=0;i<count;i++){const input={value:i,payload:'x'.repeat(size)};if(i%100===0)weak.push(new WeakRef(input));if(isTs){if(execute(input)!==i+1)throw Error('TS large input oracle');}else{const out=await bridge.run(program,input);if(out.result!==i+1||out.input.payload!==input.payload)throw Error('Large-input oracle');}completed++;}}
 for(let block=0;block<6;block++){await inputs(500,64*1024);await snapshot(`large-inputs-${completed}`,isTs?{completed}:await bridge.stats());}
 await inputs(1000,0);await snapshot('after-small-inputs',isTs?{completed}:await bridge.stats());
 if(snapshots.at(-1).sampledInputsAlive!==0)throw Error('Completed parent input object retained');
 raw.push({snapshots,completed,requestPayloadBytes:64*1024,totalLargeInputCalls:3000,arm:isTs?'direct-ts':'bridge'});
 }finally{if(bridge)await bridge.close();}
}else throw Error('Unknown mode');
console.log(JSON.stringify({node:process.version,mode,block:Number(block),raw}));
