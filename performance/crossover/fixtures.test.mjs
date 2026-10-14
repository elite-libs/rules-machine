import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { fixtures, checksum, expectedChecksum, ruleMetadata } from './fixtures.mjs';
test('sweep axes and mathematical mutation oracles are fixed', () => {
  const all = fixtures();
  assert.equal(all.length, 15);
  assert.equal(new Set(all.map(f => f.name)).size, 15);
  assert.deepEqual(all.filter(f => f.axis === 'rules').map(f => f.computeRules), [1,4,16,64,256,1024]);
  for (const f of all) {
    assert.equal(f.input.x, 0);
    assert.equal(f.input.payload.length, f.payloadBytes);
    if (f.axis !== 'layers') {
      assert.equal(f.rules.length, f.computeRules + 1);
      assert.equal(f.expected.result, f.computeRules);
      assert.equal(f.expected.input.x, f.computeRules);
    } else {
      let cursor = f.rules[0], depth = 1;
      while (cursor.if) { assert.equal(cursor.if, 'true'); cursor = Array.isArray(cursor.then) ? cursor.then[0] : cursor.then; depth++; }
      assert.deepEqual(cursor, { return: '1' });
      assert.equal(depth, f.structuralDepth);
      assert.equal(f.expected.input.x, 0);
    }
  }
});
test('checksum sees mutations and complete payload, count sum is unsigned', () => {
  const a = { result: 1, input: { x: 1, payload: 'abc' } };
  assert.equal(checksum(a), checksum({ input: { payload: 'abc', x: 1 }, result: 1 }));
  assert.notEqual(checksum(a), checksum({ ...a, input: { ...a.input, payload: 'axc' } }));
  assert.notEqual(checksum(a), checksum({ ...a, input: { ...a.input, x: 2 } }));
  let sum = 0;
  for (let i = 0; i < 2048; i++) sum = (sum + checksum(a)) >>> 0;
  assert.equal(sum, expectedChecksum(a, 2048));
});

test('depth metadata distinguishes object and array conditional shapes', () => {
 const all = fixtures();
 assert.deepEqual(ruleMetadata(all.find(f => f.name === 'layers-32').rules), { jsonDepth: 34, ruleNodeCount: 34 });
 assert.deepEqual(ruleMetadata(all.find(f => f.name === 'layers-32-array').rules), { jsonDepth: 66, ruleNodeCount: 66 });
});
