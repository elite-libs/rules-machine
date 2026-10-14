import { init } from 'expressionparser';
import type { ExpressionValue } from 'expressionparser/dist/ExpressionParser.js';
import { describe, expect, test, vi } from 'vitest';
import {
  ExecutionBudget,
  ResourceLimitError,
  withExecutionBudget,
} from '../utils/budget';
import { getOwnPath } from '../utils/paths';
import { ruleExpressionLanguage } from './language';
import { array, evalBool, evalString } from './language-utils';
import { createMaterializer, dataEntries, readData } from './materialize';

function evaluate(source: string, input: Record<string, unknown> = {}) {
  const values = createMaterializer();
  const parser = init(
    ruleExpressionLanguage,
    (term) => values.protect(getOwnPath(input, term)) as ExpressionValue,
  );
  return values.materialize(
    parser.rpnToThunk(parser.tokensToRpn(parser.tokenize(source))),
  );
}

describe('materialization provenance and immutable host values', () => {
  test('returns frozen input graphs by identity without invoking contained functions', () => {
    const fn = vi.fn(() => 99);
    const input = Object.freeze({
      frozen: Object.freeze([fn, null, Object.freeze({ value: 2 })]),
    });
    const values = createMaterializer();
    expect(values.materialize(() => values.protect(input))).toBe(input);
    expect(fn).not.toHaveBeenCalled();
    expect(evaluate('frozen', { frozen: input.frozen })).toBe(input.frozen);
    expect(evaluate('HEAD(frozen)', { frozen: input.frozen })).toBe(fn);
    expect(fn).not.toHaveBeenCalled();
  });

  test('preserves protected cycles, aliases and null prototypes without graph walks', () => {
    const values = createMaterializer();
    const child = Object.create(null);
    Object.defineProperty(child, '__proto__', { value: 42, enumerable: true });
    const input: Record<string, unknown> = { a: child, b: child };
    input.self = input;
    Object.freeze(input);
    expect(values.materialize(() => values.protect(input))).toBe(input);
    expect(evaluate('record', { record: input })).toBe(input);
    expect(child.__proto__).toBe(42);
    expect(Object.getPrototypeOf(child)).toBeNull();
  });

  test('copies fresh parser records safely and preserves their cycles and aliases', () => {
    const values = createMaterializer();
    const shared = Object.freeze({ value: () => 3 });
    const internal = Object.create(null);
    Object.defineProperty(internal, '__proto__', {
      value: () => 7,
      enumerable: true,
    });
    internal.a = shared;
    internal.b = shared;
    internal.self = internal;
    Object.freeze(internal);
    const result = values.materialize(() => internal) as typeof internal;
    expect(result).not.toBe(internal);
    expect(Object.getPrototypeOf(result)).toBeNull();
    expect(result.__proto__).toBe(7);
    expect(result.a).toBe(result.b);
    expect(result.a.value).toBe(3);
    expect(result.self).toBe(result);
    expect(typeof internal.__proto__).toBe('function');
  });

  test('preserves opaque class and Date identity without methods', () => {
    const method = vi.fn(() => 1);
    class Host {
      valueOf = method;
      toString = method;
    }
    const host = Object.freeze(new Host());
    const date = Object.freeze(new Date(0));
    const values = createMaterializer();
    expect(values.materialize(() => values.protect(host))).toBe(host);
    expect(values.materialize(() => values.protect(date))).toBe(date);
    expect(evaluate('host', { host })).toBe(host);
    expect(() => evaluate('host > 1', { host })).toThrow(/primitive/);
    expect(() => evaluate('STRING(host)', { host })).toThrow(/primitive/);
    expect(method).not.toHaveBeenCalled();
  });

  test('does not read getters during protection, but rejects attempted reads or copies', () => {
    const getter = vi.fn(() => 3);
    const host = Object.defineProperty({}, 'value', {
      get: getter,
      enumerable: true,
    });
    const values = createMaterializer();
    expect(values.materialize(() => values.protect(host))).toBe(host);
    expect(() => readData(host, 'value')).toThrow(/accessor/);
    expect(() => dataEntries(host)).toThrow(/accessor/);
    expect(() => evaluate('PUT("extra", 1, host)', { host })).toThrow(
      /accessor/,
    );
    expect(() => evaluate('VALUES(host)', { host })).toThrow(/accessor/);
    expect(() => evaluate('GET("value", host)', { host })).toThrow(/accessor/);
    expect(getter).not.toHaveBeenCalled();
  });

  test('protects newly inserted descendants lazily after earlier evaluations', () => {
    const fn = vi.fn(() => 5);
    const input: unknown[] = [1];
    const values = createMaterializer();
    values.protect(input);
    expect(array(input as ExpressionValue)).toEqual([1]);
    input[0] = fn;
    expect(array(input as ExpressionValue)[0]).toBe(fn);
    expect(() => evalBool(readData(input, '0') as ExpressionValue)).toThrow(
      /boolean/,
    );
    expect(() => evalString(readData(input, '0') as ExpressionValue)).toThrow(
      /string/,
    );
    expect(fn).not.toHaveBeenCalled();
  });

  test.each([
    'MAP',
    'FILTER',
    'TAKEWHILE',
    'DROPWHILE',
  ])('rejects host callbacks through %s', (name) => {
    const callback = vi.fn(() => true);
    expect(() =>
      evaluate(`${name}(callback, items)`, { callback, items: [1, 2] }),
    ).toThrow(/callbacks/);
    expect(callback).not.toHaveBeenCalled();
  });

  test('rejects REDUCE host callbacks and accepts named built-ins', () => {
    const callback = vi.fn(() => 1);
    expect(() =>
      evaluate('REDUCE(callback, 0, items)', { callback, items: [1, 2] }),
    ).toThrow(/callbacks/);
    expect(callback).not.toHaveBeenCalled();
    expect(evaluate('MAP("ABS", items)', { items: [-1, -2] })).toEqual([1, 2]);
    expect(evaluate('REDUCE("ADD", 0, items)', { items: [1, 2] })).toBe(3);
  });

  test('preserves dangerous dictionary keys and protected child identity', () => {
    const child = Object.freeze({ key: 1 });
    const result = evaluate('PUT("constructor", child, record)', {
      child,
      record: JSON.parse('{"__proto__":1}'),
    }) as Record<string, unknown>;
    expect(Object.hasOwn(result, '__proto__')).toBe(true);
    expect(result.__proto__).toBe(1);
    expect(result.constructor).toBe(child);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });

  test('rejects array accessors without calling them', () => {
    const getter = vi.fn(() => 1);
    const items = Object.defineProperty([0], '0', { get: getter });
    expect(() => evaluate('SUM(items)', { items })).toThrow(/accessor/);
    expect(getter).not.toHaveBeenCalled();
  });

  test('enforces traversal and allocation budgets before large array copies', () => {
    const values = createMaterializer();
    expect(() =>
      withExecutionBudget(new ExecutionBudget({ maxArrayLength: 2 }), () =>
        values.materialize(() => [1, 2, 3]),
      ),
    ).toThrow(ResourceLimitError);
    expect(() =>
      withExecutionBudget(new ExecutionBudget({ maxOperations: 3 }), () =>
        values.materialize(() => ({ a: 1, b: 2 })),
      ),
    ).toThrow(ResourceLimitError);
    expect(() =>
      withExecutionBudget(new ExecutionBudget({ maxArrayLength: 2 }), () =>
        evaluate('RANGE(0, 3)'),
      ),
    ).toThrow(ResourceLimitError);
    expect(() =>
      withExecutionBudget(new ExecutionBudget({ maxArrayLength: 2 }), () =>
        evaluate('KEYS(record)', { record: { a: 1, b: 2, c: 3 } }),
      ),
    ).toThrow(ResourceLimitError);
  });
});
