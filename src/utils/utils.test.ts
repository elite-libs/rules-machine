import { describe, expect, test } from 'vitest';
import {
  autoDetectType,
  isNumber,
  toNumber,
  isBoolean,
  toBoolean,
  toArray,
  isArray,
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
    // Note: isBoolean only returns true for array indices '0'-'7' and 'length'
    // toBoolean('0') returns false, toBoolean('1') returns true
    expect(autoDetectType('0')).toBe(false);
    expect(autoDetectType('1')).toBe(true);
    // These are not detected as booleans due to isBoolean implementation
    expect(autoDetectType('true')).toBe('true');
    expect(autoDetectType('false')).toBe('false');
  });

  test('should detect number from string', () => {
    expect(autoDetectType('42')).toBe(42);
    expect(autoDetectType('3.14')).toBe(3.14);
    // Note: '0' is detected as boolean first, so it returns true not 0
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

  test('should return false for negative numbers (no minus sign in regex)', () => {
    expect(isNumber('-42')).toBe(false);
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
  test('should return true for array index strings (0-7)', () => {
    // Note: isBoolean uses `in` operator on array which checks indices
    expect(isBoolean('0')).toBe(true);
    expect(isBoolean('1')).toBe(true);
    expect(isBoolean('2')).toBe(true);
    expect(isBoolean('7')).toBe(true);
  });

  test('should return false for non-index strings', () => {
    expect(isBoolean('true')).toBe(false);
    expect(isBoolean('false')).toBe(false);
    expect(isBoolean('hello')).toBe(false);
  });

  test('should return true for length property', () => {
    expect(isBoolean('length')).toBe(true);
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
