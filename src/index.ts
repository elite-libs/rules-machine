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
import { ExpressionValue } from 'expressionparser/dist/ExpressionParser';

const trailingQuotes = /^('|").*('|")$/g;

const oneify = <TList>(value?: TList[] | TList) => value != null && Array.isArray(value) && value.length === 1 ? value[0] : value;

interface RuleMachineOptions {
  trace?: boolean
  ignoreMissingKeys?: boolean
}

interface TraceRow {
  startTime?: number
  runTime?: number

  operation: string
  rule?: Rule
  result?: any
  stepRow?: number
  stepCount?: number
  lhs?: string
  value?: ExpressionValue
  error?: any
};

export function ruleFactory<
  TInput extends {
    [k: string]: string | boolean | number | null | undefined | TInput
  } = any
>(
  rules: Rule,
  options: RuleMachineOptions = {
    trace: false,
    ignoreMissingKeys: true,
  }
) {
  if (typeof options === 'string')
    options = { name: options } as RuleMachineOptions;

  const {
    trace,
    ignoreMissingKeys = true,
  } = options;
  // Validate, parse & load rules
  // Then return a function that takes an input object and returns a RuleTrace[]
  return function executeRulePipeline(input: TInput = {} as TInput) {
    const traceSimple: TraceRow[] = [];

    function logTrace({ operation, rule, result, ...args }: TraceRow) {
      if (trace) traceSimple.push({ operation, rule: oneify(rule), result: oneify(result), stepCount, stepRow, ...args });
    }

    let stepRow = 0;
    let stepCount = 0;
    const results = {
      input,
      trace: traceSimple,
      returnValue: undefined as any,
      lastValue: undefined as any,
    };
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
          return result;
        } catch (error) {
          logTrace({ operation: 'error', error, rule: term, stepRow, stepCount });
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new Error(`Invalid term: ${term}`);
      }
    });

    rules = arrayify(rules);

    for (const rule of rules) {
      if (
        typeof rule === 'string') {
        results.lastValue = evaluateRule({ stepRow, input, rule });
        logTrace({ operation: 'ruleString', rule: rule, result: results.lastValue, stepRow });
      } else if (Array.isArray(rule) && typeof rule[0] === 'string') {
        results.lastValue = rule.map((rule) =>
          evaluateRule({ stepRow, input, rule })
        );
        logTrace({ operation: 'ruleString[]', rule: rule, result: results.lastValue, stepRow });
      } else if ('if' in rule) {
        // NOTE: Add || and && operators here.
        let conditionResult: boolean | undefined;
        if (typeof rule.if === 'object' && 'and' in rule.if) {
          const and = arrayify(rule.if.and);
          const results = and.map((rule) =>
            evaluateRule({ stepRow, input, rule })
          );
          conditionResult = results.every((result) => result);
          logTrace({ operation: 'if.and', rule: and, result: conditionResult, stepRow });
        } else if (typeof rule.if === 'object' && 'or' in rule.if) {
          const or = rule.if.or;
          const results = arrayify(or).map((rule) =>
            evaluateRule({ stepRow, input, rule })
          );
          conditionResult = results.some((result) => result);
          logTrace({ operation: 'if.or', rule: or, result: conditionResult, stepRow });
        } else if (typeof rule.if !== 'string' && Array.isArray(rule.if)) {
          throw new Error('The `if` value must be a string or logical object (e.g. `{and/if: []}`.) Arrays are currently not supported.');
        } else if (typeof rule.if === 'string') {
          conditionResult = Boolean(
            evaluateRule({
              stepRow,
              input,
              rule: rule.if,
            })
          );
          logTrace({ operation: 'if', rule: rule.if, result: conditionResult, stepRow });
        }
        if (
          conditionResult &&
          (typeof rule.then === 'string' || Array.isArray(rule.then))
        ) {
          results.lastValue = evaluateRule({
            stepRow,
            input,
            rule: rule.then,
          });
          logTrace({ operation: 'if.then', rule: rule.then, result: conditionResult, stepRow });
        } else if (
          !conditionResult &&
          (typeof rule.else === 'string' || Array.isArray(rule.else))
        ) {
          results.lastValue = evaluateRule({
            stepRow,
            input,
            rule: rule.else,
          });
          logTrace({ operation: 'if.else', rule: rule.else, result: conditionResult, stepRow });
        }
      } else if ('return' in rule) {
        const returnResult = evaluateRule({
          stepRow,
          input,
          rule: rule.return,
          ignoreMissingKeys: true,
        });
        results.returnValue = returnResult;
        logTrace({ operation: 'return', rule: rule.return, result: returnResult, stepRow });
        break;
      }
      stepRow++;
    }

    if (trace) logTrace({ operation: 'complete', runTime: performance.now() - startTime, stepCount, stepRow });

    if (trace)
      return results;
    else
      return results.returnValue || results.lastValue;

    function evaluateRule({
      stepRow,
      input,
      rule,
      ignoreMissingKeys = false,
    }: {
      stepRow: number
      input: TInput
      rule: string | string[] | Rule
      ignoreMissingKeys?: boolean
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
          const [lhs, _] = rule
            .split(matchedOperator, 2)
            .map((s) => s.trim());
          const value = parser.expressionToValue(rule);
          const result = set(input, lhs, value);
          results.lastValue = value;
          logTrace({ operation: 'evalRule', result, rule, lhs, value });
          return input as any; // value???
        } else {
          const result = parser.expressionToValue(rule) as any;
          logTrace({ operation: 'expression', result, rule });
          results.lastValue = result;
          return result;
        }
      } catch (e) {
        logTrace({ operation: 'error', error: e.message });
        console.error('PARSER FAIL:', e);
        throw e;
      }
    }
  };
}

export function extractValueOrLiteral<
  TInput extends {
    [k: string]: string | boolean | number | null | undefined | TInput
  } = any
>(
  input: TInput,
  token: string,
  stepRow?: number,
  stepCount?: number,
  ignoreMissingKeys?: boolean
) {
  const value = get(input, token);
  if (value)
    return autoDetectType(value);

  if (trailingQuotes.test(token)) return token.replace(trailingQuotes, '');
  if (isNumber(token) || isBoolean(token)) return autoDetectType(token);

  // throw if we got an undefined key
  if (!ignoreMissingKeys && token.length > 0)
    throw new Error(`Undefined key: ${token}`);

  if (ignoreMissingKeys) return undefined;
  throw Error(`Unrecognized token in rule expression ${token} (${stepRow}, ${stepCount})`);
  // if we have a string key and don't find it in the input, assume it's undefined.
}

export type Rule =
  | string
  | {
    if: Rule
    then: Rule
    else?: Rule
  }
  | {
    and: Rule[]
  }
  | {
    or: Rule[]
  }
  | {
    return: Rule
  }
  | Rule[];

export type LogicalRule =
  | {
    and: Rule[]
  }
  | {
    or: Rule[]
  };
