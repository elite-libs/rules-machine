// import debug from 'debug';
import get from 'lodash/get.js';
import set from 'lodash/set.js';
import { isBoolean, isNumber, autoDetectType, toArray } from './utils/utils';
import performance from './utils/performance';
import {
  assignmentOperators,
  ruleExpressionLanguage,
} from './expression-language';
import { init } from 'expressionparser';
import { ExpressionValue } from 'expressionparser/dist/ExpressionParser.js';
import { UserError } from './utils/errors';

const trailingQuotes = /^('|").*('|")$/g;

// const oneify = <TList>(value?: TList[] | TList) => value != null && Array.isArray(value) && value.length === 1 ? value[0] : value;
const serialize = (data: unknown) =>
  data !== null && typeof data === 'object' ? JSON.stringify(data) : data;

interface RuleMachineOptions {
  trace?: boolean;
  ignoreMissingKeys?: boolean;
}

interface TraceRow {
  startTime?: number;
  runTime?: number;

  operation: string;
  rule?: Rule;
  input?: any;
  result?: any;
  stepRow?: number;
  stepCount?: number;
  lhs?: string;
  value?: ExpressionValue;
  error?: any;
  [key: string]: unknown;
}

const arrayMethods = ['map', 'filter', 'every', 'some', 'find'] as const;
const isArrayRule = (data: object) =>
  Object.keys(data).some((key) => key in arrayMethods);

export function ruleFactory<
  TInput extends {
    [k: string]: string | boolean | number | null | undefined | TInput;
  } = any,
>(
  rules: Rule,
  options: RuleMachineOptions | undefined = {
    trace: false,
    ignoreMissingKeys: true,
  },
) {
  if (typeof options === 'string')
    options = { name: options } as RuleMachineOptions;

  const { trace, ignoreMissingKeys = true } = options;
  // Validate, parse & load rules
  // Then return a function that takes an input object and returns a RuleTrace[]
  return function executeRulePipeline(input: TInput = {} as TInput) {
    const traceSimple: TraceRow[] = [];

    function logTrace({ operation, rule, ...args }: TraceRow) {
      if (trace) traceSimple.push({ operation, rule, ...args });
    }

    let stepRow = 0;
    let stepCount = 0;
    const BREAK = 'BREAK';
    const results = {
      input,
      trace: traceSimple,
      lastValue: input as any,
      returnValue: input as any,
    };

    checkInvalidKeys(input);

    // Note: previously used more complex logic here
    // TODO: refactor & remove the `getReturnValue()` function
    const getReturnValue = () => results.lastValue;

    const startTime = performance.now();
    logTrace({ operation: 'begin', startTime });

    const parser = init(ruleExpressionLanguage, (term: string) => {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      if (typeof term !== 'string') throw new Error(`Invalid term: ${term}`);
      try {
        const result =
          extractValueOrLiteral(
            input,
            term,
            stepRow,
            stepCount,
            ignoreMissingKeys,
          ) ?? get(input, term, undefined as any);
        // console.log(`TERM: ${term} => ${result}`);
        logTrace({
          operation: 'key.lookup',
          key: term,
          value: result,
          stepRow,
          stepCount,
        });
        return result;
      } catch (error) {
        logTrace({
          operation: 'error',
          error,
          rule: term,
          stepRow,
          stepCount,
        });
      }
    });

    const handleRule = (rule: Rule) => {
      if (typeof rule === 'string') {
        results.lastValue = evaluateRule({ stepRow, input, rule });
        if (trace)
          logTrace({
            operation: 'ruleString',
            rule,
            result: serialize(results.lastValue),
            currentState: serialize(input),
            stepRow,
            stepCount,
          });
      } else if (Array.isArray(rule)) {
        results.lastValue = rule.map((rule) =>
          // this alloms nested arrays of rules
          typeof rule === 'string'
            ? evaluateRule({ stepRow, input, rule, ignoreMissingKeys })
            : handleRule(rule),
        );
        if (trace)
          logTrace({
            operation: 'ruleString[]',
            rule,
            result: serialize(results.lastValue),
            currentState: serialize(input),
            stepRow,
            stepCount,
          });
      } else if ('if' in rule) {
        results.lastValue = input; // set the current state to the input object.

        let conditionResult: RuleResult;
        if (typeof rule.if === 'object' && 'and' in rule.if) {
          const and = toArray(rule.if.and);
          for (const rule of and) {
            conditionResult = evaluateRule({
              stepRow,
              input,
              rule,
            });
            if (!conditionResult) break;
          }
          if (trace)
            logTrace({
              operation: 'if.and',
              rule: and,
              result: serialize(conditionResult),
              currentState: serialize(input),
              stepRow,
              stepCount,
            });
        } else if (typeof rule.if === 'object' && 'or' in rule.if) {
          const or = toArray(rule.if.or);
          for (const rule of or) {
            conditionResult = evaluateRule({
              stepRow,
              input,
              rule,
            });
            if (conditionResult) break;
          }
          if (trace)
            logTrace({
              operation: 'if.or',
              rule: or,
              result: serialize(conditionResult),
              currentState: serialize(input),
              stepRow,
              stepCount,
            });
        } else if (typeof rule.if !== 'string' && Array.isArray(rule.if)) {
          throw new UserError(
            'The `if` value must be a string or logical object (e.g. `{and/if: []}`.) Arrays are currently not supported.',
          );
        } else if (typeof rule.if === 'string') {
          conditionResult = Boolean(
            evaluateRule({
              stepRow,
              input,
              rule: rule.if,
            }),
          );
          if (trace)
            logTrace({
              operation: 'if',
              rule: rule.if,
              result: serialize(conditionResult),
              currentState: serialize(input),
              stepRow,
              stepCount,
            });
        }
        // Now check the condition result
        if (conditionResult && rule.then) {
          if (trace)
            logTrace({
              operation: 'if.then',
              rule: rule.then,
              currentState: serialize(input),
              stepRow,
              stepCount,
            });
          handleRule(rule.then);
        } else if (!conditionResult && rule.else) {
          if (trace)
            logTrace({
              operation: 'if.else',
              rule: rule.else,
              currentState: serialize(input),
              stepRow,
              stepCount,
            });
          handleRule(rule.else);
        } else {
          results.lastValue = input;
        }
      } else if ('return' in rule) {
        const returnResult = evaluateRule({
          stepRow,
          input,
          rule: rule.return,
          ignoreMissingKeys: true,
        });
        results.lastValue = returnResult;
        results.returnValue = returnResult;
        if (trace)
          logTrace({
            operation: 'return',
            rule: rule.return,
            result: serialize(returnResult),
            currentState: serialize(input),
            stepRow,
            stepCount,
          });
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        return BREAK;
      } else if (isArrayRule(rule) && 'run' in rule) {
        const arrayRule =
          'map' in rule
            ? rule.map
            : 'filter' in rule
            ? rule.filter
            : 'every' in rule
            ? rule.every
            : 'some' in rule
            ? rule.some
            : rule.find;
        const arrayOperator = Object.keys(rule).find(
          (key) => key in arrayMethods,
        );
        if (!arrayOperator)
          throw new Error(`Invalid array rule: ${JSON.stringify(rule)}`);
        const arrayMethod =
          'map' in rule
            ? Array.prototype.map
            : 'filter' in rule
            ? Array.prototype.filter
            : 'every' in rule
            ? Array.prototype.every
            : 'some' in rule
            ? Array.prototype.some
            : Array.prototype.find;

        if (trace)
          logTrace({
            operation: `${arrayOperator}`,
            rule,
            currentState: serialize(input),
            stepRow,
            stepCount,
          });
        const data = get(input, arrayRule);
        if (data == null)
          throw new UserError(`No data found at '${arrayRule}'`);
        if (!Array.isArray(data))
          throw new UserError(`Data at '${arrayRule}' is not an array`);
        const arrayResult = arrayMethod.call(toArray(data), (item, index) => {
          Object.assign(input, { $item: item, $index: index, $array: data });

          // additional logic for array operations
          let conditionResult: RuleResult;
          if (
            arrayMethod === Array.prototype.filter &&
            typeof rule.run === 'object' &&
            'and' in rule.run
          ) {
            const and = toArray(rule.run.and);
            for (const rule of and) {
              conditionResult = evaluateRule({
                stepRow,
                input,
                rule,
              });
              if (!conditionResult) break;
            }
            if (trace)
              logTrace({
                operation: 'run.and',
                rule: and,
                result: serialize(conditionResult),
                currentState: serialize(input),
                stepRow,
                stepCount,
              });
          } else if (
            arrayMethod === Array.prototype.filter &&
            typeof rule.run === 'object' &&
            'or' in rule.run
          ) {
            const or = toArray(rule.run.or);
            for (const rule of or) {
              conditionResult = evaluateRule({
                stepRow,
                input,
                rule,
              });
              if (conditionResult) break;
            }
            if (trace)
              logTrace({
                operation: 'or.and',
                rule: or,
                result: serialize(conditionResult),
                currentState: serialize(input),
                stepRow,
                stepCount,
              });
          } else {
            handleRule(rule.run);
            conditionResult = results.lastValue;
          }
          return conditionResult;
        });
        results.lastValue = arrayResult;
        if ('set' in rule) {
          // @ts-expect-error
          set(input, rule.set, arrayResult);
        }
      } else if ('try' in rule && 'catch' in rule) {
        try {
          if (trace)
            logTrace({
              operation: 'try',
              rule: rule.try,
              currentState: serialize(input),
              stepRow,
              stepCount,
            });
          handleRule(rule.try);
        } catch (e) {
          logTrace({
            operation: 'catch',
            rule: rule.catch,
            currentState: serialize(input),
            stepRow,
            stepCount,
          });
          handleRule(rule.catch);
        }
      }
      return results.lastValue;
    };

    rules = toArray(rules);

    for (const rule of rules) {
      try {
        const ruleResult = handleRule(rule);
        if (ruleResult === BREAK) break;
      } catch (e) {
        logTrace({
          operation: 'error',
          runTime: performance.now() - startTime,
          stepCount,
          currentState: serialize(input),
          stepRow,
          lastValue: e?.message,
        });
        throw e;
      }
      stepRow++;
    }

    logTrace({
      operation: 'complete',
      runTime: performance.now() - startTime,
      stepCount,
      currentState: serialize(input),
      stepRow,
      lastValue: serialize(getReturnValue()),
    });

    if (trace) {
      // @ts-expect-error: todo: fix this, add proper type for Result
      results.runTime = performance.now() - startTime;
      return results;
    } else {
      return getReturnValue();
    }

    type RuleResult =
      | string
      | boolean
      | number
      | null
      | undefined
      | {}
      | Array<string | boolean | number | null | undefined>;

    function evaluateRule({
      stepRow,
      input,
      rule,
      ignoreMissingKeys = false,
    }: {
      stepRow: number;
      input: TInput;
      rule: string | string[] | Rule;
      ignoreMissingKeys?: boolean;
    }): RuleResult {
      // checking only the first rule seems unsafe
      if (Array.isArray(rule) && typeof rule[0] === 'string') {
        return rule.flatMap((rule) =>
          evaluateRule({ stepRow, input, rule, ignoreMissingKeys }),
        );
      }
      if (typeof rule !== 'string')
        throw new UserError(
          `Nesting is not enabled for this rule type: ${JSON.stringify(rule)}`,
        );

      stepCount++;

      try {
        const matchedOperator = assignmentOperators.find((op) =>
          rule.includes(` ${op} `),
        );

        if (matchedOperator) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const [lhs, _] = rule.split(matchedOperator, 2).map((s) => s.trim());
          const value = parser.expressionToValue(rule);
          const previous = get(input, lhs);
          const result = set(input, lhs, value);
          results.lastValue = value;
          logTrace({
            operation: 'evalRule',
            result: serialize(result),
            rule,
            lhs,
            value,
            previous: serialize(previous),
            stepRow,
            stepCount,
          });
          return input as any; // value???
        } else {
          const result = parser.expressionToValue(rule) as any;
          logTrace({
            operation: 'expression',
            result,
            rule,
            stepRow,
            stepCount,
          });
          results.lastValue = result;
          return result;
        }
      } catch (e) {
        logTrace({
          operation: 'error',
          error: e.message,
          rule,
          stepRow,
          stepCount,
        });
        if (e.name !== 'UserError') console.error('UNEXPECTED ERROR:', e);
        throw e;
      }
    }
  };
}

