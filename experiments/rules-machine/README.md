# rules-machine

A Rust library for JSON-serializable business rules. This is the experimental Rust subset of [Rules Machine](https://github.com/elite-libs/rules-machine), re-exporting the tested `rusty-rules-experiment` core at a pinned version.

```sh
cargo add rules-machine@0.1.1 serde_json
```

```rust
use rules_machine::{Program, Value};
use serde_json::json;

let program = Program::compile(&json!([
    "total = price * quantity",
    { "return": "total" }
])).unwrap();
let (result, updated_input) = program.execute(
    Value::from_json(&json!({ "price": 10, "quantity": 3 })),
    true, // missing keys resolve as undefined
).unwrap();
assert_eq!(result.number().unwrap(), 30.0);
```

All public core types and functions are available through `rules_machine`, including `Program`, `Value` and `Session`. The pinned core provides conditions, assignments, returns, array operations and a subset of numeric/string functions. Unsupported syntax and domains reject explicitly. Input values must be acyclic data trees; arbitrary caller-constructed cyclic `Rc` graphs are outside the contract.

This is not a full TypeScript replacement. Tracing, atomic rollback, date functions and host callbacks are unsupported. Cooperative work limits do not impose strict memory quotas or preemptive deadlines. Applications requiring hard isolation must own process termination and resource limits.

This package provides the library. To install the optional worker binary, use `cargo install rusty-rules-experiment --version 0.1.1 --locked`. The Node bridge is maintained in the repository and copies data across the process boundary.

- [Language subset, protocol and resource limits](https://github.com/elite-libs/rules-machine/blob/main/experiments/rusty-rules/README.md)
- [Compatibility cases](https://github.com/elite-libs/rules-machine/blob/main/performance/rust-gaps/spec.json)
- [Security findings and remaining boundaries](https://github.com/elite-libs/rules-machine/blob/main/docs/security-review/RESULTS.md)

BSD-3-Clause; see LICENSE.md.
