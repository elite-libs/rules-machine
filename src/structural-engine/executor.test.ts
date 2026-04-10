import { describe, expect, test } from 'vitest';
import { ruleFactory } from '../index';
import { UserError } from '../utils/errors';

describe('Executor edge cases', () => {
  test('should handle nested array rules properly', () => {
    const rules = [{ if: 'true', then: ['x = 1', 'y = 2'] }, { return: 'x' }];
    expect(ruleFactory(rules)()).toBe(1);
  });

  test('should return undefined for missing keys with ignoreMissingKeys behavior', () => {
    const rules = ['result = missingKey', { return: 'result' }];
    // Missing keys should result in undefined
    expect(ruleFactory(rules)({})).toBe(undefined);
  });

  test('should throw error for reserved array field names', () => {
    expect(() => ruleFactory('x = 1')({ $item: 1 } as any)).toThrow();
    expect(() => ruleFactory('x = 1')({ $index: 0 } as any)).toThrow();
    expect(() => ruleFactory('x = 1')({ $array: [] } as any)).toThrow();
  });

  test('should handle array method errors - invalid array', () => {
    const rules = [{ map: 'notAnArray', run: '$item * 2' }];
    expect(() => ruleFactory(rules)({ notAnArray: 'string' })).toThrow();
  });

  test('should handle array method errors - missing data', () => {
    const rules = [{ filter: 'missingArray', run: '$item > 2' }];
    expect(() => ruleFactory(rules)({})).toThrow();
  });

  test('should handle complex nested if/then/else', () => {
    const rules = [
      {
        if: { and: ['x > 0', 'x < 10'] },
        then: {
          if: 'x > 5',
          then: 'result = "high"',
          else: 'result = "low"',
        },
        else: 'result = "out of range"',
      },
      { return: 'result' },
    ];
    expect(ruleFactory(rules)({ x: 3 })).toBe('low');
    expect(ruleFactory(rules)({ x: 7 })).toBe('high');
    expect(ruleFactory(rules)({ x: 15 })).toBe('out of range');
  });

  test('should handle or conditions in if statements', () => {
    const rules = [
      { if: { or: ['x == 1', 'x == 3'] }, then: 'result = "match"' },
      { return: 'result' },
    ];
    expect(ruleFactory(rules)({ x: 1 })).toBe('match');
    expect(ruleFactory(rules)({ x: 3 })).toBe('match');
    expect(ruleFactory(rules)({ x: 2 })).toBe(undefined);
  });

  test('should handle array methods with set', () => {
    const rules = [
      {
        map: 'items',
        run: '$item * 2',
        set: 'doubled',
      },
      { return: 'doubled' },
    ];
    expect(ruleFactory(rules)({ items: [1, 2, 3] })).toEqual([2, 4, 6]);
  });

  test('should handle filter array method', () => {
    const rules = [
      {
        filter: 'items',
        run: '$item > 2',
        set: 'filtered',
      },
      { return: 'filtered' },
    ];
    expect(ruleFactory(rules)({ items: [1, 2, 3, 4, 5] })).toEqual([3, 4, 5]);
  });

  test('should handle every array method', () => {
    const rules = [
      {
        every: 'items',
        run: '$item > 0',
        set: 'allPositive',
      },
      { return: 'allPositive' },
    ];
    expect(ruleFactory(rules)({ items: [1, 2, 3] })).toBe(true);
    expect(ruleFactory(rules)({ items: [1, -2, 3] })).toBe(false);
  });

  test('should handle some array method', () => {
    const rules = [
      {
        some: 'items',
        run: '$item > 3',
        set: 'hasLarge',
      },
      { return: 'hasLarge' },
    ];
    expect(ruleFactory(rules)({ items: [1, 2, 3] })).toBe(false);
    expect(ruleFactory(rules)({ items: [1, 4, 3] })).toBe(true);
  });

  test('should handle find array method', () => {
    const rules = [
      {
        find: 'items',
        run: '$item > 2',
        set: 'found',
      },
      { return: 'found' },
    ];
    expect(ruleFactory(rules)({ items: [1, 2, 3, 4] })).toBe(3);
    expect(ruleFactory(rules)({ items: [1, 2] })).toBe(undefined);
  });

  test('should handle try/catch with nested rules', () => {
    const rules = [
      {
        try: {
          try: 'x = 1',
          catch: 'x = 2',
        },
        catch: 'x = 3',
      },
      { return: 'x' },
    ];
    expect(ruleFactory(rules)()).toBe(1);
  });

  test('should handle try/catch that executes catch block', () => {
    const rules = [
      {
        try: 'THROW "error"',
        catch: 'result = "caught"',
      },
      { return: 'result' },
    ];
    expect(ruleFactory(rules)()).toBe('caught');
  });

  test('should handle trace output', () => {
    const rules = ['x = 1', 'y = 2', { return: 'y' }];
    const fn = ruleFactory(rules, { trace: true });
    const result = fn({}) as any;
    // When trace is enabled in ruleFactory options, it returns ExecutionResult
    expect(result.input).toBeDefined();
    expect(result.lastValue).toBeDefined();
  });

  test('should handle error in rule execution', () => {
    const rules = ['THROW "test error"'];
    expect(() => ruleFactory(rules)()).toThrow();
  });
});
