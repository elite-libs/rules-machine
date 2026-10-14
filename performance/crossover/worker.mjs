import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { deepStrictEqual } from 'node:assert';
import { readFileSync } from 'node:fs';
import { RustBridge } from '../../experiments/rusty-rules/bridge.mjs';
import { encode } from '../../experiments/rusty-rules/wire.mjs';
import { fixtures, checksum, expectedChecksum, ruleMetadata } from './fixtures.mjs';
const [arm, modulePath, binary, mode, countFile] = process.argv.slice(2);
if (!['ts', 'rust'].includes(arm) || !['oracle', 'pilot', 'measure'].includes(mode)) throw Error('Invalid worker mode');
const counts = countFile ? JSON.parse(readFileSync(countFile, 'utf8')) : {};
const { ruleFactory } = await import(pathToFileURL(modulePath));
const bridge = arm === 'rust' ? new RustBridge({ binary, timeoutMs: 10000 }) : undefined;
const rows = [];
try {
  for (const f of fixtures()) {
    const execute = arm === 'ts' ? ruleFactory(f.rules) : undefined;
    let program;
    if (bridge) {
      try { program = await bridge.prepare(f.rules); }
      catch (error) {
        // Public bridge rule sanitization uses the tagged wire depth40 bound.
        if (f.name !== 'layers-32-array' || !/depth/i.test(String(error.message))) throw error;
        rows.push({ name: f.name, axis: f.axis, supported: false,
          structuralDepth: f.structuralDepth, shape: f.shape, ...ruleMetadata(f.rules), error: String(error.message), operations: 0 });
        continue;
      }
    }
    const run = () => {
      if (bridge) return bridge.run(program, f.input);
      // Isolate caller-owned input once. Mutated input and scalar result are
      // already caller-owned; the bridge returns its decoded owned copy.
      const input = structuredClone(f.input);
      return { result: execute(input), input };
    };
    deepStrictEqual(await run(), f.expected);
    // Identical preparation/warm count in both arms; no cold compilation timing.
    for (let i = 0; i < 3; i++) deepStrictEqual(await run(), f.expected);
    let count = mode === 'measure' ? counts[f.name] : 1;
    let elapsedMs = 0, actualCount = 0, actualChecksum = 0;
    const batch = async n => {
      const start = performance.now();
      let sum = 0;
      for (let i = 0; i < n; i++) sum = (sum + checksum(await run())) >>> 0;
      const elapsed = performance.now() - start;
      if (sum !== expectedChecksum(f.expected, n)) throw Error(`Timed output mismatch ${f.name}`);
      return { elapsed, sum };
    };
    if (mode === 'pilot') {
      // TS baseline alone determines fixed paired-arm confirmation iterations.
      for (;;) { const b = await batch(count); elapsedMs = b.elapsed; actualChecksum = b.sum; actualCount = count;
        if (elapsedMs >= 20 || count === 2048) break;
        count = Math.min(2048, count * 2);
      }
    } else if (mode === 'measure') {
      if (!Number.isSafeInteger(count) || count < 1 || count > 2048) throw Error('Invalid fixed count');
      const b = await batch(count); elapsedMs = b.elapsed; actualChecksum = b.sum; actualCount = count;
    }
    deepStrictEqual(await run(), f.expected);
    rows.push({ name: f.name, axis: f.axis, supported: true, shape: f.shape, ...ruleMetadata(f.rules), expressionCount: f.expressionCount,
      structuralDepth: f.structuralDepth, computeRules: f.computeRules, payloadBytes: f.payloadBytes,
      ruleJSONBytes: Buffer.byteLength(JSON.stringify(f.rules)),
      taggedInputBytes: Buffer.byteLength(JSON.stringify(encode(f.input))),
      // Fixed representative identifier; actual IDs differ only by a few decimal bytes.
      requestBytes: Buffer.byteLength(JSON.stringify({ id: 1, op: 'run', program, input: encode(f.input), options: {} }) + '\n'),
      elapsedMs, operations: actualCount, checksum: actualChecksum,
      expectedChecksum: expectedChecksum(f.expected, actualCount), iterations: count });
    if (bridge) await bridge.release(program);
  }
  console.log(JSON.stringify({ arm, mode, node: process.version, rows, rss: process.memoryUsage().rss }));
} finally { await bridge?.close(); }
