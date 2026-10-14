import {
  checkArrayLength,
  checkDataDepth,
  checkStringLength,
  consumeWork,
} from './budget';

/** Descriptor-only trace snapshots: never run getters, toJSON or host methods. */
export function traceSnapshot(
  value: unknown,
  ancestors = new WeakSet<object>(),
  depth = 0,
): unknown {
  checkDataDepth(depth);
  consumeWork();
  if (typeof value === 'string') {
    checkStringLength(value.length);
    consumeWork(value.length);
  }
  if (typeof value === 'bigint' || typeof value === 'symbol') {
    const text = String(value);
    checkStringLength(text.length);
    consumeWork(text.length);
    return text;
  }
  if (typeof value === 'function') return '[Function]';
  if (value === null || typeof value !== 'object') return value;
  if (ancestors.has(value)) return '[Circular]';
  ancestors.add(value);
  try {
    if (value instanceof Date) {
      const epoch = Date.prototype.getTime.call(value);
      return Number.isFinite(epoch)
        ? new Date(epoch).toISOString()
        : '[Invalid Date]';
    }
    const result: Record<string, unknown> | unknown[] = Array.isArray(value)
      ? []
      : {};
    if (Array.isArray(value)) checkArrayLength(value.length);
    for (const key of Object.keys(value)) {
      checkStringLength(key.length);
      consumeWork(key.length);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor) continue;
      Object.defineProperty(result, key, {
        value:
          'value' in descriptor
            ? traceSnapshot(descriptor.value, ancestors, depth + 1)
            : '[Accessor]',
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    if (Array.isArray(value)) (result as unknown[]).length = value.length;
    return result;
  } finally {
    ancestors.delete(value);
  }
}

export function serializeTrace(value: unknown): unknown {
  const copy = traceSnapshot(value);
  return copy !== null && typeof copy === 'object'
    ? JSON.stringify(copy)
    : copy;
}
