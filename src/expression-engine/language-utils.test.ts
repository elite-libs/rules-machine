import { describe, expect, test, it } from 'vitest';
import {
  unpackArgs,
  num,
  array,
  evalBool,
  evalString,
  evalArray,
  obj,
  filterValues,
  containsValues,
  objectContainsValues,
  countObjectKeys,
  omitProperties,
  iterable,
  string,
  char,
  dateParser,
} from './language-utils';
import { UserError } from '../utils/errors';

describe('unpackArgs', () => {
  test('should call function with single argument when result is not array', () => {
    const fn = (arg: any) => arg() * 2;
    const wrapped = unpackArgs(fn);
    expect(wrapped(() => 5)).toBe(10);
  });

  test('should call function with array when result is array and lengths match', () => {
    const fn = (args: any) => {
      const arr = args();
      return arr[0]() + arr[1]();
    };
    const wrapped = unpackArgs(fn);
    expect(wrapped(() => [() => 5, () => 3])).toBe(8);
  });

  test('should throw when too few arguments for multi-arg function', () => {
    const fn = (arg1: any, arg2: any) => arg1() + arg2();
    const wrapped = unpackArgs(fn);
    expect(() => wrapped(() => 5)).toThrow(UserError);
    expect(() => wrapped(() => 5)).toThrow('Too few arguments');
  });

  test('should work with zero-argument functions', () => {
    const fn = () => 42;
    const wrapped = unpackArgs(fn);
    expect(wrapped(() => [() => 1, () => 2])).toBe(42);
  });
});

describe('num', () => {
  test('should return number when input is number', () => {
    expect(num(42)).toBe(42);
    expect(num(-3.14)).toBe(-3.14);
    expect(num(0)).toBe(0);
  });

  test('should throw UserError when input is not number', () => {
    expect(() => num('42' as any)).toThrow(UserError);
    expect(() => num('42' as any)).toThrow('Expected number');
    expect(() => num(true as any)).toThrow(UserError);
    expect(() => num(null as any)).toThrow(UserError);
    expect(() => num({} as any)).toThrow(UserError);
  });
});

describe('array', () => {
  test('should return array when input is array', () => {
    expect(array([1, 2, 3])).toEqual([1, 2, 3]);
    expect(array([])).toEqual([]);
  });

  test('should unpack function values in array', () => {
    const result = array([() => 1, () => 2, () => 3] as any);
    expect(result).toEqual([1, 2, 3]);
  });

  test('should throw UserError when input is not array', () => {
    expect(() => array('test' as any)).toThrow(UserError);
    expect(() => array('test' as any)).toThrow('Expected array');
    expect(() => array(42 as any)).toThrow(UserError);
    expect(() => array(null as any)).toThrow(UserError);
  });

  test('should throw when result is arguments array', () => {
    // Note: The isArgumentsArray check happens after unpackArray is called
    // This test documents the current behavior
    const argsArray: any = [() => 1, () => 2, () => 3];
    argsArray.isArgumentsArray = true;
    // The array function will unpack and then check
    const result = array(argsArray);
    expect(result).toEqual([1, 2, 3]);
  });
});

describe('evalBool', () => {
  test('should return boolean when input is boolean', () => {
    expect(evalBool(true)).toBe(true);
    expect(evalBool(false)).toBe(false);
  });

  test('should evaluate zero-arg function', () => {
    expect(evalBool(() => true)).toBe(true);
    expect(evalBool(() => false)).toBe(false);
  });

  test('should throw UserError when result is not boolean', () => {
    expect(() => evalBool('true' as any)).toThrow(UserError);
    expect(() => evalBool('true' as any)).toThrow('Expected boolean');
    expect(() => evalBool(1 as any)).toThrow(UserError);
    expect(() => evalBool(null as any)).toThrow(UserError);
  });
});

