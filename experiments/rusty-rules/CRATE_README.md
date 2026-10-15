# rusty-rules-experiment

An experimental Rust implementation of a tested subset of [Rules Machine](https://github.com/elite-libs/rules-machine). It provides a Rust library and a persistent JSON-line worker binary. It is not a drop-in replacement for the TypeScript engine; unsupported syntax and function domains reject explicitly.

```sh
cargo add rusty-rules-experiment@0.1.1
# Or install the worker binary:
cargo install rusty-rules-experiment --version 0.1.1 --locked
```

```rust
use rusty_rules_experiment::{Program, Value};
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

The example also uses `serde_json`, which consumers should declare as a direct dependency. `Program::execute` returns the result and updated input. Values use shared references within one execution; the public API expects acyclic data trees. It does not support arbitrary caller-constructed cyclic `Rc` graphs.

Supported features include conditions, structural logical groups, assignments, returns, array map/filter/every/some/find, try/catch, and a subset of numeric, array and string functions. Tracing, atomic rollback, host callbacks, date functions and full JavaScript coercion are unsupported. Compilation validates the whole supported program, including unreachable branches.

Evaluation uses a cooperative one-million-work-unit limit, including bulk collection and string work. The worker has syntax, frame and output limits. These are not strict memory quotas or preemptive CPU deadlines; applications requiring hard isolation must own process termination and resource limits. The legacy benchmark command accepts repeated iterations and needs caller-owned cancellation.

The optional Node bridge is maintained in the source repository, outside this crate package. It provides tagged transport, deadlines, cancellation and backpressure; crossing the process boundary copies data and loses reference identity. Native Rust benchmark results do not describe bridge latency.

- [Complete subset, protocol, limits and bridge documentation](https://github.com/elite-libs/rules-machine/blob/main/experiments/rusty-rules/README.md)
- [Machine-readable compatibility cases](https://github.com/elite-libs/rules-machine/blob/main/performance/rust-gaps/spec.json)
- [Security review and remaining boundaries](https://github.com/elite-libs/rules-machine/blob/main/docs/security-review/RESULTS.md)

Licensed under BSD-3-Clause; see the included LICENSE.md.
