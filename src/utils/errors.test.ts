import { describe, expect, test } from 'vitest';
import { UserError } from './errors';

describe('UserError', () => {
  test('should create UserError with message', () => {
    const error = new UserError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('UserError');
  });

  test('should toString return message', () => {
    const error = new UserError('Test error');
    expect(error.toString()).toBe('Test error');
  });

  test('should create UserError with debugMode', () => {
    const error = new UserError('Test error', true);
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('UserError');
  });

  test('should be instance of Error', () => {
    const error = new UserError('Test error');
    expect(error).toBeInstanceOf(Error);
  });

  test('should be thrown and caught', () => {
    expect(() => {
      throw new UserError('Test throw');
    }).toThrow(UserError);
  });
});
