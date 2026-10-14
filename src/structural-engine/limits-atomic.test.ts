import { describe, expect, expectTypeOf, test, vi } from 'vitest';
import { createExpressionEngine } from '../expression-engine/engine';
import {
  createRuleExecutor,
  type ExecutionResult,
  ResourceLimitError,
  type RuleMachineOptions,
  ruleFactory,
} from '../index';
import { ExecutionBudget } from '../utils/budget';

describe('execution limits', () => {
  test('flat source is rejected before recursive parsing can overflow', () => {
    expect(() => ruleFactory(Array(6_000).fill('1').join(' + '))({})).toThrow(
      'maxTokens',
    );
    expect(
      createExpressionEngine({ maxTokens: 8 }).evaluateExpression(
        '1 + 2',
        () => 0,
      ),
    ).toBe(3);
    expect(() => createExpressionEngine({ maxTokens: 2048 })).toThrow(
      'maxTokens',
    );
  });
  test('nested array work shares one budget and resource errors bypass catch rules', () => {
    const input = { items: Array(20).fill(1), inner: Array(20).fill(2) };
    expect(() =>
      ruleFactory(
        {
          try: { map: 'items', run: { map: 'inner', run: '$item + 1' } },
          catch: 'caught = true',
        },
        { limits: { maxOperations: 100 } },
      )(input),
    ).toThrow(ResourceLimitError);
    expect(input).not.toHaveProperty('caught');
    expect(input).not.toHaveProperty('$item');
  });
  test('array traversal and growth are bounded', () => {
    expect(() =>
      ruleFactory(
        { map: 'items', run: '$item' },
        { limits: { maxArrayLength: 2 } },
      )({ items: [1, 2, 3] }),
    ).toThrow('maxArrayLength');
    expect(() =>
      ruleFactory('items.length = 100', { limits: { maxArrayLength: 2 } })({
        items: [],
      }),
    ).toThrow('maxArrayLength');
  });
  test('cooperative deadline and invalid options reject deterministically', () => {
    const now = vi.spyOn(performance, 'now');
    try {
      now.mockReturnValue(0);
      const budget = new ExecutionBudget({ maxDurationMs: 1 });
      now.mockReturnValue(2);
      expect(() => budget.checkDeadline()).toThrow('maxDurationMs');
    } finally {
      now.mockRestore();
    }
    for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() =>
        ruleFactory('1', { limits: { maxOperations: value } })({}),
      ).toThrow();
  });
  test('cold source scanning counts as work before parsing', () => {
    expect(() =>
      ruleFactory(`${' '.repeat(1000)}1`, { limits: { maxOperations: 10 } })(
        {},
      ),
    ).toThrow(ResourceLimitError);
  });
  test('atomic execution rolls back when the final deadline check fails', () => {
    const now = vi
      .spyOn(performance, 'now')
      .mockReturnValue(2)
      .mockReturnValueOnce(0);
    const input = { value: 1 };
    try {
      expect(() =>
        ruleFactory('value = 2', {
          atomic: true,
          limits: { maxDurationMs: 1 },
        })(input),
      ).toThrow(ResourceLimitError);
      expect(input.value).toBe(1);
    } finally {
      now.mockRestore();
    }
  });
  test('cache retention has entry and estimated byte ceilings', () => {
    const engine = createExpressionEngine({
      maxCacheBytes: 2048,
      maxCacheEntries: 3,
    });
    for (let i = 0; i < 1000; i++)
      expect(engine.evaluateExpression(`${i} + 1`, () => 0)).toBe(i + 1);
    expect(engine.cacheStats().entries).toBeLessThanOrEqual(3);
    expect(engine.cacheStats().estimatedBytes).toBeLessThanOrEqual(2048);
    const disabled = createExpressionEngine({ maxCacheBytes: 0 });
    expect(disabled.evaluateExpression('1 + 2', () => 0)).toBe(3);
    expect(disabled.cacheStats().entries).toBe(0);
  });
});

