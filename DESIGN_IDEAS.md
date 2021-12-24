# Exploring Various Patterns

## `Rule` Expressions

A `Rule` is a string expressing a bit of logic.

Typically it includes 3 parts: a left-hand side (LHS), an operator (`+`, `*`, `=`, `==`), and a right-hand side (RHS).

### Example Rules

- Assignment Operator Examples
  - `account.balance -= 100`
  - `discount ??= 10` - this is modern ES2019 syntax. It sets the `discount` to 10 only if it is unset (null-ish coalescing.)
  - `invoice.total += cart.subtotal`
- Logical Operators (Boolean Expressions)
  - `==`
  - `!=`
  - `>=`
  - `>`
  - etc.

## Logical AND, OR

```ts
// {"and": ["price >= 25", "price <= 50"]}
[
  {"if": {"and": ["price >= 25", "price <= 50"]}, "then": "discount = 5"},
  {"if": "price >= 100", "then": "discount = 20"},
  {"return": "discount"},
]

// Possible recursive structure?
[
  {
    "if": 
      {"or": [
        "price >= 25", 
        {"and": [
          "price <= 50",
          "discountApplied == false"
        ]}
      ]},
    "then": "discount = 5"
  },
  {"if": "price >= 100", "then": "discount = 20"},
  {"return": "discount"},
]

// "price >= 25 || price <= 50"
[
  {"if": "price >= 25 || price <= 50", "then": "discount = 5"},
  {"if": "price >= 100", "then": "discount = 20"},
  {"return": "discount"},
]

```


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
