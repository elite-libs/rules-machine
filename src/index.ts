// import debug from 'debug';
import get from 'lodash/get.js';
import set from 'lodash/set.js';
import { isBoolean, isNumber, autoDetectType, arrayify } from './utils/utils';
import performance from './utils/performance';
import {
  assignmentOperators,
  ruleExpressionLanguage,
} from './expression-language';
import { init } from 'expressionparser';
import { ExpressionValue } from 'expressionparser/dist/ExpressionParser.js';

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

export function ruleFactory<
  TInput extends {
    [k: string]: string | boolean | number | null | undefined | TInput;
  } = any
>(
  rules: Rule,
  options: RuleMachineOptions | undefined = {
    trace: false,
    ignoreMissingKeys: true,
  }
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
    const results = {
      input,
      trace: traceSimple,
      lastValue: input as any,
      returnValue: input as any,
    };

    // Note: previously used more complex logic here
    // TODO: refactor & remove the `getReturnValue()` function
    const getReturnValue = () => results.lastValue;

    const startTime = performance.now();
    if (trace) logTrace({ operation: 'begin', startTime });

    const parser = init(ruleExpressionLanguage, (term: string) => {
      if (typeof term === 'string') {
        try {
          const result =
            extractValueOrLiteral(
              input,
              term,
              stepRow,
              stepCount,
              ignoreMissingKeys
            ) ?? get(input, term, undefined as any);
          // console.log(`TERM: ${term} => ${result}`);
          if (trace) {
            logTrace({
              operation: 'key.lookup',
              key: term,
              value: result,
              stepRow,
              stepCount,
            });
          }
          return result;
        } catch (error) {
          if (trace) {
            logTrace({
              operation: 'error',
              error,
              rule: term,
              stepRow,
              stepCount,
            });
          }
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new Error(`Invalid term: ${term}`);
      }
    });

    rules = arrayify(rules);

    for (const rule of rules) {
      if (typeof rule === 'string') {
        results.lastValue = evaluateRule({ stepRow, input, rule });
        if (trace) {
          logTrace({
            operation: 'ruleString',
            rule: rule,
            result: serialize(results.lastValue),
            currentState: serialize(input),
            stepRow,
            stepCount,
          });
        }
      } else if (Array.isArray(rule) && typeof rule[0] === 'string') {
        results.lastValue = rule.map((rule) =>
          evaluateRule({ stepRow, input, rule })
        );
        if (trace) {
          logTrace({
            operation: 'ruleString[]',
            rule: rule,
            result: serialize(results.lastValue),
            currentState: serialize(input),
            stepRow,
            stepCount,
          });
        }
      } else if ('if' in rule) {
        results.lastValue = input; // set the current state to the input object.

        let conditionResult: boolean | undefined;
        if (typeof rule.if === 'object' && 'and' in rule.if) {
          const and = arrayify(rule.if.and);
          const results = and.map((rule) =>
            evaluateRule({ stepRow, input, rule })
          );
          conditionResult = results.every((result) => result);
          if (trace) {
            logTrace({
              operation: 'if.and',
              rule: and,
              result: serialize(conditionResult),
              currentState: serialize(input),
              stepRow,
              stepCount,
            });
          }
        } else if (typeof rule.if === 'object' && 'or' in rule.if) {
          const or = rule.if.or;
          const results = arrayify(or).map((rule) =>
            evaluateRule({ stepRow, input, rule })
          );
          conditionResult = results.some((result) => result);
          if (trace) {
            logTrace({
              operation: 'if.or',
              rule: or,
              result: serialize(conditionResult),
              currentState: serialize(input),
              stepRow,
              stepCount,
            });
          }
        } else if (typeof rule.if !== 'string' && Array.isArray(rule.if)) {
          throw new Error(
            'The `if` value must be a string or logical object (e.g. `{and/if: []}`.) Arrays are currently not supported.'
          );
        } else if (typeof rule.if === 'string') {
          conditionResult = Boolean(
            evaluateRule({
              stepRow,
              input,
              rule: rule.if,
            })
          );
          if (trace) {
            logTrace({
              operation: 'if',
              rule: rule.if,
              result: serialize(conditionResult),
              currentState: serialize(input),
              stepRow,
              stepCount,
            });
          }
        }
        // Now check the condition result
        if (
          conditionResult &&
          (typeof rule.then === 'string' || Array.isArray(rule.then))
        ) {
          results.lastValue = evaluateRule({
            stepRow,
            input,
            rule: rule.then,
          });
          if (trace) {
            logTrace({
              operation: 'if.then',
              rule: rule.then,
              result: serialize(conditionResult),
              currentState: serialize(input),
              stepRow,
              stepCount,
            });
          }
        } else if (
          !conditionResult &&
          (typeof rule.else === 'string' || Array.isArray(rule.else))
        ) {
          results.lastValue = evaluateRule({
            stepRow,
            input,
            rule: rule.else,
          });
          if (trace) {
            logTrace({
              operation: 'if.else',
              rule: rule.else,
              result: serialize(conditionResult),
              currentState: serialize(input),
              stepRow,
              stepCount,
            });
          }
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
        if (trace) {
          logTrace({
            operation: 'return',
            rule: rule.return,
            result: serialize(returnResult),
            currentState: serialize(input),
            stepRow,
            stepCount,
          });
        }
        break;
      } else if ('try' in rule) {
        try {
          const tryResult = evaluateRule({
            stepRow,
            input,
            rule: rule.try,
            ignoreMissingKeys: true,
          });
          results.lastValue = tryResult;
          if (trace) {
            logTrace({
              operation: 'try',
              rule: rule.try,
              result: serialize(tryResult),
              currentState: serialize(input),
              stepRow,
              stepCount,
            });
          }
        } catch (e) {
          console.log(e);
        }
      }
      stepRow++;
    }

    if (trace) {
      logTrace({
        operation: 'complete',
        runTime: performance.now() - startTime,
        stepCount,
        currentState: serialize(input),
        stepRow,
        lastValue: serialize(getReturnValue()),
      });
    }

    if (trace) {
      // @ts-expect-error: todo: fix this, add proper type for Result
      results.runTime = performance.now() - startTime;
      return results;
    } else {
      return getReturnValue();
    }
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
    }):
      | string
      | boolean
      | number
      | null
      | undefined
      | {}
      | Array<string | boolean | number | null | undefined> {
      if (Array.isArray(rule) && typeof rule[0] === 'string') {
        return rule.flatMap((rule) =>
          evaluateRule({ stepRow, input, rule, ignoreMissingKeys })
        );
      }
      if (typeof rule !== 'string')
        throw new Error('Nested rules not yet implemented.');

      stepCount++;

      try {
        const matchedOperator = assignmentOperators.find((op) =>
          rule.includes(` ${op} `)
        );

        if (matchedOperator) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const [lhs, _] = rule.split(matchedOperator, 2).map((s) => s.trim());
          const value = parser.expressionToValue(rule);
          const previous = get(input, lhs);
          const result = set(input, lhs, value);
          results.lastValue = value;
          if (trace) {
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
          }
          return input as any; // value???
        } else {
          const result = parser.expressionToValue(rule) as any;
          if (trace) {
            logTrace({
              operation: 'expression',
              result,
              rule,
              stepRow,
              stepCount,
            });
          }
          results.lastValue = result;
          return result;
        }
      } catch (e) {
        if (trace) logTrace({ operation: 'error', error: e.message });
        console.error('PARSER FAIL:', e);
        throw e;
      }
    }
  };
}

export function extractValueOrLiteral<
  TInput extends {
    [k: string]: string | boolean | number | null | undefined | TInput;
  } = any
>(
  input: TInput,
  token: string,
  stepRow?: number,
  stepCount?: number,
  ignoreMissingKeys?: boolean
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
    `Unrecognized token in rule expression ${token} (${stepRow}, ${stepCount})`
  );
  // if we have a string key and don't find it in the input, assume it's undefined.
}

export type Rule =
  | string
  | {
      if: Rule;
      then: Rule;
      else?: Rule;
    }
  | {
      and: Rule[];
    }
  | {
      or: Rule[];
    }
  | {
      return: Rule;
    }
  | { try: Rule; catch: Rule }
  | Rule[];