describe('atomic writes', () => {
  test('rolls back nested mutations and additions without changing aliases', () => {
    const nested = { value: 1 };
    const input = { nested, alias: nested };
    expect(() =>
      ruleFactory(['nested.value = 2', 'new.path = 3', 'THROW "fail"'], {
        atomic: true,
      })(input),
    ).toThrow('fail');
    expect(input).toEqual({ nested: { value: 1 }, alias: { value: 1 } });
    expect(input.nested).toBe(nested);
    expect(input.alias).toBe(nested);
    expect(input).not.toHaveProperty('new');
  });
  test('restores array truncation, holes and length extension', () => {
    const items = new Array(3);
    items[0] = 1;
    items[2] = 3;
    const input = { items };
    expect(() =>
      ruleFactory(['items.length = 1', 'items[5] = 9', 'THROW "fail"'], {
        atomic: true,
      })(input),
    ).toThrow();
    expect(items.length).toBe(3);
    expect(items[2]).toBe(3);
    expect(1 in items).toBe(false);
    expect(5 in items).toBe(false);
  });
  test('commits success, preserves default partial mutations and rolls back budget failures', () => {
    const input = { x: 0 };
    expect(
      ruleFactory(['x = 2', { return: 'x' }], { atomic: true })(input),
    ).toBe(2);
    expect(input.x).toBe(2);
    expect(() => ruleFactory(['x = 3', 'THROW "fail"'])(input)).toThrow();
    expect(input.x).toBe(3);
    expect(() =>
      ruleFactory(['x = 4', '1 + 2 + 3'], {
        atomic: true,
        limits: { maxOperations: 12 },
      })(input),
    ).toThrow(ResourceLimitError);
    expect(input.x).toBe(3);
  });
  test('failed array truncation restores elements even after a partial native failure', () => {
    const items = [1, 2, 3, 4];
    Object.defineProperty(items, '1', { configurable: false });
    expect(() =>
      ruleFactory('items.length = 0', { atomic: true })({ items }),
    ).toThrow('readonly');
    expect(items).toEqual([1, 2, 3, 4]);
    expect(Object.getOwnPropertyDescriptor(items, '1')?.configurable).toBe(
      false,
    );
  });
  test('a readonly failure restores earlier writes while preserving cyclic identities', () => {
    const input: Record<string, unknown> = {
      value: 1,
      frozen: Object.freeze({ value: 2 }),
    };
    input.self = input;
    expect(() =>
      ruleFactory(['value = 3', 'frozen.value = 4'], { atomic: true })(input),
    ).toThrow('readonly');
    expect(input.value).toBe(1);
    expect(input.self).toBe(input);
  });
  test('rollback never restores expired callback context after callback assignments', () => {
    const input = { items: [1, 2], inner: [3] };
    expect(() =>
      ruleFactory(
        [
          {
            map: 'items',
            run: [
              '$item = 5',
              '$index = 7',
              { map: 'inner', run: '$array = ARRAY(8)' },
            ],
          },
          'THROW "failed"',
        ],
        { atomic: true },
      )(input),
    ).toThrow('failed');
    expect(input).toEqual({ items: [1, 2], inner: [3] });
    for (const key of ['$item', '$index', '$array'])
      expect(Object.hasOwn(input, key)).toBe(false);
  });
  test('nested executor savepoints roll back failure and retain successful writes for the outer rollback', () => {
    const input = { outer: 1, inner: 1 };
    const engine = createExpressionEngine();
    const nested = createRuleExecutor(engine, { atomic: true });
    const executor = createRuleExecutor(
      {
        ...engine,
        evaluate(compiled, resolver) {
          if (compiled.source === 'trigger') {
            expect(() =>
              nested.execute(['inner = 3', 'THROW "inner failure"'], input),
            ).toThrow('inner failure');
            expect(input).toEqual({ outer: 2, inner: 1 });
            nested.execute('inner = 4', input);
            return 0;
          }
          return engine.evaluate(compiled, resolver);
        },
      },
      { atomic: true },
    );
    expect(() =>
      executor.execute(
        ['outer = 2', 'trigger', 'THROW "outer failure"'],
        input,
      ),
    ).toThrow('outer failure');
    expect(input).toEqual({ outer: 1, inner: 1 });
  });
  test('runtime errors do not log to the caller console', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() =>
        ruleFactory('missing', { ignoreMissingKeys: false })({}),
      ).toThrow();
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

test('trace option types reflect the selected return mode', () => {
  expectTypeOf(ruleFactory('1')<number>()).toEqualTypeOf<number>();
  expectTypeOf(
    ruleFactory('1', { trace: false })<number>(),
  ).toEqualTypeOf<number>();
  expectTypeOf(
    ruleFactory<{ x: number }>('x', { trace: true })<number>({ x: 1 }),
  ).toMatchTypeOf<ExecutionResult<{ x: number }>>();
  const options: RuleMachineOptions = { trace: Math.random() > 0.5 };
  expectTypeOf(ruleFactory('1', options)<number>()).toEqualTypeOf<
    number | ExecutionResult<Record<string, unknown>>
  >();
});

describe('descriptor-only execution and trace history', () => {
  test('structural arrays never invoke accessors, constructors or iterators', () => {
    let calls = 0;
    const items = [1, 2];
    Object.defineProperty(items, 'constructor', {
      get() {
        calls++;
        throw new Error('constructor');
      },
    });
    Object.defineProperty(items, Symbol.iterator, {
      value() {
        calls++;
        throw new Error('iterator');
      },
    });
    expect(ruleFactory({ map: 'items', run: '$item + 1' })({ items })).toEqual([
      2, 3,
    ]);
    Object.defineProperty(items, '0', {
      get() {
        calls++;
        return 1;
      },
      configurable: true,
    });
    for (const operator of ['map', 'filter', 'every', 'some', 'find'] as const)
      expect(() =>
        ruleFactory({ [operator]: 'items', run: '$item' } as never)({ items }),
      ).toThrow('accessors');
    expect(calls).toBe(0);
  });
  test('sparse structural arrays preserve map holes and find visits holes', () => {
    const items = new Array(2);
    items[1] = 3;
    const mapped = ruleFactory({ map: 'items', run: '$item + 1' })<unknown[]>({
      items,
    });
    expect(mapped.length).toBe(2);
    expect(0 in mapped).toBe(false);
    expect(mapped[1]).toBe(4);
    expect(
      ruleFactory({ find: 'items', run: '$index = 0' })({ items }),
    ).toBeUndefined();
    expect(ruleFactory({ every: 'items', run: '$item > 0' })({ items })).toBe(
      true,
    );
  });
  test('malformed rule getters and iterators reject before any mutation', () => {
    let calls = 0;
    const input = { x: 1 };
    const rule = {
      get return() {
        calls++;
        return '2';
      },
    };
    expect(() => ruleFactory(['x = 2', rule])(input)).toThrow('accessors');
    const children = ['1'];
    Object.defineProperty(children, Symbol.iterator, {
      value() {
        calls++;
        throw new Error('iterator');
      },
    });
    expect(() => ruleFactory(children)(input)).toThrow('symbol');
    expect(() => ruleFactory({ and: children })(input)).toThrow();
    expect(calls).toBe(0);
    expect(input.x).toBe(1);
  });
  test('trace captures historical objects without invoking accessors or toJSON', () => {
    let calls = 0;
    const object = {
      x: 1,
      get secret() {
        calls++;
        return 4;
      },
      toJSON() {
        calls++;
        return 'wrong';
      },
    };
    const result = ruleFactory(['object', 'object.x = 2'], { trace: true })({
      object,
    });
    const lookup = result.trace.find(
      (row) => row.operation === 'key.lookup' && row.key === 'object',
    );
    expect(lookup?.value).toMatchObject({
      x: 1,
      secret: '[Accessor]',
      toJSON: '[Function]',
    });
    expect(object.x).toBe(2);
    expect(calls).toBe(0);
  });
  test('deep trace input fails with a typed resource error rather than stack overflow', () => {
    const input: Record<string, unknown> = {};
    let node = input;
    for (let i = 0; i < 12000; i++) {
      const child = {};
      node.child = child;
      node = child;
    }
    expect(() => ruleFactory('1', { trace: true })(input)).toThrow(
      ResourceLimitError,
    );
    expect(() =>
      ruleFactory('1', { limits: { maxDataDepth: 257 } })({}),
    ).toThrow('maxDataDepth');
  });
  test('compact negative function and array arguments parse consistently', () => {
    expect(ruleFactory('ADD(2,-1)')({})).toBe(1);
    expect(ruleFactory('[1,-2]')({})).toEqual([1, -2]);
    expect(ruleFactory('SLICE(-3,-1,[1,2,3,4])')({})).toEqual([2, 3]);
    expect(ruleFactory('STRING("a,-b")')({})).toBe('a,-b');
  });
});
