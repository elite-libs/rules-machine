import { describe, expect, test } from 'vitest';
import {
  autoDetectType,
  isArray,
  isBoolean,
  isNumber,
  toArray,
  toBoolean,
  toNumber,
} from './utils';

describe('autoDetectType', () => {
  test('should return null for null', () => {
    expect(autoDetectType(null)).toBe(null);
  });

  test('should return null for undefined', () => {
    expect(autoDetectType(undefined)).toBe(null);
  });

  test('should return boolean for boolean', () => {
    expect(autoDetectType(true)).toBe(true);
    expect(autoDetectType(false)).toBe(false);
  });

  test('should return number for number', () => {
    expect(autoDetectType(42)).toBe(42);
    expect(autoDetectType(-3.14)).toBe(-3.14);
    expect(autoDetectType(0)).toBe(0);
  });

  test('should detect boolean from string', () => {
    expect(autoDetectType('0')).toBe(false);
    expect(autoDetectType('1')).toBe(true);
    expect(autoDetectType('true')).toBe(true);
    expect(autoDetectType('false')).toBe(false);
    expect(autoDetectType('2')).toBe(2);
    expect(autoDetectType('length')).toBe('length');
  });

  test('should detect number from string', () => {
    expect(autoDetectType('42')).toBe(42);
    expect(autoDetectType('3.14')).toBe(3.14);
    // Explicit boolean aliases 0 and 1 are detected before numbers.
  });

  test('should return string for non-boolean/number string', () => {
    expect(autoDetectType('hello')).toBe('hello');
    expect(autoDetectType('')).toBe('');
  });

  test('should return array for array', () => {
    expect(autoDetectType([1, 2, 3])).toEqual([1, 2, 3]);
    expect(autoDetectType([])).toEqual([]);
  });

  test('should return object for object', () => {
    expect(autoDetectType({ a: 1 })).toEqual({ a: 1 });
    expect(autoDetectType({})).toEqual({});
  });

  test('should return string for other types', () => {
    expect(autoDetectType(Symbol('test'))).toBe('Symbol(test)');
  });
});

describe('isNumber', () => {
  test('should return true for integer strings', () => {
    expect(isNumber('42')).toBe(true);
    expect(isNumber('0')).toBe(true);
    expect(isNumber('123456')).toBe(true);
  });

  test('should return true for decimal strings', () => {
    expect(isNumber('3.14')).toBe(true);
    expect(isNumber('0.5')).toBe(true);
    expect(isNumber('100.00')).toBe(true);
  });

  test('should return false for non-number strings', () => {
    expect(isNumber('hello')).toBe(false);
    expect(isNumber('')).toBe(false);
    expect(isNumber('abc123')).toBe(false);
    expect(isNumber('12abc')).toBe(false);
  });

  test('recognizes signed decimals and scientific notation', () => {
    expect(isNumber('-42')).toBe(true);
    expect(isNumber('1.2e3')).toBe(true);
    expect(isNumber('.5')).toBe(true);
    expect(isNumber('..')).toBe(false);
    expect(isNumber('1.2.3')).toBe(false);
  });
});

describe('toNumber', () => {
  test('should return number as-is', () => {
    expect(toNumber(42)).toBe(42);
    expect(toNumber(-3.14)).toBe(-3.14);
    expect(toNumber(0)).toBe(0);
  });

  test('should parse integer strings', () => {
    expect(toNumber('42')).toBe(42);
    expect(toNumber('0')).toBe(0);
    expect(toNumber('123')).toBe(123);
  });

  test('should parse decimal strings', () => {
    expect(toNumber('3.14')).toBe(3.14);
    expect(toNumber('0.5')).toBe(0.5);
    expect(toNumber('100.00')).toBe(100);
  });
});

describe('isBoolean', () => {
  test.each([
    'true',
    'false',
    'yes',
    'no',
    'on',
    'off',
    '0',
    '1',
    'TRUE',
  ])('recognizes %s', (value) => {
    expect(isBoolean(value)).toBe(true);
  });
  test.each(['2', '7', 'length', 'map', 'hello', ''])('rejects %s', (value) => {
    expect(isBoolean(value)).toBe(false);
  });
});

describe('toBoolean', () => {
  test('should return true for truthy strings', () => {
    expect(toBoolean('true')).toBe(true);
    expect(toBoolean('yes')).toBe(true);
    expect(toBoolean('on')).toBe(true);
    expect(toBoolean('1')).toBe(true);
  });

  test('should return false for falsy strings', () => {
    expect(toBoolean('false')).toBe(false);
    expect(toBoolean('no')).toBe(false);
    expect(toBoolean('off')).toBe(false);
    expect(toBoolean('0')).toBe(false);
  });

  test('should be case-insensitive', () => {
    expect(toBoolean('TRUE')).toBe(true);
    expect(toBoolean('False')).toBe(false);
    expect(toBoolean('YES')).toBe(true);
    expect(toBoolean('NO')).toBe(false);
  });

  test('should handle non-string values', () => {
    expect(toBoolean(true)).toBe(true);
    expect(toBoolean(false)).toBe(false);
    expect(toBoolean(1)).toBe(true); // '1' converts to true
    expect(toBoolean({})).toBe(false); // '[object Object]'.toLowerCase() doesn't match truthy values
  });
});

describe('toArray', () => {
  test('should return array as-is', () => {
    expect(toArray([1, 2, 3])).toEqual([1, 2, 3]);
    expect(toArray([])).toEqual([]);
  });

  test('should wrap single value in array', () => {
    expect(toArray(42)).toEqual([42]);
    expect(toArray('hello')).toEqual(['hello']);
    expect(toArray(true)).toEqual([true]);
    expect(toArray(null)).toEqual([null]);
    expect(toArray(undefined)).toEqual([undefined]);
    expect(toArray({ a: 1 })).toEqual([{ a: 1 }]);
  });
});

describe('isArray', () => {
  test('should return true for arrays', () => {
    expect(isArray([1, 2, 3])).toBe(true);
    expect(isArray([])).toBe(true);
    expect(isArray(['a', 'b'])).toBe(true);
  });

  test('should return false for non-arrays', () => {
    expect(isArray(42)).toBe(false);
    expect(isArray('hello')).toBe(false);
    expect(isArray(true)).toBe(false);
    expect(isArray(null)).toBe(false);
    expect(isArray(undefined)).toBe(false);
    expect(isArray({})).toBe(false);
  });

  test('should return false for strings', () => {
    expect(isArray('hello')).toBe(false);
    expect(isArray('')).toBe(false);
  });
});
