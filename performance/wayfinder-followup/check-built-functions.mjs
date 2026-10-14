import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {deepStrictEqual} from 'node:assert';
const [baselineArg,output]=process.argv.slice(2);
if(!baselineArg||!output)throw Error('Usage: check-built-functions.mjs BASELINE_MODULE OUTPUT');
const baseline=await import(pathToFileURL(resolve(baselineArg)));
const delivered=new Function(readFileSync('dist/index.global.js','utf8')+'\nreturn RulesMachine;')();
const language=readFileSync('src/expression-engine/language.ts','utf8');
const block=language.slice(language.indexOf('const prefixOps:'),language.indexOf('Object.keys(prefixOps).forEach'));
const names=[...block.matchAll(/^    ([A-Z][A-Z0-9_]*):/gm)].map(m=>m[1]);
if(names.length!==97)throw Error('Function inventory changed; review probe matrix');
const values=['0','1','-1','true','"a"','str','arr','obj'];
const argumentsList=['',...values];
for(const a of values)for(const b of values)argumentsList.push(`${a},${b}`);
argumentsList.push('true,1,2','1,2,3','0,2,arr','"ADD",0,arr','"a",1,obj','"a",obj,1','"x","y",str','"ABS",arr','"ISNAN",arr');
const input={obj:{a:1,b:2},arr:[1,2,3],str:'abc',pairs:[[1,2],[3,4]],dictPairs:[['a',1],['b',2]]};
function run(lib,expression){const value=structuredClone(input);try{return{ok:true,result:lib.ruleFactory(expression)(value),input:value}}catch(error){return{ok:false,error:{name:error?.name??typeof error,message:error?.message??String(error)},input:value}}}
const rows=[];for(const name of names){let successes=0;const probes=[...argumentsList,...(name==='UNZIP'?['pairs']:name==='UNZIPDICT'?['dictPairs']:[])];for(const args of probes){const expression=`${name}(${args})`,expected=run(baseline,expression),actual=run(delivered,expression);deepStrictEqual(actual,expected,expression);if(actual.ok)successes++;}rows.push({name,probes:probes.length,successfulDomainProbes:successes,passed:true});}
const result={at:new Date().toISOString(),node:process.version,scope:'Actual delivered minified IIFE executed in Node; baseline/final results, mutated inputs and error name/message compared across valid/invalid arities/domains. Not full function coverage or browser-process timing.',baseline:resolve(baselineArg),functions:names.length,probes:rows.reduce((n,r)=>n+r.probes,0),passed:true,rows};
writeFileSync(output,JSON.stringify(result,null,2));console.log(`${result.functions} functions / ${result.probes} built-IIFE probes pass`);
