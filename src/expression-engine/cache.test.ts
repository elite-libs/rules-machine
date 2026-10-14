import { describe, expect, test } from 'vitest';
import { createExpressionEngine } from './engine';

describe('syntax cache context isolation', () => {
  test('resolves fresh terms and returns fresh array literals', () => {
    const engine = createExpressionEngine();
    const expr = engine.compile('[value, value + 1]');
    expect(engine.evaluate(expr, () => 2)).toEqual([2, 3]);
    const first = engine.evaluate(expr, () => 8) as number[];
    first[0] = 999;
    expect(engine.evaluate(expr, () => 8)).toEqual([8, 9]);
  });
  test('restores resolver after reentrant calls and failures', () => {
    const engine = createExpressionEngine();
    expect(
      engine.evaluateExpression('a + b', (term) => {
        if (term === 'a') return engine.evaluateExpression('n + 1', () => 4);
        return 7;
      }),
    ).toBe(12);
    expect(() =>
      engine.evaluateExpression('a', () => {
        throw new Error('resolver');
      }),
    ).toThrow('resolver');
    expect(engine.evaluateExpression('a', () => 3)).toBe(3);
  });
  test('evicts syntax without changing results and isolates public metadata', () => {
    const engine = createExpressionEngine();
    engine.compile('x = 2').lhs = 'changed';
    expect(engine.compile('x = 2').lhs).toBe('x');
    for (let n = 0; n < 520; n++)
      expect(engine.evaluateExpression(`${n} + value`, () => 1)).toBe(n + 1);
    expect(engine.evaluateExpression('0 + value', () => 9)).toBe(9);
  });
  test('bounds source size and nesting before parsing', () => {
    const engine = createExpressionEngine();
    expect(() => engine.compile('a'.repeat(100_001))).toThrow('maximum length');
    expect(() =>
      engine.compile('('.repeat(101) + '1' + ')'.repeat(101)),
    ).toThrow('maximum nesting');
    expect(
      engine.evaluateExpression('"' + '('.repeat(101) + '"', () => 0),
    ).toBe('('.repeat(101));
  });
  test('fails closed for unsupported syntax and unknown calls', () => {
    const engine = createExpressionEngine();
    for (const source of [
      '',
      'false && true',
      'true || false',
      'HOUR(timestamp)',
      'RAND()',
      '1 2',
    ]) {
      expect(
        () => engine.evaluateExpression(source, () => 7),
        source,
      ).toThrow();
    }
    expect(engine.evaluateExpression('ABS(2)', () => 0)).toBe(2);
    expect(engine.evaluateExpression('(true) AND (false)', () => 0)).toBe(
      false,
    );
    expect(engine.evaluateExpression('"a && b"', () => 0)).toBe('a && b');
  });
  test('normalizes empty array syntax without sharing mutable results', () => {
    const engine = createExpressionEngine();
    const first = engine.evaluateExpression('[]', () => 0) as unknown[];
    first.push(1);
    expect(engine.evaluateExpression('[]', () => 0)).toEqual([]);
    expect(engine.evaluateExpression('[[], 2]', () => 0)).toEqual([[], 2]);
    expect(engine.evaluateExpression('"[]"', () => 0)).toBe('[]');
  });
  test('recognizes compact assignment and ignores assignment text in literals', () => {
    const engine = createExpressionEngine();
    expect(engine.compile('x+=2')).toMatchObject({
      lhs: 'x',
      assignmentOperator: '+=',
    });
    expect(
      engine.compile('"message = value"').assignmentOperator,
    ).toBeUndefined();
  });
});
