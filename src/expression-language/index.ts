/* eslint-disable @typescript-eslint/restrict-template-expressions */
import {
  ArgumentsArray,
  ExpressionArray,
  ExpressionParserOptions,
  ExpressionThunk,
  ExpressionValue,
  InfixOps,
  isArgumentsArray,
  TermDelegate,
  TermType,
  TermTyper,
} from "expressionparser/dist/ExpressionParser.js";
import get from "lodash/get.js";
import { toArray } from "../utils/utils";
import {
  array,
  char,
  containsValues,
  countObjectKeys,
  dateParser,
  evalArray,
  evalBool,
  evalString,
  filterValues,
  iterable,
  num,
  obj,
  objectContainsValues,
  omitProperties,
  string,
  unpackArgs,
} from "./utils";

const hasOwnProperty = (obj: object, key: string) =>
  Object.prototype.hasOwnProperty.call(obj, key);
export interface FunctionOps {
  [op: string]: (...args: ExpressionThunk[]) => ExpressionValue;
}

export const assignmentOperators = ["=", "+=", "-=", "*=", "/=", "??="];
/*
TODO: Look into additional modifier operators:

- `**=`
- `%=`
- `||=`
*/

const getInfixOps = (termDelegate: TermDelegate): InfixOps => ({
  "+": (a, b) => num(a()) + num(b()),
  "-": (a, b) => num(a()) - num(b()),
  "*": (a, b) => num(a()) * num(b()),
  "/": (a, b) => num(a()) / num(b()),
  ",": (a, b): ArgumentsArray => {
    const aVal = a();
    const aArr: ExpressionArray<ExpressionValue> = isArgumentsArray(aVal)
      ? aVal
      : [() => aVal];
    const args: ExpressionArray<ExpressionValue> = aArr.concat([b]);
    args.isArgumentsArray = true;
    return args as ArgumentsArray;
  },
  "%": (a, b) => num(a()) % num(b()),
  "=": (_, b) => b(),
  "+=": (a, b) => num(a()) + num(b()),
  "-=": (a, b) => num(a()) - num(b()),
  "*=": (a, b) => num(a()) * num(b()),
  "/=": (a, b) => num(a()) / num(b()),
  "??=": (a, b) => a() ?? b(),
  "==": (a, b) => a() === b(),
  "!=": (a, b) => a() !== b(),
  "<>": (a, b) => a() !== b(),
  "~=": (a, b) => Math.abs(num(a()) - num(b())) < Number.EPSILON,
  ">": (a, b) => a() > b(),
  "<": (a, b) => a() < b(),
  ">=": (a, b) => a() >= b(),
  "<=": (a, b) => a() <= b(),
  AND: (a, b) => a() && b(),
  OR: (a, b) => a() || b(),
  "^": (a, b) => Math.pow(num(a()), num(b())),
});

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
    if (hasOwnProperty(prefixOps, upperName)) {
      return (...args) => {
        args.isArgumentsArray = true;
        return prefixOps[upperName](() => args);
      };
    } else if (hasOwnProperty(infixOps, upperName)) {
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
      for (let i = 2, s = Math.sqrt(val); i <= s; i++)
        if (val % i === 0) return false;

      return val !== 1;
    },
    GCD: (arg1, arg2) => {
      let a = num(arg1());
      let b = num(arg2());
      a = Math.abs(a);
      b = Math.abs(b);
      if (b > a) {
        const temp = a;
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
      if (typeof dateArg === "string" || typeof dateArg === "number")
        return new Date(dateParser(dateArg)).toISOString();

      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      return `UnknownDate(${dateArg?.valueOf()})`;
    },
    NOT: (arg) => !arg(),
    "!": (arg) => !arg(),
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

      if (condition()) return thenStatement();
      else return elseStatement();
    },

    AVERAGE: (arg) => {
      const arr = evalArray(arg());

      const sum = arr.reduce(
        (prev: number, curr: ExpressionValue): number => prev + num(curr),
        0
      );
      return num(sum) / arr.length;
    },

    SUM: (arg) =>
      evalArray(arg(), num).reduce(
        (prev: number, curr: ExpressionValue) => prev + num(curr),
        0
      ),
    CHAR: (arg) => String.fromCharCode(num(arg())),
    CODE: (arg) => char(arg()).charCodeAt(0),

    DEC2BIN: (arg) => Number.parseInt(string(arg())).toString(2),
    DEC2HEX: (arg) => Number.parseInt(string(arg())).toString(16),
    DEC2STR: (arg) => Number.parseInt(string(arg())).toString(10),
    BIN2DEC: (arg) => Number.parseInt(string(arg()), 2),
    HEX2DEC: (arg) => Number.parseInt(string(arg()), 16),
    STR2DEC: (arg) => Number.parseInt(string(arg()), 10),
    DEGREES: (arg) => (num(arg()) * 180) / Math.PI,
    RADIANS: (arg) => (num(arg()) * Math.PI) / 180,

    MIN: (arg) =>
      evalArray(arg()).reduce(
        (prev: number, curr: ExpressionValue) => Math.min(prev, num(curr)),
        Number.POSITIVE_INFINITY
      ),
    MAX: (arg) =>
      evalArray(arg()).reduce(
        (prev: number, curr: ExpressionValue) => Math.max(prev, num(curr)),
        Number.NEGATIVE_INFINITY
      ),
    SORT: (arg) => {
      const arr = array(arg()).slice();
      arr.sort((a, b) => num(a) - num(b));
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
    STRING: (arg) => evalArray(arg()).join(""),
    STRING_CONTAINS: (arg1, arg2) => string(arg2()).includes(string(arg1())),
    STRING_ENDS_WITH: (arg1, arg2) => string(arg2()).endsWith(string(arg1())),
    STRING_STARTS_WITH: (arg1, arg2) =>
      string(arg2()).startsWith(string(arg1())),
    SPLIT: (arg1, arg2) => string(arg2()).split(string(arg1())),

    CHARARRAY: (arg) => {
      const str = string(arg());
      return str.split("");
    },
    ARRAY: (arg) => array(arg()),
    ISNAN: (arg) => isNaN(num(arg())),
    MAP: (arg1, arg2) => {
      const func = arg1();
      const arr = evalArray(arg2());
      return arr.map((val: ExpressionValue) => {
        if (typeof func === "function") return () => func(val);
        else return call(string(func))(() => val);
      });
    },
    REDUCE: (arg1, arg2, arg3) => {
      const func = arg1();
      const start = arg2();
      const arr = evalArray(arg3());
      return arr.reduce((prev: ExpressionValue, curr: ExpressionValue) => {
        const args: ExpressionArray<ExpressionThunk> = [() => prev, () => curr];
        if (typeof func === "function") return func(...args);
        else return call(string(func))(...args);
      }, start);
    },
    RANGE: (arg1, arg2) => {
      const start = num(arg1());
      const limit = num(arg2());
      const result = [];
      for (let i = start; i < limit; i++) result.push(i);

      return result;
    },
    UPPER: (arg) => string(arg()).toUpperCase(),
    LOWER: (arg) => string(arg()).toLowerCase(),

    ZIP: (arg1, arg2) => {
      const arr1 = evalArray(arg1());
      const arr2 = evalArray(arg2());

      if (arr1.length !== arr2.length)
        throw new Error("ZIP: Arrays are of different lengths");
      else return arr1.map((v1: ExpressionValue, i: number) => [v1, arr2[i]]);
    },
    UNZIP: (arg1) => {
      const inputArr = evalArray(arg1());
      const arr1 = inputArr.map((item: ExpressionValue) => array(item)[0]);
      const arr2 = inputArr.map((item: ExpressionValue) => array(item)[1]);
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
      arr.forEach((val: ExpressionValue) => {
        let isSatisfied;
        if (typeof func === "function") isSatisfied = evalBool(func(val));
        else isSatisfied = evalBool(call(string(func))(() => val));

        if (isSatisfied) result.push(val);
      });

      return result;
    },
    TAKEWHILE: (arg1, arg2) => {
      const func = arg1();
      const arr = evalArray(arg2());

      const satisfaction = (val: ExpressionValue) => {
        let isSatisfied;
        if (typeof func === "function") isSatisfied = evalBool(func(val));
        else isSatisfied = evalBool(call(string(func))(() => val));

        return isSatisfied;
      };

      let i = 0;
      while (satisfaction(arr[i]) && i < arr.length) i++;

      return arr.slice(0, i);
    },
    DROPWHILE: (arg1, arg2) => {
      const func = arg1();
      const arr = evalArray(arg2());

      const satisfaction = (val: ExpressionValue) => {
        let isSatisfied;
        if (typeof func === "function") isSatisfied = evalBool(func(val));
        else isSatisfied = evalBool(call(string(func))(() => val));

        return isSatisfied;
      };

      let i = 0;
      while (satisfaction(arr[i]) && i < arr.length) i++;

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
    OBJECT_CONTAINS: objectContainsValues,
    COUNT_KEYS: countObjectKeys,
    OMIT: omitProperties,
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

      return data.filter((val: ExpressionValue) => !removeValues.includes(val));
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

      arr1.forEach((v1: ExpressionValue, i: number) => {
        const key = string(v1);
        result[key] = arr2[i];
      });

      return result;
    },
    UNZIPDICT: (arg1) => {
      const arr = evalArray(arg1());
      const result: { [key: string]: ExpressionValue } = {};

      arr.forEach((item: ExpressionValue) => {
        const kvPair = array(item);
        if (kvPair.length !== 2)
          throw new Error("UNZIPDICT: Expected sub-array of length 2");

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
    if (key !== "ARRAY") {
      // @ts-expect-error
      prefixOps[key] = unpackArgs(prefixOps[key]);
    }
  });

  return {
    ESCAPE_CHAR: "\\",
    INFIX_OPS: infixOps,
    PREFIX_OPS: prefixOps,
    PRECEDENCE: [
      Object.keys(prefixOps),
      ["^"],
      ["*", "/", "%", "MOD"],
      ["+", "-"],
      ["<", ">", "<=", ">="],
      ["=", "!=", "<>", "~="],
      ["AND", "OR"],
      [","],
    ],
    LITERAL_OPEN: '"',
    LITERAL_CLOSE: '"',
    GROUP_OPEN: "(",
    GROUP_CLOSE: ")",
    SEPARATOR: " ",
    SYMBOLS: [
      "^",
      "*",
      "/",
      "%",
      "+",
      "-",
      "<",
      ">",
      "=",
      "!",
      ",",
      '"',
      "(",
      ")",
      "[",
      "]",
      "~",
      "?",
    ],
    AMBIGUOUS: {
      "-": "NEG",
    },
    SURROUNDING: {
      ARRAY: {
        OPEN: "[",
        CLOSE: "]",
      },
    },
    // @ts-expect-error
    termDelegate: function (term: string) {
      const numVal = parseFloat(term);
      if (Number.isNaN(numVal)) {
        switch (term.toUpperCase()) {
          case "E":
            return Math.E;
          case "LN2":
            return Math.LN2;
          case "LN10":
            return Math.LN10;
          case "LOG2E":
            return Math.LOG2E;
          case "LOG10E":
            return Math.LOG10E;
          case "PI":
            return Math.PI;
          case "SQRTHALF":
            return Math.SQRT1_2;
          case "SQRT2":
            return Math.SQRT2;
          case "FALSE":
            return false;
          case "TRUE":
            return true;
          case "EMPTY":
            return [];
          case "EMPTYDICT":
            return {};
          case "INFINITY":
            return Number.POSITIVE_INFINITY;
          case "EPSILON":
            return Number.EPSILON;
          case "UNDEFINED":
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
          case "E":
            return "number";
          case "LN2":
            return "number";
          case "LN10":
            return "number";
          case "LOG2E":
            return "number";
          case "LOG10E":
            return "number";
          case "PI":
            return "number";
          case "SQRTHALF":
            return "number";
          case "SQRT2":
            return "number";
          case "FALSE":
            return "boolean";
          case "TRUE":
            return "boolean";
          case "EMPTY":
            return "array";
          case "INFINITY":
            return "number";
          case "EPSILON":
            return "number";
          default:
            return termTypeDelegate ? termTypeDelegate(term) : "unknown";
        }
      } else {
        return "number";
      }
    },

    isCaseInsensitive: true,

    descriptions: [],
  };
};
