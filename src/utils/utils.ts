import isObject from 'lodash/isObject.js';

export function autoDetectType(
  value: unknown,
): unknown[] | string | boolean | number | null | object {
  if (value == null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    if (isBoolean(value)) return toBoolean(value);
    if (isNumber(value)) return toNumber(value);
    return value;
  }
  if (isArray(value)) return value;
  if (isObject(value)) return value;
  return String(value);
}

export function isNumber(value: string): boolean {
  return /^[0-9.]+$/.test(`${value}`);
}

export function toNumber(value: string | number): number {
  return typeof value === 'number'
    ? value
    : /^[0-9]+$/.test(value)
      ? parseInt(value, 10)
      : parseFloat(value);
}

const boolExpressions = [
  'true',
  'false',
  'yes',
  'no',
  'on',
  'off',
  '0',
  '1',
] as const;

export function isBoolean(value: string): boolean {
  return `${value}`.toLowerCase() in boolExpressions;
}

export function toBoolean(value: unknown): boolean {
  const strValue = `${value}`.toString().toLowerCase();
  return (
    strValue === 'true' ||
    strValue === 'yes' ||
    strValue === 'on' ||
    strValue === '1'
  );
}

export function toArray<TInput>(input: TInput | TInput[]): TInput[] {
  return Array.isArray(input) && typeof input !== 'string' ? input : [input];
}

export function isArray(input: unknown): input is unknown[] {
  return Array.isArray(input) && typeof input !== 'string';
}