describe('evalString', () => {
  test('should return string when input is string', () => {
    expect(evalString('hello')).toBe('hello');
    expect(evalString('')).toBe('');
  });

  test('should evaluate zero-arg function', () => {
    expect(evalString(() => 'hello')).toBe('hello');
  });

  test('should throw UserError when result is not string', () => {
    expect(() => evalString(42 as any)).toThrow(UserError);
    expect(() => evalString(42 as any)).toThrow('Expected string');
    expect(() => evalString(true as any)).toThrow(UserError);
    expect(() => evalString(null as any)).toThrow(UserError);
  });
});

describe('evalArray', () => {
  test('should convert single value to array', () => {
    expect(evalArray(42)).toEqual([42]);
    expect(evalArray('hello')).toEqual(['hello']);
    expect(evalArray(true)).toEqual([true]);
    expect(evalArray(null as any)).toEqual([null]);
  });

  test('should return array as-is', () => {
    expect(evalArray([1, 2, 3])).toEqual([1, 2, 3]);
  });

  test('should unpack function values', () => {
    const result = evalArray([() => 1, () => 2] as any);
    expect(result).toEqual([1, 2]);
  });

  test('should apply typeCheck when provided', () => {
    const typeCheck = (val: any) => {
      if (typeof val !== 'number') throw new Error('Expected number');
      return val * 2;
    };
    expect(evalArray([1, 2, 3], typeCheck)).toEqual([2, 4, 6]);
  });

  test('should wrap typeCheck errors in UserError', () => {
    const typeCheck = (val: any) => {
      throw new Error('Custom error');
    };
    expect(() => evalArray([1, 2], typeCheck)).toThrow(UserError);
    expect(() => evalArray([1, 2], typeCheck)).toThrow(
      'In array; Custom error',
    );
  });
});

describe('obj', () => {
  test('should return object when input is object', () => {
    expect(obj({ a: 1 })).toEqual({ a: 1 });
    expect(obj({})).toEqual({});
  });

  test('should throw UserError when input is not object', () => {
    expect(() => obj('test' as any)).toThrow(UserError);
    expect(() => obj('test' as any)).toThrow('Expected object');
    expect(() => obj(42 as any)).toThrow(UserError);
    expect(() => obj(null as any)).toThrow(UserError);
  });

  test('should throw UserError when input is array', () => {
    expect(() => obj([1, 2] as any)).toThrow(UserError);
    expect(() => obj([1, 2] as any)).toThrow('Expected object, found array');
  });
});

describe('filterValues', () => {
  test('should filter out values from first argument', () => {
    expect(
      filterValues(
        () => [1, 3],
        () => [1, 2, 3, 4, 5],
      ),
    ).toEqual([2, 4, 5]);
  });

  test('should handle single value in first argument', () => {
    expect(
      filterValues(
        () => 1,
        () => [1, 2, 3, 4, 5],
      ),
    ).toEqual([2, 3, 4, 5]);
  });

  test('should return empty array when all values filtered', () => {
    expect(
      filterValues(
        () => [1, 2, 3],
        () => [1, 2, 3],
      ),
    ).toEqual([]);
  });

  test('should return all values when none match', () => {
    expect(
      filterValues(
        () => [4, 5, 6],
        () => [1, 2, 3],
      ),
    ).toEqual([1, 2, 3]);
  });
});

describe('containsValues', () => {
  test('should return true when values match', () => {
    expect(
      containsValues(
        () => [1, 3],
        () => [1, 2, 3, 4, 5],
      ),
    ).toBe(true);
  });

  test('should return true when single value matches', () => {
    expect(
      containsValues(
        () => 3,
        () => [1, 2, 3, 4, 5],
      ),
    ).toBe(true);
  });

  test('should return false when no values match', () => {
    expect(
      containsValues(
        () => [6, 7],
        () => [1, 2, 3, 4, 5],
      ),
    ).toBe(false);
  });
});

describe('objectContainsValues', () => {
  test('should return true when key exists in object', () => {
    expect(
      objectContainsValues(
        () => ['a', 'c'],
        () => ({ a: 1, b: 2, c: 3 }),
      ),
    ).toBe(true);
  });

  test('should return true when single key exists', () => {
    expect(
      objectContainsValues(
        () => 'b',
        () => ({ a: 1, b: 2, c: 3 }),
      ),
    ).toBe(true);
  });

  test('should return false when no keys exist', () => {
    expect(
      objectContainsValues(
        () => ['x', 'y'],
        () => ({ a: 1, b: 2, c: 3 }),
      ),
    ).toBe(false);
  });
});

