import toPath from 'lodash/toPath.js';
import { describe, expect, test } from 'vitest';
import { stringToPath } from './string-path';

function assertMatches(source: string): void {
  const expected = toPath(source);
  const actual = stringToPath(source);
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(`Path mismatch for ${JSON.stringify(source)}`);
}

describe('string path compatibility', () => {
  test('matches Lodash across every short path in a grammar alphabet', () => {
    const alphabet = ['a', '.', '[', ']', '0', '-', '"', "'", '\\', ' '];
    let checked = 0;
    function visit(source: string, remaining: number): void {
      assertMatches(source);
      checked++;
      if (remaining > 0)
        for (const character of alphabet)
          visit(source + character, remaining - 1);
    }
    visit('', 5);
    expect(checked).toBe(111_111);
  });

  test('matches quoted, Unicode, numeric and malformed string paths', () => {
    const cases = [
      '',
      '.',
      '..',
      '[]',
      '[[]]',
      'a[]..b',
      'a[0].b',
      'a[-0]',
      'a[-1.25]',
      'a[01]',
      'a[+2]',
      'a[1e3]',
      'a["b.c"]',
      "a['b.c']",
      'a["b\\"c"]',
      "a['b\\'c']",
      'a["b\\\\c"]',
      'a["\\n"]',
      'a["b\nc"]',
      'a["b\u0000c"]',
      '雪["⛄.🙂"]',
      'a["unterminated]',
      'a["b"]tail',
      'a[1.2.3]',
      '__proto__.constructor.prototype',
      '\ud800["\udfff"]',
    ];
    for (const source of cases) assertMatches(source);
    let seed = 0x1a2b3c4d;
    const alphabet = [
      'a',
      '.',
      '[',
      ']',
      '0',
      '-',
      '"',
      "'",
      '\\',
      ' ',
      '\n',
      '雪',
      '🙂',
    ];
    for (let index = 0; index < 5_000; index++) {
      let source = '';
      for (let position = 0; position < 40; position++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        source += alphabet[seed % alphabet.length];
      }
      assertMatches(source);
    }
  });

  test('cached results remain independent across mutation and cache churn', () => {
    const path = 'nested["quoted.key"].value';
    const first = stringToPath(path);
    first[0] = 'changed';
    first.push('extra');
    expect(stringToPath(path)).toEqual(['nested', 'quoted.key', 'value']);
    for (let index = 0; index < 1_001; index++)
      assertMatches(`items[${index}].value`);
    expect(stringToPath(path)).toEqual(['nested', 'quoted.key', 'value']);
    const longPath = `${'x'.repeat(20_000)}.value`;
    const longResult = stringToPath(longPath);
    longResult.length = 0;
    expect(stringToPath(longPath)).toEqual(toPath(longPath));
  });
});
