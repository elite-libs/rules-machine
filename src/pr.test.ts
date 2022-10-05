import { ruleFactory } from './index';

describe('AND', () => {
  it('"and" object rule should short circuit', () => {
    const rules = [
      { if: { and: ['foo', 'bar = 42'] }, then: '1' },
      { return: 'bar' },
    ];

    expect(ruleFactory(rules)({ foo: false })).toBe(undefined);
    expect(ruleFactory(rules)({ foo: true })).toBe(42);
  });

  it('"and" string rule should short circuit', () => {
    const rules = [{ if: 'foo and bar = 42', then: '1' }, { return: 'bar' }];

    expect(ruleFactory(rules)({ foo: false })).toBe(undefined);
    expect(ruleFactory(rules)({ foo: true })).toBe(42);
  });
});

describe('OR', () => {
  it('"or" object rule should short circuit', () => {
    const rules = [
      { if: { or: ['foo', 'bar = 42'] }, then: '1' },
      { return: 'bar' },
    ];

    expect(ruleFactory(rules)({ foo: false })).toBe(42);
    expect(ruleFactory(rules)({ foo: true })).toBe(undefined);
  });

  it('"or" string rule should short circuit', () => {
    const rules = [{ if: 'foo or bar = 42', then: '1' }, { return: 'bar' }];

    expect(ruleFactory(rules)({ foo: false })).toBe(42);
    expect(ruleFactory(rules)({ foo: true })).toBe(undefined);
  });
});
