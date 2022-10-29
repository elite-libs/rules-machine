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

  it('should process nested try', () => {
    const rules = [
      'result = "fail"',
      {
        try: { try: 'result = "success"', catch: 'result = "never"' },
        catch: 'result = "never"',
      },
      { return: 'result' },
    ];
    expect(ruleFactory(rules)()).toBe('success');
  });

  it('should process nested catch', () => {
    const rules = [
      'result = "fail"',
      {
        try: 'THROW "error"',
        catch: { try: 'THROW "error"', catch: 'result = "success"' },
      },
      { return: 'result' },
    ];
    expect(ruleFactory(rules)()).toBe('success');
  });

  it('should process deeply nested rules', () => {
    const rules = [
      'result = "fail"',
      {
        try: {
          if: 'true == true',
          then: {
            if: 'true == true',
            then: {
              if: 'false == true',
              then: 'result = "never"',
              else: 'throw "error"',
            },
          },
        },
        catch: {
          if: 'true == true',
          then: {
            if: 'true == true',
            then: {
              if: 'false == true',
              then: 'result = "never"',
              else: 'result = "success"',
            },
          },
        },
      },
      { return: 'result' },
    ];
    expect(ruleFactory(rules)()).toBe('success');
  });
});
