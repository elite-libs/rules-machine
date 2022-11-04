import isObject from 'lodash/isObject.js';

export function autoDetectType(
  value: any,
): any[] | string | boolean | number | null | {} {
  if (value == null) return null;
  if (isBoolean(value)) return toBoolean(value);
  if (isNumber(value)) return toNumber(value);
  if (isArray(value)) return toArray(value);
  if (isObject(value)) return value;
  return `${value}`;
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

export function isBoolean(value: string): boolean {
  return ['true', 'false', 'yes', 'no', 'on', 'off', '0', '1'].includes(
    `${value}`.toLowerCase(),
  );
}

export function toBoolean(value: any) {
  value = `${value}`.toString().toLowerCase();
  return value === 'true' || value === 'yes' || value === 'on' || value === '1';
}

export function toArray<TInput>(input: TInput | TInput[]): TInput[] {
  return Array.isArray(input) && typeof input !== 'string' ? input : [input];
}

export function isArray(input: unknown) {
  return Array.isArray(input) && typeof input !== 'string';
}
