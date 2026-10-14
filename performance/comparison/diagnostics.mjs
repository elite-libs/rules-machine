import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
const [baseline,upgrade,tuned,output]=process.argv.slice(2);
const raw=[];
for(const [arm,path] of Object.entries({baseline,upgrade,tuned}))for(const mode of ['cold','memory'])for(let block=0;block<(mode==='cold'?3:1);block++){
 const child=spawnSync(process.execPath,['--expose-gc',resolve('performance/comparison/diagnostic-worker.mjs'),path,mode],{encoding:'utf8'});
 if(child.error||child.status!==0)throw Error(String(child.error||child.stderr));const data=JSON.parse(child.stdout);raw.push({arm,block,...data});
}
writeFileSync(output,JSON.stringify({at:new Date().toISOString(),classification:'Diagnostic only; additional workloads not acceptance confirmation. Cold=1000 factories+one evaluation each; memory=one mutable rule program over unique sources, explicit full GC snapshots. Three independent cold processes, one memory process per arm; Node only.',raw},null,2));console.log(JSON.stringify(raw,null,2));
