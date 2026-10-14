import type { ExpressionValue } from 'expressionparser/dist/ExpressionParser.js';
import type { ExpressionEngine } from '../expression-engine/engine';
import {
  checkArrayLength,
  consumeWork,
  ExecutionBudget,
  type ExecutionLimits,
  ResourceLimitError,
  withExecutionBudget,
} from '../utils/budget';
import { UserError } from '../utils/errors';
import { recordMutation, withAtomicWrites } from '../utils/mutations';
import {
  assertWritablePath,
  getOwnPath as get,
  setOwnPath as set,
} from '../utils/paths';
import { serializeTrace, traceSnapshot } from '../utils/snapshot';
import type { AndRule, OrRule, Rule } from './types';

// ─── Helpers ────────────────────────────────────────────────────────────────

const trailingQuotes = /^(['"])([\s\S]*)\1$/;

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
  value?: unknown;
  error?: unknown;
  [key: string]: unknown;
}

// ─── Options ─────────────────────────────────────────────────────────────────

export interface ExecutorOptions {
  trace?: boolean;
  ignoreMissingKeys?: boolean;
  limits?: ExecutionLimits;
  atomic?: boolean;
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

export function createRuleExecutor<TInput extends object>(
  expressionEngine: ExpressionEngine,
  options: ExecutorOptions = { trace: false, ignoreMissingKeys: true },
): RuleExecutor<TInput> {
  const { trace, ignoreMissingKeys = true } = options;

  function executeProgram<TReturn = unknown>(
    rules: Rule,
    input: TInput = {} as TInput,
  ): TReturn | ExecutionResult<TInput> {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      throw new UserError('Input must be an object');
    }
    validateRule(rules);
    const traceSimple: TraceRow[] = [];
    const snapshot = trace ? serializeTrace : (_data: unknown) => undefined;

    function logTrace(row: TraceRow) {
      if (!trace) return;
      const { operation, rule, ...args } = row;
      traceSimple.push({
        operation,
        rule: traceSnapshot(rule) as Rule,
        ...(traceSnapshot(args) as Record<string, unknown>),
      });
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
      consumeWork();
      if (typeof condition === 'string')
        return evaluateRule({ stepRow, input, rule: condition });
      const conjunction = Object.hasOwn(condition, 'and');
      const children = conjunction
        ? (condition as AndRule).and
        : (condition as OrRule).or;
      for (let index = 0; index < children.length; index++) {
        const result = Boolean(evaluateCondition(children[index]));
        if (conjunction ? !result : result) return !conjunction;
      }
      return conjunction;
    };

    const handleRule = (rule: Rule): unknown => {
      consumeWork();
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
        for (let childIndex = 0; childIndex < rule.length; childIndex++) {
          const child = rule[childIndex];
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

        checkArrayLength(data.length);
        consumeWork(data.length);
        const runRule = (rule as { run: Rule }).run;
        const length = data.length;
        const runItem = (item: unknown, index: number) => {
          const contextKeys = ['$item', '$index', '$array'] as const;
          const descriptors = contextKeys.map((key) =>
            Object.getOwnPropertyDescriptor(input, key),
          );
          const previousReturnValue = results.returnValue;
          try {
            for (const key of contextKeys)
              recordMutation(input, key, undefined);
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
              else delete (input as Record<string, unknown>)[key];
            });
          }
        };
        let arrayResult: unknown =
          arrayOperator === 'map'
            ? new Array(length)
            : arrayOperator === 'filter'
              ? []
              : arrayOperator === 'every'
                ? true
                : arrayOperator === 'some'
                  ? false
                  : undefined;
        for (let index = 0; index < length; index++) {
          const descriptor = Object.getOwnPropertyDescriptor(
            data,
            String(index),
          );
          if (descriptor && !('value' in descriptor))
            throw new UserError('Array accessors are not supported');
          if (!descriptor && arrayOperator !== 'find') continue;
          const item: unknown = descriptor?.value;
          const result = runItem(item, index);
          if (arrayOperator === 'map')
            (arrayResult as unknown[])[index] = result;
          else if (arrayOperator === 'filter') {
            if (result) (arrayResult as unknown[]).push(item);
          } else if (arrayOperator === 'every' && !result) {
            arrayResult = false;
            break;
          } else if (arrayOperator === 'some' && result) {
            arrayResult = true;
            break;
          } else if (arrayOperator === 'find' && result) {
            arrayResult = item;
            break;
          }
        }

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
        } catch (error) {
          if (error instanceof ResourceLimitError) throw error;
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

      consumeWork();
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
        if (trace)
          logTrace({
            operation: 'error',
            error: e instanceof Error ? e.message : String(e),
            rule,
            stepRow,
            stepCount,
          });
        throw e;
      }
    }

    // ── Main execution loop ──────────────────────────────────────────────────

    const ruleArray = Array.isArray(rules) ? rules : [rules];

    for (let ruleIndex = 0; ruleIndex < ruleArray.length; ruleIndex++) {
      const rule = ruleArray[ruleIndex];
      try {
        const ruleResult = handleRule(rule);
        if (ruleResult === BREAK) break;
      } catch (e) {
        if (trace)
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

  function execute<TReturn = unknown>(
    rules: Rule,
    input: TInput = {} as TInput,
  ): TReturn | ExecutionResult<TInput> {
    const budget = new ExecutionBudget(options.limits);
    const run = () =>
      withExecutionBudget(budget, () => {
        const result = executeProgram<TReturn>(rules, input);
        budget.checkDeadline();
        return result;
      });
    return options.atomic ? withAtomicWrites(run) : run();
  }
  return { execute };
}

// ─── Utility (also exported for use in index.ts) ─────────────────────────────

export function extractValueOrLiteral<TInput extends object>(
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
    consumeWork();
    if (++nodes > 10_000) fail('maximum node count (10000) exceeded');
    if (depth > 100) fail('maximum nesting depth (100) exceeded');
    if (typeof value === 'string') return;
    if (!value || typeof value !== 'object')
      fail('expected a string or rule object');
    const object = value as Record<string, unknown>;
    if (active.has(object)) fail('cyclic rule structure');
    active.add(object);
    try {
      if (Array.isArray(object)) checkArrayLength(object.length);
      const ownKeys = Reflect.ownKeys(object);
      consumeWork(ownKeys.length);
      const descriptors = Object.getOwnPropertyDescriptors(object);
      for (const key of ownKeys) {
        if (typeof key !== 'string') fail('symbol keys are not supported');
        const descriptor = descriptors[key as string];
        if (!('value' in descriptor)) fail('accessors are not supported');
        if (Array.isArray(object) && key === 'length') continue;
        if (!descriptor.enumerable)
          fail('nonenumerable rule keys are not supported');
        if (Array.isArray(object) && !/^(0|[1-9][0-9]*)$/.test(key as string))
          fail('unexpected array key');
      }
      if (Array.isArray(object)) {
        if (logicalOnly)
          fail(
            'The `if` value must be a string or logical object; arrays are not supported',
          );
        checkArrayLength(object.length);
        if (ownKeys.length !== object.length + 1)
          fail('sparse rule arrays are not supported');
        for (let index = 0; index < object.length; index++)
          visit(descriptors[String(index)].value, depth + 1);
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
        const children = object[operator] as unknown[];
        const childKeys = Reflect.ownKeys(children);
        consumeWork(childKeys.length);
        checkArrayLength(children.length);
        if (childKeys.length !== children.length + 1)
          fail('logical arrays must be dense and contain no extra keys');
        for (let index = 0; index < children.length; index++) {
          const descriptor = Object.getOwnPropertyDescriptor(
            children,
            String(index),
          );
          if (!descriptor || !('value' in descriptor) || !descriptor.enumerable)
            fail('logical arrays must contain enumerable data values');
          visit(descriptor?.value, depth + 1, true);
        }
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
        if (
          typeof object[operator] !== 'string' ||
          !(object[operator] as string).trim()
        )
          fail(`${operator} must be a nonempty input path`);
        if (Object.hasOwn(object, 'set') && typeof object.set !== 'string')
          fail('set must be an input path');
        if (Object.hasOwn(object, 'set'))
          assertWritablePath(object.set as string);
        if (!Object.hasOwn(object, 'run')) fail(`${operator} requires run`);
        visit(object.run, depth + 1);
      }
    } finally {
      active.delete(object);
    }
  };
  visit(rules, 0);
}
