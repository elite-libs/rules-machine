import {
  checkArrayLength,
  checkDataDepth,
  checkStringLength,
  consumeWork,
} from './budget';
import { UserError } from './errors';
import { recordMutation } from './mutations';
import { stringToPath as toPath } from './string-path';

const unsafe = new Set(['__proto__', 'prototype', 'constructor']);

function writeData(target: object, key: string, value: unknown) {
  consumeWork();
  if (typeof target === 'function')
    throw new UserError('Cannot assign through a host function');
  const constructor = Object.getOwnPropertyDescriptor(target, 'constructor');
  if (
    target === Object.prototype ||
    target === Array.prototype ||
    (constructor &&
      'value' in constructor &&
      typeof constructor.value === 'function')
  )
    throw new UserError('Cannot assign through a host prototype');
  if (!Array.isArray(target)) {
    const prototype = Object.getPrototypeOf(target);
    if (
      prototype !== Object.prototype &&
      prototype !== null &&
      Object.hasOwn(prototype, 'constructor')
    )
      throw new UserError('Cannot assign through an opaque host object');
  }
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (descriptor && !('value' in descriptor))
    throw new UserError(`Assignment cannot invoke an accessor: ${key}`);
  if (Array.isArray(target)) {
    if (key === 'length') {
      if (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < 0 ||
        value > 0xffffffff
      )
        throw new UserError('Array length must be a nonnegative integer');
      checkArrayLength(value);
    } else {
      const index = Number(key);
      if (
        Number.isInteger(index) &&
        index >= 0 &&
        index < 0xffffffff &&
        String(index) === key
      )
        checkArrayLength(Math.max(target.length, index + 1));
    }
  }
  recordMutation(target, key, value);
  try {
    Object.defineProperty(
      target,
      key,
      descriptor
        ? { value }
        : { value, enumerable: true, writable: true, configurable: true },
    );
  } catch {
    throw new UserError(`Cannot assign to readonly property: ${key}`);
  }
}

function ownData(data: unknown, key: string): unknown {
  consumeWork();
  if (data == null) return undefined;
  if (typeof data === 'function')
    throw new UserError('Cannot traverse a host function');
  if (typeof data === 'object' && !Array.isArray(data)) {
    const prototype = Object.getPrototypeOf(data);
    if (
      prototype !== Object.prototype &&
      prototype !== null &&
      Object.hasOwn(prototype, 'constructor')
    )
      throw new UserError('Cannot traverse an opaque host object');
  }
  const descriptor = Object.getOwnPropertyDescriptor(Object(data), key);
  if (!descriptor) return undefined;
  if (!('value' in descriptor))
    throw new UserError(`Cannot read accessor property: ${key}`);
  return descriptor.value;
}

/** Resolve own data properties only; accessors and host methods are never invoked. */
export function getOwnPath(
  data: unknown,
  path: string | number,
  read: (data: unknown, key: string) => unknown = ownData,
): unknown {
  if (typeof path === 'string') checkStringLength(path.length);
  consumeWork(typeof path === 'string' ? path.length : 1);
  if (data != null && Object.hasOwn(Object(data), path))
    return read(data, String(path));
  let value: unknown = data;
  const keys = toPath(String(path));
  checkDataDepth(keys.length);
  for (const key of keys) {
    value = read(value, key);
    if (value === undefined) return undefined;
  }
  return value;
}

export function assertWritablePath(path: string): void {
  checkStringLength(path.length);
  consumeWork(path.length);
  if (!path || toPath(path).some((key) => unsafe.has(key))) {
    throw new UserError(`Unsafe assignment path: ${path}`);
  }
}

export function setOwnPath(data: object, path: string, value: unknown): void {
  assertWritablePath(path);
  if (data === null || typeof data !== 'object')
    throw new UserError('Assignment requires an object');
  const keys = Object.hasOwn(data, path) ? [path] : toPath(path);
  checkDataDepth(keys.length);
  let target = data as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    let child = ownData(target, key);
    if (typeof child === 'function')
      throw new UserError('Cannot assign through a host function');
    if (child === null || typeof child !== 'object') {
      child = /^\d+$/.test(keys[i + 1]) ? [] : {};
      writeData(target, key, child);
    }
    target = child as Record<string, unknown>;
  }
  writeData(target, keys[keys.length - 1], value);
}
