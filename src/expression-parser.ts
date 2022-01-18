import { init, formula, ExpressionParser } from 'expressionparser'
import { ExpressionParserOptions } from 'expressionparser/dist/ExpressionParser';
import { extractValueOrLiteral } from 'src';


// parser.expressionToValue("(1 + 1) + 40 = MY_VARIABLE"); // true

export default function expressionParser<TInput extends {
  [k: string]: string | boolean | number | null | undefined | TInput;
} = any
>(input: TInput) {

  const parser = init(formula, (term: string) => {
    if (typeof term === 'string') {
      extractValueOrLiteral(input, term);
      return 42;
    } else {
      throw new Error(`Invalid term: ${term}`);
    }
  });

  // const arithmeticLanguage: ExpressionParserOptions = {
  //   INFIX_OPS: {
  //     '+': function(a: () => number, b: () => number) {
  //       return a() + b();
  //     },
  //     '-': function(a: () => number, b: () => number) {
  //       return a() - b();
  //     },
  //     '*': function(a: () => number, b: () => number) {
  //       return a() * b();
  //     },
  //     '/': function(a: () => number, b: () => number) {
  //       return a() / b();
  //     },
  //     ',': function(a: string, b: string) {
  //       return [a] + b;
  //     },
  //     // '%': (a: number, b: number) => num(a()) % num(b()),
  //     // '=': (a: number, b: number) => a() === b(),
  //     // '!=': (a: number, b: number) => a() !== b(),
  //     // '<>': (a: number, b: number) => a() !== b(),
  //     // '~=': (a: number, b: number) => Math.abs(num(a()) - num(b())) < Number.EPSILON,
  //     // '>': (a: number, b: number) => a() > b(),
  //     // '<': (a: number, b: number) => a() < b(),
  //     // '>=': (a: number, b: number) => a() >= b(),
  //     // '<=': (a: number, b: number) => a() <= b(),
  //     // AND: (a: number, b: number) => a() && b(),
  //     // OR: (a: number, b: number) => a() || b(),
  //     // '^': (a: number, b: number) => Math.pow(num(a()), num(b())),
  //     '+=': function(a: number, b: number) {
  //       return a += b;
  //     },
  //     '-=': function(a: number, b: number) {
  //       return a -= b;
  //     },
  //     '*=': function(a: number, b: number) {
  //       return a *= b;
  //     },
  //     '/=': function(a: number, b: number) {
  //       return a /= b;
  //     },
  //     '**=': function(a: number, b: number) {
  //       return a **= b;
  //     },
  //     '%=': function(a: number, b: number) {
  //       return a %= b;
  //     },
  //     '||=': function(a: number, b: number) {
  //       return a ||= b;
  //     },
  //     '??=': function(a: number, b: number) {
  //       return a ??= b;
  //     },
  //   },
  //   PREFIX_OPS: {
  //     'SQRT': function(expr: () => number) {
  //       return () => Math.sqrt(expr());
  //     },
  //     'POW': function(expr: () => number[]) {

  //       return () => Math.pow(expr()[0], expr()[1]);
  //     }
  //   },
  //   PRECEDENCE: [
  //     // DYNAMICALLY PREPEND BELOW: Object.keys(arithmeticLanguage.PREFIX_OPS),
  //     ["^"],
  //     ["*", "/", "%", "MOD"],
  //     ["+", "-"],
  //     ["<", ">", "<=", ">="],
  //     ["=", "!=", "<>", "~="],
  //     ["AND", "OR"],
  //     [","],
  // ],
  // LITERAL_OPEN: '"',
  // LITERAL_CLOSE: '"',
  // GROUP_OPEN: "(",
  // GROUP_CLOSE: ")",
  // SEPARATOR: " ",
  // SYMBOLS: [
  //     "^",
  //     "*",
  //     "/",
  //     "%",
  //     "+",
  //     "-",
  //     "<",
  //     ">",
  //     "=",
  //     "!",
  //     ",",
  //     '"',
  //     "(",
  //     ")",
  //     "[",
  //     "]",
  //     "~",
  // ],
  // AMBIGUOUS: {
  //     "-": "NEG",
  // },
  // SURROUNDING: {
  //     ARRAY: {
  //         OPEN: "[",
  //         CLOSE: "]",
  //     },
  // },

  //   // PRECEDENCE: [['SQRT', 'POW'], ['*', '/'], ['+', '-'], [',']],
  //   // GROUP_OPEN: '(',
  //   // GROUP_CLOSE: ')',
  //   // SEPARATOR: ' ',
  //   // SYMBOLS: ['(', ')', '+', '-', '*', '/', ','],

  //   termDelegate: function(term: string) {
  //     console.log(`resolve term: ${term}`);
  //     return parseInt(term);
  //   }
  // };

  // arithmeticLanguage.PRECEDENCE.unshift(Object.keys(arithmeticLanguage.PREFIX_OPS))

  // const parser = new ExpressionParser(arithmeticLanguage);
}
