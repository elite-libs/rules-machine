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

## Example Rules

```json
[
  {"if": {"and": ["price >= 25", "price <= 50"]}, "then": "discount = 5"},
  {"if": "price >= 100", "then": "discount = 20"},
  {"return": "discount"},
]
```

```json
[
  {
    "if": "price >= 25",
    "then": "discount = 5"
  },
  {
    "if": "price >= 100",
    "then": "discount = 20"
  },
  {
    "return": "discount"
  }
]
```

```json
[
  {
    "if": "price >= 100",
    "then": "discount = 20"
  },
  {
    "return": "discount"
  }
]
```

```json
[
  {
    "if": "price >= 100",
    "then": "discount += 20"
  },
  {
    "return": "discount"
  }
]
```

```json
[
  {
    "if": "user.plan == \"premium\"",
    "then": "discount = 15"
  },
  {
    "if": "user.employee == true",
    "then": "discount = 15"
  },
  {
    "return": "discount"
  }
]
```

```json
[
  {
    "if": {
      "and": [
        "price >= 25",
        "price <= 50"
      ]
    },
    "then": "discount = 5"
  },
  {
    "if": "price >= 100",
    "then": "discount = 20"
  },
  {
    "return": "discount"
  }
]
```

```json
[
  {
    "if": "price <= 100",
    "then": "discount = 5"
  },
  {
    "if": {
      "or": [
        "price >= 100",
        "user.isAdmin == true"
      ]
    },
    "then": "discount = 20"
  },
  {
    "return": "discount"
  }
]
```

```json
[
  {
    "if": "price <= 100",
    "then": [
      "discount = 5",
      "user.discountApplied = true"
    ]
  },
  {
    "if": {
      "and": [
        "price >= 90",
        "user.discountApplied != true"
      ]
    },
    "then": "discount = 20"
  },
  {
    "return": "discount"
  }
]

```
