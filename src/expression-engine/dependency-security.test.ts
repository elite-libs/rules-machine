import { expect, test } from 'vitest';
import { ruleFactory } from '../index';

test('OMIT cannot delete prototype properties through array-wrapped path segments', () => {
  // Only a temporary test-owned sentinel is touched, never built-in methods.
  const marker = '__rules_machine_advisory_regression__';
  Object.defineProperty(Object.prototype, marker, {
    value: true,
    configurable: true,
  });
  try {
    ruleFactory('OMIT(paths, data)')({
      paths: [[['__proto__'], marker]],
      data: {},
    });
    expect(Object.hasOwn(Object.prototype, marker)).toBe(true);
  } finally {
    Reflect.deleteProperty(Object.prototype, marker);
  }
});
