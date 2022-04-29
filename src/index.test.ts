// import { Rule, ruleFactory } from '../';
import { ruleFactory } from './index';
import mockDateHelper from './utils/mockDateHelper';

const omitRuntime = ({ runtime, ...keys }: any) => keys;

test('can invoke date functions', () => {
  const unMockDate = mockDateHelper(new Date(2020, 0, 20));
  const rulesFn = ruleFactory(
    [
      { if: '3 >= 1', then: 'inTenMinutes = DATEISO("10m")' },
      // { if: '3 >= 1', then: 'inTenMinutes = DATEISO("2022-01-10", "-10d")' },
      { return: 'inTenMinutes' },
    ],
    { name: 'dateMath', traceResults: false }
  );

  const input = { addToDate: '10m' };
  const result = rulesFn(input);

  expect(result).toMatch(/.*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*/);
  unMockDate();
});

test("can process 'then' rules", () => {
  const rulesFn = ruleFactory(
    [
      { if: 'price >= 25', then: 'discount = 5' },
      { if: 'price >= 100', then: 'discount = 20' },
      { return: 'discount' },
    ],
    { name: 'calculateDiscount', traceResults: true }
  );

  const input = { price: 100 };
  const result = rulesFn(input);

  expect(result.trace.map(omitRuntime)).toMatchSnapshot();
  expect(result.returnValue).toBe(20);
  expect(result.input.discount).toBe(20);
});

test("can process omitted 'else' rules", () => {
  const rulesFn = ruleFactory(
    [{ if: 'price >= 100', then: 'discount = 20' }, { return: 'discount' }],
    { name: 'calculateDiscount', traceResults: true }
  );

  const input = { price: 10 };
  const result = rulesFn(input);

  expect(result.trace.map(omitRuntime)).toMatchSnapshot();
  expect(result.returnValue).toBe(undefined);
});

test('can process increment operator +=', () => {
  const rulesFn = ruleFactory(
    [{ if: 'price >= 100', then: 'discount += 20' }, { return: 'discount' }],
    { name: 'calculateDiscount', traceResults: true }
  );
  const input = { price: 100, discount: 10 };
  const result = rulesFn(input);

  expect(result.trace.map(omitRuntime)).toMatchSnapshot();
  expect(result.returnValue).toBe(30);
});

test('structured input', () => {
  const rulesFn = ruleFactory(
    [
      { if: 'user.plan == "premium"', then: 'discount = 15' },
      { if: 'user.employee == true', then: 'discount = 15' },
      { return: 'discount' },
    ],
    { name: 'calculateDiscount', traceResults: true }
  );
  const result = rulesFn({
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
  const rulesFn = ruleFactory(
    [
      { if: { and: ['price >= 25', 'price <= 50'] }, then: 'discount = 5' },
      { if: 'price >= 100', then: 'discount = 20' },
      { return: 'discount' },
    ],
    { name: 'calculateDiscount', traceResults: true }
  );
  const input = { price: 35 };
  const result = rulesFn(input);

  expect(result.trace.map(omitRuntime)).toMatchSnapshot();
  expect(result.returnValue).toBe(5);
  expect(result.input.discount).toBe(5);
});

test("can process 'or' rules", () => {
  const rulesFn = ruleFactory(
    [
      { if: 'price <= 100', then: 'discount = 5' },
      {
        if: { or: ['price >= 100', 'user.isAdmin == true'] },
        then: 'discount = 20',
      },
      { return: 'discount' },
    ],
    { name: 'calculateDiscount', traceResults: true }
  );
  const input = { price: 35, user: { isAdmin: true } };
  const result = rulesFn(input);

  expect(result.trace.map(omitRuntime)).toMatchSnapshot();
  expect(result.returnValue).toBe(20);
  expect(result.input.discount).toBe(20);
});

test('can process rule arrays', () => {
  const rulesFn = ruleFactory(
    [
      {
        if: 'price <= 100',
        then: ['discount = 5', 'user.discountApplied = true'],
      },
      {
        if: { and: ['price >= 90', 'user.discountApplied != true'] },
        then: 'discount = 20',
      },
      { return: 'discount' },
    ],
    { name: 'calculateDiscount', traceResults: true }
  );
  const input = { price: 90, user: { isAdmin: true } };
  const result = rulesFn(input);

  expect(result.trace.map(omitRuntime)).toMatchSnapshot();
  expect(result.returnValue).toBe(5);
  expect(result.input.discount).toBe(5);
  expect(result.input.user?.discountApplied).toBe(true);
});

test('can process complex rule expressions', () => {
  const rulesFn = ruleFactory(
    [
      { if: 'price >= 25', then: 'discount = 5 * 2' },
      { if: 'price >= 100', then: 'discount = 20 * 4' },
      { return: 'discount' },
    ],
    { name: 'calculateDiscount', traceResults: true }
  );

  const input = { price: 100 };
  const result = rulesFn(input);

  expect(result.trace.map(omitRuntime)).toMatchSnapshot();
  expect(result.input.discount).toBe(80);
  expect(result.returnValue).toBe(80);
});

test('can use conditional array helpers', () => {
  const rulesFn = ruleFactory(
    [
      'availableCities = FILTER_VALUES(["London", "Milan"], cities)',
      { return: 'availableCities' },
    ],
    { name: 'trace', traceResults: true }
  );

  const input = {
    cities: ['Denver', 'London', 'LA'],
    onlyUSA: true,
  };
  const result = rulesFn(input);

  expect(result.trace.map(omitRuntime)).toMatchSnapshot();
  expect(result.returnValue).toStrictEqual(['Denver', 'LA']);
});

test('can use conditional array helpers', () => {
  const rulesFn = ruleFactory(['hasLondon = CONTAINS("London", cities)'], {
    name: 'trace',
    traceResults: true,
  });

  const input = {
    cities: ['Denver', 'London', 'LA'],
    onlyUSA: true,
  };
  const result = rulesFn(input);

  expect(result.trace.map(omitRuntime)).toMatchSnapshot();
  expect(result.input?.hasLondon).toBe(true);
});
