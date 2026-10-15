import { describe, expect, test } from 'vitest';
import { createExpressionEngine } from '../expression-engine/engine';
import { ruleFactory } from '../index';
import {
  ExecutionBudget,
  ResourceLimitError,
  withExecutionBudget,
} from '../utils/budget';
import { traceSnapshot } from '../utils/snapshot';
import { createRuleExecutor } from './executor';

describe('runtime security boundary', () => {
  test('atomic truncation cannot discard nonextensible array elements', () => {
    const items = Object.preventExtensions([1, 2, 3]);
    const before = Object.getOwnPropertyDescriptors(items);
    expect(() =>
      ruleFactory(['items.length = 0', 'THROW("stop")'], { atomic: true })({
        items,
      }),
    ).toThrow();
    expect(Object.getOwnPropertyDescriptors(items)).toEqual(before);
  });
  test('trace error descriptions do not execute message getters', () => {
    let calls = 0;
    const error = new Error('original');
    Object.defineProperty(error, 'message', {
      get() {
        calls++;
        return 'trap';
      },
    });
    const base = createExpressionEngine();
    const executor = createRuleExecutor(
      {
        ...base,
        evaluate() {
          throw error;
        },
      },
      { trace: true },
    );
    let caught: unknown;
    try {
      executor.execute('1');
    } catch (value) {
      caught = value;
    }
    expect(caught).toBe(error);
    expect(calls).toBe(0);
  });
  test('trace object keys obey string limits', () => {
    const input = { ['k'.repeat(101)]: 1 };
    expect(() =>
      ruleFactory('1', { trace: true, limits: { maxStringLength: 100 } })(
        input,
      ),
    ).toThrow(ResourceLimitError);
  });
});

describe('atomic array descriptors and trace traversal bounds', () => {
  test('ordinary non-atomic truncation retains partial-write behavior', () => {
    const items = Object.preventExtensions([1, 2, 3]);
    expect(() =>
      ruleFactory(['items.length = 0', 'THROW("stop")'])({ items }),
    ).toThrow('stop');
    expect(items.length).toBe(0);
  });
  test('atomic truncation with no removed slots remains reversible on nonextensible arrays', () => {
    const items = new Array(3);
    Object.preventExtensions(items);
    const before = Object.getOwnPropertyDescriptors(items);
    expect(() =>
      ruleFactory(['items.length = 1', 'THROW("stop")'], { atomic: true })({
        items,
      }),
    ).toThrow('stop');
    expect(Object.getOwnPropertyDescriptors(items)).toEqual(before);
  });
  test('partial failed truncation restores holes and exact index descriptors', () => {
    const items = [1, 2, 3, 4];
    delete items[1];
    Object.defineProperty(items, '2', {
      configurable: false,
      writable: false,
      enumerable: false,
    });
    const before = Object.getOwnPropertyDescriptors(items);
    expect(() =>
      ruleFactory('items.length = 0', { atomic: true })({ items }),
    ).toThrow('readonly');
    expect(Object.getOwnPropertyDescriptors(items)).toEqual(before);
  });
  test('trace snapshot checks long keys and generated BigInt text before copying', () => {
    const limits = { maxStringLength: 100 };
    for (const input of [
      { ['k'.repeat(101)]: 1 },
      10n ** 100n,
      Symbol('s'.repeat(101)),
    ])
      expect(() =>
        withExecutionBudget(new ExecutionBudget(limits), () =>
          traceSnapshot(input),
        ),
      ).toThrow(ResourceLimitError);
  });
  test('trace snapshots charge keys across aliased graphs before expansion', () => {
    const shared = { ['k'.repeat(100)]: 1 };
    expect(() =>
      withExecutionBudget(new ExecutionBudget({ maxOperations: 100 }), () =>
        traceSnapshot({ a: shared, b: shared }),
      ),
    ).toThrow(ResourceLimitError);
  });
  test('trace error formatting never calls arbitrary coercion methods', () => {
    let calls = 0;
    const error = {
      toString() {
        calls++;
        return 'coerced';
      },
      [Symbol.toPrimitive]() {
        calls++;
        return 'coerced';
      },
    };
    const engine = createExpressionEngine();
    const executor = createRuleExecutor(
      {
        ...engine,
        evaluate() {
          throw error;
        },
      },
      { trace: true },
    );
    let caught: unknown;
    try {
      executor.execute('1');
    } catch (value) {
      caught = value;
    }
    expect(caught).toBe(error);
    expect(calls).toBe(0);
  });
});

