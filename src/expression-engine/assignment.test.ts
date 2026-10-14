import { describe, expect, test } from 'vitest';
import { extractAssignment } from './assignment';

describe('assignment boundaries', () => {
  test.each([
    '"hello = world"',
    'x == 1',
    'x >= 1',
    'x <= 1',
    'x != 1',
    'x ~= 1',
    'IF(true, "x = 1", "y += 2")',
  ])('does not assign for %s', (source) => {
    expect(extractAssignment(source).assignmentOperator).toBeUndefined();
  });
  test.each([
    ['x=1', 'x', '='],
    ['x += " = "', 'x', '+='],
    ['user.value??=2', 'user.value', '??='],
    ['items[0]=3', 'items[0]', '='],
  ])('recognizes %s', (source, lhs, assignmentOperator) => {
    expect(extractAssignment(source)).toMatchObject({
      lhs,
      assignmentOperator,
    });
  });
  test.each([
    'x=y=1',
    '1 = 2',
    'x.constructor.value = 1',
    'x["__proto__"] = 1',
  ])('rejects %s', (source) => {
    expect(() => extractAssignment(source)).toThrow();
  });
});
