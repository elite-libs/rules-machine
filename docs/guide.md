# Getting Started with Rules Machine

A step-by-step guide to using Rules Machine in your projects.

## Installation

Use Node.js 24 or newer. ESM, CommonJS, TypeScript declarations, and a browser global build are available; see [package formats](../README.md#installation).

```bash
pnpm add @elite-libs/rules-machine
# or
npm install @elite-libs/rules-machine
# or
yarn add @elite-libs/rules-machine
```

## Basic Usage

### Your First Rule

```ts
import { ruleFactory } from '@elite-libs/rules-machine';

const calculateDiscount = ruleFactory([
  'discount = 0',
  { if: 'price >= 50', then: 'discount = 10' },
  { if: 'price >= 100', then: 'discount = 20' },
  { return: 'discount' },
]);

const result = calculateDiscount({ price: 75 });
console.log(result); // 10
```

### How It Works

1. **`ruleFactory(rules)`** — Creates an executor for your rules
2. **`engine(input)`** — Executes rules with your data
3. **Returns** — The first executed `return` value, or the last evaluated value when no return executes. Assignments mutate the supplied input object

## Rule Syntax

### Conditional Rules: `if/then/else`

```ts
ruleFactory([
  {
    if: 'score >= 90',
    then: 'grade = "A"',
    else: { if: 'score >= 80', then: 'grade = "B"', else: 'grade = "C"' },
  },
]);
```

### Logical Operators: `and` / `or`

Use object form for short-circuit evaluation:

```ts
// Object form (recommended)
{
  if: { and: ['age >= 18', 'age <= 65'] },
  then: 'eligible = true'
}

{
  if: { or: ['user.isAdmin', 'user.hasAccess'] },
  then: 'canEdit = true'
}
```

Inline form also short-circuits:

```ts
{ if: 'age >= 18 AND age <= 65', then: 'eligible = true' }
```

### Assignment Rules

Modify values in the input object:

```ts
ruleFactory([
  'discount = 10',
  'total = price * quantity',
  'user.discountApplied = true',
  'cart.subtotal += shipping',
]);
```

Supported operators: `=`, `+=`, `-=`, `*=`, `/=`, `??=`

### Return Rules

End execution and return a value:

```ts
ruleFactory([
  { if: 'valid', then: 'result = "ok"' },
  { return: 'result' }, // Execution stops here
  { return: 'error' }, // Never reached
]);
```

### Array Operations

Process arrays with special variables: `$item`, `$index`, `$array`. They are scoped to each callback and restored after nested operations and errors. A `return` inside `run` ends only that callback; outside array callbacks it ends the pipeline.

#### Map

```ts
const doubleNumbers = ruleFactory([
  {
    map: 'numbers',
    run: '$item * 2',
    set: 'doubled',
  },
]);

doubleNumbers({ numbers: [1, 2, 3] });
// [2, 4, 6]; the input object also gains doubled: [2, 4, 6]
```

#### Filter

```ts
const getAdults = ruleFactory([
  {
    filter: 'users',
    run: '$item.age >= 18',
    set: 'adults',
  },
  { return: 'adults' },
]);

getAdults({
  users: [
    { name: 'Alice', age: 17 },
    { name: 'Bob', age: 25 },
    { name: 'Charlie', age: 30 },
  ],
});
// [{ name: 'Bob', age: 25 }, { name: 'Charlie', age: 30 }]
```

#### Every, Some, Find

```ts
// Every: check if all items match
const allAdults = ruleFactory([
  {
    every: 'users',
    run: '$item.age >= 18',
    set: 'result',
  },
  { return: 'result' },
]);

// Some: check if any item matches
const hasAdult = ruleFactory([
  {
    some: 'users',
    run: '$item.age >= 18',
    set: 'result',
  },
  { return: 'result' },
]);

// Find: get first matching item
const firstAdult = ruleFactory([
  {
    find: 'users',
    run: '$item.age >= 18',
    set: 'result',
  },
  { return: 'result' },
]);
```

### Error Handling: `try/catch`

```ts
ruleFactory([
  { try: 'THROW("example failure")', catch: 'status = "failed"' },
  { return: 'status' },
]);
```

## Working with Data

### Accessing Nested Properties

Use dot notation and array indexing:

```ts
ruleFactory(['user.name', 'cart.items[0].price', 'order.shipping.address.zip']);
```

### Using Built-in Functions

```ts
ruleFactory([
  'average = AVERAGE([10, 20, 30])',
  'greeting = UPPER("hello")',
  'isValid = ISPRIME(7)',
  'items = SPLIT(",", "a,b,c")',
]);
```

See the [built-in function overview](../README.md#built-in-functions) and [function-domain notes](../README.md#function-domains-and-expression-syntax).

### String Literals

Wrap string literals in double quotes. Use `STRING` to join strings; `+` accepts numbers:

```ts
ruleFactory(['status = "active"', 'message = STRING(["Hello, ", user.name])']);
```

## Debugging with Traces

Enable tracing to receive execution metadata alongside the result:

```ts
const engine = ruleFactory([
  'discount = 0',
  { if: 'price >= 25', then: 'discount = 5' },
  { return: 'discount' },
], { trace: true });
const input = { price: 45 };
const result = engine(input);

console.log(result.lastValue); // 5
console.log(result.returnValue); // 5 (the explicit return)
console.log(result.input === input); // true
console.table(result.trace);
```

The traced result contains `input`, `trace`, `lastValue`, `returnValue`, and elapsed `runTime` in milliseconds. Each trace row has an `operation`; additional fields depend on the operation, such as `rule`, `value`, `result`, `currentState`, `stepRow`, and `stepCount`. Timing rows include `startTime` or `runTime`. Inspect actual rows rather than assuming every operation shares a schema.

Trace values are historical snapshots, with markers for cycles, accessors and functions. The result's `input` remains the live caller object. Treat traces as application data: they can contain sensitive rule inputs and outputs.

## Options and failure behavior

```ts
const engine = ruleFactory([
  'total = price * quantity',
  { return: 'total' },
], {
  ignoreMissingKeys: false,
  atomic: true,
  limits: { maxOperations: 200_000, maxDurationMs: 50 },
});

engine({ price: 10, quantity: 3 }); // 30
```

| Option | Default | Description |
| --- | --- | --- |
| `trace` | `false` | Return trace metadata instead of a bare value. |
| `ignoreMissingKeys` | `true` | Resolve missing keys as `undefined`; `false` rejects missing lookups. |
| `atomic` | `false` | Restore interpreter-owned property writes on an uncaught failure. |
| `limits` | [Default limits](../README.md#resource-limits) | Set cooperative work, array, string, data-depth and duration limits. |
| `expression` | Bounded cache enabled | Configure token and syntax-cache bounds. |

Ordinary runtime errors can be handled by a rule's `try/catch`. `ResourceLimitError` bypasses those handlers. By default, earlier assignments remain after a failure. Atomic execution restores writes when an error escapes the pipeline; a handled rule error continues the same transaction and does not roll back earlier writes.

These limits are cooperative. They cannot interrupt Proxy traps, host callbacks, or every native operation, and they are not a strict heap cap. Use a caller-owned killable worker or process when strict cancellation or isolation is required. See the [full execution contract](../README.md#execution-contract-and-limits) for bounds and rollback limitations.

## Security Considerations

### Protected Keys

Rules Machine rejects reserved top-level input keys and unsafe assignment path segments. Path reads use own properties:

```ts
// Throws error
engine(JSON.parse('{"__proto__": {"isAdmin": true}}'));
engine({ constructor: 'malicious' });
engine({ toString: 'override' });
```

### Reserved Fields

These fields are reserved for internal use in array operations:

```ts
// Throws error
engine({ $item: 'value' });
engine({ $index: 0 });
engine({ $array: [] });
```

### No `eval()`

Rules Machine parses expressions via [`expressionparser`](https://www.npmjs.com/package/expressionparser). It never uses `eval()` or `Function()`.

See [execution contracts and limits](../README.md#execution-contract-and-limits) for mutation, supported syntax, numeric bounds, and the synchronous trust model.

## Common Patterns

### Chaining Rules

```ts
ruleFactory([
  { if: 'user.isNew', then: 'user.rewardsBalance = 500' },
  'discount = 0',
  { if: 'user.rewardsBalance >= 500', then: 'discount = 0.05' },
  { if: 'user.rewardsBalance >= 1000', then: 'discount = 0.10' },
  { return: 'discount' },
]);
```

### Stateful Rules

Track state within an execution. Reusing an input also preserves its assigned fields across calls; use fresh input for independent decisions:

```ts
ruleFactory([
  'discount = 0',
  'appliedDiscount = false',
  { if: 'price <= 100', then: ['discount = 5', 'appliedDiscount = true'] },
  {
    if: { and: ['price >= 90', 'appliedDiscount != true'] },
    then: 'discount = 20',
  },
  { return: 'discount' },
]);
```

### Nested Conditions

```ts
ruleFactory([
  'canAccess = false',
  {
    if: {
      or: ['user.isAdmin', { and: ['user.isPremium', 'user.years >= 5'] }],
    },
    then: 'canAccess = true',
  },
  { return: 'canAccess' },
]);
```

## Next Steps

- Explore [Examples](./examples.md) for real-world patterns
- Review [Why Use a Rules Engine?](./why.md) for use cases
- Check the [API Reference](../README.md#api-reference) for details
- Read the [security review](./security-review/RESULTS.md) for verified fixes and remaining limits
