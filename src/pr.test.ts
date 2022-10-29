import { ruleFactory } from './index';

describe('nested rules', () => {
  it('should process nested then', () => {
    const rules = [
      'result = "fail"',
      {
        if: 'true == true',
        then: {
          if: 'true == true',
          then: 'result = "success"',
        },
      },
      { return: 'result' },
    ];
    expect(ruleFactory(rules)()).toBe('success');
  });

  it('should process nested else', () => {
    const rules = [
      'result = "fail"',
      {
        if: 'false == true',
        then: 'result = "never"',
        else: {
          if: 'false == true',
          then: 'result = "never"',
          else: 'result = "success"',
        },
      },
      { return: 'result' },
    ];
    expect(ruleFactory(rules)()).toBe('success');
  });
});
