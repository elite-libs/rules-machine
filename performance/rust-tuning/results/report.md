# Final two-loop Rust tuning report

Final Rust source `91ef65e`; reviewed pre-tuning baseline `127d762`; TS runtime `d4a88ea` with unchanged module SHA256 `2ee464b289edc23e3cc124e290081081db404d32c759d4938d1af639e20075e1`. Final Rust CLI SHA256 `149a9bcda421ee1645eaddf9869cd93553d5942718be493f94f7e73c3d57971d`. Node 26.8.2, rustc1.99.0/LLVM23.1.1, Linux x64 i7-7700K, 8 logical CPUs. Only Node 26 performance is measured; Node 24.21.0 correctness/package checks are qualified separately. No paid remote compute; model/reporting costs unavailable. CPU utilization was not sampled.

## Frozen contract and acceptance

Two additional tuning loops were requested after the separately confirmed context-cycle ablation and exact-power compatibility phase. All seven original fixture/oracle/digest bytes stayed frozen. Independent architect source review approved combined source before timing. Final gates:27 Rust tests (25 integration + 2 unit), 15 bridge tests, 419 shared cases / 279 unique programs, 11158 numeric/domain probes. No bound, cycle check, scope semantics, input validation or output preflight was removed. General function/option/budget parity remains outside the Rust core contract.

Each loop has a separate allocation-count diagnostic and six independent paired Rust-process screening blocks. The counting allocator exists only in the example binary, never in measured CLI. The final combined candidate then passes a predeclared independent 12-block paired baseline-Rust comparison requiring at least 5% whole-suite point gain and 95% interval lower>1. Native four-arm and bridge campaigns each receive their own fresh 12-block confirmation. Cyclic/alternating order balances positions. Actual completion counters, weighted digest, full untimed result/input oracles and skipped-work sentinels gate useful work. Bootstrap 10000 whole paired blocks; per-slice intervals unadjusted for multiple comparisons.

## Loop 1: callback allocation

Source 79e61d2 replaces a per-item saved Vec with stack slots, saves prior context values from BTreeMap insertion rather than duplicate lookups, reads each current item directly without formatting/parsing an index string, and obtains array length without cloning all elements. Borrows end before callback execution; nested/error restoration occurs before propagating failure. Captured length and current-item mutation behavior are retained, with explicit regressions.

Six-block screening: whole suite **1.057× [1.011, 1.098]**; scalar **1.010× [0.966, 1.069]**; array aggregate **1.122× [0.996, 1.265]**. The array aggregate interval includes 1, so this screen does not establish a significant aggregate-array latency gain. The fixed whole-suite interval exceeds 1 and deterministic allocation reduction supports retaining the candidate provisionally for independent combined confirmation.

## Loop 2: prepared expression paths

Source 91ef65e stores validated immutable path segments in the prepared AST, avoiding per-term char/segment allocations and parsing. Raw own-key precedence is retained before segment traversal. Each execution reads its current input; no resolved value or input reference is cached. Compile-time unsafe-path/segment limits remain. Fresh-input, exact-dotted-key and strict-missing regressions pass.

Six-block incremental screening versus loop1: whole suite **1.538× [1.506, 1.574]**; arrays **1.457× [1.418, 1.498]**; scalar **1.601× [1.543, 1.674]**. All seven individual slice intervals exceed 1. This is screening evidence; final acceptance follows the independent combined comparison below.

| Fixture | Baseline allocations/op | Loop 1 | Loop 2 combined | Baseline requested bytes/op | Combined |
| --- | ---: | ---: | ---: | ---: | ---: |
| eligibility | 35.31 | 35.31 | 20.31 | 2014 | 1308 |
| pricing-0 | 77.00 | 77.00 | 42.00 | 4592 | 2780 |
| pricing-1024 | 78.00 | 78.00 | 43.00 | 5616 | 3804 |
| pricing-32768 | 78.00 | 78.00 | 43.00 | 37360 | 35548 |
| array-map-16 | 149.00 | 116.00 | 65.00 | 7165 | 2639 |
| array-map-256 | 2069.00 | 1556.00 | 785.00 | 94441 | 23999 |
| array-map-4096 | 32789.00 | 24596.00 | 12305.00 | 1495297 | 365759 |

At 4096 items, loop 1 removes 8193 allocations/op (2N+1), then loop 2 removes 12291 (3N+3). Combined allocation count falls 62.5% and cumulative requested bytes 75.5%. Requested bytes include realloc traffic and are not peak/retained memory. Preparation stores more syntax metadata; cold/cache/memory diagnostics below expose that tradeoff.

## Independent confirmation and final deployment boundary

| Comparison | Geometric throughput ratio [95% interval] |
| --- | --- |
| Combined Rust / Rust 127d762, 12 paired blocks | **1.640× [1.590, 1.689]** |
| Combined / baseline Rust, arrays | 1.679× [1.612, 1.739] |
| Combined / baseline Rust, scalar | 1.612× [1.540, 1.679] |
| Final TS / exact original ee300ad | 9.885× [9.737, 10.033] |
| Original artifact + final external dependencies / original | 0.993× [0.977, 1.008] |
| Final native Rust / original | 105.092× [102.222, 107.689] |
| Final native Rust / final TS, same 7 slices | **10.632× [10.385, 10.898]** |
| Persistent bridge / direct TS, same 7 slices | **0.300× [0.288, 0.312]** |

