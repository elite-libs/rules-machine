import { ruleFactory } from './index';

describe('array method object syntax', () => {
  describe('map', () => {
    it('execute', () => {
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
  
  // describe('reduce', () => {

  //   it('should handle reduce', () => {
  //     const doubleList = ruleFactory([
  //       {
  //         reduce: 'list',
  //         run: '$item * 2',
  //         set: 'results',
  //       },
  //       { return: 'results' }
  //     ])
  //     doubleList([1, 2, 3, 4]);
  //   });

  // });
});
