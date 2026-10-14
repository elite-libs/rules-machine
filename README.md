# Rules Machine

[![CI Status](https://github.com/elite-libs/rules-machine/workflows/test/badge.svg)](https://github.com/elite-libs/rules-machine/actions)
[![NPM version](https://img.shields.io/npm/v/@elite-libs/rules-machine.svg)](https://www.npmjs.com/package/@elite-libs/rules-machine)
[![GitHub stars](https://img.shields.io/github/stars/elite-libs/rules-machine.svg?style=social)](https://github.com/elite-libs/rules-machine)
[![License: BSD-3-Clause](https://img.shields.io/npm/l/@elite-libs/rules-machine.svg)](https://github.com/elite-libs/rules-machine/blob/main/LICENSE.md)

![Rules Machine](img/rules-machine-header.svg)

> **A fast, serializable rules engine for TypeScript & JavaScript** — move business logic where you need it.

---

**Table of Contents**

- [Quick Start](#quick-start)
- [What is Rules Machine?](#what-is-rules-machine)
- [Why Use a Rules Engine?](#why-use-a-rules-engine)
- [Installation](#installation)
- [Core Concepts](#core-concepts)
  - [App Logic vs Business Rules](#app-logic-vs-business-rules)
- [API Reference](#api-reference)
  - [ruleFactory](#rulefactory)
  - [Rule Types](#rule-types)
  - [Operators](#operators)
  - [Built-in Functions](#built-in-functions)
- [Examples](#examples)
- [Performance & Security](#performance--security)
- [Use Cases](#use-cases)
- [Contributing](#contributing)
- [License](#license)

## What is Rules Machine?

Rules Machine is a high-performance, general-purpose [rules engine](https://martinfowler.com/bliki/RulesEngine.html) for TypeScript and JavaScript. It executes business logic defined as JSON-serializable rules, making it perfect for:

- **Serverless & Edge** — Deploy rules to CloudFlare Workers, Lambda@Edge, or any V8 isolate
- **Shared Validation** — Use the same rules on client, server, and in transit
- **Dynamic Logic** — Store, sync, and update rules without redeploying code
- **Complex Decision Trees** — Organize pricing, discounts, approvals, and workflows

```bash
pnpm add @elite-libs/rules-machine
# or
npm install @elite-libs/rules-machine
# or
yarn add @elite-libs/rules-machine
```

## Quick Start

```ts
import { ruleFactory } from '@elite-libs/rules-machine';

const calculateDiscount = ruleFactory([
  { if: { and: ['price >= 25', 'price <= 50'] }, then: 'discount = 5' },
  { if: 'price > 50', then: 'discount = 10' },
  { return: 'discount' },
]);

calculateDiscount({ price: 40 }); // 5
calculateDiscount({ price: 60 }); // 10
```

## Why Use a Rules Engine?

Rules engines shine when you need to:

1. **Store & Sync Rules** — Keep rules in JSON/YAML, databases, or config services
2. **Manage Complexity** — Isolate business rules from core application logic
3. **Trace & Debug** — Get step-by-step execution traces for audits and debugging
4. **Enable Non-Devs** — Let product, QA, or business teams review rule logic

### Real-World Scenarios

- **E-commerce**: Tiered discounts, tax calculations, shipping rules
- **Finance**: Loan approvals, risk assessments, compliance checks
- **Healthcare**: Eligibility rules, coverage determinations, pricing tiers
- **SaaS**: Feature flags, usage limits, subscription tiers

## Core Concepts

### App Logic vs Business Rules

| **App Logic**               | **Business Rules**            |
| --------------------------- | ----------------------------- |
| Changes infrequently        | Changes frequently            |
| Core application behavior   | Business policies & decisions |
| _"Validate cart total > 0"_ | _"Premium users get 25% off"_ |
| _"One discount per order"_  | _"NY residents pay NY tax"_   |

**When to use Rules Machine:**

- Rules change based on business needs (pricing, discounts, approvals)
- You need to store or sync rules across environments
- Audit trails and execution traces are required
- Non-technical stakeholders need to review logic

## API Reference

### `ruleFactory`

Creates a rule executor from JSON-serializable rules.

```ts
import { ruleFactory } from '@elite-libs/rules-machine';

const engine = ruleFactory(rules, options?);
const result = engine(input);
```

**Options:**

| Option              | Type      | Default | Description                   |
| ------------------- | --------- | ------- | ----------------------------- |
| `trace`             | `boolean` | `false` | Enable execution tracing      |
| `ignoreMissingKeys` | `boolean` | `true`  | Skip undefined keys vs. throw |

**Returns:** Function that accepts input object and returns result (or trace object if enabled).

### Rule Types

#### Conditional: `if/then/else`

```ts
ruleFactory([
  {
    if: 'score >= 90',
    then: 'grade = "A"',
    else: { if: 'score >= 80', then: 'grade = "B"', else: 'grade = "C"' },
  },
]);
```

#### Logical: `and` / `or`

```ts
// Object form (short-circuits)
{ if: { and: ['age >= 18', 'age <= 65'] }, then: 'eligible = true' }

// Inline form
{ if: 'age >= 18 AND age <= 65', then: 'eligible = true' }
```

#### Array Operations: `map`, `filter`, `every`, `some`, `find`

```ts
// Map: double each item
ruleFactory([
  {
    map: 'numbers',
    run: '$item * 2',
    set: 'doubled',
  },
]);

// Filter: keep only multiples of 3
ruleFactory([
  {
    filter: 'numbers',
    run: '$item % 3 == 0',
    set: 'results',
  },
  { return: 'results' },
]);

// Every: check if all items match
ruleFactory([
  {
    every: 'numbers',
    run: '$item % 3 == 0',
    set: 'allMatch',
  },
  { return: 'allMatch' },
]);
```

Special variables available in array rules: `$item`, `$index`, `$array`.

#### Return: `return`

Ends execution and returns a value.

```ts
ruleFactory([{ if: 'valid', then: 'result = "ok"' }, { return: 'result' }]);
```

#### Error Handling: `try/catch`

```ts
ruleFactory([
  { try: 'THROW("example failure")', catch: 'status = "failed"' },
  { return: 'status' },
]);
```

### Operators

**Assignment:** `=`, `+=`, `-=`, `*=`, `/=`, `??=`

**Comparison:** `==`, `!=`, `<>`, `<`, `<=`, `>`, `>=`, `~=`

**Arithmetic:** `+`, `-`, `*`, `/`, `%`, `^`

**Logical:** `AND`, `OR` (note: both inline and object forms short-circuit)

### Built-in Functions

Rules Machine includes 80+ built-in functions:

#### Math

```
AVERAGE(), CEIL(), FLOOR(), ROUND(), TRUNC(), SUM()
ADD(), SUB(), DIV(), MUL(), NEG(), MOD(), GCD()
ABS(), SQRT(), CUBEROOT(), SIGN()
ISPRIME(), ISNAN(), NOT()
```

#### Array

```
LENGTH(), SLICE(), SORT(), REVERSE()
MIN(), MAX(), HEAD(), LAST(), TAIL()
TAKE(), DROP(), TAKEWHILE(), DROPWHILE()
FILTER(), MAP(), REDUCE()
CONCAT(), CONS(), JOIN(), RANGE()
CONTAINS(), INDEX()
```

#### Object

```
DICT(), KEYS(), VALUES(), UNZIP(), UNZIPDICT()
CONTAINS(), COUNT_KEYS(), OMIT()
ZIP()
```

#### String

```
LOWER(), UPPER(), SPLIT(), CHAR(), CODE()
STRING_CONTAINS(), STRING_STARTS_WITH(), STRING_ENDS_WITH()
BIN2DEC(), DEC2BIN(), DEC2HEX(), HEX2DEC()
DEC2STR(), STR2DEC(), CHARARRAY()
```

#### Utility

```
IF(), GET(), FILTER_VALUES(), REMOVE_VALUES()
THROW()
```

Trigonometry & advanced math: `SIN()`, `COS()`, `TAN()`, `ASIN()`, `ACOS()`, `ATAN()`, `EXP()`, `LN()`, `LOG()`, `LOG2()`, `DEGREES()`, `RADIANS()`, and more.

## Examples

### Discount Tiers

```json
[
  { "if": { "and": ["price >= 25", "price <= 50"] }, "then": "discount = 5" },
  { "if": "price > 50", "then": "discount = 10" },
  { "return": "discount" }
]
```

### User Eligibility

```json
[
  { "if": "user.plan == \"premium\"", "then": "discount = 15" },
  { "if": "user.employee == true", "then": "discount = 15" },
  { "return": "discount" }
]
```

### Complex Conditions with State

```json
[
  {
    "if": "price <= 100",
    "then": ["discount = 5", "user.discountApplied = true"]
  },
  {
    "if": { "and": ["price >= 90", "user.discountApplied != true"] },
    "then": "discount = 20"
  },
  { "return": "discount" }
]
```

### Array Processing

```ts
const processOrders = ruleFactory([
  {
    filter: 'orders',
    run: '$item.total > 100',
    set: 'largeOrders',
  },
  {
    map: 'largeOrders',
    run: '$item.total * 0.9',
    set: 'discountedTotals',
  },
  {
    return: 'discountedTotals',
  },
]);

processOrders({ orders: [{ total: 50 }, { total: 150 }, { total: 200 }] });
// [135, 180]
```

### With Execution Trace

```ts
const engine = ruleFactory(rules, { trace: true });
const result = engine({ price: 45 });

console.log(result.trace);
// [
//   { operation: 'begin', startTime: ... },
//   { operation: 'if', rule: 'price >= 25 AND price <= 50', result: true },
//   { operation: 'evalRule', rule: 'discount = 5', value: 5 },
//   { operation: 'complete', runTime: 0.42 }
// ]
```

## Performance & Security

### Security

- **No `eval()`** — Uses expression parsing via [`expressionparser`](https://www.npmjs.com/package/expressionparser)
- **Protected keys** — Blocks dangerous keys: `__proto__`, `constructor`, `prototype`, etc.
- **Reserved fields** — Prevents use of `$item`, `$index`, `$array` in input

### Execution contract and limits

Assignments mutate the supplied input. Reads use own data properties and reject accessors. Input objects, frozen values, cycles, aliases and functions can be returned by identity without recursive mutation or function invocation. Functions and class instances are opaque: traversal, coercion and host callbacks reject. Built-in higher-order functions accept built-in names. Proxies and custom expression engines remain host code; use ordinary data for predictable execution. Assignment needs writable destinations and rejects `__proto__`, `constructor`, and `prototype` paths. Array callback variables are restored after each callback. A `return` in an array's `run` finishes that callback; other returns finish the pipeline.

By default, a runtime error leaves earlier assignments in place. Use `{ atomic: true }` to restore interpreter-owned property writes on an uncaught failure, including resource exhaustion. Rollback preserves existing object identities, aliases, array holes and descriptors. A handled rule `catch` continues the transaction; it does not create a savepoint. The atomic journal has a hard ceiling of 100,000 property records, including temporary callback context. This option cannot undo external host side effects. Enabled traces snapshot historical values without invoking getters or `toJSON`; cycles, functions and accessors use descriptive markers. The returned trace result's `input` is the live caller object.

Execution is synchronous and uses cooperative resource limits. A `ResourceLimitError` bypasses rule `catch` handlers. Defaults per execution are:

| Option in `limits` | Default | What it bounds |
| --- | ---: | --- |
| `maxOperations` | 1,000,000 | Shared work accounting, including cold source scans, array loops and used string processing |
| `maxArrayLength` | 100,000 | Arrays traversed or produced |
| `maxStringLength` | 1,000,000 | Used string values and generated string results |
| `maxDataDepth` | 128 | Traversed data depth; configurable up to 256 |
| `maxDurationMs` | 1,000 | Cooperative elapsed deadline, checked periodically and before successful return |

For example, `ruleFactory(rules, { atomic: true, limits: { maxOperations: 200_000, maxDurationMs: 50 } })`. These controls are not a process sandbox, strict heap cap, or preemptive timeout for host callbacks, Proxy traps or individual native operations. Isolate execution in a killable worker/process when those guarantees matter.

Validation allows at most 100 levels of rule nesting and 10,000 structural nodes. Rule objects and child lists must contain enumerable data properties; sparse rule lists, symbol keys, getters and unexpected keys reject before execution. Expressions allow 100,000 characters, 100 grouping levels and at most 1,024 tokens. `expression.maxTokens` may lower that limit. The factory's syntax cache defaults to 512 entries and 8 MiB of conservative source/token accounting; configure `expression.maxCacheEntries` / `expression.maxCacheBytes`, or set either to zero to disable retention. This estimate is not measured VM heap usage. `createExpressionEngine().cacheStats()` exposes the accounting.

String paths use a separate module-local cache shared by that module’s factories: at most 500 paths and 1 MiB of UTF-16 string-content accounting. Entries above 16 KiB are parsed without retention. Array/map overhead is outside that accounting, so it is not a VM heap limit. This cache stores path text and segments, not resolved input objects; expression-cache options and `cacheStats()` do not control or report it.

`RANGE` requires finite safe integer bounds and at most 100,000 items; `GCD` requires finite safe integers; `ISPRIME` accepts integers up to 1e12 and returns false below the prime domain. `DATE` accepts finite epoch milliseconds, ISO date-only strings interpreted as UTC, ISO datetimes with an explicit `Z` or offset, and unit-bearing relative durations such as `"-2 days"`. `DATEISO` uses the same parser. Invalid dates, rollover dates, ambiguous local datetimes, bare numeric strings and host objects reject. Relative durations read the clock on every evaluation; they are not cached results.

Use `AND` and `OR` for logical operators, double quotes for string literals, and `STRING([...])` for string concatenation. JavaScript `&&`, `||`, arbitrary function calls, wildcard paths, and object-valued `return` rules are unsupported. Return objects with a string expression such as `DICT(["valid", "errors"], [valid, errors])`. Pass nested arrays through input because the parser does not reliably support nested array literals. Legacy `FILTER_VALUES` and `INCLUDES_VALUES` remove matching values; they preserve exclusion behavior for compatibility.

### Performance

- Reuses a bounded expression cache within each factory
- Reuse a factory for repeated executions; measure throughput with your rules and data
- Suitable for edge computing and serverless environments

## Use Cases

| Industry       | Use Case                                                           |
| -------------- | ------------------------------------------------------------------ |
| **E-commerce** | Dynamic pricing, discount stacks, tax calculations, shipping rules |
| **Finance**    | Loan approvals, risk scoring, compliance checks, fraud detection   |
| **Healthcare** | Eligibility verification, coverage rules, claim adjudication       |
| **SaaS**       | Feature flags, usage limits, tier upgrades, billing logic          |
| **Gaming**     | Achievement unlocks, loot tables, match-making rules               |

## Documentation

- **[Why Use a Rules Engine?](./docs/why.md)** — When and why to use Rules Machine
- **[Getting Started Guide](./docs/guide.md)** — Step-by-step tutorial
- **[Examples](./docs/examples.md)** — Real-world patterns and use cases

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push: `git push origin feature/my-feature`
5. Submit a PR

### Development

Use the pinned pnpm version and `pnpm-lock.yaml` for reproducible development. The obsolete Bun lockfile was removed because it named dependencies that no longer match this package.

```bash
pnpm install
pnpm build
pnpm test
pnpm test:coverage
```

## License

BSD-3-Clause — See [LICENSE](LICENSE.md) for details.

---

**Related Projects:**

- [JSON Rules Engine](https://www.npmjs.com/package/json-rules-engine)
- [Martin Fowler: Rules Engine](https://martinfowler.com/bliki/RulesEngine.html)

Browser IIFE builds are minified by default; `NODE_ENV=development pnpm build` keeps them readable. Node ESM/CommonJS retain the existing opt-in `NODE_ENV=production` minification. All formats retain source maps.