The independent paired Rust comparison directly attributes a 64.0% throughput improvement to the combined tuning bundle under the same campaign, satisfying the predeclared gate. It does not assign the entire final gain to either component in isolation. The bridge still takes about 3.34 times direct TS elapsed time overall; native gains do not cancel encoding/framing/pipe/decode cost.

Exact native arm semantics: baseline is original ee300ad source, original emitted artifact and original dependency tree. Upgrade is that identical original artifact resolving final external runtime dependencies, notably lodash 4.18.1; it does not isolate build-tool or bundled-parser upgrades. Final TS uses final guarded runtime/dependency/build. Native Rust timing includes fresh Value construction, input validation, execution and checked digest, with JSON parse/process startup/preparation excluded. TS includes structuredClone/evaluate/digest. Bridge includes parent tagged encode, bounded framing, pipes, worker execution, returned result+mutated-input decode and digest; its direct TS comparison uses one clone/evaluate/digest.

| Fixture | Native final TS µs/op | Native Rust µs/op | Bridge direct TS µs/op | Persistent bridge µs/op |
| --- | ---: | ---: | ---: | ---: |
| eligibility | 25.80 | 1.14 | 23.89 | 79.81 |
| pricing-0 | 35.93 | 2.82 | 34.31 | 91.96 |
| pricing-1024 | 38.59 | 2.78 | 28.43 | 97.34 |
| pricing-32768 | 48.59 | 4.26 | 45.70 | 224.46 |
| array-map-16 | 66.45 | 5.71 | 52.43 | 143.45 |
| array-map-256 | 621.24 | 82.68 | 379.30 | 1295.79 |
| array-map-4096 | 7541.14 | 1356.05 | 10215.76 | 24871.51 |

## Cold, cache and retained-input diagnostics

Three independent parent processes each perform 10 paired alternating cold observations, with modules already imported. TS factory+first evaluation median 0.419 ms; new Rust worker+prepare+first evaluation median 2.052 ms. No independent-sample confidence interval is claimed for these 30 clustered observations.

Matched retention uses 3 independent processes per arm: 2000 unique programs, then 6 blocks × 500 calls with 64 KiB unused payload, followed by 1000 small calls. Forced-GC/event-loop snapshots show 0/40 sampled caller inputs alive at the end of every process; all output/counter gates pass. Rust cache plateaus at 128 programs / 1802 source bytes, retainedInputs=0 by implementation statistics. TS factory's512entry bound is an implementation property, not exposed stats from this retention probe. Final post-GC Node heap is about 6.34 MB for bridge parent and 6.56 MB for TS; final child RSS 3.35–3.49 MB, parent RSS 109–110 MB versus TS 77.6–78.4 MB. The finite probe supports bounded cache/input retention here, not absence of every leak or a universal memory advantage. Extra prepared path metadata is syntax only.

## Scope, provenance and historical evidence

The core supports 35/97 named functions in exact declared domains; 62 unknown named calls reject. Null/missing/undefined tagged transport, unary negative, case-insensitive constants/operators, nested sequences/returns, recursive conditions, all five array rules and try/catch are covered. Full tracing, arbitrary JS objects/functions, all library functions, TSoptions/atomic/budget parity and excluded syntax remain gaps. See [exact domains](../../rust-gaps/spec.json) and [crate contract](../../../experiments/rusty-rules/README.md).

Finite general power remains explicitly outside the verified domain; exact significand bits identify accepted binary powers including subnormals, and serde_json float_roundtrip preserves adjacent numbers. Earlier 56 random-power failures also changed input floats; they did not isolate libm/V8 differences. No unconfounded general math-implementation claim is made.

The final TS module is byte-identical to the separately paired prior-security comparison and TS CPU profiles. Required protection bundle versus prior 7b073e3 remains 0.720× [0.700, 0.740] throughput; this regression is retained. Earlier unchanged TS campaigns varied between 8.68× and 10.18× versus original, while this final run is 9.885×. Within-campaign bootstrap intervals do not capture host/load/frequency/JIT variation across campaigns; affinity/frequency were not pinned. Source changes drove planned reruns, and no previous samples were selected for final inference.

`loop1-*` and `loop2-*` retain complete screening/gates/allocation diagnostics. `combined-confirmation` is independent 12-block tuning confirmation; `final-native` and`final-bridge` are fresh primary final boundary confirmations. Immutable binary/source hashes and actual commands are in environment/provenance files. A derived-analysis canned uncertainty sentence in combined-confirmation incorrectly said screening despite correct 12-block environment classification; only prose was corrected, with original analysis/stdout retained and no numerical/raw change.

The [prior gap-phase 127d762 report](../../rust-gaps/results/2026-10-14/report.md) remains confirmed pre-tuning baseline evidence, including all earlier interrupted/development failures and separate TS profiles/context-ablation. Original security reports and seven fixtures remain unchanged. No paid remote computation was used; model/reporting costs unavailable.
