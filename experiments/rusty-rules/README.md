# Experimental Rust core and persistent Node bridge

This crate implements an experimental subset of the TypeScript engine. It is a repository experiment, separate from the published npm API. Use the [coverage matrix](../../performance/rust-gaps/spec.json) to check whether your rules are supported before choosing it. The worker does not execute JavaScript or host callbacks.

The Node bridge owns one persistent child process. It serializes inputs and returns copies; TypeScript input mutation and cross-process object identity do not carry over. Native throughput measurements do not describe bridge performance.

## Install from crates.io

[`rusty-rules-experiment` 0.1.1](https://crates.io/crates/rusty-rules-experiment/0.1.1) is available on crates.io.

```sh
cargo add rusty-rules-experiment@0.1.1
cargo install rusty-rules-experiment --version 0.1.1 --locked
```

The crate includes the Rust library and worker binary. The Node bridge remains in this repository; see [crate usage](CRATE_README.md) for a Rust API example.

## Build and validate

Run from the repository root with Node.js 24+, the repository's pnpm dependencies, and Rust installed. The recorded security qualification used Rust 1.99.0. Offline Cargo commands require dependencies to be present in your local Cargo cache.

```sh
cargo test --offline --manifest-path experiments/rusty-rules/Cargo.toml
cargo build --offline --release --manifest-path experiments/rusty-rules/Cargo.toml
node --test experiments/rusty-rules/bridge.test.mjs
pnpm build
node performance/rust-gaps/differential.mjs ./dist/index.mjs
```

## Use the persistent bridge

After the release build, run this example from the repository root:

```js
import { RustBridge } from './experiments/rusty-rules/bridge.mjs';
const bridge = new RustBridge({ binary: './experiments/rusty-rules/target/release/rusty-rules-experiment' });
try {
  const program = await bridge.prepare([
    { map: 'items', run: '$item * 2', set: 'out' },
    { return: 'out' },
  ]);
  const { result, input } = await bridge.run(program, { items: [1, 2] });
  // result is [2, 4]; input is { items: [1, 2], out: [2, 4] }.
  await bridge.release(program);
} finally {
  await bridge.close();
}
```

`prepare`, `run`, `execute`, `release`, `stats` and `close` are instance methods. `run`/`execute` accept `{ signal, timeoutMs, options: { ignoreMissingKeys } }`. Rule failures reject only the request and leave the worker usable. Submitted cancellation or deadline terminates the owned worker with SIGKILL, rejects all pending requests and removes timers/listeners; create a new instance explicitly to continue. A pre-aborted request is rejected without terminating a healthy worker. `close()` is idempotent and waits for child termination. The bridge does not restart implicitly or create more workers. The caller's input is never modified; returned result/input are data tree copies, and cross-process reference identity is not preserved.

## Resource and failure contract

The JSON-line protocol correlates integer request IDs. Output is flushed per response; unknown IDs, malformed responses, worker exit, oversized frames and spawn/write errors fail pending work. Limits: 128 pending requests, 16 MiB queued request bytes, 8 MiB request/response frames, and a configurable 5-second default deadline measured from submission. Node stream writes remain ordered, with queue byte/pending bounds applying backpressure before additional writes. Prepared programs use FIFO eviction at 128 entries or 1 MiB total source JSON. `run` after eviction rejects; call `prepare` again. Cached entries contain program syntax only, with no retained input/result objects. Programs have at most 10,000 structural nodes, depth 100; expressions at most 100,000 UTF-8 bytes, 4,096 tokens, depth 100; evaluation has a one-million-step guard. These are prototype-specific bounds rather than a promise of identical TypeScript budgeting.

The security follow-up requires positive safe-integer request IDs and validates structured worker errors without coercion. Zero `Session.cache_limit` rejects preparation. The one-million cooperative work guard now includes native collection slots/copies/scans, string copying and processing, cycle scans, and conservative sort work, charged before bulk allocation. Resource exhaustion stays sticky and bypasses rule catches. Previously accepted heavy requests may now reject; these limits are independent of TypeScript and are not a strict heap/CPU cap. Direct execution compilation remains bounded by frame and per-expression/program syntax limits. The legacy benchmark mode accepts caller-selected repeated iterations and requires caller-owned process cancellation.

## Transport and data model

Tagged-v1 encodes every value as a tuple, so ordinary objects resembling sentinels never collide. Tags are `undefined`, `null`, `boolean`, `number`, `string`, `array` and `object`; object payloads are key/value pair lists, preserving own undefined separately from absent keys. Numbers additionally encode `NaN`, infinities and negative zero. Transport accepts depth 40 trees with plain own enumerable data properties and dense arrays. Cycles, sparse arrays, accessors, symbols, functions, BigInt, host objects and lone UTF-16 surrogates reject. Shared reference aliases serialize as copies. Cyclic writes are rejected before mutation to prevent reference-count cycles retaining values in a persistent process.

## Supported language

Implemented core: finite/nonfinite numeric arithmetic, unary negative/NOT, primitive and reference equality inside the worker, numeric/string relational comparison, case-insensitive built-in constants/operators/functions, dotted data lookup, literal bracket assignment targets, simple/numeric-compound/nullish assignment, nested sequence result arrays, nested pipeline returns, recursive structural and/or, if/then/else, all map/filter/every/some/find operations and try/catch. Returns inside array callbacks remain local to each item. Callback context fields restore on success/error. Strings follow the upstream parser's verbatim-next-character escape convention rather than JSON string-literal unescaping.

Supported parenthesized functions are enumerated by `arity()` in src/lib.rs and machine-readable coverage: numeric ABS/NEG/NOT/FLOOR/CEIL/ROUND/SQRT/ISNAN/ADD/SUB/MUL/DIV/MOD; LENGTH/COUNT_KEYS/MIN/MAX; SORT/REVERSE/HEAD/TAIL/LAST; RANGE/INDEX/TAKE/DROP/SLICE/CONCAT/CONS/CONTAINS/INCLUDES/REMOVE_VALUES; and STRING_CONTAINS/STRING_STARTS_WITH/STRING_ENDS_WITH. Other calls reject during preparation, including date functions, higher-order functions, dynamic callbacks and object helper functions. Parenthesized calls are required. Bracket expression reads, non-ASCII string INDEX, sparse writes/length growth, object relational coercion and non-ASCII bare identifier paths are unsupported. No tracing or error-message/type parity is promised. Entire supported program syntax is compiled before input mutation; unsupported syntax in an unreachable branch still rejects, unlike lazy TypeScript parsing.

## CLI and response encoding

The original CLI benchmark mode remains available: one JSON line `{ rules, inputs, iterations, warmup }`, optionally `--once`, returns outputs/mutated inputs, elapsedNs, actual operation count and checked digest. Its ordinary JSON output necessarily omits undefined object fields and maps nonfinite/undefined array values to null, as JavaScript JSON.stringify does. Use tagged persistent commands when those distinctions matter. The scalar/array digest for the frozen benchmark cases is unchanged; measured loops still reset input and consume every result. Performance claims require fresh final-source confirmation; earlier reports remain historical and unchanged.

Output expansion is bounded during recursive encoding using a conservative 8 MiB response budget shared across result and input. This can reject some data below the raw byte frame limit when worst-case escaping estimates exceed the budget; it prevents alias-expanded output from allocating an arbitrarily large response before framing checks. Ordinary legacy benchmark output has an aggregate frame budget as well. The same scalar/array digest is preserved for historical frozen fixtures; new null/undefined/object results use additional digest cases outside those historical fixtures.

MIN/MAX preserve JavaScript signed-zero tie behavior. SORT supports finite numbers and infinities, retaining stable equal ordering, but explicitly rejects NaN elements: the comparator is non-transitive there, so different standard-library sorting algorithms cannot promise the same sequence. The public Rust `Program::execute` API expects acyclic data trees produced by `Value::from_json` or `Value::from_wire`; arbitrary external Rc graphs are outside this transport/core contract. Unsupported execution options (including atomic, readonly and TypeScript budget knobs) reject instead of being ignored; the bridge uses its documented independent resource limits.

## Exact function argument domains

| Function | Accepted domain |
| --- | --- |
| ABS | Strict numeric arguments, including NaN and infinities. |
| NEG | Strict numeric arguments, including NaN and infinities. |
| NOT | Any supported tagged value; JS truthiness. |
| FLOOR | Strict numeric arguments, including NaN and infinities. |
| CEIL | Strict numeric arguments, including NaN and infinities. |
| ROUND | Strict numeric arguments, including NaN and infinities. |
| SQRT | Strict numeric arguments, including NaN and infinities. |
| ISNAN | Strict numeric arguments, including NaN and infinities. |
| ADD | Strict numeric arguments, including NaN and infinities. |
| SUB | Strict numeric arguments, including NaN and infinities. |
| MUL | Strict numeric arguments, including NaN and infinities. |
| DIV | Strict numeric arguments, including NaN and infinities. |
| MOD | Strict numeric arguments, including NaN and infinities. |
| LENGTH | Array or string (UTF-16 length). |
| COUNT_KEYS | Object only; arrays and null reject. |
| MIN | Numeric scalar or numeric array; NaN propagates after validating every element; signed-zero ties match JS. |
| MAX | Numeric scalar or numeric array; NaN propagates after validating every element; signed-zero ties match JS. |
| SORT | Numeric array only; NaN or nonnumeric elements explicitly reject; stable ascending comparator. |
| REVERSE | Array only. |
| HEAD | Array only. |
| TAIL | Array only. |
| LAST | Array only. |
| RANGE | Finite safe-integer bounds; at most 100000 results. |
| INDEX | Array or ASCII string and numeric index; non-ASCII string valid-index access rejects. |
| TAKE | Numeric offsets; array or scalar wrapped into a singleton; JS integer truncation. |
| DROP | Numeric offsets; array or scalar wrapped into a singleton; JS integer truncation. |
| SLICE | Numeric offsets; array or scalar wrapped into a singleton; JS integer truncation. |
| CONCAT | Two arrays; combined result at most 100000 elements. |
| CONS | Any value and array; result at most 100000 elements. |
| CONTAINS | Each argument accepts any supported value; scalars wrap to singleton arrays. First argument supplies matches, second supplies data. SameValueZero primitive matching; object identity within worker. |
| INCLUDES | Each argument accepts any supported value; scalars wrap to singleton arrays. First argument supplies matches, second supplies data. SameValueZero primitive matching; object identity within worker. |
| REMOVE_VALUES | Each argument accepts any supported value; scalars wrap to singleton arrays. First argument supplies matches, second supplies data. SameValueZero primitive matching; object identity within worker. |
| STRING_CONTAINS | Two strings. |
| STRING_STARTS_WITH | Two strings. |
| STRING_ENDS_WITH | Two strings. |

Power operator: Finite nonzero bases other than +/-1 must be powers of two and exponent integer; other finite domains explicitly reject. Nonfinite/zero/+/-1 special cases follow JS. General finite exponentiation remains outside the verified domain. Earlier random-power failures also changed input floats, so they did not isolate math implementation differences; exact JSON float roundtrip is now enabled. SORT rejects NaN and nonnumeric elements, including singleton arrays. Paths are limited to 100 segments; CONCAT/CONS results to 100000 elements.

## Verification and performance evidence

The [security review](../../docs/security-review/RESULTS.md) records 36 Rust tests, 20 bridge tests on each of Node 24 and 26, 419 shared differential cases, and 11,158 exact-or-declared-rejection numeric/domain probes. These checks cover the declared subset and include explicit rejection cases; they do not establish full TypeScript parity. The [security cost report](../../docs/security-review/PERFORMANCE.md) contains fresh measurements for the stricter work guard.

Historical pre-security two-loop confirmation is retained in [the tuning report](../../performance/rust-tuning/results/report.md): native Rust was 10.63× [10.38, 10.90] the then-final TS throughput on the same seven frozen slices, while the persistent bridge was 0.300× [0.288, 0.312] direct TS throughput. The bridge was slower at its real process/serialization boundary. These within-campaign estimates use 12 paired blocks; cross-campaign variation and prototype scope prevent a general replacement claim. That source passed 27 Rust tests, 15 bridge tests, 419 shared differential/rejection cases, and 11,158 exact-or-declared-rejection numeric/domain probes. Cold preparation and matched long-lived TS/bridge retention diagnostics are included in that report. Its source was `91ef65e`; exact artifacts and instrument hashes are recorded with the evidence. The subsequent [security review](../../docs/security-review/RESULTS.md) changes work accounting and records fresh correctness and cost evidence; old timings do not qualify the new guard.

The earlier [127d762 gap-phase report](../../performance/rust-gaps/results/2026-10-14/report.md) remains confirmed pre-tuning baseline evidence. Two additional measured loops reduced callback allocations and prepared immutable path segments. Independent 12-block paired Rust confirmation measures 1.640× [1.590, 1.689] throughput versus that baseline. Earlier campaigns and all failed development probes remain retained; later workload-specific crossover experiments form a separate cohort and do not alter these seven frozen fixtures.
