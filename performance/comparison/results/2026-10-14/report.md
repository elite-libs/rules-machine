# Local comparison

2026-10-14T00:09:13.404Z; v26.8.2; Intel(R) Core(TM) i7-7700K CPU @ 4.20GHz. 12 independent process blocks. Includes input cloning/reset.

| Fixture | Current µs/op | Upgrade-only µs/op | Tuned µs/op | Tuned speedup [95% interval] | Rust µs/op | Rust speedup [95% interval] |
|---|---:|---:|---:|---|---:|---|
| eligibility | 194.41 | 201.81 | 17.17 | 11.59× [10.66, 12.67] | 1.52 | 106.92× [87.67, 128.61] |
| pricing-0 | 397.68 | 399.01 | 27.12 | 13.57× [12.91, 14.25] | 3.71 | 89.01× [77.44, 100.48] |
| pricing-1024 | 393.29 | 381.07 | 30.47 | 12.97× [11.48, 14.43] | 4.11 | 77.85× [62.63, 93.46] |
| pricing-32768 | 431.84 | 426.50 | 39.63 | 11.28× [10.31, 12.39] | 11.73 | 35.95× [32.72, 40.12] |
| array-map-16 | 619.50 | 617.07 | 62.77 | 9.84× [9.26, 10.49] | unsupported | — |
| array-map-256 | 8879.33 | 9112.87 | 488.78 | 19.40× [17.43, 21.37] | unsupported | — |
| array-map-4096 | 116255.47 | 125793.00 | 5577.22 | 20.27× [18.95, 21.50] | unsupported | — |

Upgrade-only aggregate: 1.00× [0.98, 1.02] across 7 slices.

Tuned aggregate: 13.67× [13.27, 14.06] across 7 slices. Rust aggregate: 71.84× [64.17, 79.64] across 4 shared slices. These aggregates cover different scopes. Paired Rust over tuned on the same four shared slices: 5.83× [5.06, 6.65].

Native Rust is a restricted clean-rebuild prototype. The result does not measure a production JavaScript bridge or prove a language-only effect. Cold complete-batch boundary timings and all raw samples are in analysis.json/raw.json; boundary includes warmup and validation, so it is not a per-request IPC number.

The useful outcome is a confirmed improvement for reused programs with fresh JSON inputs. Keep the integrated TypeScript candidate; retain Rust as an experimental restricted interpreter. The upgraded dependency/tool tree alone shows no supported speed difference. All seven tuned slices comfortably exceed the provisional 15% minimum meaningful improvement and the 10% per-slice regression guard. The aggregate weights synthetic slices equally; it is not a traffic-weighted business forecast.

Measurements used baseline source `ee300ad`, integrated runtime source `79c23b6`, and Rust source `4bcf91f` compiled in release mode with rustc 1.99.0. [environment.json](environment.json) records executable/module and harness hashes, fixture hash, actual Node version, CPU/OS and command. [provenance.json](provenance.json) records dependency versions, original/patched parser hashes, package/lock hashes and compiler identity. Baseline and upgrade-only built JavaScript hashes match because their runtime source is identical; their external parser implementations differ by the recorded null guard patch.

Every process used the same frozen fixture bytes and independent hand-derived business oracle. The harness checked exact first-pass results and ordinary input mutations, actual timed completion increments and an oracle-derived output digest after every batch. Array state comparison removes only the three reserved context fields leaked by the original executor; their corrected cleanup behavior is explicitly different and covered by separate structural tests. All intentionally skipped-first-operation sentinels failed as required before the pilot. All 12 confirmation blocks were retained; no failures or outliers were discarded. The coordinator separately reported all 367 tests, typecheck, lint and packed ESM/CJS/IIFE/declaration smoke checks passing for the integrated candidate.

Intervals use deterministic 10,000-resample percentile bootstrap of whole paired process blocks. Per-slice intervals are not adjusted for multiple comparisons. The paired geometric speedups will not exactly equal ratios of the tabulated marginal medians. Absolute host performance drifted: early eligibility baseline processes were around 328µs/op, later ones around 190µs/op. The host used a powersave governor; a load snapshot was 9.01 and cgroup CPU limits were unavailable through the sandbox paths. Balanced cyclic order reduces order bias; it does not establish an exclusive host or eliminate drift. Spread and raw chronology remain visible in [raw.json](raw.json) and [analysis.json](analysis.json).

Separate diagnostics, not confirmation: 1,000 cold factory creations plus one evaluation each, across three independent Node processes per arm, had median 54.19µs/op current, 55.01µs/op upgrade-only and 55.58µs/op tuned. Observed ranges overlap (current 48.59–55.35, upgrade 51.29–56.49, tuned 50.32–58.72µs/op). These data support no cold-factory gain. The shared steady-state gain depends on factory/program reuse.

A targeted unique-expression memory diagnostic used one process per Node arm, a single mutable rule program and explicit full GC after 0/1,000/5,000/10,000 unique sources. Tuned retained heap was 4.80/5.46/5.46/5.49MiB; current was 4.80/5.18/5.14/5.16MiB. This supports bounded syntax retention in this probe, consistent with the 512-entry cache; it does not prove general absence of leaks. Tuned RSS rose from 59.68 to 79.00MiB (current 59.74 to 69.39MiB). RSS is not a peak and allocator behavior differs from retained live heap. Raw snapshots and the exact diagnostic boundary are in [diagnostics.json](diagnostics.json). Cross-language memory, long-lived concurrency and worst-case large-expression retention remain unmeasured.

Separate V8 CPU profiles in [profiles](profiles) used pricing-0, 100 baseline iterations versus 1,200 tuned iterations, with warmups 10 and 20 respectively. Their wall times are not acceptance samples. Baseline self samples were concentrated in parser/language table setup, case conversion and tokenization. Those setup frames disappear from the candidate's dominant samples. Candidate self samples include the disabled-tracing wrapper (~19.0%), safe property writes (~12.0%), structured cloning (~11.7% combined), input validation (~6.9%) and variable resolution (~6.1%). These are remaining opportunities, not evidence that another untested patch should be included. The full candidate also contains semantic/security fixes, so the experiment attributes the gain to the combined patch rather than assigning a precise fraction to each change.

Rust implements finite numeric/boolean/string operations, safe plain dotted paths, assignment and limited structural control flow. It excludes array operators, library/date functions, missing/null behavior, prototype/inherited property semantics and full error/trace parity. Nested sequence programs without a final top-level return explicitly reject. Nested returns are outside the documented shared subset but are not currently rejected by the parser; their behavior may differ from TypeScript. The timed fixtures contain only top-level returns. Rust and Node also use different object clone/materialization representations. Therefore the native result compares these specific implementations on four supported scalar workloads, and cannot establish that a full compatible Rust engine would retain the same gain.

Preparation, cold process start and serialized batch transport are included together in the separately recorded complete-batch boundary values; they were not isolated into a one-request latency estimate. A production FFI/IPC bridge, end-to-end application latency, Node 24 behavior, real customer traffic and worst-case expression/resource behavior remain unmeasured. Reproduction is described in [the comparison README](../../README.md). Exploratory pre-freeze screening is preserved under screening-pre-freeze and is not acceptance evidence; its earliest version preceded corrected timed-work validation.

All work ran locally with $0 paid/remote compute spending. No publishing or hosted deployment occurred.
