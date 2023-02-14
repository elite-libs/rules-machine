import { ruleFactory } from './index';

describe('Array Operators', () => {
  describe('map', () => {
    it('can do complex transforms', () => {
      const rules = [
        'idList = [12, 34, 56]',
        {
          map: 'idList',
          run: [
            {
              if: 'GET($item, userScore) < 0',
              then: 'userScore = PUT($item, 0, userScore)',
            },
            'scoreById = PUT($item, GET($item, userScore), scoreById)',
          ],
        },
        { return: 'scoreById' },
      ];
      const userScore = { 12: 99.9, 34: 100.1, 56: -42.0 };
      const scoreById = {};
      expect(ruleFactory(rules)({ userScore, scoreById })).toEqual({
        12: 99.9,
        34: 100.1,
        56: 0,
      });
    });

    it('should set mapped array', () => {
      const rules = [
        {
          map: 'itemList',
          run: '$item.id',
          set: 'idList',
        },
        { return: 'idList' },
      ];
      const itemList = [{ id: 12 }, { id: 34 }, { id: 56 }];
      expect(ruleFactory(rules)({ itemList })).toEqual([12, 34, 56]);
    });

    it('should throw on invalid array', () => {
      const rules = [
        {
          map: 'notAnArray',
          run: '$item.id',
        },
        { return: 'idList' },
      ];
      expect(() => ruleFactory(rules)()).toThrow();
    });
  });

  describe('filter', () => {
    it('can .filter()', () => {
      const multiplesOfThree = ruleFactory([
        {
          filter: 'list',
          run: '$item % 3 == 0',
          set: 'results',
        },
        { return: 'results' },
      ]);
      expect(multiplesOfThree({ list: [1, 2, 3, 4] })).toEqual([3]);
    });

    it('can .filter() with multiple AND conditions', () => {
      const evensButGreaterThanTwo = ruleFactory([
        {
          filter: 'list',
          run: { and: ['$item % 2 == 0', '$item > 2'] },
          set: 'results',
        },
        { return: 'results' },
      ]);

      expect(evensButGreaterThanTwo({ list: [1, 2, 3, 4] })).toEqual([4]);
      expect(evensButGreaterThanTwo({ list: [4, 5, 6, 7] })).toEqual([4, 6]);
      expect(evensButGreaterThanTwo({ list: [-1, -2, 0, 10, 20] })).toEqual([
        10, 20,
      ]);
    });

    it('can .filter() with multiple OR conditions', () => {
      const multiplesOfThreeOrZero = ruleFactory([
        {
          filter: 'list',
          run: { or: ['$item % 3 == 0', '$item === 0'] },
          set: 'results',
        },
        { return: 'results' },
      ]);

      expect(multiplesOfThreeOrZero({ list: [0, 1, 2, 3, 4] })).toEqual([0, 3]);
      expect(multiplesOfThreeOrZero({ list: [0, 5, 6, 7, 8] })).toEqual([0, 6]);
      expect(multiplesOfThreeOrZero({ list: [3, 6, 30, 60] })).toEqual([
        3, 6, 30, 60,
      ]);
      expect(multiplesOfThreeOrZero({ list: [33, -30, 0] })).toEqual([
        33, -30, 0,
      ]);
    });
  });

  describe('find', () => {
    it('can .find()', () => {
      const getFirstMultipleOfThree = ruleFactory([
        {
          find: 'list',
          run: '$item % 3 == 0',
          set: 'results',
        },
        { return: 'results' },
      ]);
      expect(getFirstMultipleOfThree({ list: [1, 2, 3, 4] })).toEqual(3);
      expect(getFirstMultipleOfThree({ list: [2, 3, 4] })).toEqual(3);
      expect(getFirstMultipleOfThree({ list: [4] })).toBeUndefined();
    });
  });

  describe('every', () => {
    it('can handle .every()', () => {
      const isEveryNumberMultipleOfThree = ruleFactory([
        {
          every: 'list',
          run: '$item % 3 == 0',
          set: 'results',
        },
        { return: 'results' },
      ]);
      expect(isEveryNumberMultipleOfThree({ list: [3, 6, 9] })).toEqual(true);
      expect(isEveryNumberMultipleOfThree({ list: [3, 6, 9, 10] })).toEqual(
        false,
      );
    });
  });

  describe('some', () => {
    it('can handle .some()', () => {
      const hasEvenNumbers = ruleFactory([
        {
          some: 'list',
          run: '2 % $item == 0',
          set: 'results',
        },
        { return: 'results' },
      ]);
      expect(hasEvenNumbers({ list: [2, 4] })).toEqual(true);
      expect(hasEvenNumbers({ list: [2, 4, 5] })).toEqual(true);
      expect(hasEvenNumbers({ list: [5] })).toEqual(false);
    });
  });

  describe('input validation', () => {
    it('should throw on restricted input fields', () => {
      // valueOf is a restricted field
      expect(() => ruleFactory(['$index'])({ valueOf: () => 420 })).toThrow();
      // $index is a restricted field
      expect(() =>
        ruleFactory(['$index'])({ $item: {}, $index: 99 }),
      ).toThrow();
    });
  });
});
