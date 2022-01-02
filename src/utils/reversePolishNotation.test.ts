import { reversePolishNotation } from "./reversePolishNotation"

test('reversePolishNotation', () => {

  expect(reversePolishNotation('1 2 +')).toBe(3);
  expect(reversePolishNotation('1 2 3 4 +')).toBe(10);
  expect(reversePolishNotation('1 2 1 2 1 2 1 2 +')).toBe(12);
  expect(reversePolishNotation('1 2 3 + 10 *')).toBe(60);

})
