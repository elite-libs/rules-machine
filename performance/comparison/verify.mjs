import { spawnSync } from 'node:child_process';
import { deepStrictEqual, ok } from 'node:assert';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fixtures, expected, normalizeInput } from './fixtures.mjs';
const modulePath=resolve(process.argv[2]||'dist/index.js');
const rust=resolve(process.argv[3]||'experiments/rusty-rules/target/release/rusty-rules-experiment');
const {ruleFactory}=await import(pathToFileURL(modulePath));
function rustRun(request){const child=spawnSync(rust,['--once'],{input:JSON.stringify(request)+'\n',timeout:10000,encoding:'utf8',maxBuffer:32*1024*1024});if(child.error||child.status!==0)throw Error(String(child.error||child.stderr));return JSON.parse(child.stdout);}
function check(rules,inputs,oracle){const execute=ruleFactory(rules);const js=inputs.map(input=>{input=structuredClone(input);return {result:execute(input),input};});const rs=rustRun({rules,inputs,iterations:1});if(rs.error)throw Error(rs.error);deepStrictEqual(rs.outputs,js);if(oracle)deepStrictEqual(js,oracle);}
for(const fixture of fixtures){console.error(fixture.name);const execute=ruleFactory(fixture.rules);const outputs=fixture.inputs.map(input=>{input=structuredClone(input);const result=execute(input);return {result,input:normalizeInput(input,fixture)};});deepStrictEqual(outputs,expected(fixture),fixture.name);if(fixture.shared)check(fixture.rules,fixture.inputs,expected(fixture));}
// Deterministic held-out arithmetic/branch/path cases, distinct from timed fixtures.
let seed=0x12345678;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;}
for(let i=0;i<100;i++){const a=random()%100,b=random()%30+1,c=random()%20;check(['out = (nested.a + b) * 2 - c', {if:'(out >= 50) AND (b != 0)',then:'out = out / 2',else:'out = out % 7'},{return:'out'}],[{nested:{a},b,c}]);}
for(const rules of ['a += 2','DATE(1)','a[0]','null','constructor.x',{map:'items',run:'$item'},'x = 1 / 0']){ok(rustRun({rules,inputs:[{a:1,x:0,items:[]}]}).error,`must reject ${JSON.stringify(rules)}`);}
check('false AND absent > 2',[{}]);check('true OR absent > 2',[{}]);
console.log('Validated all frozen oracles, 100 held-out differential cases, short circuit and explicit unsupported-case rejection.');
