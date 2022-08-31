import { RuleMapping } from '../lib/types';

const appRules: Readonly<Record<string, RuleMapping>> = {
  getDiscount: {
    rules: [
      { if: { and: ['price >= 25', 'price <= 50'] }, then: 'discount = 5' },
      { if: 'price >= 100', then: 'discount = 20' },
      { return: 'discount' },
    ],
  },
};

export default appRules;
