import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const [mode, moduleArg, binaryArg, outArg] = process.argv.slice(2);
if (!['oracle', 'pilot', 'confirm'].includes(mode) || !outArg) throw Error('Usage: node run.mjs oracle|pilot|confirm MODULE BINARY OUT');
const modulePath = resolve(moduleArg), binary = resolve(binaryArg), out = resolve(outArg);
mkdirSync(out, { recursive: true });
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const provenance = { at: new Date().toISOString(), node: process.version,
  execPath: process.execPath, platform: process.platform, arch: process.arch,
  modulePath, moduleSHA256: hash(modulePath), binary, binarySHA256: hash(binary) };
writeFileSync(resolve(out, `${mode}-provenance.json`), JSON.stringify(provenance, null, 2));
function worker(arm, action, counts) {
  return new Promise((accept, reject) => {
    const child = spawn(process.execPath, [resolve(here, 'worker.mjs'), arm, modulePath, binary, action, ...(counts ? [counts] : [])], { stdio: ['ignore', 'pipe', 'pipe'] });
    let text = '', errors = '';
    child.stdout.on('data', x => text += x); child.stderr.on('data', x => errors += x);
    child.on('error', reject); child.on('exit', code => {
      if (code) reject(Error(`Worker ${arm} exited ${code}: ${errors}`));
      else { try { accept(JSON.parse(text)); } catch (e) { reject(e); } }
    });
  });
}
if (mode === 'oracle') {
  const rows = [];
  for (const arm of ['ts', 'rust']) rows.push(await worker(arm, 'oracle'));
  writeFileSync(resolve(out, 'oracle.json'), JSON.stringify(rows, null, 2));
} else if (mode === 'pilot') {
  const pilot = await worker('ts', 'pilot');
  writeFileSync(resolve(out, 'pilot.json'), JSON.stringify(pilot, null, 2));
  writeFileSync(resolve(out, 'counts.json'), JSON.stringify(Object.fromEntries(pilot.rows.map(r => [r.name, r.iterations])), null, 2));
} else {
  const pilotProvenance = JSON.parse(readFileSync(resolve(out, 'pilot-provenance.json'), 'utf8'));
  for (const key of ['node', 'execPath', 'moduleSHA256', 'binarySHA256']) {
    if (pilotProvenance[key] !== provenance[key]) throw Error(`Pilot provenance changed: ${key}; rerun pilot`);
  }
  const blocks = [];
  for (let block = 0; block < 12; block++) {
    const order = block % 2 ? ['rust', 'ts'] : ['ts', 'rust'];
    const arms = [];
    for (const arm of order) arms.push(await worker(arm, 'measure', resolve(out, 'counts.json')));
    blocks.push({ block, order, arms });
    writeFileSync(resolve(out, 'blocks.json'), JSON.stringify({ at: new Date().toISOString(), node: process.version, blocks }, null, 2));
    console.error(`Completed paired block ${block + 1}/12`);
  }
}
