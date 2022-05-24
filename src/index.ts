// import debug from 'debug';
import get from 'lodash/get.js';
import set from 'lodash/set.js';
import { isBoolean, isNumber, autoDetectType } from './utils/typeHelpers';
import performance from './utils/performance';
import {
  assignmentOperators,
  ruleExpressionLanguage,
} from './expression-language';
import { init } from 'expressionparser';

const trailingQuotes = /^('|").*('|")$/g;

interface RuleMachineOptions {
  trace?: boolean
  ignoreMissingKeys?: boolean
}

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
    // const trace: RuleTrace[] = [];
    const traceSimple: any[] = [];
    // input = cloneDeep(input);
    let stepRow = 0;
    let stepCount = 0;
    const results = {
      trace,
      input,
      returnValue: undefined as any,
      lastValue: undefined as any,
    };
    const startTime = performance.now();
    if (trace) traceSimple.push({ startTime });

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
          traceSimple.push({ error, term, stepRow, stepCount });
        }
      } else {
        throw new Error(`Invalid term: ${term}`);
      }
    });

    rules = arrayify(rules);

    for (const rule of rules) {
      if (
        typeof rule === 'string' ||
        (Array.isArray(rule) && typeof rule[0] === 'string')
      ) {
        if (typeof rule === 'string') {
          results.lastValue = evaluateRule({ stepRow, input, rule });
        } else {
          results.lastValue = rule.map((rule) =>
            evaluateRule({ stepRow, input, rule })
          );
        }
      } else if ('if' in rule) {
        // NOTE: Add || and && operators here.
        let conditionResult: boolean | undefined;
        if (typeof rule.if === 'object' && 'and' in rule.if) {
          const and = arrayify(rule.if.and);
          const results = and.map((rule) =>
            evaluateRule({ stepRow, input, rule })
          );
          conditionResult = results.every((result) => result);
        } else if (typeof rule.if === 'object' && 'or' in rule.if) {
          const or = rule.if.or;
          const results = arrayify(or).map((rule) =>
            evaluateRule({ stepRow, input, rule })
          );
          conditionResult = results.some((result) => result);
        } else if (typeof rule.if === 'string') {
          conditionResult = Boolean(
            evaluateRule({
              stepRow,
              input,
              rule: rule.if,
            })
          );
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
        } else if (
          !conditionResult &&
          (typeof rule.else === 'string' || Array.isArray(rule.else))
        ) {
          results.lastValue = evaluateRule({
            stepRow,
            input,
            rule: rule.else,
          });
        } else {
          // throw Error(`Rule ${name} has an invalid if/else rule.`);
        }
      } else if ('return' in rule) {
        const returnResult = evaluateRule({
          stepRow,
          input,
          rule: rule.return,
          ignoreMissingKeys: true,
        });
        results.returnValue = returnResult;
      }
      stepRow++;
    }
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
        // const operatorPattern = matchedOperator ? new RegExp(escapeRegExp(` ${matchedOperator} `)) : / = /;

        if (matchedOperator) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const [lhs, _] = rule
            .split(matchedOperator, 2)
            .map((s) => s.trim());
          const value = parser.expressionToValue(rule);
          const result = set(input, lhs, value);
          results.lastValue = value;
          traceSimple.push({ result, lhs, value });
          return input as any; // value???
        } else {
          const result = parser.expressionToValue(rule) as any;
          traceSimple.push({ result });
          results.lastValue = result;
          return result;
        }
      } catch (e) {
        traceSimple.push({ error: e.message });
        console.error('PARSER FAIL:', e);
        throw e;
      }
    }
  };
}

function arrayify<T>(items: T | T[]): T[] {
  if (!Array.isArray(items)) return [items];
  return items;
}
/*
input['DATEISO("10m")']
*/

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
  // if (input[token]) return autoDetectType(input[token]);
  if (get(input, token))
    return autoDetectType(get(input, token));

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

export interface RuleTrace {
  name: string
  rule: string
  operator: string
  stepRow: number
  stepCount: number
  runtime: number
  parseResult: any
  state?: string
  result?: any
}
