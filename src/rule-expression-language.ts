import {
  Delegate,
  ExpressionThunk,
  TermDelegate,
  InfixOps,
  ExpressionValue,
  ExpressionArray,
  isArgumentsArray,
  ArgumentsArray,
  ExpressionParserOptions,
  TermTyper,
  TermType,
} from 'expressionparser/dist/ExpressionParser.js';
import get from 'lodash/get.js';
import set from 'lodash/set.js';
import isNumberLodash from 'lodash/isNumber.js';
import ms from 'ms';
import { isNumber } from './utils/isNumber';
import { toArray } from './utils/toArray';
import moduleMethodTracer from './utils/moduleMethodTracer';

export interface FunctionOps {
  [op: string]: (...args: ExpressionThunk[]) => ExpressionValue;
}

export const assignmentOperators = ['=', '+=', '-=', '*=', '/=', '??='];
// TODO: , '-=', '*=', '/=', '%='];
/*
'+='
'-='
'*='
'/='
'??='
'**='
'%='
'||='
*/

const getInfixOps = (termDelegate: TermDelegate): InfixOps => ({
  '+': (a, b) => num(a()) + num(b()),
  '-': (a, b) => num(a()) - num(b()),
  '*': (a, b) => num(a()) * num(b()),
  '/': (a, b) => num(a()) / num(b()),
  ',': (a, b): ArgumentsArray => {
    const aVal = a();
    const aArr: ExpressionArray<ExpressionValue> = isArgumentsArray(aVal)
      ? aVal
      : [() => aVal];
    const args: ExpressionArray<ExpressionValue> = aArr.concat([b]);
    args.isArgumentsArray = true;
    return args as ArgumentsArray;
  },
  '%': (a, b) => num(a()) % num(b()),
  '=': (_, b) => b(),
  '+=': (a, b) => num(a()) + num(b()),
  '-=': (a, b) => num(a()) - num(b()),
  '*=': (a, b) => num(a()) * num(b()),
  '/=': (a, b) => num(a()) / num(b()),
  '??=': (a, b) => a() ?? b(),
  '==': (a, b) => a() === b(),
  '!=': (a, b) => a() !== b(),
  '<>': (a, b) => a() !== b(),
  '~=': (a, b) => Math.abs(num(a()) - num(b())) < Number.EPSILON,
  '>': (a, b) => a() > b(),
  '<': (a, b) => a() < b(),
  '>=': (a, b) => a() >= b(),
  '<=': (a, b) => a() <= b(),
  AND: (a, b) => a() && b(),
  OR: (a, b) => a() || b(),
  '^': (a, b) => Math.pow(num(a()), num(b())),
});

export const infixOperators = Object.keys(() => '');

