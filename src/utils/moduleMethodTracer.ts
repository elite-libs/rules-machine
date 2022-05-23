import mapValues from 'lodash/mapValues.js';

export default function moduleMethodTracer(
  module: Record<string, Function>,
  callback: Function
) {
  return mapValues(module, (originalMethod: Function, name: string) => {
    return (...args: any[]) => {
      const originalValue = originalMethod(...args);
      callback(
        'invoking',
        name,
        args.map((fn) => fn()),
        originalValue
      );
      return originalValue;
    };
  });
}
