import { performance } from 'perf_hooks';
import get from 'lodash/get.js';
import set from 'lodash/set.js';
import type { ExpressionValue } from 'expressionparser/dist/ExpressionParser.js';
import type { ExpressionEngine } from '../expression-engine/engine';
import { toArray } from '../utils/utils';
import { isBoolean, isNumber, autoDetectType } from '../utils/utils';
import { UserError } from '../utils/errors';
import type { Rule, AndRule, OrRule } from './types';

// ─── Helpers ────────────────────────────────────────────────────────────────

const trailingQuotes = /^('|").*('|")$/g;

const serialize = (data: unknown) =>
  data !== null && typeof data === 'object' ? JSON.stringify(data) : data;

const arrayMethods = ['map', 'filter', 'every', 'some', 'find'] as const;
const isArrayRule = (data: object) =>
  Object.keys(data).some((key) =>
    (arrayMethods as readonly string[]).includes(key),
  );

// ─── Trace ───────────────────────────────────────────────────────────────────

export interface TraceRow {
  startTime?: number;
  runTime?: number;
  operation: string;
  rule?: Rule;
  input?: unknown;
  result?: unknown;
  stepRow?: number;
  stepCount?: number;
  lhs?: string;
  value?: ExpressionValue;
  error?: unknown;
  [key: string]: unknown;
}

// ─── Options ─────────────────────────────────────────────────────────────────

export interface ExecutorOptions {
  trace?: boolean;
  ignoreMissingKeys?: boolean;
}

// ─── Execution result ────────────────────────────────────────────────────────

export interface ExecutionResult<TInput> {
  input: TInput;
  trace: TraceRow[];
  lastValue: unknown;
  returnValue: unknown;
  runTime?: number;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * The structural rule executor.  It knows nothing about expression syntax —
 * all string expression evaluation is delegated to the injected
 * `ExpressionEngine`.
 */
export interface RuleExecutor<TInput extends object = any> {
  execute(rules: Rule, input?: TInput): unknown | ExecutionResult<TInput>;
}

/**
 * Factory: build a `RuleExecutor` bound to the given `ExpressionEngine` and
 * execution options.
 */
export function createRuleExecutor<
  TInput extends {
    [k: string]: string | boolean | number | null | undefined | TInput;
  } = any,
>(
  expressionEngine: ExpressionEngine,
  options: ExecutorOptions = { trace: false, ignoreMissingKeys: true },
): RuleExecutor<TInput> {
  const { trace, ignoreMissingKeys = true } = options;

  function execute(
    rules: Rule,
    input: TInput = {} as TInput,
  ): unknown | ExecutionResult<TInput> {
    const traceSimple: TraceRow[] = [];

    function logTrace({ operation, rule, ...args }: TraceRow) {
      if (trace) traceSimple.push({ operation, rule, ...args });
    }

    let stepRow = 0;
    let stepCount = 0;
    const BREAK = 'BREAK';

    const results: ExecutionResult<TInput> = {
      input,
      trace: traceSimple,
      lastValue: input as unknown,
      returnValue: input as unknown,
    };

    checkInvalidKeys(input);

    const getReturnValue = () => results.lastValue;

    const startTime = performance.now();
    logTrace({ operation: 'begin', startTime });

    // Build a term resolver that closes over the mutable `input` reference.
    const termResolver = (term: string): ExpressionValue => {
      try {
        const result =
          extractValueOrLiteral(
            input,
            term,
            stepRow,
            stepCount,
            ignoreMissingKeys,
          ) ?? get(input, term, undefined as unknown as ExpressionValue);
        logTrace({
          operation: 'key.lookup',
          key: term,
          value: result as ExpressionValue,
          stepRow,
          stepCount,
        });
        return result as ExpressionValue;
      } catch (error) {
        logTrace({ operation: 'error', error, rule: term, stepRow, stepCount });
        throw error;
      }
    };

    // ── handleRule ───────────────────────────────────────────────────────────

    const handleRule = (rule: Rule): unknown => {
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
        results.lastValue = rule.map((r) =>
          typeof r === 'string'
            ? evaluateRule({ stepRow, input, rule: r, ignoreMissingKeys })
            : handleRule(r),
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
        results.lastValue = input;

        let conditionResult: RuleResult;

        if (typeof rule.if === 'object' && 'and' in rule.if) {
          const and = toArray((rule.if as AndRule).and);
          for (const ruleItem of and) {
            if (typeof ruleItem === 'string') {
              conditionResult = evaluateRule({
                stepRow,
                input,
                rule: ruleItem,
              });
              if (!conditionResult) break;
            }
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
          const or = toArray((rule.if as OrRule).or);
          for (const ruleItem of or) {
            if (typeof ruleItem === 'string') {
              conditionResult = evaluateRule({
                stepRow,
                input,
                rule: ruleItem,
              });
              if (conditionResult) break;
            }
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
            evaluateRule({ stepRow, input, rule: rule.if }),
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
        return BREAK;
      } else if (isArrayRule(rule) && 'run' in rule) {
        const arrayOperator = Object.keys(rule).find((key) =>
          (arrayMethods as readonly string[]).includes(key),
        );
        if (!arrayOperator)
          throw new Error(`Invalid array rule: ${JSON.stringify(rule)}`);

        const arrayRule = (rule as unknown as Record<string, unknown>)[
          arrayOperator
        ] as string;

        const arrayMethod =
          arrayOperator === 'map'
            ? Array.prototype.map
            : arrayOperator === 'filter'
              ? Array.prototype.filter
              : arrayOperator === 'every'
                ? Array.prototype.every
                : arrayOperator === 'some'
                  ? Array.prototype.some
                  : Array.prototype.find;

        if (trace)
          logTrace({
            operation: arrayOperator,
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

        const runRule = (rule as { run: Rule }).run;
        const arrayResult = arrayMethod.call(
          toArray(data),
          (item: unknown, index: number) => {
            Object.assign(input, { $item: item, $index: index, $array: data });
            handleRule(runRule);
            return results.lastValue;
          },
        );
        results.lastValue = arrayResult;

        if ('set' in rule) {
          set(input, (rule as { set: string }).set, arrayResult);
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
        } catch {
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

    // ── evaluateRule ─────────────────────────────────────────────────────────

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
      ignoreMissingKeys: localIgnoreMissingKeys = false,
    }: {
      stepRow: number;
      input: TInput;
      rule: string | string[] | Rule;
      ignoreMissingKeys?: boolean;
    }): RuleResult {
      if (Array.isArray(rule) && typeof rule[0] === 'string') {
        return rule.flatMap((r) =>
          evaluateRule({
            stepRow,
            input,
            rule: r,
            ignoreMissingKeys: localIgnoreMissingKeys,
          }),
        );
      }
      if (typeof rule !== 'string')
        throw new UserError(
          `Nesting is not enabled for this rule type: ${JSON.stringify(rule)}`,
        );

      stepCount++;

      try {
        const compiled = expressionEngine.compile(rule);

        if (compiled.assignmentOperator) {
          const lhs = compiled.lhs!;
          const value = expressionEngine.evaluate(compiled, termResolver);
          const previous = get(input, lhs);
          set(input, lhs, value);
          results.lastValue = value;
          logTrace({
            operation: 'evalRule',
            result: serialize(input),
            rule,
            lhs,
            value,
            previous: serialize(previous),
            stepRow,
            stepCount,
          });
          return input as unknown as RuleResult;
        } else {
          const result = expressionEngine.evaluate(
            compiled,
            termResolver,
          ) as RuleResult;
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
          error: e instanceof Error ? e.message : String(e),
          rule,
          stepRow,
          stepCount,
        });
        if (e instanceof Error && e.name !== 'UserError')
          console.error('UNEXPECTED ERROR:', e);
        throw e;
      }
    }

    // ── Main execution loop ──────────────────────────────────────────────────

    const ruleArray = toArray(rules);

    for (const rule of ruleArray) {
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
          lastValue: e instanceof Error ? e.message : String(e),
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
      results.runTime = performance.now() - startTime;
      return results;
    }

    return getReturnValue();
  }

  return { execute };
}

// ─── Utility (also exported for use in index.ts) ─────────────────────────────

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
): ExpressionValue | undefined {
  const value = get(input, token);
  if (value != null) return value as ExpressionValue;

  if (trailingQuotes.test(token)) return token.replace(trailingQuotes, '');
  if (isNumber(token) || isBoolean(token))
    return autoDetectType(token) as ExpressionValue;

  if (!ignoreMissingKeys && token.length > 0)
    throw new Error(`Undefined key: ${token}`);

  if (ignoreMissingKeys) return undefined;
  throw Error(
    `Unrecognized token in rule expression ${token} (${stepRow}, ${stepCount})`,
  );
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
