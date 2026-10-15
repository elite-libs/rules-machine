import { expect, test, vi } from 'vitest';
import { ResourceLimitError } from '../utils/budget';
import { createExpressionEngine } from './engine';

test('standalone convenience evaluation charges cold source work before caching it', () => {
  const engine = createExpressionEngine({ limits: { maxOperations: 20 } });
  const source = `${' '.repeat(1_000)}1`;
  expect(() => engine.evaluateExpression(source, () => undefined)).toThrow(
    ResourceLimitError,
  );
  expect(engine.cacheStats().entries).toBe(0);
});

test('explicit preparation and warm evaluation do not charge cold parsing again', () => {
  const engine = createExpressionEngine({ limits: { maxOperations: 20 } });
  const compiled = engine.compile(`${' '.repeat(1_000)}1`);
  expect(engine.evaluate(compiled, () => undefined)).toBe(1);
  expect(engine.evaluateExpression(compiled.source, () => undefined)).toBe(1);
  expect(engine.cacheStats().entries).toBe(1);
});

test('compile rejects non-string source without invoking supplied methods', () => {
  const trim = vi.fn(() => '1');
  const source = { length: 1, trim };
  const engine = createExpressionEngine();
  expect(() => engine.compile(source as unknown as string)).toThrow(/string/);
  expect(trim).not.toHaveBeenCalled();
});

test('evaluate rejects source accessors in supplied compiled metadata', () => {
  const source = vi.fn(() => '1');
  const compiled = Object.defineProperty({}, 'source', { get: source });
  const engine = createExpressionEngine();
  expect(() => engine.evaluate(compiled as never, () => undefined)).toThrow(
    /source/,
  );
  expect(source).not.toHaveBeenCalled();
});

test('rejected metadata and invalid resolvers do not poison later evaluations', () => {
  const engine = createExpressionEngine();
  const compiled = engine.compile('value');
  expect(() => engine.evaluate(compiled, undefined as never)).toThrow(
    /resolver/i,
  );
  expect(() => engine.evaluate(null as never, () => 8)).toThrow(/source/);
  expect(engine.evaluate(compiled, () => 4)).toBe(4);
  compiled.source = '2';
  expect(engine.evaluate(compiled, () => undefined)).toBe(2);
  expect(engine.evaluate(engine.compile('value'), () => 5)).toBe(5);
});
