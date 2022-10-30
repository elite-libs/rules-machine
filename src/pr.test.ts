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
              if: 'GET(ITER.item, userScore) < 0',
              then: 'userScore = PUT(ITER.item, 0, userScore)',
            },
            'scoreById = PUT(ITER.item, GET(ITER.item, userScore), scoreById)',
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
          run: 'ITER.item.id',
          set: 'idList',
        },
        { return: 'idList' },
      ];
      const itemList = [{ id: 12 }, { id: 34 }, { id: 56 }];
      expect(ruleFactory(rules)({ itemList })).toEqual([12, 34, 56]);
    });
  });
});
