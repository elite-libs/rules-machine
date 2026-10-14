# Final Rust compatibility and performance evidence

Final primary candidate: TS runtime `d4a88ea`, built artifact SHA-256 `2ee464b289edc23e3cc124e290081081db404d32c759d4938d1af639e20075e1`; Rust release source `de6ca7f`; bounded persistent bridge raw-envelope source `d532ef5`. Node26.8.2, rustc1.99.0/LLVM23.1.1, Linux x64, i7-7700K,8logicalCPUs. Node24 was unavailable. Local execution only; external compute/API cost $0. CPU utilization was not sampled.

## Exact arms and timing boundaries

* Baseline: exact original `ee300ad` source, dependencies and original build, `/tmp/rules-machine-baseline/dist/index.js`.
* Upgrade: original source and identical original emitted artifact, resolving final external runtime dependencies (notably lodash4.18.1). Bundled old parser/build remain original. This arm does **not** isolate updated build tools or all bundled dependency patches.
* Tuned: final guarded TS runtime and final dependency tree/build. Runtime bytes match the separately measured prior comparison and bridge campaign.
* Native Rust: expanded compatible core, all seven unchanged frozen fixture slices. Native timing includes constructing fresh runtime input values, validation, execution and checked digest; request JSON parsing, process startup and preparation are outside this timer. TS includes structuredClone, execution and the same checked digest.
* Persistent bridge: parent tagged encode, bounded framing, pipe, worker execution, tagged result+mutated-input decode and digest versus direct TS clone/execute/digest. Prepared programs excluded from warm timing. Mutated input is returned as a copy, never written into the caller's object.

## Primary confirmation

Each warm campaign uses12 independent paired process blocks, all 7 frozen slices, cyclic balanced four-arm native ordering and alternating bridge ordering. Actual completion counters, weighted output digests and full untimed result/input oracles are checked. Skipped-work sentinels must fail. Hashing/reset costs are inside the stated boundaries. Bootstrap 10000 whole paired blocks; intervals are 95% within-campaign percentile intervals, per-slice intervals unadjusted for multiple comparisons.

| Comparison | Geometric throughput ratio [95% interval] |
| --- | --- |
| Upgrade / original | 0.99× [0.95, 1.03] |
| Final TS / original | 8.68× [8.23, 9.16] |
| Native Rust / original | 72.23× [69.78, 74.71] |
| Native Rust / final TS, same 7 slices | 8.32× [7.88, 8.78] |
| Persistent bridge / direct TS, same 7 slices | 0.29× [0.27, 0.31] |
| Final TS / prior security candidate7b073e3 | 0.72× [0.70, 0.74] |

The bridge loses despite the native advantage: about 3.44times the elapsed time overall. Payload and serialization costs matter. The final TS protection bundle also reduces throughput about 28% against the prior security-only candidate; it is not a free optimization.

The same unchanged TS module measured 10.18× versus original in the earlier pre-numeric campaign and 8.68× in final confirmation. Host/load/frequency/JIT variation across campaigns is wider than the within-campaign interval captures. CPU affinity/frequency were not pinned. No runs were repeated to seek a higher gain, and no samples were selected from earlier campaigns. The final preplanned whole 12-block run is primary.

| Fixture | Native TS µs/op | Native Rust µs/op | Bridge direct TS µs/op | Bridge µs/op |
| --- | ---: | ---: | ---: | ---: |
| eligibility | 51.44 | 2.39 | 44.54 | 152.45 |
| pricing-0 | 72.04 | 6.29 | 47.79 | 144.84 |
| pricing-1024 | 65.98 | 8.00 | 47.88 | 152.96 |
| pricing-32768 | 81.43 | 9.33 | 66.78 | 349.68 |
| array-map-16 | 117.89 | 11.48 | 72.90 | 231.99 |
| array-map-256 | 1006.70 | 230.99 | 592.15 | 2160.16 |
| array-map-4096 | 11717.40 | 3481.29 | 11631.89 | 35020.75 |

## Cold and retained-state diagnostics

Three independent parent processes each perform 10 paired alternating cold observations. Modules are already imported on both arms. TS factory+first evaluation median 0.438ms; new Rust worker+prepare+first evaluation median 2.260ms. These 30 observations are clustered by 3 parents; no independent-sample confidence claim is made.

