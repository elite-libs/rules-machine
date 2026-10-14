import { describe, expect, test } from 'vitest';
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
  test.each([
    '__proto__.bad',
    'a.constructor.bad',
    'a["prototype"].bad',
  ])('rejects %s', (path) => {
    expect(() => setOwnPath({}, path, true)).toThrow('Unsafe assignment path');
  });
});
