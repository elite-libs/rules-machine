import isEqual from "lodash/isEqual";
import gt from "lodash/gt";
import gte from "lodash/gte";
import lt from "lodash/lt";
import lte from "lodash/lte";

import cloneDeep from "lodash/cloneDeep";
import divide from "lodash/divide";
import add from "lodash/add";
import subtract from "lodash/subtract";
import multiply from "lodash/multiply";

import get from "lodash/get";
import set from "lodash/set";
import { autoDetectType, isBoolean, isNumber } from "./utils";
import { performance } from "perf_hooks";

export function RuleMachine<
  TInput extends {
    [k: string]: string | boolean | number | null | TInput;
  } = any
>(name: string, rules: Rule[]) {
  // Validate, parse & load rules

  // Then return a function that takes an input object and returns a RuleTrace[]
  return function executeRulePipeline(input: TInput) {
    const trace: RuleTrace[] = [];
    input = cloneDeep(input);
    let step = 0;
    const results = { trace, input, returnValue: null as any };
    const startTime = performance.now();

    for (const rule of rules) {
      if ("if" in rule) {
        // NOTE: Add || and && operators here.
        const conditionResult = evaluateRule({
          step,
          input,
          rule: rule.if,
        });
        if (conditionResult && typeof rule.then === "string") {
          const ruleResult = evaluateRule({
            step,
            input,
            rule: rule.then,
          });
        } else if (!conditionResult && typeof rule.else === "string") {
          const ruleResult = evaluateRule({
            step,
            input,
            rule: rule.else,
          });
        } else {
          // console.error('Rule "' + JSON.stringify(rule) + '" has no "then" or "else"');
          // throw Error(`Rule ${name} has an invalid if/else rule.`);
        }
      } else if ("return" in rule) {
        const returnResult = evaluateRule({
          step,
          input,
          rule: rule.return,
        });
        results.returnValue = returnResult;
      }
      step++;
    }
    return results;

    function evaluateRule({
      step,
      input,
      rule,
    }: {
      step: number;
      input: TInput;
      rule: string | Rule;
    }) {
      if (typeof rule !== "string") throw new Error('Nested rules not yet implemented.');
      
      const tokens = rule.split(/\s+/g);

      let [leftSide, operator, rightSide] = tokens;
      if (tokens.length === 1) {
        return extractValueOrLiteral(input, tokens[0]);
      }
      if (!operator || !leftSide || !rightSide)
        throw Error(`Rule ${name} has an invalid rule. 3 parts required.`);

      if (operator in ConditionalOperators) {
        let leftSideValue = extractValueOrLiteral(input, leftSide);
        let rightSideValue = extractValueOrLiteral(input, rightSide);
        let result = ConditionalOperators[
          operator as keyof typeof ConditionalOperators
        ](leftSideValue, rightSideValue);
        trace.push({
          name,
          runtime: performance.now() - startTime,
          step,
          ruleResult: { result, rule },
        });
        return result;
      } else if (operator in ModifierOperators) {
        let leftSideValue = extractValueOrNumber(input, leftSide);
        let rightSideValue = extractValueOrNumber(input, rightSide);
        let result = ModifierOperators[
          operator as keyof typeof ModifierOperators
        ](leftSideValue, rightSideValue);
        trace.push({
          name,
          runtime: performance.now() - startTime,
          step,
          ruleResult: { result, rule },
        });
        return result;
      } else if (operator === "=") {
        let leftSideValue = leftSide; // extractValueOrLiteral(input, leftSide);
        // TODO: Recursively evaluate rightSide/tokens if it contains more tokens to process.
        let rightSideValue = extractValueOrLiteral(input, rightSide);
        if (typeof leftSideValue !== "string")
          throw Error(
            `Rule ${name} has an invalid rule. Left side must be a string.`
          );
        let result = set(input, leftSideValue, rightSideValue);
        trace.push({
          name,
          runtime: performance.now() - startTime,
          step,
          ruleResult: { result, rule, leftSideValue, rightSideValue },
        });
        return result;
      }
      return false;
    }

    function extractValueOrLiteral(input: TInput, token: string) {
      if (input[token]) return autoDetectType(input[token]);
      if (token.includes(".") && get(input, token)) {
        return autoDetectType(get(input, token));
      }
      if (isNumber(token) || isBoolean(token)) return autoDetectType(token);
      // if we have a string key and don't find it in the input, assume it's undefined.
      return undefined;
    }
    function extractValueOrNumber(input: TInput, token: string): number {
      const val = extractValueOrLiteral(input, token);
      if (typeof val === "number") return val;
      return parseFloat(`${val}`);
    }
  };
}

const ConditionalOperators = {
  "===": isEqual,
  "==": isEqual,
  "!=": (a: any, b: any) => !isEqual(a, b),
  "!==": (a: any, b: any) => !isEqual(a, b),
  ">": gt,
  "<": lt,
  ">=": gte,
  "<=": lte,
};

const ModifierOperators = {
  "+": add,
  "-": subtract,
  "*": multiply,
  "/": divide,
};

export type Rule =
  | {
      if: string | Rule;
      then: string | Rule;
      else?: string | Rule;
    }
  | {
      return: string | Rule;
    };
// | {
//     and: string | Rule;
//   }
// | {
//     or: string | Rule;
//   };

interface RuleTrace {
  name: string;
  step: number;
  runtime: number;
  ruleResult: any;
}