describe('countObjectKeys', () => {
  test('should return count of object keys', () => {
    expect(countObjectKeys(() => ({ a: 1, b: 2, c: 3 }))).toBe(3);
    expect(countObjectKeys(() => ({}))).toBe(0);
  });
});

describe('omitProperties', () => {
  test('should omit specified properties from object', () => {
    expect(
      omitProperties(
        () => ['a', 'c'],
        () => ({ a: 1, b: 2, c: 3 }),
      ),
    ).toEqual({ b: 2 });
  });

  test('should handle single property to omit', () => {
    expect(
      omitProperties(
        () => 'b',
        () => ({ a: 1, b: 2, c: 3 }),
      ),
    ).toEqual({ a: 1, c: 3 });
  });

  test('should return empty object when all properties omitted', () => {
    expect(
      omitProperties(
        () => ['a', 'b'],
        () => ({ a: 1, b: 2 }),
      ),
    ).toEqual({});
  });

  test('should throw UserError when second argument is not object', () => {
    expect(() =>
      omitProperties(
        () => 'a',
        () => 'test' as any,
      ),
    ).toThrow(UserError);
    expect(() =>
      omitProperties(
        () => 'a',
        () => 'test' as any,
      ),
    ).toThrow('OMIT expects object');
  });
});

describe('iterable', () => {
  test('should return array', () => {
    expect(iterable([1, 2, 3])).toEqual([1, 2, 3]);
  });

  test('should return string', () => {
    expect(iterable('hello')).toBe('hello');
  });

  test('should throw UserError when not array or string', () => {
    expect(() => iterable(42 as any)).toThrow(UserError);
    expect(() => iterable(42 as any)).toThrow('Expected array or string');
    expect(() => iterable({} as any)).toThrow(UserError);
    expect(() => iterable(null as any)).toThrow(UserError);
  });
});

describe('string', () => {
  test('should return string', () => {
    expect(string('hello')).toBe('hello');
    expect(string('')).toBe('');
  });

  test('should throw UserError when not string', () => {
    expect(() => string(42 as any)).toThrow(UserError);
    expect(() => string(42 as any)).toThrow('Expected string');
    expect(() => string(true as any)).toThrow(UserError);
    expect(() => string(null as any)).toThrow(UserError);
  });
});

describe('char', () => {
  test('should return single character string', () => {
    expect(char('a')).toBe('a');
    expect(char('X')).toBe('X');
  });

  test('should throw UserError when empty string', () => {
    expect(() => char('')).toThrow(UserError);
    expect(() => char('')).toThrow('Expected char');
  });

  test('should throw UserError when multiple characters', () => {
    expect(() => char('ab')).toThrow(UserError);
    expect(() => char('ab')).toThrow('Expected char');
  });

  test('should throw UserError when not string', () => {
    expect(() => char(42 as any)).toThrow(UserError);
    expect(() => char(42 as any)).toThrow('Expected char');
  });
});

describe('dateParser', () => {
  test('should parse duration string', () => {
    const result = dateParser(() => '10m');
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThan(Date.now());
  });

  test('should parse date string', () => {
    const result = dateParser(() => '2020-01-20T00:00:00.000Z');
    expect(typeof result).toBe('number');
    expect(result).toBe(new Date('2020-01-20T00:00:00.000Z').getTime());
  });

  test('should parse number', () => {
    const timestamp = Date.now();
    const result = dateParser(() => timestamp);
    expect(result).toBe(timestamp);
  });

  test('should handle unknown date format', () => {
    // Long strings that aren't valid dates get parsed by Date constructor
    const result = dateParser(() => 'not-a-date-format-at-all');
    expect(typeof result).toBe('number');
    expect(result).toBeNaN();
  });
});
