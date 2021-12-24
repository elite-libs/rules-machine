# Rules Machine

![Rules Machine](img/rules-machine-header.svg)

> _Rules Against The Machine_ 🤘

The rules engine to rule them all.

## TODO

- [x] Simplify TS, making `Rule[]` the sole recursive type.
- [x] Avoid `eval` parsing.
- [x] Use reduced JS syntax, scope.
- [x] Use context for input and output.
- [ ] Add support for multiple boolean expressions. (`&&` and `||`).

## Prior Works & Research

- JSON Rules Engine - the Microsoft one
- json-rules-engine - the HE one
- GitHub Actions YAML's conditional syntax

## Syntax Ideas

Scenario: Determine customer discount: `if price >= 100 then discount = 20, else price >= 25, discount = 5`

### Option #1

```ts
[
  {"if": "price >= 25", "then": "discount = 5"},
  {"if": "price >= 100", "then": "discount = 20"},
  {"return": "discount"},
]
```

```ts
// Idea: execution could map to functional-style operators
ifThen(condition, thenLogic)
ifElse(condition, thenLogic, elseLogic)
```

### Option #2

- Pro: Familiar JS Syntax.
- Con: More complicated & error-prone parsing

```ts
[
  "if (price >= 25) discount = 5",
  "if (price >= 100) discount = 20",
]
```

### Option 3: Reference Style: JSON-Rules-Engine (Microsoft)

- IMHO, this is convoluted stylistically & difficult to write.

```ts
let microsoftRule = {
  conditions: {
    all: [{
      fact: 'account-information',
      operator: 'equal',
      value: 'microsoft',
      path: '$.company' // access the 'company' property of "account-information"
    }, {
      fact: 'account-information',
      operator: 'in',
      value: ['active', 'paid-leave'], // 'status' can be active or paid-leave
      path: '$.status' // access the 'status' property of "account-information"
    }, {
      fact: 'account-information',
      operator: 'contains', // the 'ptoDaysTaken' property (an array) must contain '2016-12-25'
      value: '2016-12-25',
      path: '$.ptoDaysTaken' // access the 'ptoDaysTaken' property of "account-information"
    }]
  },
}
```
