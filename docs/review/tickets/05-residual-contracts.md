# 05: Remaining contracts and measured limits

Parent: [Wayfinder](../WAYFINDER.md). Status: open follow-up, not part of the accepted performance claim.

| Priority | Gap and evidence | Next acceptance criterion |
| --- | --- | --- |
| P2 | The dependency recursively materializes returned object values, mutates ordinary objects, invokes zero-argument functions, fails on frozen returned records and cyclic returned objects. Expert reproduced these preexisting behaviors. | Define JSON-only versus host-object API; add immutable/cyclic/reference-identity tests before replacing materialization. Preserve DICT/MAP/REDUCE and class/date semantics intentionally. |
| P2 | A sufficiently long flat expression can exceed the recursive parser stack without exceeding character/group limits. Nested maps multiply work; no total instruction/allocation or wall-time budget exists. | Bound token/operation budgets and test resource exhaustion in isolated worker processes. A Promise timeout is not an interrupt for synchronous work. |
| P2 | DATE's short-string duration heuristic, unknown-date fallback, and relative-clock semantics remain inconsistent. | Freeze a date/duration/null/error contract and migration plan; test fixed clock, timezone and invalid input. Never cache relative date values as immutable results. |
| P2 | Rust is an experiment for explicitly listed finite scalar fixtures. Arrays, functions, null/missing, nested result arrays, nested returns, unary negatives, case-insensitive names and a JavaScript bridge are outside the validated subset. | Add a feature-by-feature differential specification before expanding claims or considering an FFI/WASM integration. |
| P2 | Public dependency advisory scan was rejected by automatic approval review because it would disclose the dependency inventory. | User may authorize the advisory service separately. No current vulnerability-free claim is made. |
| P3 | Confirmation covers seven reused-program slices on one busy local host; no cold unique-program throughput, production traffic, or production Rust bridge benchmark. | Separate cold/prepare and end-to-end bridge experiments, with equivalent reset and data-transfer boundaries. |
| P3 | Syntax cache is bounded by 512 entries, not a strict byte budget. A separate 10,000-unique-expression forced-GC diagnostic showed a plateau, but one process and post-batch RSS are not general retained-growth evidence. | Long-lived unique-program/input-retention tests and byte-aware cache budget before claiming bounded retained bytes. |
| P3 | Trace.expression results may retain object references; runtime errors can leave caller mutations and logging still occurs for unexpected errors. | Document/choose trace snapshot and error logging contracts; transactional rollback would require a separate API and performance budget. |
| P3 | TypeScript's default factory return type remains a union with trace results and cannot infer results from arbitrary string rules. | Add overload/type-only tests for literal trace options without promising static inference for a dynamic language. |

These gaps were deliberately recorded rather than folded into an untested parser rewrite. Current documented input is trusted mutable JSON data, and execution is explicitly not a sandbox. Structural malformed-program validation happens before mutation; arbitrary runtime exceptions are not transactional.
