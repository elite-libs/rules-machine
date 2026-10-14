# Prepared end-to-end crossover sweep

This separate instrument asks whether RustBridge catches the upgraded TypeScript engine for these local workloads. It does not infer a universal crossover from bytes, rule count, or nesting. No native-only measurement appears here.

Fifteen slices are fixed before timing:

- Sequential `x += 1` rules: 1, 4, 16, 64, 256, 1024, followed by return x; tiny `{x:0,payload:''}` input.
- True conditional layers: 0, 4, 16, 32, followed by return 1; unchanged tiny input. These use direct `then: nextObject` chains. An additional 32-layer `then: [nextObject]` chain records the public bridge depth boundary.
- Payload bytes: 0, 1024, 32768, 262144, with 256 increment rules and return x. The zero-byte slice deliberately duplicates the rule-axis anchor as a reproducibility check.

The 32-layer array-chain slice exceeds the public bridge's rule-data wire depth40 validation. Its expected depth rejection is recorded as unsupported, without bypassing the bridge or assigning a timing. The direct object-chain 32-layer slice fits. Other unexpected errors fail the run.

Each arm owns a fresh parent Node process per paired block; the Rust arm also owns its worker. Twelve independent paired blocks alternate TS-first/Rust-first. Within a process slices retain fixed order. Both engines prepare once per slice, verify the complete result and mutated input against an independent mathematical oracle, then perform three warm executions. TS clones caller input once, then returns the already owned mutated input and scalar result without an additional output clone; RustBridge includes encode, framing, transport, execution, response parsing and decoding. Preparation, startup, warmup, and initial/final deep output assertions are excluded from timing.

Timed work includes a complete deterministic canonical JSON checksum (record keys sorted) of every result and mutated input, including every payload character, in both arms. The measured checksum sum must equal the expected oracle digest times the actual iteration count. Full deep equality checks before and after timing supplement this digest. The common checksum adds consumer work, especially for large payloads; results describe this explicit consumption contract, and absolute timings must not be compared with the earlier benchmark cohort. Counts and digests are retained per block. No early return, skipped iteration, or output sampling is allowed.

A separate TS baseline pilot doubles iterations until at least 20 ms or a cap of 2048. Its counts are then fixed for both arms and all blocks. Pilot timings are not evidence. Each phase records Node executable/version and SHA256 hashes of the exact module and Rust binary. Do not reuse pilot counts after a build changes. Reports retain payload bytes, serialized rule bytes, tagged input bytes, representative run request bytes, expression count and structural depth, actual JSON container depth, rule-node count (including sequence arrays), and constructed chain shape. Request IDs can change actual frame size by a few decimal bytes. Structural depth records conditional count plus one. JSON container depth counts root array as one and every nested object/array; scalar leaves add no level. The 32-layer object chain has JSON depth34 and 34 rule nodes; the array chain has depth66 and 66 rule nodes. Rust request bytes are used in summaries.

Run only after the coordinator releases the CPU window, with final built module and binary paths:

```sh
node performance/crossover/run.mjs oracle dist/index.mjs experiments/rusty-rules/target/release/rusty-rules-experiment performance/crossover/results
node performance/crossover/run.mjs pilot dist/index.mjs experiments/rusty-rules/target/release/rusty-rules-experiment performance/crossover/results
node performance/crossover/run.mjs confirm dist/index.mjs experiments/rusty-rules/target/release/rusty-rules-experiment performance/crossover/results
node performance/crossover/summarize.mjs performance/crossover/results
```

Oracle mode executes four warm/preflight plus one final execution per supported slice and arm, with no timing loop. Syntax and fixture-only tests can run while confirmation timing is held:

```sh
node --test performance/crossover/fixtures.test.mjs
```

Summaries show geometric mean paired Rust/TS ratios, a deterministic paired-block bootstrap 95% interval, raw arm mean times per operation, and the count of blocks favoring Rust. Values below one favor Rust. These intervals describe between-process variation for this run, not deployment-wide uncertainty. Preserve raw blocks and exact Node/source/build provenance with any reported conclusion; do not combine pilot or native results with this sweep.
