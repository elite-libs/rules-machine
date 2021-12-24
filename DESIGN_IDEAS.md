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
// {"or": ["price >= 25", "price <= 50"]}
[
  {"if": {"or": ["price >= 25", "price <= 50"]}, "then": "discount = 5"},
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
