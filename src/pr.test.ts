import { ruleFactory } from './index';

const context = {
  list: [
    { supplier: 'Webbeds', parentBrandName: 'Red Lion (RLH Corporation)' },
    { supplier: 'NotWebbeds', parentBrandName: 'Red Lion (RLH Corporation)' },
  ],
  roomCount: 2,
};

const rulesEngine = ruleFactory([
  {
    filter: 'list',
    run: {
      and: [
        '$item.supplier == "Webbeds"',
        '$item.parentBrandName == "Red Lion (RLH Corporation)"',
      ],
    },
    set: 'results',
  },

  { return: 'results' },
]);

describe('pr', () => {
  it('should return the right stuff', () => {
    const result = rulesEngine(context);

    expect(result.length).toEqual(1);
  });
});
