import { describe, expect, test } from 'vitest';
import type { ExpressionEngine } from '../expression-engine/engine';
import { extractValueOrLiteral, ruleFactory } from '../index';
import { createRuleExecutor } from './executor';
import type { Rule } from './types';

const unsafeRule = (rule: unknown) => rule as Rule;

describe('structural execution contracts', () => {
  test('recursively evaluates logical groups and short circuits', () => {
    const execute = ruleFactory({
      if: {
        and: ['true', { or: ['false', { and: ['allowed', 'NOT blocked'] }] }],
      },
      then: { return: '"yes"' },
      else: { return: '"no"' },
    });
    expect(execute({ allowed: true, blocked: false })).toBe('yes');
    expect(execute({ allowed: true, blocked: true })).toBe('no');
    expect(ruleFactory({ or: ['true', 'THROW("unreachable")'] })()).toBe(true);
    expect(ruleFactory({ and: [] })()).toBe(true);
    expect(ruleFactory({ or: [] })()).toBe(false);
  });

  test.each([
    { if: 'true', then: { return: '1' } },
    { if: 'false', then: '0', else: { return: '1' } },
    { try: { return: '1' }, catch: '0' },
    { try: 'THROW("caught")', catch: { return: '1' } },
    [[{ return: '1' }, 'THROW("unreachable")']],
  ] as Rule[])('propagates return through nested structures: %j', (nested) => {
    expect(ruleFactory([nested, 'THROW("unreachable")'])()).toBe(1);
  });

  test('ordinary BREAK data does not stop execution', () => {
    expect(ruleFactory(['"BREAK"', { return: '2' }])()).toBe(2);
  });

  test('array returns finish only the current callback', () => {
    const input = { items: [1, 2, 3] };
    expect(
      ruleFactory([
        {
          map: 'items',
          run: [{ return: '$item * 2' }, 'THROW("unreachable")'],
          set: 'mapped',
        },
        { return: 'mapped' },
      ])(input),
    ).toEqual([2, 4, 6]);
    expect(Object.keys(input)).toEqual(['items', 'mapped']);
  });

  test('restores outer array variables and permits reuse of input', () => {
    const input = {
      items: [
        { id: 1, children: [10] },
        { id: 2, children: [20] },
      ],
    };
    const execute = ruleFactory({
      map: 'items',
      run: [{ map: '$item.children', run: '$item + 1' }, 'outerId = $item.id'],
    });
    execute(input);
    expect(input).toHaveProperty('outerId', 2);
    expect(input).not.toHaveProperty('$item');
    expect(() => execute(input)).not.toThrow();
  });

  test('cleans array context on exceptions before catch executes', () => {
    const input = { items: [1] };
    expect(
      ruleFactory({
        try: { map: 'items', run: 'THROW("failure")' },
        catch: { return: '7' },
      })(input),
    ).toBe(7);
    expect(input).toEqual({ items: [1] });
  });

  test.each([
    null,
    5,
    {},
    { if: 'true' },
    { map: 'items' },
    { return: {} },
    { return: '1', map: 'items', run: '1' },
    { if: ['true'], then: '1' },
  ])('rejects malformed rules before mutating input: %j', (bad) => {
    const input = {};
    expect(() => ruleFactory(['x = 1', unsafeRule(bad)])(input)).toThrow(
      /Invalid rule/,
    );
    expect(input).toEqual({});
  });

  test('bounds rule complexity and rejects cycles', () => {
    const cycle: Rule[] = [];
    cycle.push(cycle);
    expect(() => ruleFactory(cycle)()).toThrow(/cyclic/);
    let nested: Rule = '1';
    for (let i = 0; i < 102; i++) nested = [nested];
    expect(() => ruleFactory(nested)()).toThrow(/nesting depth/);
    expect(() =>
      ruleFactory(Array.from({ length: 10_001 }, () => '1'))(),
    ).toThrow(/node count/);
  });

  test('trace disabled never serializes input', () => {
    const input: Record<string, unknown> = {
      amount: 1n,
      toJSON() {
        throw new Error('must not serialize');
      },
    };
    input.self = input;
    expect(ruleFactory(['x = 3', { return: 'x' }])(input)).toBe(3);
  });

  test('traces cycles and BigInt without corrupting shared references', () => {
    const shared = { id: 1 };
    const input: Record<string, unknown> = { amount: 1n, a: shared, b: shared };
    input.self = input;
    const result = ruleFactory('x = 3', { trace: true })(input) as {
      trace: { result?: unknown }[];
    };
    const state = result.trace.find((row) => typeof row.result === 'string')
      ?.result as string;
    expect(JSON.parse(state)).toMatchObject({
      amount: '1',
      a: { id: 1 },
      b: { id: 1 },
      self: '[Circular]',
      x: 3,
    });
  });

  test('explicit null remains a value in strict missing-key mode', () => {
    const engine: ExpressionEngine = {
      compile: (source) => ({
        source,
        lhs: undefined,
        assignmentOperator: undefined,
      }),
      evaluate: (compiled, resolve) => resolve(compiled.source),
      evaluateExpression: (_source, resolve) => resolve('value'),
    };
    expect(
      createRuleExecutor(engine, { ignoreMissingKeys: false }).execute(
        { return: 'value' },
        { value: null },
      ),
    ).toBeNull();
    expect(() =>
      ruleFactory('missing', { ignoreMissingKeys: false })({}),
    ).toThrow(/Undefined key/);
  });

  test('rejects sparse arrays and inherited operators before mutation', () => {
    const sparse: Rule[] = ['x = 1'];
    sparse.length = 2;
    const input = {};
    expect(() => ruleFactory(sparse)(input)).toThrow(/Invalid rule/);
    expect(input).toEqual({});
    expect(() =>
      ruleFactory(unsafeRule(Object.create({ if: 'true', then: '1' })))(),
    ).toThrow(/Invalid rule/);
  });

  test('trace serialization failures do not replace rule errors', () => {
    const input = {
      toJSON() {
        throw new Error('serialization failure');
      },
    };
    expect(() =>
      ruleFactory('THROW("original error")', { trace: true })(input),
    ).toThrow('original error');
    expect(() => ruleFactory('x = 1', { trace: true })(input)).not.toThrow();
  });

  test('preserves explicit null through the default parser', () => {
    expect(
      ruleFactory(
        { return: 'value' },
        { ignoreMissingKeys: false },
      )({ value: null }),
    ).toBeNull();
    expect(
      ruleFactory({ return: 'values' })({ values: [null, { nested: null }] }),
    ).toEqual([null, { nested: null }]);
    expect(ruleFactory('value == other')({ value: null, other: null })).toBe(
      true,
    );
  });

  test('literal extraction is stable and preserves string contents', () => {
    for (let i = 0; i < 3; i++)
      expect(extractValueOrLiteral({}, '"hello"')).toBe('hello');
    expect(extractValueOrLiteral({}, "'world'")).toBe('world');
    expect(extractValueOrLiteral({}, '2')).toBe(2);
    expect(extractValueOrLiteral({}, 'true')).toBe(true);
    expect(
      extractValueOrLiteral({ value: null }, 'value', 0, 0, false),
    ).toBeNull();
  });
});
