import { isObject } from 'lodash';
import omit from 'lodash/omit.js';
import ms from 'ms';
import {
  Delegate,
  ExpressionThunk, ExpressionValue, isArgumentsArray,
} from 'expressionparser/dist/ExpressionParser.js';
import { toArray } from '../utils/utils';

export const unpackArgs = (f: Delegate) => (expr: ExpressionThunk) => {
  const result = expr();

  if (!isArgumentsArray(result)) {
    if (f.length > 1) {
      throw new Error(
        `Too few arguments. Expected ${f.length}, found 1 (${JSON.stringify(
          result
        )})`
      );
    }
    return f(() => result);
  } else if (result.length === f.length || f.length === 0) {
    return f.apply(null, result);
  } else {
    throw new Error(`Incorrect number of arguments. Expected ${f.length}`);
  }
};
export const num = (result: ExpressionValue) => {
  if (typeof result !== 'number') {
    throw new Error(
      `Expected number, found: ${typeof result} ${JSON.stringify(result)}`
    );
  }

  return result;
};
export const array = (result: ExpressionValue) => {
  if (!Array.isArray(result)) {
    throw new Error(
      `Expected array, found: ${typeof result} ${JSON.stringify(result)}`
    );
  }

  result = unpackArray([...result]);
  if (isArgumentsArray(result))
    throw new Error('Expected array, found: arguments');

  return result;
};
const unpackArray = <TInput extends unknown[]>(
  thunks: TInput | ExpressionThunk[]
) => thunks.map((thunk) => (typeof thunk === 'function' ? thunk() : thunk));
const bool = (value: ExpressionValue) => {
  if (typeof value !== 'boolean') {
    throw new Error(
      `Expected boolean, found: ${typeof value} ${JSON.stringify(value)}`
    );
  }

  return value;
};
export const evalBool = (value: ExpressionValue): boolean => {
  let result;

  while (typeof value === 'function' && value.length === 0)
    value = value();
  if (!result)
    result = value;

  return bool(result);
};
export const evalString = (value: ExpressionValue) => {
  let result;
  if (typeof value === 'function' && value.length === 0)
    result = value();

  else
    result = value;

  return string(result);
};

export const evalArray = (
  arr: ExpressionValue,
  typeCheck?: (value: ExpressionValue) => ExpressionValue
) => {
  return toArray(arr).map((value) => {
    let result;
    if (typeof value === 'function' && value.length === 0)
      result = value();

    else
      result = value;

    if (typeCheck) {
      try {
        result = typeCheck(result);
      } catch (err) {
        throw new Error(`In array; ${err.message}`);
      }
    }

    return result;
  });
};
export const obj = (obj: ExpressionValue) => {
  if (typeof obj !== 'object' || obj === null) {
    throw new Error(
      `Expected object, found: ${typeof obj} ${JSON.stringify(obj)}`
    );
  } else if (Array.isArray(obj)) {
    throw new Error('Expected object, found array');
  }

  return obj;
};

/**
 *
 * FILTER_VALUES will ONLY INCLUDE values that are in the 1st argument.
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
  const includeValues = toArray(arg1());
  const data = toArray(arg2());
  return data.filter((val) => !includeValues.includes(val));
};
export const containsValues = (arg1: ExpressionThunk, arg2: ExpressionThunk) => {
  const matches = toArray(arg1());
  const data = evalArray(arg2());
  return data.some((val) => matches.includes(val));
};
export const objectContainsValues = (arg1: ExpressionThunk, arg2: ExpressionThunk) => {
  const matches = toArray(arg1());
  const data = arg2();
  return Object.keys(data).some((val) => matches.includes(val));
};
export const omitProperties = (arg1: ExpressionThunk, arg2: ExpressionThunk) => {
  const matches = toArray(arg1()) as [];
  const data = arg2();
  if (!isObject(data)) {
    throw new Error(
      `OMIT expects object for second argument, ${typeof data} ${JSON.stringify(
        data
      )}`
    );
  }
  return omit(data, matches);
};
export const iterable = (result: ExpressionValue) => {
  if (!Array.isArray(result) && typeof result !== 'string') {
    throw new Error(
      `Expected array or string, found: ${typeof result} ${JSON.stringify(
        result
      )}`
    );
  }

  return result;
};

export const string = (result: ExpressionValue) => {
  if (typeof result !== 'string') {
    throw new Error(
      `Expected string, found: ${typeof result} ${JSON.stringify(result)}`
    );
  }

  return result;
};
export const char = (result: ExpressionValue) => {
  if (typeof result !== 'string' || result.length !== 1) {
    throw new Error(
      `Expected char, found: ${typeof result} ${JSON.stringify(result)}`
    );
  }

  return result;
};

export const dateParser = (
  arg: ExpressionThunk | string | number
): number | string => {
  const dateArg = typeof arg === 'function' ? arg() : arg;

  if (typeof dateArg === 'string' && dateArg.length < 6) {
    // possible date duration expression
    const duration = ms(dateArg);
    const d = new Date(Date.now() + duration);
    // console.info(`DATE: ${dateArg} (${duration}ms) => ${d}`);
    return d.getTime();
  }
  if (typeof dateArg === 'string' || typeof dateArg === 'number') {
    const d = new Date(dateArg);
    return d.getTime();
  }
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return `UnknownDate(${dateArg?.toString()})`;
};
