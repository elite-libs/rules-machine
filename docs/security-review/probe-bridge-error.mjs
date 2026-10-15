// Bounded child-process reproduction: malformed owned-worker output must reject
// requests instead of throwing out of a stdout event handler and crashing Node.
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const bridge = pathToFileURL(resolve('experiments/rusty-rules/bridge.mjs')).href;
const worker = 'process.stdin.once("data",()=>process.stdout.write(JSON.stringify({id:1,error:{code:"RULE_ERROR",message:{toString:null,valueOf:null}}})+"\\n"));';
const source = `import {RustBridge} from ${JSON.stringify(bridge)};
const bridge=new RustBridge({binary:process.execPath,args:['-e',${JSON.stringify(worker)}],timeoutMs:1000});
try{await bridge.stats();process.exitCode=2;}catch(error){console.log(error.code);process.exitCode=error.code==='INVALID_RESPONSE'?0:3;}finally{await bridge.close();}`;
const child = spawnSync(process.execPath, ['--input-type=module', '-e', source], { timeout: 3000, encoding: 'utf8' });
console.log(JSON.stringify({ status: child.status, signal: child.signal, error: child.error?.message, stdout: child.stdout, stderr: child.stderr }, null, 2));
process.exitCode = child.status === 0 ? 0 : 1;
