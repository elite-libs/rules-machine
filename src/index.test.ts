import { ruleFactory } from './index';
import mockDateHelper from './utils/mockDateHelper';

const omitRuntime = ({ runTime, startTime, ...keys }: any) => keys;

describe('Assignment Operators', () => {
  test('should be able to assign a value to a variable', () => {
    const rulesFn = ruleFactory('amITheWalrus = true');
    expect(rulesFn({})).toEqual({ amITheWalrus: true });
  });
  test('and return a variable by name', () => {
    const rulesFn = ruleFactory([
      'amITheWalrus = foo + bar',
      { return: 'amITheWalrus' },
    ]);
    expect(rulesFn({ foo: 1, bar: 2 })).toBe(3);
  });
});

describe('Logical', () => {
  describe('if/then/else', () => {
    test("can process 'then' rules", () => {
      const rulesFn = ruleFactory(
        [
          { if: 'price >= 25', then: 'discount = 5' },
          { if: 'price >= 100', then: 'discount = 20' },
          { return: 'discount' },
        ],
        { trace: true }
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
        { trace: true }
      );

      const input = { price: 10 };
      const result = rulesFn(input);

      expect(result.trace.map(omitRuntime)).toMatchSnapshot();
      expect(result.returnValue).toBe(undefined);
    });

    test('can process series of if/then rules', () => {
      const rulesFn = ruleFactory(
        [
          { if: 'user.plan == "premium"', then: 'discount = 15' },
          { if: 'user.employee == true', then: 'discount = 15' },
          { return: 'discount' },
        ],
        { trace: true }
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
  });

  describe('and/or', () => {
    test("can process 'and' rules", () => {
      const rulesFn = ruleFactory(
        [
          { if: { and: ['price >= 25', 'price <= 50'] }, then: 'discount = 5' },
          { if: 'price >= 100', then: 'discount = 20' },
          { return: 'discount' },
        ],
        { trace: true }
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
        { trace: true }
      );
      const input = { price: 35, user: { isAdmin: true } };
      const result = rulesFn(input);

      expect(result.trace.map(omitRuntime)).toMatchSnapshot();
      expect(result.returnValue).toBe(20);
      expect(result.input.discount).toBe(20);
    });
    test('can process nested logical rule arrays', () => {
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
        { trace: true }
      );
      const input = { price: 90, user: { isAdmin: true } };
      const result = rulesFn(input);

      expect(result.trace.map(omitRuntime)).toMatchSnapshot();
      expect(result.returnValue).toBe(5);
      expect(result.input.discount).toBe(5);
      expect(result.input.user?.discountApplied).toBe(true);
    });
  });
});

describe('Custom Functions', () => {
  test('can use functions as expressions', () => {
    const unMockDate = mockDateHelper(new Date('2020-01-20T00:00:00.000Z'));
    const rulesFn = ruleFactory('DATEISO("10m")');
    expect(rulesFn({})).toMatchSnapshot();
    unMockDate();
  });

  test('can invoke DATEISO function', () => {
    const unMockDate = mockDateHelper(new Date('2020-01-20T00:00:00.000Z'));
    const rulesFn = ruleFactory(
      [
        { if: '3 >= 1', then: 'inTenMinutes = DATEISO("10m")' },
        { return: 'inTenMinutes' },
      ],
      { trace: false }
    );

    const input = { addToDate: '10m' };
    const result = rulesFn(input);

    expect(result).toMatch(/.*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*/);
    unMockDate();
  });

  test('can invoke DATE function', () => {
    const rulesFn = ruleFactory(
      [
        'today = DATE(DATEISO("0d"))',
        'tomorrow = DATE(DATEISO("1d"))',
        {
          if: 'tomorrow > today',
          then: 'return tomorrow - today',
          else: 'return 0',
        },
      ],
      { trace: false }
    );
    const result = rulesFn({});
    // one millisecond difference locally vs CI
    const isOneDay = result === 86400000 || result === 86400001;
    expect(isOneDay).toBe(true);
  });

  test('can use functional array helpers', () => {
    const rulesFn = ruleFactory(
      [
        'availableCities = FILTER_VALUES(["London", "Milan"], cities)',
        { return: 'availableCities' },
      ],
      { trace: true }
    );

    const input = {
      cities: ['Denver', 'London', 'LA'],
      onlyUSA: true,
    };
    const result = rulesFn(input);

    expect(result.trace.map(omitRuntime)).toMatchSnapshot();
    expect(result.returnValue).toStrictEqual(['Denver', 'LA']);
  });

  test('can use CONTAINS array function', () => {
    const rulesFn = ruleFactory(['hasLondon = CONTAINS("London", cities)'], {
      trace: true,
    });

    const input = {
      cities: ['Denver', 'London', 'LA'],
      onlyUSA: true,
    };
    const result = rulesFn(input);

    expect(result.trace.map(omitRuntime)).toMatchSnapshot();
    expect(result.input?.hasLondon).toBe(true);
  });
});

describe('Assignment Operators', () => {
  test('can process increment operator +=', () => {
    const rulesFn = ruleFactory([
      { if: 'price >= 100', then: 'discount += 20' },
      { return: 'discount' },
    ]);

    expect(rulesFn({ price: 100, discount: 10 })).toBe(30);
  });
  test('minus equals: -=', () => {
    const rulesFn = ruleFactory([
      { if: 'price >= 100', then: 'discount -= 5' },
      { return: 'discount' },
    ]);

    expect(rulesFn({ price: 100, discount: 10 })).toBe(5);
  });

  test('times equals: *=', () => {
    const rulesFn = ruleFactory([
      { if: 'price >= 100', then: 'discount *= 5' },
      { return: 'discount' },
    ]);
    expect(rulesFn({ price: 100, discount: 10 })).toBe(50);
  });
  test('divided by equals: /=', () => {
    const rulesFn = ruleFactory([
      { if: 'price >= 100', then: 'discount /= 5' },
      { return: 'discount' },
    ]);
    expect(rulesFn({ price: 100, discount: 10 })).toBe(2);
  });
  test('nullish coalescing null: ??=', () => {
    const rulesFn = ruleFactory([
      { if: 'price >= 100', then: 'discount ??= 13' },
      { return: 'discount' },
    ]);
    expect(rulesFn({ price: 100, discount: null })).toBe(13);
  });

  test('nullish coalescing falsy: ??=', () => {
    const rulesFn = ruleFactory([
      { if: 'price >= 100', then: 'discount ??= 13' },
      { return: 'discount' },
    ]);
    expect(rulesFn({ price: 100, discount: 0 })).toBe(0);
  });
});

describe('Nested Rule Structures', () => {
  test('can process complex rule expressions', () => {
    const rulesFn = ruleFactory(
      [
        { if: 'price >= 25', then: 'discount = 5 * 2' },
        { if: 'price >= 100', then: 'discount = 20 * 4' },
        { return: 'discount' },
      ],
      { trace: true }
    );

    const input = { price: 100 };
    const result = rulesFn(input);

    expect(result.trace.map(omitRuntime)).toMatchSnapshot();
    expect(result.input.discount).toBe(80);
    expect(result.returnValue).toBe(80);
  });
});

describe('can use functional object helpers', () => {
  test('OBJECT_CONTAINS', () => {
    const rulesFn = ruleFactory('return OBJECT_CONTAINS("London", cities)');

    const hasLondonInput = {
      cities: { Denver: true, London: true, LA: true },
    };
    const hasTaipeiInput = {
      cities: { Denver: true, Taipei: true, LA: true },
    };

    expect(rulesFn(hasLondonInput)).toBe(true);
    expect(rulesFn(hasTaipeiInput)).toBe(false);
  });

  test('COUNT_KEYS', () => {
    const rulesFn = ruleFactory('return COUNT_KEYS(cities)');
    const input = {
      cities: { Denver: true, London: true, LA: true },
    };

    expect(rulesFn(input)).toBe(3);
  });

  test('OMIT', () => {
    const rulesFn = ruleFactory('return OMIT("London", cities)');
    const input = {
      cities: { Denver: true, London: true, LA: true },
    };

    expect(rulesFn(input)).toStrictEqual({
      Denver: true,
      LA: true,
    });
  });
});
