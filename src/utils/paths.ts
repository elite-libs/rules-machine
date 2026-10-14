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
  const keys = toPath(path);
  let target = data as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    let child = Object.hasOwn(target, key) ? target[key] : undefined;
    if (child === null || typeof child !== 'object') {
      child = /^\d+$/.test(keys[i + 1]) ? [] : {};
      Object.defineProperty(target, key, {
        value: child,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    target = child as Record<string, unknown>;
  }
  Object.defineProperty(target, keys[keys.length - 1], {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}
