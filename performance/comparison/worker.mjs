import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { fixtures } from './fixtures.mjs';
const [modulePath, name, count='1', warm='0'] = process.argv.slice(2);
const { ruleFactory } = await import(pathToFileURL(modulePath));
const fixture=fixtures.find(f=>f.name===name);if(!fixture)throw Error('unknown fixture');
const execute=ruleFactory(fixture.rules);
const outputs=fixture.inputs.map(input=>{input=structuredClone(input);return {result:execute(input),input};});
let checksum=0;
function batch(iterations){for(let i=0;i<iterations;i++)for(const source of fixture.inputs){const input=structuredClone(source);const result=execute(input);checksum+=typeof result==='number'?result:result===true?1:0;}}
batch(Number(warm));checksum=0;const start=performance.now();batch(Number(count));const elapsedNs=(performance.now()-start)*1e6;
console.log(JSON.stringify({outputs,elapsedNs,operations:Number(count)*fixture.inputs.length,checksum,rss:process.memoryUsage().rss}));
