import isEqual from 'lodash/isEqual';
import gt from 'lodash/gt';
import gte from 'lodash/gte';
import lt from 'lodash/lt';
import lte from 'lodash/lte';

import cloneDeep from 'lodash/cloneDeep';
import divide from 'lodash/divide';
import add from 'lodash/add';
import subtract from 'lodash/subtract';
import multiply from 'lodash/multiply';

import get from 'lodash/get';
import set from 'lodash/set';
import { autoDetectType, isBoolean, isNumber } from './utils';
import { performance } from 'perf_hooks';

const trailingQuotes = /^('|").*('|")$/gm;

export function RuleMachine<
  TInput extends {
    [k: string]: string | boolean | number | null | undefined | TInput;
  } = any
>(name: string, rules: Rule[]) {
  // Validate, parse & load rules

  // Then return a function that takes an input object and returns a RuleTrace[]
  return function executeRulePipeline(input: TInput) {
    const trace: RuleTrace[] = [];
    // input = cloneDeep(input);
    let stepRow = 0;
    let stepCount = 0;
    const results = { trace, input, returnValue: null as any };
    const startTime = performance.now();

    for (const rule of rules) {
      if ('if' in rule) {
        // NOTE: Add || and && operators here.
        let conditionResult: boolean | undefined = undefined;
        if (typeof rule.if === 'object' && 'and' in rule.if) {
          const and = rule.if.and;
          const results = and.map((rule) =>
            evaluateRule({ stepRow, input, rule })
          );
          conditionResult = results.every((result) => result);
        } else if (typeof rule.if === 'object' && 'or' in rule.if) {
          const or = rule.if.or;
          const results = or.map((rule) =>
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
          const parseResult = evaluateRule({
            stepRow,
            input,
            rule: rule.then,
          });
        } else if (
          !conditionResult &&
          (typeof rule.else === 'string' || Array.isArray(rule.else))
        ) {
          const parseResult = evaluateRule({
            stepRow,
            input,
            rule: rule.else,
          });
        } else {
          // console.error('Rule "' + JSON.stringify(rule) + '" has no "then" or "else"');
          // throw Error(`Rule ${name} has an invalid if/else rule.`);
        }
      } else if ('return' in rule) {
        const returnResult = evaluateRule({
          stepRow,
          input,
          rule: rule.return,
        });
        results.returnValue = returnResult;
      }
      stepRow++;
    }
    return results;

    function evaluateRule({
      stepRow,
      input,
      rule,
    }: {
      stepRow: number;
      input: TInput;
      rule: string | string[] | Rule;
    }):
      | string
      | boolean
      | number
      | null
      | undefined
      | Array<string | boolean | number | null | undefined> {
      if (Array.isArray(rule) && typeof rule[0] === 'string')
        return rule.flatMap((rule) => evaluateRule({ stepRow, input, rule }));
      if (typeof rule !== 'string')
        throw new Error('Nested rules not yet implemented.');

      stepCount++;
      const tokens = rule.split(/\s+/g);

      let [leftSide, operator, rightSide] = tokens;
      if (tokens.length === 1) {
        return extractValueOrLiteral(input, tokens[0]);
      }
      if (!operator || !leftSide || !rightSide)
        throw Error(`Rule ${name} has an invalid rule. 3 parts required.`);

      let leftSideValue = extractValueOrLiteral(input, leftSide);
      let rightSideValue = extractValueOrLiteral(input, rightSide);
      if (operator in ConditionalOperators) {
        let result = ConditionalOperators[
          operator as keyof typeof ConditionalOperators
        ](leftSideValue, rightSideValue);
        logTrace(result);
        return result;
      } else if (operator in ModifierOperators) {
        leftSideValue = extractValueOrNumber(input, leftSide);
        rightSideValue = extractValueOrNumber(input, rightSide);
        let result = ModifierOperators[
          operator as keyof typeof ModifierOperators
        ](leftSideValue, rightSideValue);
        logTrace(result);
        return result;
      } else if (operator in AssignmentOperators) {
        leftSideValue = extractValueOrNumber(input, leftSide);
        rightSideValue = extractValueOrNumber(input, rightSide);
        switch (operator) {
          case '+=':
            leftSideValue += rightSideValue;
            break;
          case '-=':
            leftSideValue -= rightSideValue;
            break;
          case '*=':
            leftSideValue *= rightSideValue;
            break;
          case '/=':
            leftSideValue /= rightSideValue;
            break;
          case '**=':
            leftSideValue **= rightSideValue;
            break;
          case '%=':
            leftSideValue %= rightSideValue;
            break;
          case '||=':
            leftSideValue ||= rightSideValue;
            break;
          case '??=':
            leftSideValue ??= rightSideValue;
            break;
          default:
            throw Error(`Rule ${name} has an invalid assignment operator.`);
        }
        let result = set(input, leftSide, leftSideValue);

        logTrace(result);
        return leftSideValue;
      } else if (operator === '=') {
        leftSideValue = leftSide; // extractValueOrLiteral(input, leftSide);
        // TODO: Recursively evaluate rightSide/tokens if it contains more tokens to process.
        rightSideValue = extractValueOrLiteral(input, rightSide);
        if (typeof leftSideValue !== 'string')
          throw Error(
            `Rule ${name} has an invalid rule. Left side must be a string.`
          );
        let result = set(input, leftSideValue, rightSideValue);
        logTrace(result);
        return leftSideValue;
      }
      function logTrace(result: any) {
        trace.push({
          name: `${name}`,
          operator,
          runtime: performance.now() - startTime,
          stepRow,
          stepCount,
          state: JSON.stringify(input),
          result,
          rule: typeof rule === 'string' ? rule : JSON.stringify(rule),
          parseResult: {
            lhs: leftSide,
            rhs: rightSide,
            rhsv: rightSideValue,
            lhsv: leftSideValue,
          },
        });
      }
      return false;
    }

    function extractValueOrLiteral(input: TInput, token: string) {
      if (input[token]) return autoDetectType(input[token]);
      if (token.includes('.') && get(input, token)) {
        return autoDetectType(get(input, token));
      }
      if (trailingQuotes.test(token)) return token.replace(trailingQuotes, '');
      if (isNumber(token) || isBoolean(token)) return autoDetectType(token);
      // if we have a string key and don't find it in the input, assume it's undefined.
      return undefined;
    }
    function extractValueOrNumber(input: TInput, token: string): number {
      const val = extractValueOrLiteral(input, token);
      if (typeof val === 'number') return val;
      return parseFloat(`${val}`);
    }
  };
}

const ConditionalOperators = {
  // "===": isEqual,
  '==': isEqual,
  '!=': (a: any, b: any) => !isEqual(a, b),
  '!==': (a: any, b: any) => !isEqual(a, b),
  '>': gt,
  '<': lt,
  '>=': gte,
  '<=': lte,
};

const ModifierOperators = {
  '+': add,
  '-': subtract,
  '*': multiply,
  '/': divide,
};

const AssignmentOperators = {
  '+=': add,
  '-=': subtract,
  '*=': multiply,
  '/=': divide,
  '**=': Math.pow,
  '%=': (a: number, b: number) => a % b,
  '||=': (a: any, b: any) => a || b,
  '??=': (a: any, b: any) => a ?? b,
};

export type Rule =
  | {
      if: string | LogicalRule;
      then: string | string[] | Rule;
      else?: string | string[] | Rule;
    }
  | {
      return: string | Rule;
    };

export type LogicalRule =
  | {
      and: string[];
    }
  | {
      or: string[];
    };

interface RuleTrace {
  name: string;
  rule: string;
  operator: string;
  stepRow: number;
  stepCount: number;
  runtime: number;
  parseResult: any;
  state?: string;
  result?: any;
}
