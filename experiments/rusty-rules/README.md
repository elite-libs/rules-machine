# Experimental Rust core and persistent Node bridge

This local crate now implements a tested core of Rules Machine. It remains experimental, with a precise supported/rejected coverage matrix in `performance/rust-gaps/spec.json`; it is not a full-language replacement. No JavaScript eval, host callbacks, network calls or automatic paid capacity are used.

Build and validate locally:

```sh
mise exec rust@1.99.0 -- cargo test --offline --manifest-path experiments/rusty-rules/Cargo.toml
mise exec rust@1.99.0 -- cargo build --offline --release --manifest-path experiments/rusty-rules/Cargo.toml
node --test experiments/rusty-rules/bridge.test.mjs
node performance/rust-gaps/differential.mjs /absolute/typescript/dist/index.mjs
```

Use the persistent bridge by explicitly owning its lifecycle:

```js
import { RustBridge } from './experiments/rusty-rules/bridge.mjs';
const bridge = new RustBridge({ binary: '/absolute/rusty-rules-experiment' });
try {
  const program = await bridge.prepare([
    { map: 'items', run: '$item * 2', set: 'out' },
    { return: 'out' },
  ]);
  const { result, input } = await bridge.run(program, { items: [1, 2] });
  // result === [2, 4]; input is the mutated COPY in the worker.
  await bridge.release(program);
} finally {
  await bridge.close();
}
```

`prepare`, `run`, `execute`, `release`, `stats` and `close` are instance methods. `run`/`execute` accept `{ signal, timeoutMs, options: { ignoreMissingKeys } }`. Rule failures reject only the request and leave the worker usable. Submitted cancellation or deadline terminates the owned worker with SIGKILL, rejects all pending requests and removes timers/listeners; create a new instance explicitly to continue. A pre-aborted request is rejected without terminating a healthy worker. `close()` is idempotent and waits for child termination. The bridge does not restart implicitly or create more workers. The caller's input is never modified; returned result/input are data tree copies, and cross-process reference identity is not preserved.

The JSON-line protocol correlates integer request IDs. Output is flushed per response; unknown IDs, malformed responses, worker exit, oversized frames and spawn/write errors fail pending work. Limits: 128 pending requests, 16MiB queued request bytes, 8MiB request/response frames, and a configurable 5-second default deadline measured from submission. Node stream writes remain ordered, with queue byte/pending bounds applying backpressure before additional writes. Prepared programs use FIFO eviction at 128 entries or 1MiB total source JSON. `run` after eviction rejects; call `prepare` again. Cached entries contain program syntax only, with no retained input/result objects. Programs have at most 10,000 structural nodes, depth100; expressions at most100,000 UTF-8 bytes,4,096 tokens, depth100; evaluation has a one-million-step guard. These are prototype-specific bounds rather than a promise of identical TypeScript budgeting.

Tagged-v1 encodes EVERY value as a tuple, so ordinary objects resembling sentinels never collide. Tags are `undefined`, `null`, `boolean`, `number`, `string`, `array` and `object`; object payloads are key/value pair lists, preserving own undefined separately from absent keys. Numbers additionally encode `NaN`, infinities and negative zero. Transport accepts depth40 trees with plain own enumerable data properties and dense arrays. Cycles, sparse arrays, accessors, symbols, functions, BigInt, host objects and lone UTF-16 surrogates reject. Shared reference aliases serialize as copies. Cyclic writes are rejected before mutation to prevent reference-count cycles retaining values in a persistent process.

Implemented core: finite/nonfinite numeric arithmetic, unary negative/NOT, primitive and reference equality inside the worker, numeric/string relational comparison, case-insensitive built-in constants/operators/functions, dotted data lookup, literal bracket assignment targets, simple/numeric-compound/nullish assignment, nested sequence result arrays, nested pipeline returns, recursive structural and/or, if/then/else, all map/filter/every/some/find operations and try/catch. Returns inside array callbacks remain local to each item. Callback context fields restore on success/error. Strings follow the upstream parser's verbatim-next-character escape convention rather than JSON string-literal unescaping.

Supported parenthesized functions are enumerated by `arity()` in src/lib.rs and machine-readable coverage: numeric ABS/NEG/NOT/FLOOR/CEIL/ROUND/SQRT/ISNAN/ADD/SUB/MUL/DIV/MOD; LENGTH/COUNT_KEYS/MIN/MAX; SORT/REVERSE/HEAD/TAIL/LAST; RANGE/INDEX/TAKE/DROP/SLICE/CONCAT/CONS/CONTAINS/INCLUDES/REMOVE_VALUES; and STRING_CONTAINS/STRING_STARTS_WITH/STRING_ENDS_WITH. Other calls reject during preparation, including date functions, higher-order functions, dynamic callbacks and object helper functions. Parenthesized calls are required. Bracket expression reads, non-ASCII string INDEX, sparse writes/length growth, object relational coercion and non-ASCII bare identifier paths are unsupported. No tracing or error-message/type parity is promised. Entire supported program syntax is compiled before input mutation; unsupported syntax in an unreachable branch still rejects, unlike lazy TypeScript parsing.

The original CLI benchmark mode remains available: one JSON line `{ rules, inputs, iterations, warmup }`, optionally `--once`, returns outputs/mutated inputs, elapsedNs, actual operation count and checked digest. Its ordinary JSON output necessarily omits undefined object fields and maps nonfinite/undefined array values to null, as JavaScript JSON.stringify does. Use tagged persistent commands when those distinctions matter. The scalar/array digest for the frozen benchmark cases is unchanged; measured loops still reset input and consume every result. Performance claims require fresh final-source confirmation; earlier reports remain historical and unchanged.

Output expansion is bounded during recursive encoding using a conservative 8MiB response budget shared across result and input. This can reject some data below the raw byte frame limit when worst-case escaping estimates exceed the budget; it prevents alias-expanded output from allocating an arbitrarily large response before framing checks. Ordinary legacy benchmark output has an aggregate frame budget as well. The same scalar/array digest is preserved for historical frozen fixtures; new null/undefined/object results use additional digest cases outside those historical fixtures.

MIN/MAX preserve JavaScript signed-zero tie behavior. SORT supports finite numbers and infinities, retaining stable equal ordering, but explicitly rejects NaN elements: the comparator is non-transitive there, so different standard-library sorting algorithms cannot promise the same sequence. The public Rust `Program::execute` API expects acyclic data trees produced by `Value::from_json` or `Value::from_wire`; arbitrary external Rc graphs are outside this transport/core contract. Unsupported execution options (including atomic, readonly and TypeScript budget knobs) reject instead of being ignored; the bridge uses its documented independent resource limits.

### Exact function argument domains

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

Final local confirmation is retained in [the gap-phase report](../../performance/rust-gaps/results/2026-10-14/report.md): native Rust is 6.63× [6.40, 6.85] the final TS throughput on the same seven frozen slices, while the persistent bridge is 0.281× [0.272, 0.291] direct TS throughput. The bridge is therefore slower at its real process/serialization boundary. These within-campaign estimates use 12 paired blocks; cross-campaign variation and prototype scope prevent a general replacement claim. Final source gates: 24 Rust tests, 15 bridge tests, 419 shared differential/rejection cases, and 11,158 exact-or-declared-rejection numeric/domain probes. Cold preparation and matched long-lived TS/bridge retention diagnostics are included in that report. The source is `127d762`; exact artifacts and instrument hashes are recorded with the evidence.
