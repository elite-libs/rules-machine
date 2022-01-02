import { ModifierOperators } from '../operators';
import { toNumber } from '.';

export const reversePolishNotation = (expression: string): any => {
  const stack: Array<number | keyof typeof ModifierOperators> = [];
  const tokens: string[] = expression.split(' ');
  let result: any;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token in ModifierOperators) {
      while (stack.length >= 2) {
        const s1 = stack.pop();
        const s2 = stack.pop();
        const op = ModifierOperators[token];
        if (s2 == null || s1 == null)
          throw Error('Invalid expression or values.');
        result = op(toNumber(s2), toNumber(s1));
        stack.push(result);
      }
    } else {
      // Push a literal value, or named variable on the stack.
      stack.push(toNumber(token));
    }
  }
  return stack[0];
};
