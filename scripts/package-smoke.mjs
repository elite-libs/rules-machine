import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = mkdtempSync(join(tmpdir(), 'rules-machine-package-'));
try {
  // Resolve the actual packed exports from an external consumer.
  const packed = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', directory], { cwd: root, encoding: 'utf8' }))[0];
  execFileSync('tar', ['-xzf', join(directory, packed.filename), '-C', directory]);
  const packageRoot = join(directory, 'package');
  symlinkSync(join(root, 'node_modules'), join(packageRoot, 'node_modules'), 'dir');
  mkdirSync(join(directory, 'node_modules', '@elite-libs'), { recursive: true });
  symlinkSync(packageRoot, join(directory, 'node_modules', '@elite-libs', 'rules-machine'), 'dir');
  writeFileSync(join(directory, 'consumer.mjs'), `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    import * as esm from '@elite-libs/rules-machine';
    const cjs = createRequire(import.meta.url)('@elite-libs/rules-machine');
    for (const {ruleFactory} of [esm,cjs]) {
      assert.equal(ruleFactory(['answer=42',{return:'answer'}])({}),42);
      assert.equal(ruleFactory('value')({value:null}),null);
      assert.equal(ruleFactory('value == null')({value:null}),true);
      assert.equal(ruleFactory([{if:'true',then:{return:'1'}},{return:'2'}])({}),1);
    }
  `);
  execFileSync(process.execPath, [join(directory, 'consumer.mjs')], { stdio: 'inherit' });
  const context = vm.createContext({ performance, console });
  vm.runInContext(readFileSync(join(packageRoot, 'dist/index.global.js'), 'utf8'), context);
  assert.equal(vm.runInContext(`RulesMachine.ruleFactory(['x=2',{return:'x * 3'}])({})`, context), 6);
  assert.equal(vm.runInContext(`RulesMachine.ruleFactory('value')({value:null})`, context), null);
  const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
  assert.ok(readFileSync(join(packageRoot, manifest.types), 'utf8').includes('ruleFactory'));
  writeFileSync(join(directory, 'consumer.mts'), `
    import { ruleFactory, createExpressionEngine, ResourceLimitError,
      type ExecutionResult, type RuleMachineOptions } from '@elite-libs/rules-machine';
    const plain: number = ruleFactory('1')<number>({});
    interface Invoice { subtotal: number; customer: { tier: string } }
    const typed: number = ruleFactory<Invoice>('subtotal')<number>({
      subtotal: 42, customer: {tier: 'gold'},
    });
    const traced: ExecutionResult<{x: number}> & {lastValue: number} =
      ruleFactory<{x: number}>('x', {trace: true})<number>({x: 1});
    const options: RuleMachineOptions = {trace: Math.random() > 0.5,
      atomic: true, limits: {maxStringLength: 1000}};
    const dynamic: number | ExecutionResult<Record<string, unknown>> =
      ruleFactory('1', options)<number>({});
    const retainedBytes: number = createExpressionEngine().cacheStats().estimatedBytes;
    const error: Error = new ResourceLimitError('limited');
    // @ts-expect-error Traced results are not plain numeric results.
    const invalid: number = ruleFactory('1', {trace: true})<number>({});
    void [plain, typed, traced, dynamic, retainedBytes, error, invalid];
  `);
  execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'),
    '--noEmit', '--strict', '--skipLibCheck', '--module', 'NodeNext',
    '--moduleResolution', 'NodeNext', '--target', 'ES2022',
    join(directory, 'consumer.mts')], {stdio: 'inherit'});
  console.log('Packed ESM, CommonJS, browser-global and declaration smoke checks passed.');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
