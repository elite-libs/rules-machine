import { shuntingYard } from './shuntingYard';

test('Can parse nested expressions', () => {
  ;
  expect(shuntingYard('1 + 2 * (3 + 4)')).toBe('1 2 3 4 + * +');
  expect(shuntingYard('((2 + 1) * 3)')).toBe('2 1 + 3 *');
});