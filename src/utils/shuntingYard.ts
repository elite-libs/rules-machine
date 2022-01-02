// OG Credit: https://eddmann.com/posts/implementing-the-shunting-yard-algorithm-in-javascript/

/**
 * Shunting-yard algorithm, returns a string of tokens in postfix notation.
 */
export let shuntingYard = (infix: string) => {
  // TODO: Add (all?) operators to this list.
  let ops = {'+': 1, '-': 1, '*': 2, '/': 2};
  let peek = (a: string[]) => a[a.length - 1];
  let stack: string[] = [];

  return infix
    .split('')
    .reduce((output, token) => {
      if (parseFloat(token)) output.push(token);

      if (token in ops && typeof token === 'string') {
        // @ts-ignore
        while (peek(stack) in ops && ops[token] <= ops[peek(stack)])
          output.push(stack.pop()!);
        stack.push(token);
      }

      if (token == '(') stack.push(token);

      if (token == ')') {
        while (peek(stack) != '(')
          output.push(stack.pop()!);
        stack.pop();
      }

      return output;
    }, [] as string[])
    .concat(stack.reverse())
    .join(' ');
};