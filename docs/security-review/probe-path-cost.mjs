// Bounded child-process diagnostics: never leave a pathological regex in this process.
import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const modulePath = new URL('../../dist/index.mjs',import.meta.url).href;
const rows=[];
for(const repetitions of [1000,2000,4000,8000,16000]) {
 const source=`import {ruleFactory} from ${JSON.stringify(modulePath)};const key='["a'.repeat(${repetitions});const run=ruleFactory('GET(key, obj)');const at=performance.now();try{run({key,obj:{}});console.log(JSON.stringify({ms:performance.now()-at,ok:true}));}catch(e){console.log(JSON.stringify({ms:performance.now()-at,error:e.name,message:e.message}));}`;
 const result=spawnSync(process.execPath,['--input-type=module','-e',source],{encoding:'utf8',timeout:3000,maxBuffer:64*1024});
 rows.push({repetitions,keyCharacters:repetitions*3,status:result.status,signal:result.signal,error:result.error?.code,stdout:result.stdout,stderr:result.stderr});
 if(result.error?.code==='ETIMEDOUT')break;
}
writeFileSync(new URL('./evidence/path-cost-before.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),node:process.version,modulePath,scope:'diagnostic;3-second child watchdog per size',rows},null,2));console.log(rows);
