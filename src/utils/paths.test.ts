import { describe, expect, test } from 'vitest';
import {
  ExecutionBudget,
  ResourceLimitError,
  withExecutionBudget,
} from './budget';
import { withAtomicWrites } from './mutations';
import { getOwnPath, setOwnPath } from './paths';

describe('own data paths', () => {
  test('reads own dotted and bracket paths without exposing prototypes', () => {
    expect(getOwnPath({ 'a.b': 2 }, 'a.b')).toBe(2);
    expect(getOwnPath({ a: [{ b: null }] }, 'a[0].b')).toBe(null);
    expect(getOwnPath({}, 'toString')).toBeUndefined();
    expect(getOwnPath({ a: {} }, 'a.constructor')).toBeUndefined();
  });
  test('creates arrays and never traverses an inherited object', () => {
    const inherited = { nested: { value: 1 } };
    const input = Object.create(inherited);
    setOwnPath(input, 'nested.value', 2);
    expect(inherited.nested.value).toBe(1);
    expect(input.nested.value).toBe(2);
    setOwnPath(input, 'items[0].value', 3);
    expect(input.items).toEqual([{ value: 3 }]);
  });
  test('writes the same exact dotted own key that reads resolve', () => {
    const input = { 'a.b': 1, a: { b: 10 } };
    setOwnPath(input, 'a.b', 3);
    expect(input['a.b']).toBe(3);
    expect(input.a.b).toBe(10);
  });
  test('preserves existing descriptors including array length', () => {
    const input = { items: [1, 2, 3] };
    setOwnPath(input, 'items.length', 1);
    expect(input.items).toEqual([1]);
    let called = false;
    Object.defineProperty(input, 'setter', {
      set() {
        called = true;
      },
    });
    expect(() => setOwnPath(input, 'setter', 2)).toThrow('accessor');
    expect(called).toBe(false);
  });
  test.each([
    '__proto__.bad',
    'a.constructor.bad',
    'a["prototype"].bad',
  ])('rejects %s', (path) => {
    expect(() => setOwnPath({}, path, true)).toThrow('Unsafe assignment path');
  });
});

// Accessor and host-object boundaries must be checked without invoking user code.
describe('descriptor-only path access', () => {
  test('rejects exact and nested getter reads and writes without invocation', () => {
    let calls = 0;
    const nested = Object.defineProperty({}, 'secret', {
      get() {
        calls++;
        return {};
      },
      enumerable: true,
    });
    const input = { nested };
    expect(() => getOwnPath(input, 'nested.secret')).toThrow(/accessor/);
    expect(() => setOwnPath(input, 'nested.secret.child', 1)).toThrow(
      /accessor/,
    );
    expect(() => setOwnPath(input, 'nested.secret', 1)).toThrow(/accessor/);
    expect(calls).toBe(0);
    const direct = Object.defineProperty({}, 'a.b', {
      get() {
        calls++;
        return 1;
      },
    });
    expect(() => getOwnPath(direct, 'a.b')).toThrow(/accessor/);
    expect(calls).toBe(0);
  });

  test('returns host values by identity and rejects traversing or overwriting function parents', () => {
    const fn = () => 1;
    const date = new Date(0);
    expect(getOwnPath({ fn, date }, 'fn')).toBe(fn);
    expect(getOwnPath({ fn, date }, 'date')).toBe(date);
    expect(() => getOwnPath({ fn }, 'fn.name')).toThrow(/host function/);
    expect(() => getOwnPath({ date }, 'date.anything')).toThrow(/opaque/);
    const input = { fn };
    expect(() => setOwnPath(input, 'fn.value', 1)).toThrow(/host function/);
    expect(input.fn).toBe(fn);
    expect(() => setOwnPath({ date }, 'date.value', 1)).toThrow(/opaque/);
  });

  test('supports frozen reads and reports readonly writes without mutation', () => {
    const input = Object.freeze({ nested: Object.freeze({ value: null }) });
    expect(getOwnPath(input, 'nested.value')).toBeNull();
    expect(() => setOwnPath(input, 'nested.value', 1)).toThrow(/readonly/);
    expect(input.nested.value).toBeNull();
  });
});

describe('bounded array writes', () => {
  test('rejects length coercion without invoking host methods', () => {
    let calls = 0;
    const length = {
      valueOf() {
        calls++;
        return 1;
      },
    };
    const input = { values: [1, 2] };
    expect(() => setOwnPath(input, 'values.length', length)).toThrow(
      /nonnegative integer/,
    );
    expect(calls).toBe(0);
    expect(input.values).toEqual([1, 2]);
  });

  test('validates ordinary numeric array lengths', () => {
    for (const value of [-1, 1.5, NaN, Infinity, 0x100000000]) {
      expect(() =>
        setOwnPath({ values: [1, 2] }, 'values.length', value),
      ).toThrow(/nonnegative integer/);
    }
    const input = { values: [1, 2] };
    setOwnPath(input, 'values.length', 1);
    expect(input.values).toEqual([1]);
  });
});

test('bounds sparse index and length writes before mutation', () => {
  const input = { values: [1] };
  for (const path of ['values[1000]', 'values.length']) {
    expect(() =>
      withExecutionBudget(new ExecutionBudget({ maxArrayLength: 2 }), () =>
        setOwnPath(input, path, path.endsWith('length') ? 1000 : 2),
      ),
    ).toThrow(ResourceLimitError);
    expect(input.values).toEqual([1]);
  }
  withExecutionBudget(new ExecutionBudget({ maxArrayLength: 2 }), () =>
    setOwnPath(input, 'values.01', 4),
  );
  expect(input.values.length).toBe(1);
  expect(getOwnPath(input, 'values.01')).toBe(4);
});

test('journals descriptors and array length changes for atomic rollback', () => {
  const values = [1, 2, 3];
  const input = { values, alias: values };
  expect(() =>
    withAtomicWrites(() => {
      setOwnPath(input, 'values.length', 1);
      setOwnPath(input, 'values[5]', 9);
      setOwnPath(input, 'added.deep', 1);
      throw new Error('rollback');
    }),
  ).toThrow('rollback');
  expect(input.values).toBe(values);
  expect(input.alias).toBe(values);
  expect(values).toEqual([1, 2, 3]);
  expect(input).not.toHaveProperty('added');
});

test('bounds traversed path depth before reading or writing', () => {
  const input = { nested: { value: 1 } };
  expect(() =>
    withExecutionBudget(new ExecutionBudget({ maxDataDepth: 1 }), () =>
      getOwnPath(input, 'nested.value'),
    ),
  ).toThrow(/maxDataDepth/);
  expect(() =>
    withExecutionBudget(new ExecutionBudget({ maxDataDepth: 1 }), () =>
      setOwnPath(input, 'added.value', 2),
    ),
  ).toThrow(/maxDataDepth/);
  expect(input).not.toHaveProperty('added');
  expect(
    withExecutionBudget(new ExecutionBudget({ maxDataDepth: 1 }), () =>
      getOwnPath({ 'nested.value': 3 }, 'nested.value'),
    ),
  ).toBe(3);
});
