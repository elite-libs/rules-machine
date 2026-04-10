import { describe, expect, test } from 'vitest';
import { createExpressionEngine } from './engine';

describe('createExpressionEngine', () => {
  test('should create engine with compile, evaluate, and evaluateExpression methods', () => {
    const engine = createExpressionEngine();
    expect(engine.compile).toBeDefined();
    expect(engine.evaluate).toBeDefined();
    expect(engine.evaluateExpression).toBeDefined();
  });

  test('should compile expression and extract assignment operator', () => {
    const engine = createExpressionEngine();
    const compiled = engine.compile('discount = 5');
    expect(compiled.source).toBe('discount = 5');
    expect(compiled.assignmentOperator).toBe('=');
    expect(compiled.lhs).toBe('discount');
  });

  test('should compile expression without assignment', () => {
    const engine = createExpressionEngine();
    const compiled = engine.compile('price >= 100');
    expect(compiled.source).toBe('price >= 100');
    expect(compiled.assignmentOperator).toBeUndefined();
    expect(compiled.lhs).toBeUndefined();
  });

  test('should compile expression with += operator', () => {
    const engine = createExpressionEngine();
    const compiled = engine.compile('discount += 5');
    expect(compiled.assignmentOperator).toBe('+=');
    expect(compiled.lhs).toBe('discount');
  });

  test('should compile expression with -= operator', () => {
    const engine = createExpressionEngine();
    const compiled = engine.compile('discount -= 5');
    expect(compiled.assignmentOperator).toBe('-=');
    expect(compiled.lhs).toBe('discount');
  });

  test('should compile expression with *= operator', () => {
    const engine = createExpressionEngine();
    const compiled = engine.compile('discount *= 2');
    expect(compiled.assignmentOperator).toBe('*=');
    expect(compiled.lhs).toBe('discount');
  });

  test('should compile expression with /= operator', () => {
    const engine = createExpressionEngine();
    const compiled = engine.compile('discount /= 2');
    expect(compiled.assignmentOperator).toBe('/=');
    expect(compiled.lhs).toBe('discount');
  });

  test('should compile expression with ??= operator', () => {
    const engine = createExpressionEngine();
    const compiled = engine.compile('discount ??= 13');
    expect(compiled.assignmentOperator).toBe('??=');
    expect(compiled.lhs).toBe('discount');
  });

  test('should evaluate compiled expression', () => {
    const engine = createExpressionEngine();
    const compiled = engine.compile('2 + 2');
    const result = engine.evaluate(compiled, () => 0);
    expect(result).toBe(4);
  });

  test('should evaluate expression with term resolver', () => {
    const engine = createExpressionEngine();
    const compiled = engine.compile('price + tax');
    const result = engine.evaluate(compiled, (term) => {
      if (term === 'price') return 100;
      if (term === 'tax') return 20;
      return 0;
    });
    expect(result).toBe(120);
  });

  test('should evaluateExpression convenience method', () => {
    const engine = createExpressionEngine();
    const result = engine.evaluateExpression('2 + 2', () => 0);
    expect(result).toBe(4);
  });

  test('should evaluateExpression with term resolver', () => {
    const engine = createExpressionEngine();
    const result = engine.evaluateExpression('price * 2', (term) => {
      if (term === 'price') return 50;
      return 0;
    });
    expect(result).toBe(100);
  });

  test('should handle nested property access', () => {
    const engine = createExpressionEngine();
    const input: any = { 'user.plan': 'premium' };
    const result = engine.evaluateExpression('user.plan', (term) => {
      return input[term];
    });
    expect(result).toBe('premium');
  });

  test('should handle boolean expressions', () => {
    const engine = createExpressionEngine();
    const result = engine.evaluateExpression('price >= 100', (term) => {
      if (term === 'price') return 100;
      return 0;
    });
    expect(result).toBe(true);
  });

  test('should handle string comparison', () => {
    const engine = createExpressionEngine();
    const result = engine.evaluateExpression('plan == "premium"', (term) => {
      if (term === 'plan') return 'premium';
      return '';
    });
    expect(result).toBe(true);
  });
});
