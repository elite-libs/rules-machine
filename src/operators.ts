import isEqual from 'lodash/isEqual.js';
import gt from 'lodash/gt.js';
import gte from 'lodash/gte.js';
import lt from 'lodash/lt.js';
import lte from 'lodash/lte.js';

// import cloneDeep from 'lodash/cloneDeep.js';
import divide from 'lodash/divide.js';
import add from 'lodash/add.js';
// import sum from 'lodash/sum.js';
import subtract from 'lodash/subtract.js';
import multiply from 'lodash/multiply.js';

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
export const AssignmentOperators: { [key: string]: (a: any, b: any) => any } = {
  '+=': add,
  '-=': subtract,
  '*=': multiply,
  '/=': divide,
  '**=': Math.pow,
  '%=': (a: number, b: number) => a % b,
  '||=': (a: any, b: any) => a || b,
  '??=': (a: any, b: any) => a ?? b,
};
