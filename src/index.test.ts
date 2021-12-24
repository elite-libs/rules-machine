import { RuleMachine } from './index';

test("can process 'then' rules", () => {
  const input = { price: 100 };
  const calculateDiscount = [
    { if: 'price >= 25', then: 'discount = 5' },
    { if: 'price >= 100', then: 'discount = 20' },
    { return: 'discount' },
  ];

  const result = RuleMachine('getDiscount', calculateDiscount)(input);

  // console.log(JSON.stringify(result.trace, null, 2));

  expect(result.returnValue).toBe(20);
  expect(result.input.discount).toBe(20);
});

test("can process omitted 'else' rules", () => {
  const input = { price: 10 };
  const calculateDiscount = [
    { if: 'price >= 100', then: 'discount = 20' },
    { return: 'discount' },
  ];

  const result = RuleMachine('getDiscount', calculateDiscount)(input);

  // console.log(JSON.stringify(result.trace, null, 2));

  expect(result.returnValue).toBe(undefined);
});

test("can process increment operator +=", () => {
  const input = { price: 100, discount: 10 };
  const calculateDiscount = [
    { if: 'price >= 100', then: 'discount += 20' },
    { return: 'discount' },
  ];
  const result = RuleMachine('getDiscount', calculateDiscount)(input);
  console.log(JSON.stringify(result.trace, null, 2));
  expect(result.returnValue).toBe(30);
});

test('structured input', () => {
  const input = {
    user: {
      plan: 'premium',
      employee: true,
    },
    config: {
      maxDiscount: 10,
    },
    shoppingCart: {
      discount: 1,
      total: 100,
    }
  };
  const calculateDiscount = [
    { if: 'user.plan == "premium"', then: 'discount = 15' },
    { if: 'user.employee == true', then: 'discount = 15' },
    // { if: 'user.employee == true', then: 'discount += 15' },
    { return: 'discount' },
  ];

  const result = RuleMachine('getDiscount', calculateDiscount)(input);

  // console.log(JSON.stringify(result.trace, null, 2));

  expect(result.returnValue).toBe(15);
});

test.todo('nested rules');
