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
