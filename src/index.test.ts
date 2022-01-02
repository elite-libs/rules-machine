import { ruleFactory } from './index';
// import legacy from '../dist/legacy.js';
// import { } from '../dist/modern.js';

const omitRuntime = ({runtime, ...keys}: any) => keys;
test("can process 'then' rules", () => {
  const rulesMachine = ruleFactory('calculateDiscount', [
    { if: 'price >= 25', then: 'discount = 5' },
    { if: 'price >= 100', then: 'discount = 20' },
    { return: 'discount' },
  ]);

  const input = { price: 100 };
  const result = rulesMachine(input);

  expect(result.trace.map(omitRuntime)).toMatchSnapshot();
  expect(result.returnValue).toBe(20);
  expect(result.input.discount).toBe(20);
});

test("can process omitted 'else' rules", () => {
  const rulesMachine = ruleFactory('calculateDiscount', [
    { if: 'price >= 100', then: 'discount = 20' },
    { return: 'discount' },
  ]);

  const input = { price: 10 };
  const result = rulesMachine(input);

  expect(result.trace.map(omitRuntime)).toMatchSnapshot();
  expect(result.returnValue).toBe(undefined);
});

test('can process increment operator +=', () => {
  const rulesMachine = ruleFactory('calculateDiscount', [
    { if: 'price >= 100', then: 'discount += 20' },
    { return: 'discount' },
  ]);
  const input = { price: 100, discount: 10 };
  const result = rulesMachine(input);

  expect(result.trace.map(omitRuntime)).toMatchSnapshot();
  expect(result.returnValue).toBe(30);
});

test('structured input', () => {
  const rulesMachine = ruleFactory('calculateDiscount', [
    { if: 'user.plan == "premium"', then: 'discount = 15' },
    { if: 'user.employee == true', then: 'discount = 15' },
    { return: 'discount' },
  ]);
  const result = rulesMachine({
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
    },
  });

  expect(result.trace.map(omitRuntime)).toMatchSnapshot();
  expect(result.returnValue).toBe(15);
});

test("can process 'and' rules", () => {
  const rulesMachine = ruleFactory('calculateDiscount', [
    { if: { and: ['price >= 25', 'price <= 50'] }, then: 'discount = 5' },
    { if: 'price >= 100', then: 'discount = 20' },
    { return: 'discount' },
  ]);
  const input = { price: 35 };
  const result = rulesMachine(input);

  expect(result.trace.map(omitRuntime)).toMatchSnapshot();
  expect(result.returnValue).toBe(5);
  expect(result.input.discount).toBe(5);
});

test("can process 'or' rules", () => {
  const rulesMachine = ruleFactory('calculateDiscount', [
    { if: 'price <= 100', then: 'discount = 5' },
    {
      if: { or: ['price >= 100', 'user.isAdmin == true'] },
      then: 'discount = 20',
    },
    { return: 'discount' },
  ]);
  const input = { price: 35, user: { isAdmin: true } };
  const result = rulesMachine(input);

  expect(result.trace.map(omitRuntime)).toMatchSnapshot();
  expect(result.returnValue).toBe(20);
  expect(result.input.discount).toBe(20);
});

test('can process rule arrays', () => {
  const rulesMachine = ruleFactory('calculateDiscount', [
    {
      if: 'price <= 100',
      then: ['discount = 5', 'user.discountApplied = true'],
    },
    {
      if: { and: ['price >= 90', 'user.discountApplied != true'] },
      then: 'discount = 20',
    },
    { return: 'discount' },
  ]);
  const input = { price: 90, user: { isAdmin: true } };
  const result = rulesMachine(input);

  expect(result.trace.map(omitRuntime)).toMatchSnapshot();
  expect(result.returnValue).toBe(5);
  expect(result.input.discount).toBe(5);
  expect(result.input.user?.discountApplied).toBe(true);
});
