# October review: results and decisions

Original revision `ee300ad`; final TypeScript runtime `d4a88ea`. The user authorized branch pushes to origin; issues and PR drafts remain local. No external issue, PR, package release, deployment, or paid remote worker was created.

## Delivered

The review grew beyond defects missed by the original 267-test suite into explicit contracts for returned host values, dates, resource limits, cache retention, trace history, atomic writes and TypeScript factory modes. The expanded Rust interpreter and persistent Node bridge are a measured core experiment, with supported and rejected semantics listed rather than a full-language claim.

| Area | Result and evidence |
| --- | --- |
| Structural control flow | Nested pipeline returns, callback-local returns, recursive logical groups and short-circuit identities; scope restored on success/error |
| Rule validation | Complete descriptor-only preflight, shape/path/depth/node checks, no getters/custom iterators, malformed programs reject before mutation |
| Expression correctness | Quote-aware compact/bracket assignment, exact dotted keys, nulls/basic literals, equality precedence, compact negative arguments, corrected math and data helpers |
| Host values | Frozen/cyclic/aliased input values return by identity; lazy weak provenance survives generated containers; no supplied function invocation; opaque host traversal/coercion and accessors reject |
| Resource controls | Shared work/array/string/depth/cooperative deadline controls; cold scan accounting; syntax token ceiling; resource errors bypass rule catches |
| Retention controls | Entry and conservative byte-aware syntax cache; bounded Rust program source/session/frame/queue/output expansion; explicit transport exclusions |
| Dates | Epoch milliseconds, validated ISO dates/explicit-zone datetimes and unit-bearing relative durations; no ambiguous/fallback dates; current clock read each evaluation |
| Trace and failure | Historical descriptor-only snapshots, no unsolicited console.error; documented default partial writes; opt-in atomic rollback preserving graph identity, holes and descriptors |
| Atomic callback boundary | Independent final read found expired callback fields could reappear after rollback; context entry is now journaled, with nested callback and browser regressions |
| Types/distribution | Literal trace overloads, dynamic union retained; Node ESM/CJS/browser artifacts, declarations and package exports corrected |
| Dependencies | 16 authorized advisory findings patched; re-audit zero known findings; actual-rule OMIT prototype-deletion regression retained |
| Rust | Tagged null/missing/undefined/nonfinite values, nested returns/results, all structural arrays, logic/try-catch and 35 named functions; 62 other named functions explicitly reject |

## Validation

Final TypeScript validation passes 462 tests across 18 files, typecheck, lint with zero errors / 95 warnings, all build formats, packed ESM/CommonJS/browser execution and an actual external TypeScript consumer compiled against the generated declarations. The consumer verifies literal/dynamic trace modes, resource options and the public cache/error APIs. Nested atomic savepoints, cold scanning and deadline rollback are covered by regression tests. Rust/bridge final validation is reconciled below with the exact experimental candidate.

The final TypeScript bundle passes 11 checks in the actual collaborative browser, including frozen/cyclic identity, constructor/getter-free array traversal, atomic rollback/context cleanup, cold-source accounting, dates and trace history. [Retained browser evidence](gap-browser-evidence.json) identifies the exact runtime. All 462 tests and packed consumers pass locally on Node 24.21.0 and 26.8.2. The external declaration consumer also verifies ordinary interface inputs after the type-only fix `3e8f578`, whose emitted runtime bytes are unchanged. Hosted CI remains unobserved. Earlier coverage numbers are not asserted as coverage of the expanded final source.

## Performance and causal checks

Final confirmation on Node 26.8.2 / Intel i7-7700K uses 12 balanced process blocks and seven identical frozen fixtures. The final Rust source is `91ef65e`; TypeScript runtime is `d4a88ea` with the byte-identical type-only fix `3e8f578`. [Native report](../../performance/rust-tuning/results/final-native/report.md), [bridge analysis](../../performance/rust-tuning/results/final-bridge/analysis.json), and [Rust tuning evidence](../../performance/rust-tuning/) retain the exact boundaries and raw observations.

| Comparison | Equal-weight throughput ratio, 95% paired-block interval |
| --- | --- |
| Final TypeScript / original | 9.885× [9.737, 10.033] |
| Upgrade-only / original | 0.993× [0.977, 1.008]; no isolated gain established |
| Native Rust / final TypeScript | 10.632× [10.385, 10.898] |
| Persistent bridge / direct final TypeScript | 0.300× [0.288, 0.312], or about 3.34× slower |
| Final Rust / pre-two-loop Rust `127d762` | 1.640× [1.590, 1.689] in a separate matched experiment |
| Final TypeScript / previous tuned security candidate | 0.720× [0.700, 0.740], approximately 28% lower throughput / 39% more time |

