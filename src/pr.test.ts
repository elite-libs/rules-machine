import { ruleFactory } from './index';

describe('try/catch', () => {
  it('should catch error', () => {
    const rules = ['return "blue"', 'return "green"'];

    const result = ruleFactory(rules)();
    console.log(result); // green
  });
});

const rules = ['return "blue"', 'return "green"'];

const result = ruleFactory(rules)();
console.log(result); // green
