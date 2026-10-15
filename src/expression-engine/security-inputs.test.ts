import { expect, test, vi } from 'vitest';
import { ruleFactory } from '../index';
import { ExecutionBudget, withExecutionBudget } from '../utils/budget';
import { joinValues } from './language-utils';
import { describeValue } from './materialize';

test('input argument markers cannot turn copied host functions into expression thunks', () => {
  const callback = vi.fn(() => 7);
  const items = Object.assign([callback], { isArgumentsArray: true });
  expect(() => ruleFactory('ABS(OMIT("missing", items))')({ items })).toThrow();
  expect(callback).not.toHaveBeenCalled();
});

test('assignment cannot mutate an intrinsic prototype supplied through an alias', () => {
  const key = '__rules_machine_security_probe__';
  let failure: unknown;
  let mutated = false;
  try {
    try {
      ruleFactory(`target.${key} = 1`)({ target: Object.prototype });
    } catch (error) {
      failure = error;
    }
    mutated = Object.hasOwn(Object.prototype, key);
  } finally {
    Reflect.deleteProperty(Object.prototype, key);
  }
  expect(failure).toBeInstanceOf(Error);
  expect(mutated).toBe(false);
});

test('assignment treats custom-prototype records as opaque without touching their hooks', () => {
  const hook = vi.fn(() => Object.prototype);
  const prototype = Object.create(null);
  Object.defineProperty(prototype, 'constructor', { get: hook });
  const target = Object.create(prototype);
  expect(() => ruleFactory('target.value = 1')({ target })).toThrow(/opaque/);
  expect(Object.hasOwn(target, 'value')).toBe(false);
  expect(hook).not.toHaveBeenCalled();
});

test('joining stops converting primitives as soon as the output limit is exceeded', () => {
  const convert = String;
  let conversions = 0;
  vi.stubGlobal('String', (value: unknown) => {
    if (typeof value === 'bigint') conversions++;
    return convert(value);
  });
  let failure: unknown;
  try {
    withExecutionBudget(new ExecutionBudget({ maxStringLength: 5 }), () =>
      joinValues([123n, 123n, 123n] as never, ''),
    );
  } catch (error) {
    failure = error;
  } finally {
    vi.unstubAllGlobals();
  }
  expect(failure).toMatchObject({ name: 'ResourceLimitError' });
  expect(conversions).toBe(2);
});

test('OMIT applies string bounds to nested path segments before joining them', () => {
  const paths = [[Array.from({ length: 20 }, () => 'key')]];
  expect(() =>
    ruleFactory('OMIT(paths, data)', { limits: { maxStringLength: 30 } })({
      paths,
      data: {},
    }),
  ).toThrow(/maxStringLength/);
});

test('diagnostics summarize bigint and symbol primitives without expanding their text', () => {
  expect(describeValue(123n)).toBe('[bigint]');
  expect(describeValue(Symbol('x'.repeat(1_000)))).toBe('[symbol]');
});

test('mandatory root-key validation consumes the execution work budget before writes', () => {
  const input = Object.fromEntries(
    Array.from({ length: 1_000 }, (_, index) => [`key${index}`, index]),
  );
  expect(() =>
    ruleFactory('changed = 1', { limits: { maxOperations: 100 } })(input),
  ).toThrow(/maxOperations/);
  expect(Object.hasOwn(input, 'changed')).toBe(false);
});