Native confirmation has 336 valid observations; bridge confirmation and the separate prior-TypeScript comparison each have 168. The hardening cost is measured as a bundle rather than attributed to an individual guard. Earlier campaigns showed different ratios on the same TypeScript module; campaign/host/JIT variation exceeds the within-campaign interval. The final preplanned campaign is primary, with no additional sampling to seek a larger gain. The separate Rust before/after experiment establishes tuning attribution; comparing ratios across campaigns does not.

### Rust tuning loops

The earlier array-scaling repair removed redundant whole-array cycle checks on internal callback context while preserving ordinary DSL cyclic-write rejection. Its separate old/new ablation showed the quadratic path and a 33.57× improvement at 4,096 items; this is narrower than whole-suite throughput.

Two additional loops were then frozen and tested:

1. Callback scope uses fixed saved slots and indexed reads instead of per-item vectors, index strings and whole-array clones. Six paired screening blocks showed a 1.057× [1.011, 1.098] whole-suite gain; the array aggregate interval included no change, while map-4096 improved 1.161× [1.108, 1.215].
2. Immutable prepared expression paths decode keys once, preserving exact raw-key precedence and fresh input reads. Six paired screening blocks showed 1.538× [1.506, 1.574] versus loop one.

The independently reviewed combination passed a fresh 12-pair confirmation versus `127d762`: 1.640× [1.590, 1.689] overall, 1.679× [1.612, 1.739] for arrays and 1.612× [1.540, 1.679] for scalar slices. Allocation instrumentation, kept out of timed binaries, showed map-4096 allocations falling from 32,789 to 12,305 per operation (62.5% fewer), and requested allocation bytes from 1,495,297 to 365,759 (75.5% fewer). Requested bytes are not live-heap measurements.

The final Rust candidate passes 27 Rust tests, 15 bridge tests, 419 shared cases and 11,158 numeric/domain probes. Exact float round-trip parsing and bit-based power-domain checks fix incoming-float and near-power boundary errors. The earlier 56 power discrepancies also involved changed input floats; they do not isolate libm versus V8 behavior. General fractional powers remain conservatively unsupported.

### Integration and retention

Cold diagnostics have 30 observations per arm in three independent parent processes, with both imports already loaded: TypeScript factory + first run median 0.419 ms (range 0.237–4.866 ms), versus Rust worker + prepare + first run 2.052 ms (1.798–5.438 ms). They are startup diagnostics, not independent production latency estimates.

Retention diagnostics use three processes per arm, each with 2,000 unique programs, 3,000 calls carrying 64 KiB payloads and 1,000 subsequent small calls. All 4,000 call oracles pass per process; 0/40 sampled parent input objects remain alive after final event-loop/GC barriers. Rust's program cache remains 128 entries / 1,802 source bytes with zero recorded retained inputs. Child RSS finishes around 3.35–3.49 MB, but the bridge's Node parent is 109–110 MB versus 77.6–78.4 MB for direct TypeScript. This supports bounded behavior in this diagnostic, not a universal leak-free or low-memory claim.

Retain hardened TypeScript as the default. Native Rust is faster on the tested subset; this persistent bridge loses that advantage to encoding, framing, copying and transport on the seven main fixtures. A separate [rules/layers/payload sweep](../../performance/crossover/README.md) evaluates different workload shapes; its results and consumer-checksum boundary must remain separate from this cohort.

### Where the bridge pays off

The separate prepared, serial end-to-end sweep completed 12 paired process blocks with 14 supported slices and one expected wire-depth rejection. Both arms verify complete results and mutated input, and timed work includes a full canonical JSON checksum of every output including payload characters. It uses one TypeScript input clone; the bridge includes encoding, transport and decoding. Preparation/startup are excluded. These boundaries differ from the main cohort, so absolute timings are not pooled.

| Controlled axis | Rust / TypeScript time, 95% paired interval | Interpretation |
| --- | --- | --- |
| 16 sequential increments; 160 rule JSON bytes | 1.524 [1.424, 1.637] | TypeScript wins |
| 64 sequential increments; 592 rule JSON bytes | 0.666 [0.608, 0.728] | Rust wins; about 1.50× throughput |
| 256 sequential increments | 0.316 [0.257, 0.390] | Rust wins |
| 1,024 sequential increments | 0.230 [0.213, 0.247] | Rust wins; about 4.36× throughput |
| 256 rules, 1 KiB payload | 0.395 [0.362, 0.429] | Rust wins |
| 256 rules, 32 KiB payload | 0.934 [0.845, 1.027] | Uncertain; interval includes a tie |
| 256 rules, 256 KiB payload | 2.230 [2.057, 2.395] | TypeScript wins |
| 32 direct-object conditional layers | 1.063 [1.001, 1.129] | No Rust win; slight TypeScript edge |

