# Getting Started with Rules Machine

A step-by-step guide to using Rules Machine in your projects.

## Installation

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
  { if: 'price >= 100', then: 'discount = 20' },
  { if: 'price >= 50', then: 'discount = 10' },
  { return: 'discount' },
]);

const result = calculateDiscount({ price: 75 });
console.log(result); // 10
```

### How It Works

1. **`ruleFactory(rules)`** — Parses and compiles your rules
2. **`engine(input)`** — Executes rules with your data
3. **Returns** — The result of the last `return` statement (or modified input)

## Rule Syntax

### Conditional Rules: `if/then/else`

```ts
ruleFactory([
  { if: 'score > 90', then: 'grade = "A"' },
  { if: 'score > 80', then: 'grade = "B"' },
  { else: 'grade = "C"' },
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

Inline form (doesn't short-circuit):

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

Supported operators: `=`, `+=`, `-=`, `*=`, `/=`, `%=`, `??=`

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

Process arrays with special variables: `$item`, `$index`, `$array`

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
// { numbers: [1, 2, 3], doubled: [2, 4, 6] }
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
  { try: 'riskyOperation()', catch: 'status = "failed"' },
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

See [API Reference](../README.md#built-in-functions) for the full list.

### String Literals

Wrap strings in quotes:

```ts
ruleFactory(['status = "active"', 'message = "Hello, " + user.name']);
```

## Debugging with Traces

Enable tracing to see execution details:

```ts
const engine = ruleFactory(rules, { trace: true });
const result = engine({ price: 45 });

console.log(result.trace);
// [
//   { operation: 'begin', startTime: 123456.789 },
//   { operation: 'if', rule: 'price >= 25', result: true },
//   { operation: 'evalRule', rule: 'discount = 5', value: 5 },
//   { operation: 'return', rule: 'discount', result: 5 },
//   { operation: 'complete', runTime: 0.42 }
// ]
```

Trace output includes:

- Operation type
- Rule executed
- Input/output values
- Timing information
- Step count

## Options

```ts
ruleFactory(rules, options);
```

| Option              | Type      | Default | Description                             |
| ------------------- | --------- | ------- | --------------------------------------- |
| `trace`             | `boolean` | `false` | Enable detailed execution tracing       |
| `ignoreMissingKeys` | `boolean` | `true`  | Skip undefined keys instead of throwing |

## Security Considerations

### Protected Keys

Rules Machine blocks dangerous keys to prevent prototype pollution:

```ts
// Throws error
engine({ __proto__: { isAdmin: true } });
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

Rules Machine uses safe expression parsing via [`expressionparser`](https://www.npmjs.com/package/expressionparser). It never uses `eval()` or `Function()`.

## Common Patterns

### Chaining Rules

```ts
ruleFactory([
  { if: 'user.isNew', then: 'user.rewardsBalance = 500' },
  { if: 'user.rewardsBalance >= 1000', then: 'discount = 0.10' },
  { if: 'user.rewardsBalance >= 500', then: 'discount = 0.05' },
  { return: 'discount' },
]);
```

### Stateful Rules

Track state across rule execution:

```ts
ruleFactory([
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