const unpackArgs = (f: Delegate) => (expr: ExpressionThunk) => {
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

const num = (result: ExpressionValue) => {
  if (typeof result !== 'number') {
    throw new Error(
      `Expected number, found: ${typeof result} ${JSON.stringify(result)}`
    );
  }

  return result;
};

const array = (result: ExpressionValue) => {
  if (!Array.isArray(result)) {
    throw new Error(
      `Expected array, found: ${typeof result} ${JSON.stringify(result)}`
    );
  }

  result = unpackArray([...result]);
  if (isArgumentsArray(result)) {
    throw new Error(`Expected array, found: arguments`);
  }

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

const evalBool = (value: ExpressionValue): boolean => {
  let result;

  while (typeof value === 'function' && value.length === 0) result = value();
  if (!result) result = value;

  return bool(result);
};

const evalString = (value: ExpressionValue) => {
  let result;
  if (typeof value === 'function' && value.length === 0) {
    result = value();
  } else {
    result = value;
  }

  return string(result);
};

const evalArray = (
  arr: ExpressionValue,
  typeCheck?: (value: ExpressionValue) => ExpressionValue
) => {
  return toArray(arr).map((value) => {
    let result;
    if (typeof value === 'function' && value.length === 0) {
      result = value();
    } else {
      result = value;
    }

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

const obj = (obj: ExpressionValue) => {
  if (typeof obj !== 'object' || obj === null) {
    throw new Error(
      `Expected object, found: ${typeof obj} ${JSON.stringify(obj)}`
    );
  } else if (Array.isArray(obj)) {
    throw new Error(`Expected object, found array`);
  }

  return obj;
};

const isCSV = (s: unknown) =>
  !!(typeof s != null && typeof s === 'string' && /.+,.+/.test(`${s}`));
const toCSV = (s: string) => s.split(',');

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
const filterValues = (arg1: ExpressionThunk, arg2: ExpressionThunk) => {
  const includeValues = toArray(arg1());
  const data = toArray(arg2());
  return data.filter((val) => !includeValues.includes(val));
};

const containsValues = (arg1: ExpressionThunk, arg2: ExpressionThunk) => {
  const matches = toArray(arg1());
  const data = evalArray(arg2());
  return data.some((val) => matches.includes(val));
};

const iterable = (result: ExpressionValue) => {
  if (!Array.isArray(result) && typeof result !== 'string') {
    throw new Error(
      `Expected array or string, found: ${typeof result} ${JSON.stringify(
        result
      )}`
    );
  }

  return result;
};

const string = (result: ExpressionValue) => {
  if (typeof result !== 'string') {
    throw new Error(
      `Expected string, found: ${typeof result} ${JSON.stringify(result)}`
    );
  }

  return result;
};

const char = (result: ExpressionValue) => {
  if (typeof result !== 'string' || result.length !== 1) {
    throw new Error(
      `Expected char, found: ${typeof result} ${JSON.stringify(result)}`
    );
  }

  return result;
};

const dateParser = (
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
  return `UnknownDate(${dateArg})`;
};

type Callable = (...args: ExpressionArray<ExpressionThunk>) => ExpressionValue;

type TermSetterFunction = (keyPath: string, value: ExpressionValue) => any;

export const ruleExpressionLanguage = function (
  termDelegate: TermDelegate,
  termTypeDelegate?: TermTyper,
  termSetter?: TermSetterFunction
): ExpressionParserOptions {
  const infixOps = getInfixOps(termDelegate);
  // const infixOps = moduleMethodTracer(getInfixOps(termDelegate), console.log);

  const call = (name: string): Callable => {
    const upperName = name.toUpperCase();
    if (prefixOps.hasOwnProperty(upperName)) {
      return (...args) => {
        args.isArgumentsArray = true;
        return prefixOps[upperName](() => args);
      };
    } else if (infixOps.hasOwnProperty(upperName)) {
      return (...args) => infixOps[upperName](args[0], args[1]);
    } else {
      throw new Error(`Unknown function: ${name}`);
    }
  };

  const prefixOps: FunctionOps = {
    NEG: (arg) => -num(arg()),
    ADD: (a, b) => num(a()) + num(b()),
    SUB: (a, b) => num(a()) - num(b()),
    MUL: (a, b) => num(a()) * num(b()),
    DIV: (a, b) => num(a()) / num(b()),
    MOD: (a, b) => num(a()) % num(b()),
    ISPRIME: (arg) => {
      const val = num(arg());
      for (let i = 2, s = Math.sqrt(val); i <= s; i++) {
        if (val % i === 0) return false;
      }
      return val !== 1;
    },
    GCD: (arg1, arg2) => {
      let a = num(arg1());
      let b = num(arg2());
      a = Math.abs(a);
      b = Math.abs(b);
      if (b > a) {
        var temp = a;
        a = b;
        b = temp;
      }
      while (true) {
        if (b === 0) return a;
        a %= b;
        if (a === 0) return b;
        b %= a;
      }
    },
    DATE: dateParser,
    DATEISO: (arg) => {
      const dateArg = arg();
      if (typeof dateArg === 'string' || typeof dateArg === 'number') {
        return new Date(dateParser(dateArg)).toISOString();
      }
      return `UnknownDate(${dateArg})`;
    },
    NOT: (arg) => !arg(),
    '!': (arg) => !arg(),
    ABS: (arg) => Math.abs(num(arg())),
    ACOS: (arg) => Math.acos(num(arg())),
    ACOSH: (arg) => Math.acosh(num(arg())),
    ASIN: (arg) => Math.asin(num(arg())),
    ASINH: (arg) => Math.asinh(num(arg())),
    ATAN: (arg) => Math.atan(num(arg())),

    ATAN2: (arg1, arg2) => Math.atan2(num(arg1()), num(arg2())),

    ATANH: (arg) => Math.atanh(num(arg())),
    CUBEROOT: (arg) => Math.cbrt(num(arg())),
    CEIL: (arg) => Math.ceil(num(arg())),

    COS: (arg) => Math.cos(num(arg())),
    COSH: (arg) => Math.cos(num(arg())),
    EXP: (arg) => Math.exp(num(arg())),
    FLOOR: (arg) => Math.floor(num(arg())),
    LN: (arg) => Math.log(num(arg())),
    LOG: (arg) => Math.log10(num(arg())),
    LOG2: (arg) => Math.log2(num(arg())),
    SIN: (arg) => Math.sin(num(arg())),
    SINH: (arg) => Math.sinh(num(arg())),
    SQRT: (arg) => Math.sqrt(num(arg())),
    TAN: (arg) => Math.tan(num(arg())),
    TANH: (arg) => Math.tanh(num(arg())),
    ROUND: (arg) => Math.round(num(arg())),
    SIGN: (arg) => Math.sign(num(arg())),
    TRUNC: (arg) => Math.trunc(num(arg())),

    IF: (arg1, arg2, arg3) => {
      const condition = arg1;
      const thenStatement = arg2;
      const elseStatement = arg3;

      if (condition()) {
        return thenStatement();
      } else {
        return elseStatement();
      }
    },

    AVERAGE: (arg) => {
      const arr = evalArray(arg());

      const sum = arr.reduce(
        (prev: number, curr): number => prev + num(curr),
        0
      );
      return num(sum) / arr.length;
    },

    SUM: (arg) =>
      evalArray(arg(), num).reduce((prev: number, curr) => prev + num(curr), 0),
    CHAR: (arg) => String.fromCharCode(num(arg())),
    CODE: (arg) => char(arg()).charCodeAt(0),

    DEC2BIN: (arg) => arg().toString(2),
    DEC2HEX: (arg) => arg().toString(16),
    DEC2STR: (arg) => arg().toString(10),
    BIN2DEC: (arg) => Number.parseInt(string(arg()), 2),
    HEX2DEC: (arg) => Number.parseInt(string(arg()), 16),
    STR2DEC: (arg) => Number.parseInt(string(arg()), 10),
    DEGREES: (arg) => (num(arg()) * 180) / Math.PI,
    RADIANS: (arg) => (num(arg()) * Math.PI) / 180,

    MIN: (arg) =>
      evalArray(arg()).reduce(
        (prev: number, curr) => Math.min(prev, num(curr)),
        Number.POSITIVE_INFINITY
      ),
    MAX: (arg) =>
      evalArray(arg()).reduce(
        (prev: number, curr) => Math.max(prev, num(curr)),
        Number.NEGATIVE_INFINITY
      ),
    SORT: (arg) => {
      const arr = array(arg()).slice();
      arr.sort();
      return arr;
    },
    REVERSE: (arg) => {
      const arr = array(arg()).slice();
      arr.reverse();
      return arr;
    },
    INDEX: (arg1, arg2) => iterable(arg1())[num(arg2())],
    LENGTH: (arg) => {
      return iterable(arg()).length;
    },
    JOIN: (arg1, arg2) => evalArray(arg2()).join(string(arg1())),
    STRING: (arg) => evalArray(arg()).join(''),
    SPLIT: (arg1, arg2) => string(arg2()).split(string(arg1())),
    CHARARRAY: (arg) => {
      const str = string(arg());
      return str.split('');
    },
    ARRAY: (arg) => array(arg()),
    ISNAN: (arg) => isNaN(num(arg())),
    MAP: (arg1, arg2) => {
      const func = arg1();
      const arr = evalArray(arg2());
      return arr.map((val) => {
        if (typeof func === 'function') {
          return () => func(val);
        } else {
          return call(string(func))(() => val);
        }
      });
    },
    REDUCE: (arg1, arg2, arg3) => {
      const func = arg1();
      const start = arg2();
      const arr = evalArray(arg3());
      return arr.reduce((prev, curr) => {
        const args: ExpressionArray<ExpressionThunk> = [() => prev, () => curr];
        if (typeof func === 'function') {
          return func(...args);
        } else {
          return call(string(func))(...args);
        }
      }, start);
    },
    RANGE: (arg1, arg2) => {
      const start = num(arg1());
      const limit = num(arg2());
      const result = [];
      for (let i = start; i < limit; i++) {
        result.push(i);
      }
      return result;
    },
    UPPER: (arg) => string(arg()).toUpperCase(),
    LOWER: (arg) => string(arg()).toLowerCase(),

    ZIP: (arg1, arg2) => {
      const arr1 = evalArray(arg1());
      const arr2 = evalArray(arg2());

      if (arr1.length !== arr2.length) {
        throw new Error('ZIP: Arrays are of different lengths');
      } else {
        return arr1.map((v1, i) => [v1, arr2[i]]);
      }
    },
    UNZIP: (arg1) => {
      const inputArr = evalArray(arg1());
      const arr1 = inputArr.map((item) => array(item)[0]);
      const arr2 = inputArr.map((item) => array(item)[1]);
      return [arr1, arr2];
    },
    TAKE: (arg1, arg2) => {
      const n = num(arg1());
      const arr = evalArray(arg2());
      return arr.slice(0, n);
    },
    DROP: (arg1, arg2) => {
      const n = num(arg1());
      const arr = evalArray(arg2());
      return arr.slice(n);
    },
    SLICE: (arg1, arg2, arg3) => {
      const start = num(arg1());
      const limit = num(arg2());
      const arr = evalArray(arg3());
      return arr.slice(start, limit);
    },
    CONCAT: (arg1, arg2) => {
      const arr1 = array(arg1());
      const arr2 = array(arg2());
      return arr1.concat(arr2);
    },
    HEAD: (arg1) => {
      const arr = array(arg1());
      return arr[0];
    },
    TAIL: (arg1) => {
      const arr = array(arg1());
      return arr.slice(1);
    },
    LAST: (arg1) => {
      const arr = array(arg1());
      return arr[arr.length - 1];
    },
    CONS: (arg1, arg2) => {
      const head = arg1();
      const arr = array(arg2());
      return [head].concat(arr);
    },
    FILTER: (arg1, arg2) => {
      const func = arg1();
      const arr = evalArray(arg2());
      const result: ExpressionArray<ExpressionValue> = [];
      arr.forEach((val) => {
        let isSatisfied;
        if (typeof func === 'function') {
          isSatisfied = evalBool(func(val));
        } else {
          isSatisfied = evalBool(call(string(func))(() => val));
        }

        if (isSatisfied) {
          result.push(val);
        }
      });

      return result;
    },
    TAKEWHILE: (arg1, arg2) => {
      const func = arg1();
      const arr = evalArray(arg2());

      const satisfaction = (val: ExpressionValue) => {
        let isSatisfied;
        if (typeof func === 'function') {
          isSatisfied = evalBool(func(val));
        } else {
          isSatisfied = evalBool(call(string(func))(() => val));
        }

        return isSatisfied;
      };

      let i = 0;
      while (satisfaction(arr[i]) && i < arr.length) {
        i++;
      }

      return arr.slice(0, i);
    },
    DROPWHILE: (arg1, arg2) => {
      const func = arg1();
      const arr = evalArray(arg2());

      const satisfaction = (val: ExpressionValue) => {
        let isSatisfied;
        if (typeof func === 'function') {
          isSatisfied = evalBool(func(val));
        } else {
          isSatisfied = evalBool(call(string(func))(() => val));
        }

        return isSatisfied;
      };

      let i = 0;
      while (satisfaction(arr[i]) && i < arr.length) {
        i++;
      }

      return arr.slice(i);
    },
    /**
     * CONTAINS will return true if any value(s) from the 1st argument occur in the 2nd argument.
     *
     * ```js
     * CONTAINS([1 ,3], [1, 2, 3, 4, 5])
     * //-> true
     *
     * CONTAINS(99, [1, 2, 3, 4, 5])
     * //-> false
     * ```
     *
     * @param {*} arg1
     * @param {*} arg2
     */
    CONTAINS: containsValues,
    INCLUDES: containsValues,
    /**
     * REMOVE_VALUES will remove all values matching the item(s) in the 1st argument from the 2nd argument array.
     *
     * ```js
     * REMOVE_VALUES([1 ,3], [1, 2, 3, 4, 5])
     * //-> [2, 4, 5]
     *
     * REMOVE_VALUES(1, [1, 2, 3, 4, 5])
     * //-> [2, 3, 4, 5]
     * ```
     *
     * @param {*} arg1
     * @param {*} arg2
     */
    REMOVE_VALUES: (arg1, arg2) => {
      const removeValues = toArray(arg1());
      const data = evalArray(arg2());

      return data.filter((val) => removeValues.includes(val) === false);
    },
    FILTER_VALUES: filterValues,
    INCLUDES_VALUES: filterValues,
    GET: (arg1, arg2) => {
      const key = string(arg1());
      const inputObj = obj(arg2());

      return get(inputObj, key);
    },
    PUT: (arg1, arg2, arg3) => {
      const key = string(arg1());
      const value = arg2();
      const inputObj = obj(arg3());

      return Object.assign({}, inputObj, { [key]: value });
    },
    DICT: (arg1, arg2) => {
      const arr1 = evalArray(arg1());
      const arr2 = evalArray(arg2());
      const result: { [key: string]: ExpressionValue } = {};

      arr1.forEach((v1, i) => {
        const key = string(v1);
        result[key] = arr2[i];
      });

      return result;
    },
    UNZIPDICT: (arg1) => {
      const arr = evalArray(arg1());
      const result: { [key: string]: ExpressionValue } = {};

      arr.forEach((item) => {
        const kvPair = array(item);
        if (kvPair.length !== 2) {
          throw new Error(`UNZIPDICT: Expected sub-array of length 2`);
        }

        const [key, value] = kvPair;

        try {
          result[evalString(key)] = value;
        } catch (err) {
          throw new Error(`UNZIPDICT keys; ${err.message}`);
        }
      });

      return result;
    },
    KEYS: (arg1) => {
      const inputObj = obj(arg1());
      return Object.keys(inputObj).sort();
    },
    VALUES: (arg1) => {
      const inputObj = obj(arg1());
      return Object.keys(inputObj)
        .sort()
        .map((key) => inputObj[key]);
    },
  };

  // Ensure arguments are unpacked accordingly
  // Except for the ARRAY constructor
  Object.keys(prefixOps).forEach((key) => {
    if (key !== 'ARRAY') {
      // @ts-ignore
      prefixOps[key] = unpackArgs(prefixOps[key]);
    }
  });

  return {
    ESCAPE_CHAR: '\\',
    INFIX_OPS: infixOps,
    PREFIX_OPS: prefixOps,
    PRECEDENCE: [
      Object.keys(prefixOps),
      ['^'],
      ['*', '/', '%', 'MOD'],
      ['+', '-'],
      ['<', '>', '<=', '>='],
      ['=', '!=', '<>', '~='],
      ['AND', 'OR'],
      [','],
    ],
    LITERAL_OPEN: '"',
    LITERAL_CLOSE: '"',
    GROUP_OPEN: '(',
    GROUP_CLOSE: ')',
    SEPARATOR: ' ',
    SYMBOLS: [
      '^',
      '*',
      '/',
      '%',
      '+',
      '-',
      '<',
      '>',
      '=',
      '!',
      ',',
      '"',
      '(',
      ')',
      '[',
      ']',
      '~',
      '?',
    ],
    AMBIGUOUS: {
      '-': 'NEG',
    },
    SURROUNDING: {
      ARRAY: {
        OPEN: '[',
        CLOSE: ']',
      },
    },
    // @ts-ignore
    termDelegate: function (term: string) {
      const numVal = parseFloat(term);
      if (Number.isNaN(numVal)) {
        switch (term.toUpperCase()) {
          case 'E':
            return Math.E;
          case 'LN2':
            return Math.LN2;
          case 'LN10':
            return Math.LN10;
          case 'LOG2E':
            return Math.LOG2E;
          case 'LOG10E':
            return Math.LOG10E;
          case 'PI':
            return Math.PI;
          case 'SQRTHALF':
            return Math.SQRT1_2;
          case 'SQRT2':
            return Math.SQRT2;
          case 'FALSE':
            return false;
          case 'TRUE':
            return true;
          case 'EMPTY':
            return [];
          case 'EMPTYDICT':
            return {};
          case 'INFINITY':
            return Number.POSITIVE_INFINITY;
          case 'EPSILON':
            return Number.EPSILON;
          case 'UNDEFINED':
            return undefined;
          default:
            return termDelegate(term);
        }
      } else {
        return numVal;
      }
    },

    termTyper: function (term: string): TermType {
      const numVal = parseFloat(term);

      if (Number.isNaN(numVal)) {
        switch (term.toUpperCase()) {
          case 'E':
            return 'number';
          case 'LN2':
            return 'number';
          case 'LN10':
            return 'number';
          case 'LOG2E':
            return 'number';
          case 'LOG10E':
            return 'number';
          case 'PI':
            return 'number';
          case 'SQRTHALF':
            return 'number';
          case 'SQRT2':
            return 'number';
          case 'FALSE':
            return 'boolean';
          case 'TRUE':
            return 'boolean';
          case 'EMPTY':
            return 'array';
          case 'INFINITY':
            return 'number';
          case 'EPSILON':
            return 'number';
          default:
            return termTypeDelegate ? termTypeDelegate(term) : 'unknown';
        }
      } else {
        return 'number';
      }
    },

    isCaseInsensitive: true,

    descriptions: [
      {
        op: '+',
        fix: 'infix',
        sig: ['a: Number', 'b: Number', 'Number'],
        text: 'Performs addition: a + b',
      },
      {
        op: 'ADD',
        fix: 'prefix',
        sig: ['a: Number', 'b: Number', 'Number'],
        text: 'Performs addition: ADD(a, b) = a + b',
      },
      {
        op: '*',
        fix: 'infix',
        sig: ['a: Number', 'b: Number', 'Number'],
        text: 'Performs multiplication: a * b',
      },
      {
        op: 'MUL',
        fix: 'prefix',
        sig: ['a: Number', 'b: Number', 'Number'],
        text: 'Performs multiplication: MUL(a, b) = a * b',
      },
      {
        op: '-',
        fix: 'infix',
        sig: ['a: Number', 'b: Number', 'Number'],
        text: 'Performs subtraction: a - b',
      },
      {
        op: 'SUB',
        fix: 'prefix',
        sig: ['a: Number', 'b: Number', 'Number'],
        text: 'Performs subtraction: SUB(a, b) = a - b',
      },
      {
        op: '/',
        fix: 'infix',
        sig: ['a: Number', 'b: Number', 'Number'],
        text: 'Performs division: a / b',
      },
      {
        op: 'DIV',
        fix: 'prefix',
        sig: ['a: Number', 'b: Number', 'Number'],
        text: 'Performs division: DIV(a, b) = a / b',
      },
      {
        op: ',',
        fix: 'infix',
        sig: ['a', 'b', 'Arguments'],
        text: 'Returns an array of arguments with b appended to a. If a is not an argument array, it is automatically appended to an empty array.',
      },
      {
        op: 'MOD',
        fix: 'prefix',
        sig: ['a: Number', 'b: Number', 'Number'],
        text: 'Performs modulo operation: MOD(a, b). (equivalent to a % b)',
      },
      {
        op: '%',
        fix: 'infix',
        sig: ['a: Number', 'b: Number', 'Number'],
        text: 'Performs modulo operation: a % b. (equivalent to MOD(a, b))',
      },
      {
        op: '=',
        fix: 'infix',
        sig: ['a', 'b', 'Boolean'],
        text: 'Returns TRUE if a = b. Otherwise returns FALSE.',
      },
      {
        op: '!=',
        fix: 'infix',
        sig: ['a: Number', 'b: Number', 'Number'],
        text: 'Returns FALSE if a = b. Otherwise returns TRUE. (equivalent to <>)',
      },
      {
        op: '<>',
        fix: 'infix',
        sig: ['a: Number', 'b: Number', 'Number'],
        text: 'Returns FALSE if a = b. Otherwise returns TRUE. (equivalent to !=)',
      },
      {
        op: '~=',
        fix: 'infix',
        sig: ['a: Number', 'b: Number', 'Number'],
        text: 'Returns TRUE if ABS(a - b) < EPSILON. Otherwise returns FALSE.',
      },
      {
        op: '>',
        fix: 'infix',
        sig: ['a: Number', 'b: Number', 'Boolean'],
        text: 'Performs greater-than operation: a > b',
      },
      {
        op: '<',
        fix: 'infix',
        sig: ['a: Number', 'b: Number', 'Boolean'],
        text: 'Performs less-than operation: a < b',
      },
      {
        op: '>=',
        fix: 'infix',
        sig: ['a: Number', 'b: Number', 'Boolean'],
        text: 'Performs greater-than-or-equal operation: a >= b',
      },
      {
        op: '<=',
        fix: 'infix',
        sig: ['a: Number', 'b: Number', 'Boolean'],
        text: 'Performs less-than-or-equal operation: a <= b',
      },
      {
        op: 'AND',
        fix: 'infix',
        sig: ['a: Boolean', 'b: Boolean', 'Boolean'],
        text: 'Performs logical AND: a AND b.',
      },
      {
        op: 'OR',
        fix: 'infix',
        sig: ['a: Boolean', 'b: Boolean', 'Boolean'],
        text: 'Performs logical OR: a OR b.',
      },
      {
        op: '^',
        fix: 'infix',
        sig: ['a: Number', 'b: Number', 'Number'],
        text: 'Performs exponentiation (a to the power of b): a ^ b',
      },
      {
        op: 'NEG',
        fix: 'prefix',
        sig: ['value: Number', 'Number'],
        text: 'Performs negation of the value: NEG(value). (equivalent to -value)',
      },
      {
        op: '-',
        fix: 'prefix',
        sig: ['value: Number', 'Number'],
        text: 'Performs negation of the value: -value. Note: no space can be present before "value". (equivalent to NEG(value))',
      },
      {
        op: 'ISPRIME',
        fix: 'prefix',
        sig: ['value: Number', 'Number'],
        text: 'Returns TRUE if value is prime, FALSE otherwise.',
      },
      {
        op: 'GCD',
        fix: 'prefix',
        sig: ['a: Number', 'b: Number', 'Number'],
        text: 'Returns the greatest common divisor of a and b.',
      },
      {
        op: 'NOT',
        fix: 'prefix',
        sig: ['value: Boolean', 'Boolean'],
        text: 'Performs logical NOT of the value: NOT(value). (equivalent to !value)',
      },
      {
        op: '!',
        fix: 'prefix',
        sig: ['value: Boolean', 'Boolean'],
        text: 'Performs logical NOT of the value: !value. (equivalent to NOT(value))',
      },
      {
        op: 'ABS',
        fix: 'prefix',
        sig: ['value: Number', 'Number'],
        text: 'Returns the absolute value of the number: ABS(value).',
      },
      {
        op: 'ACOS',
        fix: 'prefix',
        sig: ['value: Number', 'Number'],
        text: 'Returns the arc cosine (inverse cosine) of the number: ACOS(value).',
      },
      {
        op: 'ACOSH',
        fix: 'prefix',
        sig: ['value: Number', 'Number'],
        text: 'Returns the inverse hyperbolic cosine of the number: ACOSH(value).',
      },
      {
        op: 'ASIN',
        fix: 'prefix',
        sig: ['value: Number', 'Number'],
        text: 'Returns the arcsine of the number: ASIN(value).',
      },
      {
        op: 'ASINH',
        fix: 'prefix',
        sig: ['value: Number', 'Number'],
        text: 'Returns the inverse hyperbolic sine of the number: ASINH(value).',
      },
      {
        op: 'ATAN',
        fix: 'prefix',
        sig: ['value: Number', 'Number'],
        text: 'Returns the arctangent of the number: ATAN(value).',
      },
      {
        op: 'ATAN2',
        fix: 'prefix',
        sig: ['y: Number', 'x: Number', 'Number'],
        text: 'Returns the angle (radians) from the X-axis to a point, given a cartesian y-coordinate and x-coordinate: ATAN2(y, x).',
      },
      {
        op: 'ATANH',
        fix: 'prefix',
        sig: ['value: Number', 'Number'],
        text: 'Returns the inverse hyperbolic tangent of the number: ATANH(value).',
      },
      {
        op: 'CUBEROOT',
        fix: 'prefix',
        sig: ['value: Number', 'Number'],
        text: 'Returns an approximation of the cubed root of the number: CUBEROOT(value).',
      },
      {
        op: 'COS',
        fix: 'prefix',
        sig: ['value: Number', 'Number'],
        text: 'Returns the cosine of the number: COS(value).',
      },
      {
        op: 'COSH',
        fix: 'prefix',
        sig: ['value: Number', 'Number'],
        text: 'Returns the hyperbolic cosine of the number: COSH(value).',
      },
      {
        op: 'EXP',
        fix: 'prefix',
        sig: ['value: Number', 'Number'],
        text: 'Returns the natural logarithm (e) raised to this value: EXP(value).',
      },
      {
        op: 'LN',
        fix: 'prefix',
        sig: ['value: Number', 'Number'],
        text: 'Returns the natural logarithm (base e) of the number: LN(value).',
      },
      {
        op: 'LOG',
        fix: 'prefix',
        sig: ['value: Number', 'Number'],
        text: 'Returns the base 10 logarithm of the number: LOG(value).',
      },
      {
        op: 'LOG2',
        fix: 'prefix',
        sig: ['value: Number', 'Number'],
        text: 'Returns the base 2 logarithm of the number: LOG2(value).',
      },
      {
        op: 'SIN',
        fix: 'prefix',
        sig: ['value: Number', 'Number'],
        text: 'Returns the sine of the number: SIN(value).',
      },
      {
        op: 'SINH',
        fix: 'prefix',
        sig: ['value: Number', 'Number'],
        text: 'Returns the hyperbolic sine of the number: SINH(value).',
      },
      {
        op: 'SQRT',
        fix: 'prefix',
        sig: ['value: Number', 'Number'],
        text: 'Returns the square root of the number: SQRT(value).',
      },
      {
        op: 'TAN',
        fix: 'prefix',
        sig: ['value: Number', 'Number'],
        text: 'Returns the tangent of the number: TAN(value).',
      },
      {
        op: 'TANH',
        fix: 'prefix',
        sig: ['value: Number', 'Number'],
        text: 'Returns the hyperbolic tangent of the number: TANH(value).',
      },
      {
        op: 'DEGREES',
        fix: 'prefix',
        sig: ['radians: Number', 'Number'],
        text: 'Performs a conversion of radians to degrees: DEGREES(radians).',
      },
      {
        op: 'RADIANS',
        fix: 'prefix',
        sig: ['degrees: Number', 'Number'],
        text: 'Performs a conversion of radians to degrees: RADIANS(degrees).',
      },
      {
        op: 'CEIL',
        fix: 'prefix',
        sig: ['value: Number', 'Number'],
        text: 'Returns the smallest integer greater-than or equal-to the number: CEIL(value).',
      },
      {
        op: 'FLOOR',
        fix: 'prefix',
        sig: ['value: Number', 'Number'],
        text: 'Returns the greatest integer less-than or equal-to the number: CEIL(value).',
      },
      {
        op: 'ROUND',
        fix: 'prefix',
        sig: ['value: Number', 'Number'],
        text: 'Returns the value rounded to the nearest integer: ROUND(value).',
      },
      {
        op: 'TRUNC',
        fix: 'prefix',
        sig: ['value: Number', 'Number'],
        text: 'Returns the integral part of the number, truncating any fractional digits: TRUNC(value).',
      },
      {
        op: 'SIGN',
        fix: 'prefix',
        sig: ['value: Number', 'Number'],
        text: 'Returns the sign of the value, indicating whether the number is positive (1) or negative (-1): SIGN(value).',
      },
      {
        op: 'ISNAN',
        fix: 'prefix',
        sig: ['value', 'Boolean'],
        text: 'Returns TRUE if a value is not a number (e.g. the result of an invalid mathematical operation), otherwise returns FALSE: ISNAN(value).',
      },
      {
        op: 'IF',
        fix: 'prefix',
        sig: ['condition: Boolean', 'then', 'else', 'result'],
        text: 'Tests the condition and returns the "then" value if the condition is TRUE, otherwise returns the "else" value: IF(condition, then, else).',
      },
      {
        op: 'AVERAGE',
        fix: 'prefix',
        sig: ['values: Array of Numbers', 'Number'],
        text: 'Returns the average (mean) of an array of numbers. AVERAGE(array).',
      },
      {
        op: 'SUM',
        fix: 'prefix',
        sig: ['values: Array of Numbers', 'Number'],
        text: 'Returns the sum of an array of numbers. SUM(array).',
      },
      {
        op: 'MIN',
        fix: 'prefix',
        sig: ['values: Array of Numbers', 'Number'],
        text: 'Returns the minimum value in an array of numbers. MIN(array).',
      },
      {
        op: 'MAX',
        fix: 'prefix',
        sig: ['values: Array of Numbers', 'Number'],
        text: 'Returns the maximum value in an array of numbers. MAX(array).',
      },
      {
        op: 'CHAR',
        fix: 'prefix',
        sig: ['code: Integer', 'String'],
        text: 'Returns a single-character string with a unicode character representing the value of the given code. CHAR(code)',
      },
      {
        op: 'CODE',
        fix: 'prefix',
        sig: ['string: String', 'Integer'],
        text: 'Returns the unicode value of the first character of a string: CODE(string)',
      },
      {
        op: 'UPPER',
        fix: 'prefix',
        sig: ['string: String', 'String'],
        text: 'Converts a string to uppercase: UPPER(string).',
      },
      {
        op: 'LOWER',
        fix: 'prefix',
        sig: ['string: String', 'String'],
        text: 'Converts a string to lowercase: LOWER(string).',
      },
      {
        op: 'DEC2BIN',
        fix: 'prefix',
        sig: ['decimal: Integer', 'binary: String'],
        text: 'Returns a string of "1" and "0" characters representing the binary representation of the decimal value. DEC2BIN(decimal)',
      },
      {
        op: 'DEC2HEX',
        fix: 'prefix',
        sig: ['decimal: Integer', 'hex: String'],
        text: 'Returns a string of characters representing the hexadecimal representation of the decimal value. DEC2HEX(decimal)',
      },
      {
        op: 'BIN2DEC',
        fix: 'prefix',
        sig: ['binary: String', 'decimal: Integer'],
        text: 'Returns the base 10 value of a binary string of "1" and "0" characters. BIN2DEC(binary)',
      },
      {
        op: 'HEX2DEC',
        fix: 'prefix',
        sig: ['hex: String', 'decimal: Integer'],
        text: 'Returns the base 10 value of a hexadecimal string. HEX2DEC(hex)',
      },
      {
        op: 'SORT',
        fix: 'prefix',
        sig: ['array: Array', 'Array'],
        text: 'Returns a sorted array: SORT(array).',
      },
      {
        op: 'REVERSE',
        fix: 'prefix',
        sig: ['array: Array', 'Array'],
        text: 'Returns a reversed array: REVERSE(array).',
      },
      {
        op: 'INDEX',
        fix: 'prefix',
        sig: ['array: Array', 'i: Integer', 'Value'],
        text: 'Returns the value at the given array index: INDEX(array, i).',
      },
      {
        op: 'LENGTH',
        fix: 'prefix',
        sig: ['array: Array', 'Integer'],
        text: 'Returns the length of an array: LENGTH(array).',
      },
      {
        op: 'JOIN',
        fix: 'prefix',
        sig: ['array: Array', 'separator: String', 'String'],
        text: 'Joins each array element into a string, using a separator: JOIN(array, separator).',
      },
      {
        op: 'SPLIT',
        fix: 'prefix',
        sig: ['string: String', 'separator: String', 'Array'],
        text: 'Splits a string into an array of characters, using a separator: SPLIT(string, separator).',
      },
      {
        op: 'STRING',
        fix: 'prefix',
        sig: ['array: Array', 'String'],
        text: 'Converts an array into a string: STRING(array).',
      },
      {
        op: 'CHARARRAY',
        fix: 'prefix',
        sig: ['string: String', 'Array'],
        text: 'Converts a string into an array of characters: CHARARRAY(string)',
      },
      {
        op: 'ARRAY',
        fix: 'prefix',
        sig: ['arguments...', 'Array'],
        text: 'Converts arguments into an array: ARRAY(a, b, c, ...).',
      },
      {
        op: 'MAP',
        fix: 'prefix',
        sig: ['mapper: Reference', 'array: Array', 'Array'],
        text: 'Performs a mapper function on each element of the array: MAP(mapper, array).',
      },
      {
        op: 'REDUCE',
        fix: 'prefix',
        sig: ['reducer: Reference', 'start', 'array: Array', 'Array'],
        text: 'Performs a reducer function on each pair of array elements, using "start" as its starting value: REDUCE(reducer, array).',
      },
      {
        op: 'RANGE',
        fix: 'prefix',
        sig: ['start: Integer', 'limit: Integer', 'Array'],
        text: 'Creates an array of integers, incrementing from start (included) to the limit (excluded): RANGE(start, limit)',
      },
      {
        op: 'ZIP',
        fix: 'prefix',
        sig: [
          'array1: Array',
          'array2: Array',
          'Array of [array1[i], array2[i]]',
        ],
        text: 'Combines two arrays into a single array of both values, paired at their respective position: ZIP(array1, array2)',
      },
      {
        op: 'UNZIP',
        fix: 'prefix',
        sig: ['array: Array of [a, b]', '[Array of a, Array of b]'],
        text: 'Splits a single array of pairs into two arrays with values at their respective positions: UNZIP(array)',
      },
      {
        op: 'TAKE',
        fix: 'prefix',
        sig: ['n: Integer', 'Array'],
        text: 'Takes the first n values from the array: TAKE(n, array)',
      },
      {
        op: 'DROP',
        fix: 'prefix',
        sig: ['n: Integer', 'Array'],
        text: 'Drops the first n values from the array: DROP(n, array)',
      },
      {
        op: 'SLICE',
        fix: 'prefix',
        sig: ['startIndex: Integer', 'limitIndex: Integer', 'Array'],
        text: 'Slices an array from startIndex to (but not including) limitIndex: SLICE(startIndex, limitIndex, array)',
      },
      {
        op: 'CONCAT',
        fix: 'prefix',
        sig: ['array1: Array', 'array2: Array', 'Array'],
        text: 'Concatenates two arrays into one: CONCAT(array1, array2)',
      },
      {
        op: 'HEAD',
        fix: 'prefix',
        sig: ['array: Array', 'Value'],
        text: 'Retrieves the first element of an array: HEAD(array)',
      },
      {
        op: 'TAIL',
        fix: 'prefix',
        sig: ['array: Array', 'Array'],
        text: 'Returns the array without the first element: TAIL(array)',
      },
      {
        op: 'LAST',
        fix: 'prefix',
        sig: ['array: Array', 'Value'],
        text: 'Retrieves the last element of an array: HEAD(array)',
      },
      {
        op: 'CONS',
        fix: 'prefix',
        sig: ['head: Value', 'array: Array', 'Array'],
        text: 'Returns an array with a new value at the first position: CONS(head, array)',
      },
      {
        op: 'FILTER',
        fix: 'prefix',
        sig: ['filter: Reference', 'array: Array', 'Array'],
        text: "Returns an array of all elements for which 'filter(element)' returns true: FILTER(filter, array).",
      },
      {
        op: 'TAKEWHILE',
        fix: 'prefix',
        sig: ['check: Reference', 'array: Array', 'Array'],
        text: "Returns a new array of all elements up until 'check(element)' returns false: TAKEWHILE(check, array).",
      },
      {
        op: 'DROPWHILE',
        fix: 'prefix',
        sig: ['check: Reference', 'array: Array', 'Array'],
        text: "Returns a new array skipping all elements up until 'check(element)' returns false: DROPWHILE(check, array).",
      },
      {
        op: 'GET',
        fix: 'prefix',
        sig: ['key: String', 'dict: Dictionary', 'Value'],
        text: 'Retrieves the value of the associated key in a dictionary: GET(key, dict)',
      },
      {
        op: 'PUT',
        fix: 'prefix',
        sig: ['key: String', 'value: Value', 'dict: Dictionary', 'Dictionary'],
        text: 'Returns a dictionary with the key set to a new value: PUT(key, value, dict)',
      },
      {
        op: 'DICT',
        fix: 'prefix',
        sig: ['keys: Array', 'values: Array', 'Dictionary'],
        text: 'Constructs a new dictionary out of an array of keys and a corresponding array of values: DICT(keys, values)',
      },
      {
        op: 'UNZIPDICT',
        fix: 'prefix',
        sig: ['keyValuePairs: Array', 'Dictionary'],
        text: 'Constructs a new dictionary out of an array of [key, value] pairs: UNZIPDICT(keyValuePairs)',
      },
      {
        op: 'KEYS',
        fix: 'prefix',
        sig: ['dict: Dictionary', 'Array'],
        text: 'Returns all the keys of a dictionary in alphabetical order: KEYS(dict)',
      },
      {
        op: 'VALUES',
        fix: 'prefix',
        sig: ['dict: Dictionary', 'Array'],
        text: 'Returns all the values of a dictionary, in alphabetical order of their keys: VALUES(dict)',
      },
      {
        op: '[...]',
        fix: 'surround',
        sig: ['arguments...', 'Array'],
        text: 'Converts arguments into an array: [a, b, c, ...].',
      },
    ],
  };
};
