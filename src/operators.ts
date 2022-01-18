import isEqual from 'lodash/isEqual';
import gt from 'lodash/gt';
import gte from 'lodash/gte';
import lt from 'lodash/lt';
import lte from 'lodash/lte';

import cloneDeep from 'lodash/cloneDeep';
import divide from 'lodash/divide';
import add from 'lodash/add';
import sum from 'lodash/sum';
import subtract from 'lodash/subtract';
import multiply from 'lodash/multiply';

export const ConditionalOperators = {
  // "===": isEqual,
  '==': isEqual,
  '!=': (a: any, b: any) => !isEqual(a, b),
  '!==': (a: any, b: any) => !isEqual(a, b),
  '>': gt,
  '<': lt,
  '>=': gte,
  '<=': lte,
};
export const ModifierOperators: Record<string, typeof add> = {
  // '+': sum,
  '+': add,
  '-': subtract,
  '*': multiply,
  '/': divide,
};
export const AssignmentOperators = {
  '+=': add,
  '-=': subtract,
  '*=': multiply,
  '/=': divide,
  '**=': Math.pow,
  '%=': (a: number, b: number) => a % b,
  '||=': (a: any, b: any) => a || b,
  '??=': (a: any, b: any) => a ?? b,
};
