import { digest } from './digest.mjs';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { fixtures, normalizeInput } from './fixtures.mjs';
const [modulePath, name, count='1', warm='0',skip='false'] = process.argv.slice(2);
const { ruleFactory } = await import(pathToFileURL(modulePath));
const fixture=fixtures.find(f=>f.name===name);if(!fixture)throw Error('unknown fixture');
const execute=ruleFactory(fixture.rules);
const outputs=fixture.inputs.map(input=>{input=structuredClone(input);const result=execute(input);return {result,input:normalizeInput(input,fixture)};});
let checksum=0;let completed=0;
function batch(iterations, skipFirst=false){for(let i=0;i<iterations;i++)for(let j=0;j<fixture.inputs.length;j++){if(skipFirst&&i===0&&j===0)continue;const input=structuredClone(fixture.inputs[j]);const result=execute(input);checksum=(checksum+Math.imul(digest(result),j+1))>>>0;completed++;}}
batch(Number(warm));checksum=0;completed=0;const start=performance.now();batch(Number(count),skip==='true');const elapsedNs=(performance.now()-start)*1e6;
console.log(JSON.stringify({outputs,elapsedNs,operations:completed,checksum,rss:process.memoryUsage().rss}));