export function extractValueOrLiteral<
  TInput extends {
    [k: string]: string | boolean | number | null | undefined | TInput;
  } = any,
>(
  input: TInput,
  token: string,
  stepRow?: number,
  stepCount?: number,
  ignoreMissingKeys?: boolean,
) {
  const value = get(input, token);
  if (value) return value;

  if (trailingQuotes.test(token)) return token.replace(trailingQuotes, '');
  if (isNumber(token) || isBoolean(token)) return autoDetectType(token);

  // throw if we got an undefined key
  if (!ignoreMissingKeys && token.length > 0)
    throw new Error(`Undefined key: ${token}`);

  if (ignoreMissingKeys) return undefined;
  throw Error(
    `Unrecognized token in rule expression ${token} (${stepRow}, ${stepCount})`,
  );
  // if we have a string key and don't find it in the input, assume it's undefined.
}

function checkInvalidKeys<TInput extends object>(data: TInput) {
  const arrayFields = ['$item', '$index', '$array'];
  const dangerousKeys = [
    '__proto__',
    'prototype',
    'constructor',
    'toString',
    'valueOf',
    'hasOwnProperty',
    'isPrototypeOf',
    'propertyIsEnumerable',
  ];
  const unsafeKeys = Object.keys(data).filter((key) =>
    dangerousKeys.includes(key),
  );
  if (unsafeKeys.length > 0)
    throw new UserError(`Unsafe keys found in input: ${unsafeKeys.join(', ')}`);
  if (arrayFields.some((key) => key in data))
    throw new UserError(
      `Input contains reserved field name: ${arrayFields.join(', ')}`,
    );
  return data;
}

export type Rule =
  | string
  | LogicalRule
  | AndRule
  | OrRule
  | EveryRule
  | SomeRule
  | FindRule
  | MapRule
  | FilterRule
  | ReturnRule
  | TryCatchRule
  | Rule[];

interface LogicalRule {
  if: AndRule | OrRule | string;
  then: Rule;
  else?: Rule;
}
interface AndRule {
  and: string[];
}
interface OrRule {
  or: string[];
}
interface MapRule {
  map: string;
  run: Rule;
  set?: string;
}
interface FilterRule {
  filter: string;
  run: Rule;
  set?: string;
}
interface EveryRule {
  every: string;
  run: Rule;
  set?: string;
}
interface SomeRule {
  some: string;
  run: Rule;
  set?: string;
}
interface FindRule {
  find: string;
  run: Rule;
  set?: string;
}
interface ReturnRule {
  return: string;
}
interface TryCatchRule {
  try: Rule;
  catch: Rule;
}
