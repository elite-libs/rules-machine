import type { ExpressionValue } from 'expressionparser/dist/ExpressionParser.js';
import type { ExpressionEngine } from '../expression-engine/engine';
import { UserError } from '../utils/errors';
import { getOwnPath as get, setOwnPath as set } from '../utils/paths';
import { toArray } from '../utils/utils';
import type { AndRule, OrRule, Rule } from './types';

// ─── Helpers ────────────────────────────────────────────────────────────────

const trailingQuotes = /^(['"])([\s\S]*)\1$/;

const serialize = (data: unknown) => {
  if (data === null || typeof data !== 'object')
    return typeof data === 'bigint' ? String(data) : data;
  const ancestors: object[] = [];
  try {
    return JSON.stringify(data, function (_key, value) {
      if (typeof value === 'bigint') return String(value);
      if (value !== null && typeof value === 'object') {
        while (ancestors.length && ancestors[ancestors.length - 1] !== this)
          ancestors.pop();
        if (ancestors.includes(value)) return '[Circular]';
        ancestors.push(value);
      }
      return value;
    });
  } catch {
    return '[Unserializable]';
  }
};

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
export interface RuleExecutor<TInput extends object> {
  execute<TReturn = unknown>(
    rules: Rule,
    input?: TInput,
  ): TReturn | ExecutionResult<TInput>;
}

/**
 * Factory: build a `RuleExecutor` bound to the given `ExpressionEngine` and
 * execution options.
 */
type MutableInput = {
  [k: string]: string | boolean | number | null | undefined | MutableInput;
};

export function createRuleExecutor<TInput extends Record<string, unknown>>(
  expressionEngine: ExpressionEngine,
  options: ExecutorOptions = { trace: false, ignoreMissingKeys: true },
): RuleExecutor<TInput> {
  const { trace, ignoreMissingKeys = true } = options;

  function execute<TReturn = unknown>(
    rules: Rule,
    input: TInput = {} as TInput,
  ): TReturn | ExecutionResult<TInput> {
    validateRule(rules);
    const traceSimple: TraceRow[] = [];
    const snapshot = trace ? serialize : (_data: unknown) => undefined;

    function logTrace({ operation, rule, ...args }: TraceRow) {
      if (trace) traceSimple.push({ operation, rule, ...args });
    }

    let stepRow = 0;
    let stepCount = 0;
    const BREAK = Symbol('return');

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
    const mutableInput = input as MutableInput;
    const termResolver = (term: string): ExpressionValue => {
      try {
        const result = extractValueOrLiteral(
          mutableInput,
          term,
          stepRow,
          stepCount,
          ignoreMissingKeys,
        );
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

    const evaluateCondition = (
      condition: string | AndRule | OrRule,
    ): unknown => {
      if (typeof condition === 'string')
        return evaluateRule({ stepRow, input, rule: condition });
      if ('and' in condition && Object.hasOwn(condition, 'and'))
        return condition.and.every((child) =>
          Boolean(evaluateCondition(child)),
        );
      return (condition as OrRule).or.some((child) =>
        Boolean(evaluateCondition(child)),
      );
    };

    const handleRule = (rule: Rule): unknown => {
      if (typeof rule === 'string') {
        results.lastValue = evaluateRule({ stepRow, input, rule });
        if (trace)
          logTrace({
            operation: 'ruleString',
            rule,
            result: snapshot(results.lastValue),
            currentState: snapshot(input),
            stepRow,
            stepCount,
          });
      } else if (Array.isArray(rule)) {
        const values: unknown[] = [];
        for (const child of rule) {
          const value =
            typeof child === 'string'
              ? evaluateRule({ stepRow, input, rule: child, ignoreMissingKeys })
              : handleRule(child);
          if (value === BREAK) return BREAK;
          values.push(value);
        }
        results.lastValue = values;
        if (trace)
          logTrace({
            operation: 'ruleString[]',
            rule,
            result: snapshot(results.lastValue),
            currentState: snapshot(input),
            stepRow,
            stepCount,
          });
      } else if ('if' in rule && Object.hasOwn(rule, 'if')) {
        results.lastValue = input;

        const conditionResult = evaluateCondition(rule.if);
        if (trace)
          logTrace({
            operation:
              typeof rule.if === 'string'
                ? 'if'
                : 'and' in rule.if
                  ? 'if.and'
                  : 'if.or',
            rule:
              typeof rule.if === 'string'
                ? rule.if
                : 'and' in rule.if
                  ? rule.if.and
                  : rule.if.or,
            result: snapshot(conditionResult),
            currentState: snapshot(input),
            stepRow,
            stepCount,
          });

        if (conditionResult) {
          if (trace)
            logTrace({
              operation: 'if.then',
              rule: rule.then,
              currentState: snapshot(input),
              stepRow,
              stepCount,
            });
          if (handleRule(rule.then) === BREAK) return BREAK;
        } else if (Object.hasOwn(rule, 'else')) {
          if (trace)
            logTrace({
              operation: 'if.else',
              rule: rule.else,
              currentState: snapshot(input),
              stepRow,
              stepCount,
            });
          if (rule.else !== undefined && handleRule(rule.else) === BREAK)
            return BREAK;
        } else {
          results.lastValue = input;
        }
      } else if (
        ('and' in rule && Object.hasOwn(rule, 'and')) ||
        ('or' in rule && Object.hasOwn(rule, 'or'))
      ) {
        results.lastValue = evaluateCondition(rule);
      } else if ('return' in rule && Object.hasOwn(rule, 'return')) {
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
            result: snapshot(returnResult),
            currentState: snapshot(input),
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
            currentState: snapshot(input),
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
            const contextKeys = ['$item', '$index', '$array'] as const;
            const descriptors = contextKeys.map((key) =>
              Object.getOwnPropertyDescriptor(input, key),
            );
            const previousReturnValue = results.returnValue;
            try {
              Object.assign(input, {
                $item: item,
                $index: index,
                $array: data,
              });
              handleRule(runRule);
              return results.lastValue;
            } finally {
              results.returnValue = previousReturnValue;
              contextKeys.forEach((key, i) => {
                const descriptor = descriptors[i];
                if (descriptor) Object.defineProperty(input, key, descriptor);
                else delete input[key];
              });
            }
          },
        );
        results.lastValue = arrayResult;

        if ('set' in rule) {
          set(input, (rule as { set: string }).set, arrayResult);
        }
      } else if (
        'try' in rule &&
        'catch' in rule &&
        Object.hasOwn(rule, 'try')
      ) {
        try {
          if (trace)
            logTrace({
              operation: 'try',
              rule: rule.try,
              currentState: snapshot(input),
              stepRow,
              stepCount,
            });
          if (handleRule(rule.try) === BREAK) return BREAK;
        } catch {
          logTrace({
            operation: 'catch',
            rule: rule.catch,
            currentState: snapshot(input),
            stepRow,
            stepCount,
          });
          if (handleRule(rule.catch) === BREAK) return BREAK;
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
      | object
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
          const lhs = compiled.lhs;
          if (typeof lhs !== 'string')
            throw new UserError('Assignment requires a left-hand input path');
          const value = expressionEngine.evaluate(compiled, termResolver);
          const previous = get(input, lhs);
          set(input, lhs, value);
          results.lastValue = value;
          logTrace({
            operation: 'evalRule',
            result: snapshot(input),
            rule,
            lhs,
            value,
            previous: snapshot(previous),
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
          currentState: snapshot(input),
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
      currentState: snapshot(input),
      stepRow,
      lastValue: snapshot(getReturnValue()),
    });

    if (trace) {
      results.runTime = performance.now() - startTime;
      return results as TReturn | ExecutionResult<TInput>;
    }

    return getReturnValue() as TReturn;
  }

  return { execute };
}

// ─── Utility (also exported for use in index.ts) ─────────────────────────────

export function extractValueOrLiteral<TInput extends Record<string, unknown>>(
  input: TInput,
  token: string,
  stepRow?: number,
  stepCount?: number,
  ignoreMissingKeys?: boolean,
): ExpressionValue | undefined {
  const value = get(input, token);
  if (value !== undefined) return value as ExpressionValue;

  const quoted = trailingQuotes.exec(token);
  if (quoted) return quoted[2];
  if (/^(true|false|yes|no|on|off)$/i.test(token))
    return /^(true|yes|on)$/i.test(token);
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(token))
    return Number(token);

  if (!ignoreMissingKeys && token.length > 0)
    throw new UserError(`Undefined key: ${token}`);

  if (ignoreMissingKeys) return undefined;
  throw new UserError(
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

/** Validate the complete program before any input mutation occurs. */
function validateRule(rules: Rule) {
  const active = new WeakSet<object>();
  let nodes = 0;
  const fail = (message: string): never => {
    throw new UserError(`Invalid rule: ${message}`);
  };
  const visit = (value: unknown, depth: number, logicalOnly = false): void => {
    if (++nodes > 10_000) fail('maximum node count (10000) exceeded');
    if (depth > 100) fail('maximum nesting depth (100) exceeded');
    if (typeof value === 'string') return;
    if (!value || typeof value !== 'object')
      fail('expected a string or rule object');
    const object = value as Record<string, unknown>;
    if (active.has(object)) fail('cyclic rule structure');
    active.add(object);
    try {
      if (Array.isArray(object)) {
        if (logicalOnly)
          fail(
            'The `if` value must be a string or logical object; arrays are not supported',
          );
        for (const child of object) visit(child, depth + 1);
        return;
      }
      const prototype = Object.getPrototypeOf(object);
      if (prototype !== null && prototype !== Object.prototype)
        fail('rule objects must have a plain or null prototype');
      const keys = Object.keys(object);
      const operators = keys.filter((key) =>
        ['if', 'and', 'or', 'return', 'try', ...arrayMethods].includes(key),
      );
      if (operators.length !== 1)
        fail('expected exactly one structural operator');
      const operator = operators[0];
      if (logicalOnly && operator !== 'and' && operator !== 'or')
        fail('condition must be a string or logical object');
      const allowed =
        operator === 'if'
          ? ['if', 'then', 'else']
          : operator === 'try'
            ? ['try', 'catch']
            : (arrayMethods as readonly string[]).includes(operator)
              ? [operator, 'run', 'set']
              : [operator];
      if (keys.some((key) => !allowed.includes(key)))
        fail(`unexpected key in ${operator} rule`);
      if (operator === 'and' || operator === 'or') {
        if (!Array.isArray(object[operator]))
          fail(`${operator} must be an array`);
        for (const child of object[operator] as unknown[])
          visit(child, depth + 1, true);
      } else if (operator === 'if') {
        visit(object.if, depth + 1, true);
        if (!Object.hasOwn(object, 'then')) fail('if requires then');
        visit(object.then, depth + 1);
        if (Object.hasOwn(object, 'else')) visit(object.else, depth + 1);
      } else if (operator === 'try') {
        visit(object.try, depth + 1);
        if (!Object.hasOwn(object, 'catch')) fail('try requires catch');
        visit(object.catch, depth + 1);
      } else if (operator === 'return') {
        if (typeof object.return !== 'string')
          fail('return must be a string expression');
      } else {
        if (typeof object[operator] !== 'string')
          fail(`${operator} must be an input path`);
        if (Object.hasOwn(object, 'set') && typeof object.set !== 'string')
          fail('set must be an input path');
        if (!Object.hasOwn(object, 'run')) fail(`${operator} requires run`);
        visit(object.run, depth + 1);
      }
    } finally {
      active.delete(object);
    }
  };
  visit(rules, 0);
}
