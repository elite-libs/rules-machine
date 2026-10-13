import set from 'lodash/set.js';
import toPath from 'lodash/toPath.js';
import { UserError } from './errors';

const unsafe = new Set(['__proto__', 'prototype', 'constructor']);

/** Resolve data properties only; inherited host methods are not rule data. */
export function getOwnPath(data: unknown, path: string | number): unknown {
  if (data != null && Object.hasOwn(Object(data), path)) {
    return (data as Record<string | number, unknown>)[path];
  }
  let value: unknown = data;
  for (const key of toPath(String(path))) {
    if (value == null || !Object.hasOwn(Object(value), key)) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

export function assertWritablePath(path: string): void {
  if (!path || toPath(path).some((key) => unsafe.has(key))) {
    throw new UserError(`Unsafe assignment path: ${path}`);
  }
}

export function setOwnPath(data: object, path: string, value: unknown): void {
  assertWritablePath(path);
  set(data, path, value);
}
