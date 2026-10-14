import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
const [modulePath,mode]=process.argv.slice(2);
const {ruleFactory}=await import(pathToFileURL(modulePath));
if(mode==='cold'){
 const count=1000;let completed=0;let checksum=0;
 const start=performance.now();
 for(let i=0;i<count;i++){const execute=ruleFactory('price * quantity + 1');const value=execute({price:17,quantity:3});if(value!==52)throw Error('cold oracle');checksum+=value;completed++;}
 console.log(JSON.stringify({mode,elapsedNs:(performance.now()-start)*1e6,completed,checksum}));
}else{
 if(!global.gc)throw Error('requires --expose-gc');
 const rules=['price + 0'];const execute=ruleFactory(rules);let completed=0;let checksum=0;
 const snapshots=[];let previous=0;
 for(const limit of [0,1000,5000,10000]){
  for(let i=previous;i<limit;i++){rules[0]=`price + ${i}`;const value=execute({price:17});if(value!==i+17)throw Error('unique source oracle');checksum+=value;completed++;}
  previous=limit;global.gc();snapshots.push({uniqueExpressions:limit,...process.memoryUsage()});
 }
 if(completed!==10000||checksum!==50165000)throw Error('memory workload count/digest');
 console.log(JSON.stringify({mode,completed,checksum,snapshots}));
}
