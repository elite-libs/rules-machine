import type {
  ArgumentsArray,
  Delegate,
  ExpressionThunk,
  ExpressionValue,
} from 'expressionparser/dist/ExpressionParser.js';
import isObject from 'lodash/isObject.js';
import toPath from 'lodash/toPath.js';
import {
  checkArrayLength,
  checkDataDepth,
  checkStringLength,
  consumeWork,
  ResourceLimitError,
} from '../utils/budget';
import { UserError } from '../utils/errors';
import { parseDate } from './dates';
import {
  dataEntries,
  describeValue,
  isProtectedInput,
  readData,
  unwrapInternal,
} from './materialize';

export const isArgumentsArray = (value: unknown): value is ArgumentsArray =>
  Array.isArray(value) &&
  !isProtectedInput(value) &&
  readData(value, 'isArgumentsArray') === true;

export const unpackArgs = (f: Delegate) => (expr: ExpressionThunk) => {
  const result = expr();

  if (!isArgumentsArray(result)) {
    if (f.length > 1) {
      throw new UserError(
        `Too few arguments. Expected ${f.length}, found 1 (${describeValue(
          result,
        )})`,
      );
    }
    return f(() => result);
  } else if (result.length === f.length || f.length === 0) {
    return f.apply(null, result);
  } else {
    throw new UserError(`Incorrect number of arguments. Expected ${f.length}`);
  }
};
export const num = (result: ExpressionValue) => {
  if (typeof result !== 'number') {
    throw new UserError(
      `Expected number, found: ${typeof result} ${describeValue(result)}`,
    );
  }

  return result;
};
export const array = (result: ExpressionValue) => {
  if (!Array.isArray(result)) {
    throw new UserError(
      `Expected array, found: ${typeof result} ${describeValue(result)}`,
    );
  }

  checkArrayLength(result.length);
  consumeWork(result.length);
  return Array.from({ length: result.length }, (_, index) =>
    unwrapInternal(readData(result, String(index))),
  ) as ExpressionValue[];
};
const bool = (value: ExpressionValue) => {
  if (typeof value !== 'boolean') {
    throw new UserError(
      `Expected boolean, found: ${typeof value} ${describeValue(value)}`,
    );
  }

  return value;
};
export const evalBool = (value: ExpressionValue): boolean => {
  return bool(unwrapInternal(value));
};
export const evalString = (value: ExpressionValue) =>
  string(unwrapInternal(value));

