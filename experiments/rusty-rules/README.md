# Experimental rusty-rules

A local Rust prototype, not a published crate or a drop-in replacement. It parses the same JSON rule strings and structures used by the comparison fixtures into expression/rule trees. The supported subset comprises finite numeric arithmetic/comparisons, primitive equality, booleans and short-circuit AND/OR, JSON string literals, dotted object paths, assignment, sequences, if/then/else and return. Unsupported syntax fails explicitly. Arrays, library functions, null/missing semantics, dynamic dates, compound assignment and the full JavaScript compatibility surface are excluded.

Build/test: `mise exec rust@1.99.0 -- cargo test --manifest-path experiments/rusty-rules/Cargo.toml` then the same command with `build --release`.

The CLI accepts one JSON request per line: `{ "rules": [...], "inputs": [{...}], "iterations": 1, "warmup": 0 }`. It returns first-pass outputs and mutated inputs for validation, execution timing and completed operation count. Timing includes fresh input cloning on each evaluation, as does the Node worker. Preparation/parsing and JSON transport are excluded from native execution timing. The harness also records process/JSON boundary wall time separately; it must not be presented as steady-state FFI latency.

This clean-rebuild arm tests pre-parsed interpretation and Rust together. A speed difference cannot be attributed solely to language choice. Scope and fixture hash are frozen in the comparison plan before candidate measurements.
