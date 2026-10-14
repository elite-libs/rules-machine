import { describe, expect, test } from 'vitest';
import { ruleFactory } from '../index';

describe('language correctness and resource bounds', () => {
  test('supports singleton numeric and string array literals', () => {
    expect(ruleFactory('[1]')()).toEqual([1]);
    expect(ruleFactory('["potion"]')()).toEqual(['potion']);
  });
  test('equality binds before OR and assignment binds after boolean operations', () => {
    expect(
      ruleFactory('income - debt > 25000 OR region == "west"')({
        income: 60_000,
        debt: 0,
        region: 'east',
      }),
    ).toBe(true);
    const input = { result: false };
    ruleFactory('result = true OR false')(input);
    expect(input.result).toBe(true);
  });
  test('COSH computes hyperbolic cosine away from zero', () => {
    expect(ruleFactory('COSH(1)')()).toBeCloseTo(Math.cosh(1));
  });
  test.each([
    -2,
    0,
    1,
    2.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])('rejects non-prime domain %s', (n) => {
    expect(ruleFactory('ISPRIME(n)')({ n })).toBe(false);
  });
  test('bounds primality work and range allocations', () => {
    expect(() => ruleFactory('ISPRIME(n)')({ n: 1_000_000_000_001 })).toThrow(
      'ISPRIME supports',
    );
    for (const [start, end] of [
      [0, Number.POSITIVE_INFINITY],
      [0, 100_001],
      [0.5, 2],
      [2 ** 53, 2 ** 53 + 2],
    ]) {
      expect(() => ruleFactory('RANGE(start, end)')({ start, end })).toThrow(
        'RANGE',
      );
    }
    expect(ruleFactory('RANGE(3, 1)')()).toEqual([]);
  });
  test.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    0.5,
  ])('GCD rejects non-integers %s', (n) => {
    expect(() => ruleFactory('GCD(n, 1)')({ n })).toThrow('GCD expects');
  });
  test('GCD supports zero and signed arguments', () => {
    expect(ruleFactory('GCD(0, 0)')()).toBe(0);
    expect(ruleFactory('GCD(-54, 24)')()).toBe(6);
  });
  test.each([
    'TAKEWHILE',
    'DROPWHILE',
  ])('%s never evaluates beyond the end', (name) => {
    expect(
      ruleFactory(`${name}(predicate, items)`)({
        predicate: 'ISPRIME',
        items: [],
      }),
    ).toEqual([]);
    expect(
      ruleFactory(`${name}(predicate, items)`)({
        predicate: 'ISPRIME',
        items: [2, 3],
      }),
    ).toEqual(name === 'TAKEWHILE' ? [2, 3] : []);
  });
  test('dictionary keys remain ordinary own data without prototype changes', () => {
    // Call through the public rules path, including parser array normalization.
    const value = ruleFactory('DICT(keys, vals)')({
      keys: ['__proto__', 'constructor'],
      vals: [{ polluted: true }, 2],
    }) as object;
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
    expect(Object.hasOwn(value, '__proto__')).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  test('PUT copies __proto__ as data and GET ignores inherited properties', () => {
    const source = JSON.parse('{"__proto__":{"polluted":true},"x":1}');
    const value = ruleFactory('PUT("y", 2, source)')({ source }) as object;
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
    expect(Object.hasOwn(value, '__proto__')).toBe(true);
    expect(
      ruleFactory('GET("toString", source)')({ source: {} }),
    ).toBeUndefined();
  });
  test('partial numeric tokens resolve as keys rather than silently truncating', () => {
    expect(ruleFactory('123abc')({ '123abc': 9 })).toBe(9);
  });
});
