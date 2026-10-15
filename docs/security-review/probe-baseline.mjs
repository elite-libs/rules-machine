// Tiny bounded public-API before/after cases. Run with a 10-second watchdog.
import * as baseline from '../../.cache/wayfinder-followup/qualified-dist/index.mjs';
import * as candidate from '../../dist/index.mjs';
function observed(run){try{return{ok:true,result:run()};}catch(error){return{ok:false,error:error.name,message:error.message};}}
const results={};
for(const [arm,lib] of Object.entries({baseline,candidate})){
  const row={};
  let calls=0;
  const items=Object.assign([()=>{calls++;return 7;}],{isArgumentsArray:true});
  row.argumentMarker=observed(()=>lib.ruleFactory('ABS(OMIT("missing",items))')({items}));
  row.argumentMarker.hostCallbackCalls=calls;
  const engine=lib.createExpressionEngine({limits:{maxOperations:20}});
  row.coldCompilation={...observed(()=>engine.evaluateExpression(' '.repeat(1000)+'1',()=>undefined)),cacheEntries:engine.cacheStats().entries};
  calls=0;
  const metadata=Object.defineProperty({},'source',{get(){calls++;return '1';}});
  row.sourceAccessor={...observed(()=>lib.createExpressionEngine().evaluate(metadata,()=>undefined)),getterCalls:calls};
  const array=Object.preventExtensions([1,2,3]);
  row.atomicTruncation={...observed(()=>lib.ruleFactory(['items.length=0','THROW("stop")'],{atomic:true})({items:array})),length:array.length,ownSlots:Object.keys(array)};
  calls=0;
  const injected=Object.defineProperty({},'return',{enumerable:true,get(){calls++;return '9';}});
  const program=['program[1]=injected',{return:'1'}];
  row.ruleAlias={...observed(()=>lib.ruleFactory(program)({program,injected})),getterCalls:calls};
  row.nestedOmitPath=observed(()=>lib.ruleFactory('OMIT(paths,data)',{limits:{maxStringLength:30}})({paths:[[Array.from({length:20},()=> 'key')]],data:{}}));
  const input=Object.fromEntries(Array.from({length:1000},(_,i)=>['key'+i,i]));
  row.rootValidation=observed(()=>{lib.ruleFactory('changed=1',{limits:{maxOperations:100}})(input);return input.changed;});
  row.rootValidation.mutated=Object.hasOwn(input,'changed');
  const key='__rules_machine_security_probe__';
  row.intrinsicAliases=[];
  const async=Object.getPrototypeOf((async function*(){}).prototype);
  for(const target of [Object.prototype,Math,async,Object.getPrototypeOf(async)]){
    try{
      const outcome=observed(()=>{lib.ruleFactory('target.'+key+'=1')({target});return target[key];});
      row.intrinsicAliases.push({...outcome,mutated:Object.hasOwn(target,key)});
    }finally{Reflect.deleteProperty(target,key);}
  }
  results[arm]=row;
}
console.log(JSON.stringify({at:new Date().toISOString(),node:process.version,baseline:'ef4f3c5 runtime, qualified artifact9adecf3',candidate:'6cf27cc TypeScript',results},null,2));
