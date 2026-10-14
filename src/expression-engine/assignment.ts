import { UserError } from '../utils/errors';
import { assertWritablePath } from '../utils/paths';

const keyPath =
  /^[$A-Z_a-z][$\w]*(?:(?:\.[$\w]+)|(?:\[(?:\d+|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\]))*$/;

/** Detect only top-level assignment operators, never operators inside literals. */
export function extractAssignment(source: string): {
  assignmentOperator: string | undefined;
  lhs: string | undefined;
} {
  let quote = '';
  let depth = 0;
  let assignmentOperator: string | undefined;
  let lhs: string | undefined;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '(' || ch === '[') {
      depth++;
      continue;
    }
    if (ch === ')' || ch === ']') {
      depth--;
      continue;
    }
    if (depth !== 0 || ch !== '=') continue;
    const previous = source[i - 1];
    if ('=!<>~'.includes(previous ?? '') || source[i + 1] === '=') continue;
    let start = i;
    let operator = '=';
    if (previous === '?' && source[i - 2] === '?') {
      start -= 2;
      operator = '??=';
    } else if (previous && '+-*/'.includes(previous)) {
      start--;
      operator = `${previous}=`;
    }
    if (assignmentOperator)
      throw new UserError('Chained assignments are not supported');
    lhs = source.slice(0, start).trim();
    if (!keyPath.test(lhs))
      throw new UserError(`Invalid assignment target: ${lhs}`);
    assertWritablePath(lhs);
    assignmentOperator = operator;
  }
  return { assignmentOperator, lhs };
}
