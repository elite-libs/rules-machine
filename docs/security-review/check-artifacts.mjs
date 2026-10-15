import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';
import * as esm from '../../dist/index.mjs';

// Self-contained so the same contract can run in a real browser realm.
export function securityContract(lib) {
  const results = [];
  const check = (name, run) => {
    if (!run()) throw Error(`Security contract failed: ${name}`);
    results.push(name);
  };
  const rejects = (run, pattern) => {
    try { run(); } catch (error) { return !pattern || pattern.test(error.message); }
    return false;
  };
  check('ordinary comma and higher-order calls', () =>
    lib.ruleFactory('ADD(1,2)')() === 3 &&
    lib.ruleFactory('REDUCE("ADD",0,items)')({items:[1,2,3]}) === 6);
  check('forged callback marker never executes supplied function', () => {
    let calls=0;
    const items=Object.assign([()=>{calls++;return 7;}],{isArgumentsArray:true});
    return rejects(()=>lib.ruleFactory('ABS(OMIT("missing",items))')({items})) && calls===0;
  });
  check('compiled-source accessor never executes', () => {
    let calls=0;
    const compiled=Object.defineProperty({},'source',{get(){calls++;return '1';}});
    return rejects(()=>lib.createExpressionEngine().evaluate(compiled,()=>undefined)) && calls===0;
  });
  check('cold compilation cannot escape work limits', () => {
    const engine=lib.createExpressionEngine({limits:{maxOperations:20}});
    return rejects(()=>engine.evaluateExpression(' '.repeat(1000)+'1',()=>undefined),/maxOperations/) && engine.cacheStats().entries===0;
  });
  check('root validation work precedes mutation', () => {
    const input=Object.fromEntries(Array.from({length:1000},(_,i)=>['key'+i,i]));
    return rejects(()=>lib.ruleFactory('changed=1',{limits:{maxOperations:100}})(input),/maxOperations/) && !Object.hasOwn(input,'changed');
  });
  check('nested OMIT path text stays bounded', () =>
    rejects(()=>lib.ruleFactory('OMIT(paths,data)',{limits:{maxStringLength:30}})({paths:[[Array.from({length:20},()=> 'key')]],data:{}}),/maxStringLength/));
  check('validated program cannot be replaced through an input alias', () => {
    let calls=0;
    const injected=Object.defineProperty({},'return',{enumerable:true,get(){calls++;return '9';}});
    const rules=['program[1]=injected',{return:'1'}];
    const input={program:rules,injected};
    const run=lib.ruleFactory(rules);
    return run(input)===1 && rejects(()=>run(input),/accessors/) && calls===0;
  });
  check('atomic truncation preserves nonextensible array elements', () => {
    const items=Object.preventExtensions([1,2,3]);
    return rejects(()=>lib.ruleFactory(['items.length=0','THROW("stop")'],{atomic:true})({items})) && items.length===3 && items[0]===1 && items[2]===3;
  });
  check('intrinsic prototype aliases are not writable', () => {
    const key='__rules_machine_security_probe__';
    try {
      const failed=rejects(()=>lib.ruleFactory('target.'+key+'=1')({target:Object.prototype}));
      return failed && !Object.hasOwn(Object.prototype,key);
    } finally { Reflect.deleteProperty(Object.prototype,key); }
  });
  check('iterator and generator prototypes are not writable', () => {
    const sync=Object.getPrototypeOf((function*(){}).prototype);
    const async=Object.getPrototypeOf((async function*(){}).prototype);
    const key='__rules_machine_security_probe__';
    return [sync,Object.getPrototypeOf(sync),async,Object.getPrototypeOf(async),Math].every(target=>{
      try {
        const failed=rejects(()=>lib.ruleFactory('target.'+key+'=1')({target}));
        return failed && !Object.hasOwn(target,key);
      } finally { Reflect.deleteProperty(target,key); }
    });
  });
  check('trace formatting never invokes error message getters', () => {
    let calls=0;
    const failure=new Error('original');
    Object.defineProperty(failure,'message',{get(){calls++;return 'hook';}});
    const executor=lib.createRuleExecutor({...lib.createExpressionEngine(),evaluate(){throw failure;}},{trace:true});
    let caught;
    try { executor.execute('1'); } catch(error) { caught=error; }
    return caught===failure && calls===0;
  });
  check('trace keys obey string limits', () =>
    rejects(()=>lib.ruleFactory('1',{trace:true,limits:{maxStringLength:100}})({['k'.repeat(101)]:1}),/maxStringLength/));
  return results;
}

const cjs=createRequire(import.meta.url)('../../dist/index.cjs');
const context=vm.createContext({performance});
vm.runInContext(readFileSync(new URL('../../dist/index.global.js',import.meta.url),'utf8'),context);
console.log(JSON.stringify({at:new Date().toISOString(),node:process.version,esm:securityContract(esm),cjs:securityContract(cjs),iife:vm.runInContext(`(${securityContract.toString()})(RulesMachine)`,context)},null,2));
