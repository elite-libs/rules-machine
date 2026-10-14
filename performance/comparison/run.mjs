import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { deepStrictEqual, throws } from 'node:assert';
import os from 'node:os';
import { batchDigest } from './digest.mjs';
import { fixtures, expected, fixtureVersion } from './fixtures.mjs';
const args=Object.fromEntries(process.argv.slice(2).map(arg=>{const i=arg.indexOf('=');return [arg.slice(0,i),arg.slice(i+1)];}));
const baseline=resolve(args.baseline||'performance/comparison/baseline/index.js');
const upgrade=args.upgrade?resolve(args.upgrade):undefined;
const tuned=resolve(args.tuned||'dist/index.js');
const rust=resolve(args.rust||'experiments/rusty-rules/target/release/rusty-rules-experiment');
const output=resolve(args.output||'performance/comparison/artifacts');mkdirSync(output,{recursive:true});
const blocks=Number(args.blocks||12);if(!Number.isInteger(blocks)||blocks<1)throw Error('blocks must be positive integer');const only=args.only?.split(',');
function run(arm,fixture,iterations,warmup=0,skipFirst=false){const start=performance.now();let child;
 if(arm==='rust')child=spawnSync(rust,['--once'],{input:JSON.stringify({rules:fixture.rules,inputs:fixture.inputs,iterations,warmup,skipTimedFirst:skipFirst})+'\n',encoding:'utf8',maxBuffer:32*1024*1024});
 else child=spawnSync(process.execPath,[resolve('performance/comparison/worker.mjs'),arm==='baseline'?baseline:arm==='upgrade'?upgrade:tuned,fixture.name,String(iterations),String(warmup),String(skipFirst)],{encoding:'utf8',maxBuffer:32*1024*1024});
 const boundaryNs=(performance.now()-start)*1e6;
 if(child.error||child.status!==0)throw Error(`${arm}: ${child.error||child.stderr}`);let result;try{result=JSON.parse(child.stdout.trim());}catch{throw Error(child.stdout+'\n'+child.stderr)}if(result.error)throw Error(result.error);
 deepStrictEqual(result.outputs,expected(fixture),`${arm}/${fixture.name} oracle`);if(result.operations!==iterations*fixture.inputs.length)throw Error('wrong completed count');if(result.checksum!==(Math.imul(batchDigest(expected(fixture)),iterations)>>>0))throw Error('wrong timed output digest');
 return {...result,outputs:undefined,boundaryNs};}
const chosen=fixtures.filter(f=>!only||only.includes(f.name));
const sha256=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const serialized=JSON.stringify(fixtures.map(({oracle,...f})=>f));const env={at:new Date().toISOString(),fixtureVersion,fixtureHash:createHash('sha256').update(serialized).digest('hex'),node:process.version,cpu:os.cpus()[0]?.model,cpus:os.cpus().length,platform:`${os.platform()} ${os.release()} ${os.arch()}`,memory:os.totalmem(),blocks,baseline,tuned,upgrade,rust,moduleHashes:{baseline:sha256(baseline),tuned:sha256(tuned),...(upgrade?{upgrade:sha256(upgrade)}:{}),rust:sha256(rust)},harnessHashes:Object.fromEntries(['fixtures.mjs','digest.mjs','worker.mjs','run.mjs','verify.mjs'].map(f=>[f,sha256(resolve('performance/comparison',f))])),command:process.argv};
writeFileSync(resolve(output,'environment.json'),JSON.stringify(env,null,2));
// Fail-vacuity sentinel: a changed output must never satisfy the expected oracle.
const sentinel=expected(fixtures[0]);const wrong=structuredClone(sentinel);wrong[0].result=!wrong[0].result;throws(()=>deepStrictEqual(wrong,sentinel));
for(const arm of ['baseline',...(upgrade?['upgrade']:[]),'tuned','rust'])throws(()=>run(arm,fixtures[0],1,0,true),/wrong completed count|wrong timed output digest/);
const raw=[];function save(){writeFileSync(resolve(output,'raw.json'),JSON.stringify(raw,null,2));}
// Freeze per-slice iterations from baseline-only pilot, never a candidate result.
const iterations={};for(const fixture of chosen){const pilot=run('baseline',fixture,2,1);iterations[fixture.name]=Math.max(2,Math.min(10000,Math.ceil(250e6/pilot.elapsedNs*2)));raw.push({phase:'pilot',fixture:fixture.name,arm:'baseline',iterations:2,...pilot});save();}
writeFileSync(resolve(output,'schedule.json'),JSON.stringify({iterations,blocks,order:'simple cyclic rotations; 12 blocks balance every position for 4-arm shared and 3-arm array workloads',warmup:'max(1, floor(iterations/5)) batches'},null,2));
for(let block=0;block<blocks;block++){for(const fixture of chosen){let arms=fixture.shared?['baseline',...(upgrade?['upgrade']:[]),'tuned','rust']:['baseline',...(upgrade?['upgrade']:[]),'tuned'];const shift=block%arms.length;arms=[...arms.slice(shift),...arms.slice(0,shift)];for(const arm of arms){const n=iterations[fixture.name];const result=run(arm,fixture,n,Math.max(1,Math.floor(n/5)));raw.push({phase:'confirmation',sampledAt:new Date().toISOString(),block,fixture:fixture.name,arm,iterations:n,...result});save();process.stderr.write(`${block+1}/${blocks} ${fixture.name} ${arm}: ${(result.elapsedNs/result.operations).toFixed(0)} ns/op\n`);}}}
const summary=chosen.map(fixture=>{const perArm={};for(const arm of fixture.shared?['baseline',...(upgrade?['upgrade']:[]),'tuned','rust']:['baseline',...(upgrade?['upgrade']:[]),'tuned']){const samples=raw.filter(r=>r.phase==='confirmation'&&r.fixture===fixture.name&&r.arm===arm).map(r=>r.elapsedNs/r.operations).sort((a,b)=>a-b);perArm[arm]={medianNs:samples[Math.floor(samples.length/2)],minNs:samples[0],maxNs:samples.at(-1),blocks:samples.length};}return {fixture:fixture.name,shared:fixture.shared,...perArm};});
writeFileSync(resolve(output,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
