import { isArray } from './isArray';
import { isBoolean } from './isBoolean';
import { isNumber } from './isNumber';
import { toArray } from './toArray';
import { toBoolean } from './toBoolean';
import { toNumber } from './toNumber';

export function autoDetectType(
  value: any
): any[] | string | boolean | number | null {
  if (value == null) return null;
  if (isBoolean(value)) return toBoolean(value);
  if (isNumber(value)) return toNumber(value);
  if (isArray(value)) return toArray(value);
  return `${value}`;
}
