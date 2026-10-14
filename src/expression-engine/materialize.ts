import { checkArrayLength, consumeWork } from '../utils/budget';
import { UserError } from '../utils/errors';

// Weak markers carry provenance across lazy built-in helpers without retaining inputs.
const protectedValues = new WeakSet<object>();
const objectLike = (value: unknown): value is object =>
  value !== null && (typeof value === 'object' || typeof value === 'function');

/** Mark one input value, without walking or reading its graph. */
export function protectInput<T>(value: T): T {
  consumeWork();
  if (Array.isArray(value)) checkArrayLength(value.length);
  if (objectLike(value)) protectedValues.add(value);
  return value;
}

export function isProtectedInput(value: unknown): boolean {
  return objectLike(value) && protectedValues.has(value);
}

function assertDataContainer(value: unknown): void {
  if (typeof value === 'function')
    throw new UserError('Cannot traverse a host function');
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
      throw new UserError('Cannot traverse or copy an opaque host object');
  }
}

/** Read own data only. Accessing a protected container transfers input provenance. */
export function readData(value: unknown, key: PropertyKey): unknown {
  consumeWork();
  if (value == null) return undefined;
  assertDataContainer(value);
  const descriptor = Object.getOwnPropertyDescriptor(Object(value), key);
  if (!descriptor) return undefined;
  if (!('value' in descriptor))
    throw new UserError(`Cannot read accessor property: ${String(key)}`);
  return isProtectedInput(value)
    ? protectInput(descriptor.value)
    : descriptor.value;
}

export function dataEntries(value: object): [PropertyKey, unknown][] {
  assertDataContainer(value);
  if (Array.isArray(value)) checkArrayLength(value.length);
  const keys = Reflect.ownKeys(value);
  consumeWork(keys.length);
  return keys
    .filter((key) => Object.getOwnPropertyDescriptor(value, key)?.enumerable)
    .map((key) => [key, readData(value, key)]);
}

/** Only unprotected parser-generated zero-argument thunks may be unwrapped. */
export function unwrapInternal<T>(value: T): T {
  let seen: Set<object> | undefined;
  while (typeof value === 'function' && !isProtectedInput(value)) {
    if (value.length !== 0)
      throw new UserError('Unexpected callable expression value');
    seen ??= new Set<object>();
    if (seen.has(value)) throw new UserError('Cyclic expression thunk');
    seen.add(value);
    consumeWork();
    value = value();
  }
  return value;
}

/** Higher-order language functions accept built-in names, never host callbacks. */
export function rejectHostCallback(value: unknown): void {
  if (typeof value === 'function')
    throw new UserError(
      'Host function callbacks are not supported; use a built-in function name',
    );
}

export function createMaterializer() {
  function materialize(expression: unknown): unknown {
    const copies = new WeakMap<object, object>();
    const visit = (original: unknown): unknown => {
      consumeWork();
      const value = unwrapInternal(original);
      if (
        !objectLike(value) ||
        typeof value === 'function' ||
        isProtectedInput(value)
      )
        return value;
      const prototype = Object.getPrototypeOf(value);
      if (
        !Array.isArray(value) &&
        prototype !== Object.prototype &&
        prototype !== null
      )
        return value;
      const existing = copies.get(value);
      if (existing) return existing;
      if (Array.isArray(value)) checkArrayLength(value.length);
      const copy = Array.isArray(value)
        ? new Array(value.length)
        : Object.create(prototype);
      copies.set(value, copy);
      for (const [key, child] of dataEntries(value)) {
        Object.defineProperty(copy, key, {
          value: visit(child),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
      return copy;
    };
    return visit(expression);
  }
  return { protect: protectInput, materialize };
}

/** Error formatting must not call host toJSON/valueOf/toString methods. */
export function describeValue(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'object')
    return Array.isArray(value) ? '[array]' : '[object]';
  if (typeof value === 'function') return '[function]';
  if (typeof value === 'string') return JSON.stringify(value);
  return String(value);
}
