import {digest} from '../comparison/digest.mjs';
import {fixtures, expected, normalizeInput} from '../comparison/fixtures.mjs';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import {deepStrictEqual} from 'node:assert';
const [modulePath,name,count='1',warm='0',skip='false']=process.argv.slice(2);
const {ruleFactory}=await import(pathToFileURL(modulePath));
const fixture=fixtures.find(f=>f.name===name);if(!fixture)throw Error('unknown fixture');
const execute=ruleFactory(fixture.rules);
function outputs(){return fixture.inputs.map(value=>{const input=structuredClone(value);return{result:execute(input),input:normalizeInput(input,fixture)}})}
const oracle=expected(fixture);deepStrictEqual(outputs(),oracle);
let checksum=0,completed=0;
function batch(n,skipFirst=false){for(let i=0;i<n;i++)for(let j=0;j<fixture.inputs.length;j++){
 if(skipFirst&&i===0&&j===0)continue;
 const input=structuredClone(fixture.inputs[j]);checksum=(checksum+Math.imul(digest(execute(input)),j+1))>>>0;completed++;
}}
const warmStart=performance.now();let warmBatches=0;
do{batch(Math.max(1,Number(warm)));warmBatches+=Math.max(1,Number(warm))}while(performance.now()-warmStart<250);
const warmElapsedMs=performance.now()-warmStart;
checksum=0;completed=0;const start=performance.now();batch(Number(count),skip==='true');const elapsedNs=(performance.now()-start)*1e6;
const operations=completed,timedChecksum=checksum;deepStrictEqual(outputs(),oracle);
console.log(JSON.stringify({outputs:oracle,elapsedNs,operations,checksum:timedChecksum,rss:process.memoryUsage().rss,warmBatches,warmElapsedMs}));