Matched retention diagnostics run 3 independent processes per arm, 2000 unique programs, then 6 blocks of 500 calls with 64 KiB unused payload and 1000 small-input calls, with forced-GC/event-loop barriers. All values/counters pass; 0/40 sampled caller input objects remain live at the end of each process. Rust syntax cache plateaus at 128 entries / 1802 source bytes; retainedInputs=0 by implementation statistics. TS cache churn reaches 512 entries, with post-GC parent heap about 6.49MB after 2000 unique expressions and 6.56MB after 4000 input calls. Bridge parent heap is about 6.20MB and 6.34MB respectively; Rust child RSS stays about 3.38–3.40MB after large inputs. Parent RSS remains higher for bridge (108–109 MB final) than direct TS (77.6–78.6 MB). This finite diagnostic supports bounded syntax/input retention under this workload, not a universal leak or low-memory guarantee. Raw per-block RSS/heap/HWM snapshots are retained.

## Correctness scope and rejected domains

Shared machine-readable spec plus 240 deterministically generated programs across 12 families: 419/419 differential/rejection cases. Broad numeric/domain grid: 10478/10478 cases match TS or assert an explicitly declared Rust rejection. Rust 21 tests (20 integration + 1 DAG unit), bridge 15 tests.35/97 named functions are supported in exact declared domains; 62 unknown named calls reject during preparation. [Spec](../../spec.json), [coverage](correctness-final-frozen/coverage.md), and crate README list domains.

Null and missing/undefined stay distinct through collision-free tagged wire, unary negatives and case-insensitive constants/operators work, nested sequence result arrays and returns propagate, recursive structural conditions/all 5 array rules/try-catch are covered. General finite exponentiation is explicitly restricted to power-of-two bases/integer exponents (with JS special cases): Rust libm differed from V8 by last-bit rounding in 56 deterministic random probes. SORT rejects NaN/nonnumeric elements; COUNT_KEYS is object-only; non-ASCII INDEX is restricted. Unsupported functions, tracing, atomic/read-only options and TSbudget parity remain explicit gaps. No full-language replacement, synchronous sandbox or option/resource parity is claimed.

Prototype guards bound 100 path segments, 100000 array elements, syntax/nodes/evaluation steps, 128 cached programs / 1 MiB source, tagged depth 40, 8 MiB request/result frames, 128 pending requests / 16 MiB queued requests. Internal alias-DAG cycle traversal memoizes completed nodes and keeps active-cycle/depth rejection. These independently chosen limits do not replace process isolation or OS memory limits.

## Mechanism and profiles

The retained context-ablation changes only internal callback context insertion: previously every item rescanned its already-validated `$array` reference. Six balanced process pairs show about 1.10× at 16 items, 3.14× at 256 and 33.57× at 4096, consistent with removing quadratic rescans. This causal diagnostic predates final numeric/resource fixes; final whole-campaign evidence above is authoritative. Linux perf was unavailable, so no native sampled profile is claimed.

Separate final TS Node CPU profiles: pricing spends 25.5% self samples in `validateRule` structural preflight `visit` (`src/structural-engine/executor.ts:615`, emitted `dist/index.mjs:3821`), 10.2% in `writeData`, 8.3% in structuredClone; map4096 spends 21.3% in `runItem`, 14.2% in `handleRule`, 8.8% in `termDelegate`. Profiles include admission/reset/digest as implemented and are diagnostic, not acceptance timing. They locate protection/context/materialization costs without attributing the entire prior regression to one function.

## Retained evidence classification

* `native-confirmation`, `bridge-confirmation`: final primary 12-block campaigns.
* `prior`: matched final TS versus prior 7b073e3, 12 blocks; exact final TS module hash matches.
* `native-pre-context`, `native-final`: complete earlier screening campaigns; pre-context and pre-numeric candidates respectively. Historical `native-final` name does not designate final acceptance. The pre-context command's rustSource placeholder resolves to source c6439e7 via retained binary hash.
* `native-numeric-before-index-boundary`, `native-before-dag-memo`: interrupted partial campaigns retained in full; excluded from all final inference.
* `numeric-grid-development`, `numeric-grid-domain`, `correctness-signed-zero-probe`: failing development evidence; later directories retain corrected-source gates.
* `bridge-final-tests.txt`: sandbox file-level test-launch failure; successful escalated 15-test gates retained separately. No failure is silently discarded.
* `profiles`: separate final TS CPUprofiles, checked worker output and aggregated self-sample summary.
* `provenance.json`, campaign `environment.json`: source IDs, module/binary hashes, effective dependency and lock identities, exact commands and instrument/fixture hashes.

Old comparison fixtures and historical 2026-10-14-security evidence are unchanged. No publication, remote service, or paid computation was used.