export const evalArray = (
  arr: ExpressionValue,
  typeCheck?: (value: ExpressionValue) => ExpressionValue,
) => {
  const values = Array.isArray(arr) ? array(arr) : [unwrapInternal(arr)];
  return values.map((value) => {
    let result = value;

    if (typeCheck) {
      try {
        result = typeCheck(result);
      } catch (err) {
        if (err instanceof ResourceLimitError) throw err;
        throw new UserError(
          `In array; ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return result;
  });
};
export const obj = (obj: ExpressionValue) => {
  if (typeof obj !== 'object' || obj === null) {
    throw new UserError(
      `Expected object, found: ${typeof obj} ${describeValue(obj)}`,
    );
  } else if (Array.isArray(obj)) {
    throw new UserError('Expected object, found array');
  }

  const prototype = Object.getPrototypeOf(obj);
  if (prototype !== Object.prototype && prototype !== null)
    throw new UserError('Expected a plain object; host objects are opaque');
  return obj;
};

/**
 *
 * FILTER_VALUES excludes values present in the first argument.
 *
 * ```js
 * FILTER_VALUES([1 ,3], [1, 2, 3, 4, 5])
 * //-> [2, 4, 5]
 *
 * FILTER_VALUES(1, [1, 2, 3, 4, 5])
 * //-> [2, 3, 4, 5]
 * ```
 */
export const filterValues = (arg1: ExpressionThunk, arg2: ExpressionThunk) => {
  const includeValues = evalArray(arg1());
  const data = evalArray(arg2());
  const excluded = new Set(includeValues);
  return data.filter((val) => !excluded.has(val));
};
export const containsValues = (
  arg1: ExpressionThunk,
  arg2: ExpressionThunk,
) => {
  const matches = evalArray(arg1());
  const data = evalArray(arg2());
  const included = new Set(matches);
  return data.some((val) => included.has(val));
};
export const objectContainsValues = (
  arg1: ExpressionThunk,
  arg2: ExpressionThunk,
) => {
  const matches = evalArray(arg1());
  const data = obj(arg2());
  const keys = Object.keys(data);
  consumeWork(keys.length);
  const included = new Set(matches);
  return keys.some((key) => included.has(key));
};
export const countObjectKeys = (arg1: ExpressionThunk) => {
  const keys = Object.keys(obj(arg1()));
  consumeWork(keys.length);
  return keys.length;
};
export const omitProperties = (
  arg1: ExpressionThunk,
  arg2: ExpressionThunk,
) => {
  const matches = evalArray(arg1());
  const data = arg2();
  if (!isObject(data)) {
    throw new UserError(
      `OMIT expects object for second argument, ${typeof data} ${describeValue(
        data,
      )}`,
    );
  }
  const clone = (value: object): Record<PropertyKey, unknown> => {
    const prototype = Object.getPrototypeOf(value);
    if (
      !Array.isArray(value) &&
      prototype !== Object.prototype &&
      prototype !== null
    )
      throw new UserError('OMIT cannot copy an opaque host object');
    const copy = (
      Array.isArray(value) ? new Array(value.length) : Object.create(prototype)
    ) as Record<PropertyKey, unknown>;
    for (const [key, child] of dataEntries(value))
      Object.defineProperty(copy, key, {
        value: child,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    return copy;
  };
  const output = clone(data);
  const segmentText = (
    value: ExpressionValue,
    active = new Set<object>(),
  ): string => {
    consumeWork();
    if (Array.isArray(value)) {
      if (active.has(value))
        throw new UserError('OMIT path must not be cyclic');
      checkDataDepth(active.size + 1);
      active.add(value);
      try {
        return array(value)
          .map((part) => segmentText(part, active))
          .join(',');
      } finally {
        active.delete(value);
      }
    }
    if (typeof value === 'number') return String(value);
    return string(value);
  };
  for (const raw of matches) {
    let path: string[];
    if (Array.isArray(raw)) path = array(raw).map((part) => segmentText(part));
    else {
      const keyPath = segmentText(raw);
      path = Object.hasOwn(output, keyPath) ? [keyPath] : toPath(keyPath);
    }
    let target = output;
    for (let i = 0; i < path.length; i++) {
      checkDataDepth(i + 1);
      const key = path[i];
      if (i === path.length - 1) {
        delete target[key];
        break;
      }
      const child = readData(target, key);
      if (child === null || typeof child !== 'object') break;
      const copy = clone(child);
      Object.defineProperty(target, key, {
        value: copy,
        enumerable: true,
        writable: true,
        configurable: true,
      });
      target = copy;
    }
  }
  return output as ExpressionValue;
};
export const iterable = (result: ExpressionValue) => {
  if (!Array.isArray(result) && typeof result !== 'string') {
    throw new UserError(
      `Expected array or string, found: ${typeof result} ${describeValue(
        result,
      )}`,
    );
  }

  if (typeof result === 'string') {
    checkStringLength(result.length);
    consumeWork(result.length);
  }
  return result;
};

export const string = (result: ExpressionValue) => {
  if (typeof result !== 'string') {
    throw new UserError(
      `Expected string, found: ${typeof result} ${describeValue(result)}`,
    );
  }

  checkStringLength(result.length);
  consumeWork(result.length);
  return result;
};
export const char = (result: ExpressionValue) => {
  if (typeof result === 'string') {
    checkStringLength(result.length);
    consumeWork(result.length);
  }
  if (typeof result !== 'string' || result.length !== 1) {
    throw new UserError(
      `Expected char, found: ${typeof result} ${describeValue(result)}`,
    );
  }

  return result;
};

export const dateParser = (arg: ExpressionThunk | string | number): number =>
  parseDate(typeof arg === 'function' ? unwrapInternal(arg) : arg);

/** Primitive join semantics without invoking host conversion hooks. */
export function joinValues(
  values: ExpressionValue[],
  separator: string,
): string {
  let characters = Math.max(0, values.length - 1) * separator.length;
  const strings = values.map((value) => {
    if (
      value !== null &&
      (typeof value === 'object' ||
        typeof value === 'function' ||
        typeof value === 'symbol')
    )
      throw new UserError('String joining accepts primitive values only');
    const text = value == null ? '' : String(value);
    characters += text.length;
    return text;
  });
  checkStringLength(characters);
  consumeWork(characters);
  return strings.join(separator);
}
