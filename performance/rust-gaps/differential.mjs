import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {deepStrictEqual} from 'node:assert';
import {RustBridge} from '../../experiments/rusty-rules/bridge.mjs';
import {decode,encode} from '../../experiments/rusty-rules/wire.mjs';
import {fixtures,expected} from '../comparison/fixtures.mjs';
const [modulePath='/home/dan/code/oss/rules-machine/dist/index.mjs',binaryPath='experiments/rusty-rules/target/release/rusty-rules-experiment',output='performance/rust-gaps/artifacts']=process.argv.slice(2);
const spec=JSON.parse(readFileSync(new URL('./spec.json',import.meta.url)));const {ruleFactory}=await import(pathToFileURL(resolve(modulePath)));const bridge=new RustBridge({binary:resolve(binaryPath)});const results=[];
function normalize(value){return encode(value);}
async function check(test,feature){const input=test.inputWire?decode(test.inputWire):structuredClone(test.input||{});let js,jsError,rs,rsError;try{const value=structuredClone(input);js={result:ruleFactory(test.rules,test.options)(value),input:value};}catch(e){jsError=e.message;}try{rs=await bridge.execute(test.rules,input,{options:test.options});}catch(e){rsError=e.message;}
 const pass=!!jsError===!!rsError&&(!jsError&&(()=>{try{deepStrictEqual(rs,js);return true;}catch{return false;}})()||!!jsError);
 results.push({feature,name:test.name,rules:test.rules,input:encode(input),pass,jsError,rsError,...(!pass?{js:js?encode(js):undefined,rs:rs?encode(rs):undefined}:{})});if(!pass)process.stderr.write(`FAIL ${feature}/${test.name}\n`);
}
try{
for(const fn of spec.supportedFunctions)await check({name:fn.name,rules:fn.expression,input:{obj:{a:1,b:2}}},'function');
for(const feature of spec.supported)for(const test of feature.cases)await check(test,feature.feature);
// Distinct serializable program trees and expressions across deterministic families.
let seed=0x92743;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
for(let i=0;i<240;i++){const a=rand()%20,b=rand()%7+1,c=rand()%9;let rules,input={a,b,c,items:[a,b,c]};switch(i%12){
case 0:rules=[`out = (a + ${b}) * ${c+1}`,{return:'out'}];break;
case 1:rules={if:{and:[`a >= ${a%5}`,{or:['false',`b <= ${b+1}`]}]},then:`out=${a+b}`,else:`out=${c}`};break;
case 2:rules=[[`${a}+${b}`,`${c}*2`]];break;
case 3:rules=[{if:`a >= ${a}`,then:[{return:`a + ${b}`},'wrong=1']},'wrong=2'];break;
case 4:rules=[{map:'items',run:`$item * ${b} + ${c}`,set:'out'},{return:'out'}];break;
case 5:rules={filter:'items',run:`$item >= ${c}`};break;
case 6:rules={[['every','some','find'][Math.floor(i/12)%3]]:'items',run:`$item < ${b+c}`};break;
case 7:rules={try:`ADD("bad${a}", ${b})`,catch:`out=${c}`};break;
case 8:rules=[`nested.value = -${a}`,`nested.value += ${b}`,{return:'nested.value'}];break;
case 9:rules=`[MIN([${a},${b},${c}]), MAX([${a},${b},${c}]), RANGE(0,${b})]`;break;
case 10:rules=[`out = missing`,{if:'out == null',then:'out=1',else:`out=${c}`},{return:'[out, missing, NULL]'}];break;
case 11:rules=`[${a} > ${b}, TRUE or FALSE and FALSE, ABS(-${c})]`;break;}
await check({name:`generated-${i}`,rules,input},`generated-family-${i%12}`);}
for(const fixture of fixtures){for(let i=0;i<Math.min(fixture.inputs.length,3);i++)await check({name:`${fixture.name}-${i}`,rules:fixture.rules,input:fixture.inputs[i]},'frozen-benchmark-fixtures');}
const language=readFileSync(new URL('../../src/expression-engine/language.ts',import.meta.url),'utf8');
const functionBlock=language.slice(language.indexOf('const prefixOps:'),language.indexOf('Object.keys(prefixOps).forEach'));
const knownFunctions=[...functionBlock.matchAll(/^    ([A-Z][A-Z0-9_]*):/gm)].map(m=>m[1]);
const supportedNames=new Set(spec.supportedFunctions.map(f=>f.name));
for(const name of knownFunctions.filter(n=>!supportedNames.has(n))){let rejected=false;try{await bridge.prepare(`${name}(1)`);}catch{rejected=true;}results.push({feature:'function-rejection',name,pass:rejected});}
for(const test of spec.unsupported){let rejected=false;try{await bridge.execute(test.rules,{obj:{x:1},items:[1]}, {options:test.options});}catch{rejected=true;}results.push({feature:test.feature,name:'explicit-rejection',pass:rejected});}
}finally{await bridge.close();}
mkdirSync(output,{recursive:true});const summary={at:new Date().toISOString(),node:process.version,specVersion:spec.version,specSha256:createHash('sha256').update(readFileSync(new URL('./spec.json',import.meta.url))).digest('hex'),modulePath:resolve(modulePath),moduleSha256:createHash('sha256').update(readFileSync(modulePath)).digest('hex'),binaryPath:resolve(binaryPath),binarySha256:createHash('sha256').update(readFileSync(binaryPath)).digest('hex'),cases:results.length,uniquePrograms:new Set(results.filter(r=>r.rules!==undefined).map(r=>JSON.stringify(r.rules))).size,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results};writeFileSync(resolve(output,'differential.json'),JSON.stringify(summary,null,2));console.log(`${summary.passed}/${summary.cases} pass; ${summary.failed} differences`);if(summary.failed)process.exitCode=1;
