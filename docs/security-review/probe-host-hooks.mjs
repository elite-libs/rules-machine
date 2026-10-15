// Bounded adversarial API matrix. Run with `timeout 20s node ...`.
// Counts actual host hook execution, not merely expected error messages.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { ruleFactory } from '../../dist/index.mjs';
const source=readFileSync('src/expression-engine/language.ts','utf8');
const block=source.slice(source.indexOf('const prefixOps:'),source.indexOf('Object.keys(prefixOps).forEach'));
const names=[...block.matchAll(/^    ([A-Z][A-Z0-9_]*):/gm)].map(match=>match[1]);
assert.equal(names.length,97,'Review inventory if functions change');
let calls=0;
const hook=()=>{calls++;return 7;};
hook();assert.equal(calls,1,'Hook counter fail-vacuity sentinel');calls=0;
const hostile=Object.create(null);
for(const key of ['toJSON','valueOf','toString','constructor','length','isArgumentsArray',Symbol.toPrimitive,Symbol.iterator,Symbol.asyncIterator])
  Object.defineProperty(hostile,key,{enumerable:typeof key==='string',get:hook});
const items=Object.assign([hook],{isArgumentsArray:true});
const accessorItems=[1];
for(const key of ['0','constructor','isArgumentsArray',Symbol.iterator])Object.defineProperty(accessorItems,key,{get:hook,configurable:true});
const payloads=[hostile,hook,items,accessorItems,{valueOf:hook,toString:hook,toJSON:hook},[items],Object.freeze([hook])];
const templates=['value','value,normal','normal,value','value,normal,record','normal,value,record','normal,record,value','"ABS",value','"ADD",0,value'];
let probes=0,returned=0,rejected=0;
for(const value of payloads)for(const name of names)for(const args of templates)for(const trace of [false,true]){
  const expression=`${name}(${args})`;
  try{ruleFactory(expression,{trace,limits:{maxOperations:10000,maxDurationMs:1000}})({value,normal:[1,2],record:{a:1}});returned++;}
  catch{rejected++;}
  probes++;
  assert.equal(calls,0,`Host hook executed: ${expression}, payload${payloads.indexOf(value)}, trace${trace}`);
}
console.log(JSON.stringify({at:new Date().toISOString(),node:process.version,functions:names.length,payloadFamilies:payloads.length,templates:templates.length,traceModes:2,probes,returned,rejected,hostHooksInvoked:calls,scope:'Bounded hostile callbacks/accessors/coercion/iteration/argument-marker matrix against delivered ESM; expected domain errors are counted, not failures. Not exhaustive fuzzing or a sandbox proof.'},null,2));
