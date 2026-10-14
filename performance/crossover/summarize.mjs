import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const out = resolve(process.argv[2]);
const data = JSON.parse(readFileSync(resolve(out, 'blocks.json'), 'utf8'));
if (data.blocks.length !== 12) throw Error('Requires 12 complete independent paired blocks');
let seed = 0x82746;
const random = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
const summary = [];
for (const initial of data.blocks[0].arms[0].rows) {
  const pairs = data.blocks.map(b => {
    const ts = b.arms.find(a => a.arm === 'ts').rows.find(r => r.name === initial.name);
    const rust = b.arms.find(a => a.arm === 'rust').rows.find(r => r.name === initial.name);
    if (!ts.supported || !rust.supported) return { supported: false, reason: rust.error || ts.error };
    if (ts.operations !== rust.operations || ts.operations < 1 || ts.checksum !== ts.expectedChecksum || rust.checksum !== rust.expectedChecksum) throw Error('Count/checksum gate failed');
    return { supported: true, ts, rust, ratio: rust.elapsedMs / ts.elapsedMs };
  });
  if (pairs.some(p => !p.supported)) { summary.push({ name: initial.name, supported: false, reason: pairs.find(p => !p.supported).reason }); continue; }
  const logs = pairs.map(p => Math.log(p.ratio));
  const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
  const boot = Array.from({ length: 10000 }, () => Math.exp(mean(logs.map(() => logs[random(logs.length)])))).sort((a, b) => a - b);
  summary.push({ name: initial.name, supported: true, axis: initial.axis,
    structuralDepth: initial.structuralDepth, jsonDepth: initial.jsonDepth, ruleNodeCount: initial.ruleNodeCount, shape: initial.shape, ruleJSONBytes: initial.ruleJSONBytes,
    taggedInputBytes: initial.taggedInputBytes, requestBytes: pairs[0].rust.requestBytes,
    computeRules: initial.computeRules, payloadBytes: initial.payloadBytes,
    iterationsPerBlock: pairs[0].ts.operations, rustOverTS: Math.exp(mean(logs)),
    pairedBootstrap95: [boot[249], boot[9749]], rustFasterBlocks: pairs.filter(p => p.ratio < 1).length,
    tsNsPerOperation: mean(pairs.map(p => p.ts.elapsedMs * 1e6 / p.ts.operations)),
    rustNsPerOperation: mean(pairs.map(p => p.rust.elapsedMs * 1e6 / p.rust.operations)) });
}
const result = { claimScope: 'Local prepared warm end-to-end serial workload sweep; ratios below one favor Rust. Not a universal byte/rule/layer crossover.',
  timingScope: 'Includes input/output copy boundaries and full JSON output checksum; excludes prepare/startup, initial/final complete oracle assertions and three warm calls.',
  node: data.node, at: data.at, summary };
writeFileSync(resolve(out, 'summary.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