The tested sequential-rule crossover lies between 16 and 64 increments; no exact threshold was measured. Rule source bytes are prepared once: the 16/64-rule cases both have a 57-byte tagged input and a representative 114-byte run request. Rule JSON size alone does not establish compute cost. Payload growth moves the result in the opposite direction because transport/copying grows; the payload crossover is unresolved around 32 KiB. No nesting-only win appears through 32 direct-object layers. A 32-layer array chain exceeds the public wire-depth bound and is recorded unsupported, never as a fast timing.

The repeated 256-rule/empty-payload anchor has overlapping intervals at different fixed slice positions. Within-run ordering/JIT effects and unadjusted per-slice intervals remain limitations. See the [full crossover report and raw evidence](../../performance/crossover/README.md). These are workload-specific local crossings, not universal byte/rule/layer guarantees or production SLOs.

All campaigns retain fixed business-state/output oracles, actual completion/digest checks and raw observations. No valid slow sample is removed. Native, persistent bridge and cold boundaries are separate: native Rust throughput does not imply an IPC advantage. Final native confirmation uses all seven unchanged fixtures; earlier scalar-only evidence remains historical. Equal slice weighting is a synthetic comparison, not a production workload distribution.

Historical campaigns remain unchanged: [initial](../../performance/comparison/results/2026-10-14/report.md) and [security dependency tree](../../performance/comparison/results/2026-10-14-security/report.md). The latter measured 14.24× [13.96, 14.55] prior-tuned/original on seven warm slices, 1.01× [0.99, 1.03] upgrade-only, and 6.06× [5.74, 6.42] native Rust/prior-tuned on four scalar slices. These are prior candidates, not the final hardened build's performance claim.

## Independent review and decisions

Original proposals remain retained: [Architect](council-architect.md), [Performance Wizard](council-performance.md), [expert](council-expert.md), [documentation](council-documentation.md), and [instrument audit](council-measurement-audit.md). The [gap review disposition](council-gap-review.md) records the independent findings, fixes and the expert provider failure before its final report. The Architect completed a further bounded read-through after the callback rollback repair. No incomplete expert pass is presented as completed.

Accepted changes preserve correctness over a benchmark score. The original warm parser/cache improvement remains an isolated treatment; the added hardening has its own comparative cost. Rust remains optional experimental code with a precise rejection inventory and explicit lifecycle. Unsupported Rust options reject rather than silently ignoring atomicity, tracing or TypeScript budgets.

## Remaining boundaries

Synchronous cooperative limits do not preempt host code/Proxy traps or provide strict VM heap bytes. Conservative cache/frame accounting is not a universal memory guarantee. Atomic rollback covers interpreter property writes, not external host side effects; a handled rule catch continues its transaction. Trace result.input remains live while trace rows snapshot history.

Rust copies trees across the process boundary, so caller mutation and reference identity differ from in-process TypeScript. Cycles, sparse/accessor/host data, symbols/BigInt, selected Unicode/path forms, tracing and 62 named functions remain unsupported. The bridge is a bounded prototype, not a published FFI/WASM or drop-in release.

No production traffic, canary deployment, fleet concurrency/SLOs, or cross-host performance confirmation was available or authorized. Local synthetic/cold/retention diagnostics are labeled accordingly. The advisory response is point-in-time known-vulnerability evidence; unknown vulnerabilities remain possible. Model/reporting costs are unavailable; no paid remote compute was launched.

## Reviewable delivery

[Wayfinder](WAYFINDER.md), [compatibility notes](CHANGELOG.md), [closed gap ticket](tickets/05-residual-contracts.md), [runtime](prs/01-runtime-hardening.md), [distribution](prs/02-distribution.md), [performance/Rust](prs/03-performance-rust.md), [documentation](prs/04-specification-docs.md), [dependencies](prs/05-dependency-security.md), and [gap contracts](prs/06-gap-contracts.md) are local review drafts and records. Six task branches are pushed; the umbrella branch includes the final evidence reconciliation. Issues and PRs remain local, and release/integration review remains separate. The [remaining API, design and test boundaries](tickets/07-api-design-test-boundaries.md) track unresolved contracts and missing evidence.
