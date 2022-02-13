import debug from 'debug';
import get from 'lodash/get';
import set from 'lodash/set';
import { isBoolean, isNumber, autoDetectType } from './utils';
import {
  AssignmentOperators,
  ConditionalOperators,
  ModifierOperators,
} from './operators';
// import { reversePolishNotation } from './utils/reversePolishNotation';
// import { performance } from 'perf_hooks';
import performance from './utils/performance';
import { ruleExpressionLanguage } from './rule-expression-language';
import { init } from 'expressionparser';
import { ValuePrimitive } from 'expressionparser/dist/ExpressionParser';

const trailingQuotes = /^('|").*('|")$/g;
const whitespacePattern = /\s+/g;

type RuleMachineOptions = {
  name?: string;
  traceResults?: boolean
}

type RulesTraceResults<
TInput extends {
  [k: string]: string | boolean | number | null | undefined | TInput;
} = any
> = {
  trace: RuleTrace[],
  input: TInput,
  returnValue: any,
  lastValue: any,
}

// export default ruleFactory;

export function ruleFactory<
  TInput extends {
    [k: string]: string | boolean | number | null | undefined | TInput;
  } = any
>(rules: Rule[], options: string | RuleMachineOptions = { name: 'rules.unnamed' }) {
  if (typeof options === 'string') {
    options = { name: options } as RuleMachineOptions;
  }
  let {name = 'rules.unnamed', traceResults} = options;
  // Validate, parse & load rules
  // Then return a function that takes an input object and returns a RuleTrace[]
  return function executeRulePipeline(input: TInput) {
    const trace: RuleTrace[] = [];
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

    const parser = init(ruleExpressionLanguage, (term: string) => {
      if (typeof term === 'string') {
        const result =
          extractValueOrLiteral(input, term, stepRow, stepCount, false) || 'INVALID';
        // console.log(`TERM: ${term} => ${result}`);
        return result;
        // return 42;
      } else {
        throw new Error(`Invalid term: ${term}`);
      }
    });

    for (const rule of rules) {
      if (
        typeof rule === 'string' ||
        (Array.isArray(rule) && typeof rule[0] === 'string')
      ) {
        if (typeof rule === 'string') {
          evaluateRule({ stepRow, input, rule });
        } else {
          rule.map((rule) => evaluateRule({ stepRow, input, rule }));
        }
      } else if ('if' in rule) {
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
          ignoreMissingKeys: true,
        });
        results.returnValue = returnResult;
      }
      stepRow++;
    }
    if (traceResults) {
      return results;
    } else {
      return results.returnValue || results.lastValue;
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
      | Array<string | boolean | number | null | undefined> {
      if (Array.isArray(rule) && typeof rule[0] === 'string')
        return rule.flatMap((rule) => evaluateRule({ stepRow, input, rule, ignoreMissingKeys }));
      if (typeof rule !== 'string')
        throw new Error('Nested rules not yet implemented.');

      stepCount++;
      const tokens = rule.split(whitespacePattern);
      // TODO: Change to split on operator. 1 at a time
      let [leftSide, operator, ...rightSideItems] = tokens;
      let rightSide = rightSideItems.join(' '); // Warning: This may be a string with quotes.
      let rightSideParsed: any = undefined;

      if (tokens.length >= 2) {
        // To support math expressions, check right-side
        // rightSideParsed = whitespacePattern.test(rightSide)
        //   ? parser.expressionToValue(rightSide)
        //   : extractValueOrLiteral(input, rightSide, stepRow, stepCount);
        rightSideParsed = parser.expressionToValue(rightSide);
      }
      if (tokens.length === 1) {
        // TODO: Convert to new parser here!?
        const result =  extractValueOrLiteral(input, tokens[0], stepRow, stepCount, ignoreMissingKeys);
        results.lastValue = result;
        return result;
      }
      if (!operator || !leftSide || !rightSide)
        throw Error(`Rule ${name} has an invalid rule. 3 parts required.`);

      let leftSideValue = extractValueOrLiteral(
        input,
        leftSide,
        stepRow,
        stepCount,
        true,
      );
      let rightSideValue = rightSideParsed; // extractValueOrLiteral(input, rightSide, stepRow, stepCount);
      if (operator in ConditionalOperators) {
        let result = ConditionalOperators[
          operator as keyof typeof ConditionalOperators
        ](leftSideValue, rightSideValue);
        logTrace(result);
        results.lastValue = result;
        return result;
      } else if (operator in ModifierOperators) {
        leftSideValue = extractValueOrNumber(input, leftSide, true);
        rightSideValue = extractValueOrNumber(input, rightSide);
        let result = ModifierOperators[
          operator as keyof typeof ModifierOperators
        ](leftSideValue, rightSideValue);
        logTrace(result);
        results.lastValue = result;
        return result;
      } else if (operator in AssignmentOperators) {
        leftSideValue = extractValueOrNumber(input, leftSide, true);
        // rightSideValue = extractValueOrNumber(input, rightSide);
        rightSideValue = rightSideValue as number;
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
        results.lastValue = leftSideValue;
        return leftSideValue;
      } else if (operator === '=') {
        leftSideValue = leftSide; // extractValueOrLiteral(input, leftSide, stepRow, stepCount);
        // TODO: Recursively evaluate rightSide/tokens if it contains more tokens to process.
        // rightSideValue = extractValueOrLiteral(input, rightSide, stepRow, stepCount);
        if (typeof leftSideValue !== 'string')
          throw Error(
            `Rule ${name} has an invalid rule. Left side must be a string.`
          );
        let result = set(input, leftSideValue, rightSideValue);
        logTrace(result);
        results.lastValue = leftSideValue;
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

    function extractValueOrNumber(input: TInput, token: string, ignoreMissingKeys?: boolean): number {
      const val = extractValueOrLiteral(input, token, stepRow, stepCount, ignoreMissingKeys);
      if (typeof val === 'number') return val;
      return parseFloat(`${val}`);
    }
  };
}

export function extractValueOrLiteral<
  TInput extends {
    [k: string]: string | boolean | number | null | undefined | TInput;
  } = any
>(input: TInput, token: string, stepRow?: number, stepCount?: number, ignoreMissingKeys?: boolean) {
  if (input[token]) return autoDetectType(input[token]);
  if (token.includes('.') && get(input, token)) {
    return autoDetectType(get(input, token));
  }
  if (trailingQuotes.test(token)) return token.replace(trailingQuotes, '');
  if (isNumber(token) || isBoolean(token)) return autoDetectType(token);

  // throw if we got an undefined key
  if (!ignoreMissingKeys && token.length > 0) throw new Error(`Undefined key: ${token}`);
  if (ignoreMissingKeys == true) return undefined;
  console.warn(
    `Unrecognized token in rule expression (${stepRow}, ${stepCount}):`,
    token
  );
  // if we have a string key and don't find it in the input, assume it's undefined.
  return undefined;
}

export type Rule =
  | string
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

export interface RuleTrace {
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