test('atomic preflight rejects irreversible partial truncation before any deletion', () => {
  const items = [1, 2, 3, 4];
  Object.defineProperty(items, '1', { configurable: false });
  Object.preventExtensions(items);
  const before = Object.getOwnPropertyDescriptors(items);
  const input = { x: 1, items };
  expect(() =>
    ruleFactory(['x = 2', 'items.length = 0'], { atomic: true })(input),
  ).toThrow('nonextensible');
  expect(Object.getOwnPropertyDescriptors(items)).toEqual(before);
  expect(input.x).toBe(1);
});

test('input aliases cannot replace a prevalidated later rule with an accessor', () => {
  let calls = 0;
  const injected = Object.defineProperty({}, 'return', {
    enumerable: true,
    get() {
      calls++;
      return '9';
    },
  });
  const rules = ['program[1] = injected', { return: '1' }];
  const input = { program: rules, injected };
  const run = ruleFactory(rules);
  expect(run(input)).toBe(1);
  expect(calls).toBe(0);
  expect(() => run(input)).toThrow('accessors');
  expect(calls).toBe(0);
});

test('input aliases cannot inject a cycle or mutate a selected conditional branch mid-call', () => {
  const cycle: Record<string, unknown> = { if: 'true' };
  // biome-ignore lint/suspicious/noThenProperty: construct a structural cycle, not a promise.
  cycle.then = cycle;
  const rules = ['program[1] = injected', { return: '1' }];
  const input = { program: rules, injected: cycle };
  const run = ruleFactory(rules);
  expect(run(input)).toBe(1);
  expect(() => run(input)).toThrow('cyclic');

  let calls = 0;
  const injected = Object.defineProperty({}, 'return', {
    enumerable: true,
    get() {
      calls++;
      return '9';
    },
  });
  // biome-ignore lint/suspicious/noThenProperty: structural then contains a rule.
  const condition = { if: 'program.then = injected', then: { return: '2' } };
  expect(ruleFactory(condition)({ program: condition, injected })).toBe(2);
  expect(calls).toBe(0);
});

describe('independent engine and argument branding review', () => {
  test('marker laundering through generated containers never executes host functions', () => {
    for (const expression of [
      'ABS(ARRAY(items))',
      'ABS(REVERSE(items))',
      'ABS(FILTER_VALUES(EMPTY, OMIT("missing", items)))',
      'MAP("ABS", CONS(OMIT("missing", items), EMPTY))',
      'REDUCE("ADD", 0, OMIT("missing", items))',
    ]) {
      let calls = 0;
      const callback = () => {
        calls++;
        return 7;
      };
      const items = Object.assign([callback], { isArgumentsArray: true });
      expect(() => ruleFactory(expression)({ items })).toThrow();
      expect(calls).toBe(0);
    }
  });
  test('argument identity checks do not consult marker getters', () => {
    let calls = 0;
    const items = Object.defineProperty([1], 'isArgumentsArray', {
      get() {
        calls++;
        return true;
      },
    });
    expect(() => ruleFactory('ABS(items)')({ items })).toThrow();
    expect(calls).toBe(0);
  });
  test('normal comma and higher-order argument construction stays compatible', () => {
    expect(ruleFactory('ADD(1,2)')()).toBe(3);
    expect(ruleFactory('MAP("ABS",items)')({ items: [-2, 3] })).toEqual([2, 3]);
    expect(ruleFactory('REDUCE("ADD",0,items)')({ items: [1, 2, 3] })).toBe(6);
  });
  test('compiled source is an own primitive data field and forged metadata is ignored', () => {
    let calls = 0;
    const engine = createExpressionEngine();
    const inherited = Object.create({
      get source() {
        calls++;
        return '1';
      },
    });
    expect(() => engine.evaluate(inherited, () => undefined)).toThrow('source');
    const boxed = { source: new String('1') };
    expect(() => engine.evaluate(boxed as never, () => undefined)).toThrow(
      'source',
    );
    const compiled = Object.defineProperties(
      { source: '1' },
      {
        lhs: {
          get() {
            calls++;
            throw new Error('lhs');
          },
        },
        assignmentOperator: {
          get() {
            calls++;
            throw new Error('assignment');
          },
        },
      },
    );
    expect(engine.evaluate(compiled as never, () => undefined)).toBe(1);
    expect(calls).toBe(0);
  });
});

test('ordinary Error without an own message keeps empty trace text', () => {
  const engine = createExpressionEngine();
  const error = new Error();
  const executor = createRuleExecutor(
    {
      ...engine,
      evaluate(compiled, resolver) {
        if (compiled.source === 'trigger') throw error;
        return engine.evaluate(compiled, resolver);
      },
    },
    { trace: true },
  );
  const result = executor.execute({ try: 'trigger', catch: '1' }) as {
    trace: { operation: string; error?: unknown }[];
  };
  expect(result.trace.find((row) => row.operation === 'error')?.error).toBe('');
});
