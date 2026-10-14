# Local end-to-end crossover results

The final Rust bridge crosses the upgraded TypeScript API between the tested 16- and 64-increment workloads on this host. Larger payloads can reverse that advantage. This is a controlled local workload result, not a universal rule-count, byte-count, nesting, or language threshold.

Completed 2026-10-14 UTC with Node v26.8.2, 12 independent paired parent-process blocks, alternating arm order. All complete-output oracle assertions and all timed operation-count/checksum gates passed. Fourteen slices ran in both arms; the additional 32-layer array chain correctly hit the bridge's public wire depth limit. Preparation/startup are excluded; both arms are warmed. TS performs one caller-input clone and synchronous execution; Rust includes public RustBridge framing, transport and returned-value decoding. Both consume the complete output through the same canonical JSON checksum. Absolute times belong to this cohort and should not be compared directly with the earlier main benchmark.

**All ratios below are Rust / TypeScript execution TIME. Lower favors Rust.** Brackets show a paired-block bootstrap 95% interval, unadjusted across the 14 supported slices. These are exploratory local comparisons, not simultaneous confidence guarantees. Rule count means increment statements; each sequence adds one return statement. Depth below means conditional layers; actual JSON depth is recorded separately in raw data.

| Increment rules | Rule JSON bytes | Tagged input bytes | Rust/TS TIME [95% interval] | Rust faster blocks |
|---:|---:|---:|---:|---:|
| 1 | 25 | 57 | 3.773 [3.588, 3.999] | 0/12 |
| 4 | 52 | 57 | 2.951 [2.795, 3.106] | 0/12 |
| 16 | 160 | 57 | 1.524 [1.424, 1.637] | 0/12 |
| 64 | 592 | 57 | 0.666 [0.608, 0.728] | 12/12 |
| 256 | 2,320 | 57 | 0.316 [0.257, 0.390] | 12/12 |
| 1,024 | 9,232 | 57 | 0.230 [0.213, 0.247] | 12/12 |

This brackets a crossover for the tested repeated `x += 1` sequence; it does not identify the exact intermediate count. The run request remains about 114 bytes because rules are prepared beforehand and subsequent calls send only a program handle and input. Rule JSON size therefore measures prepared compute volume, rather than transmitted bytes per execution.

| True conditional layers | JSON container depth | Rule nodes including sequence arrays | Rust/TS TIME [95% interval] | Rust faster blocks |
|---:|---:|---:|---:|---:|
| 0 | 2 | 2 | 6.660 [6.194, 7.204] | 0/12 |
| 4 | 6 | 6 | 3.160 [3.022, 3.329] | 0/12 |
| 16 | 18 | 18 | 1.527 [1.423, 1.645] | 0/12 |
| 32 | 34 | 34 | 1.063 [1.001, 1.129] | 4/12 |

No supported nesting slice establishes a Rust advantage. The direct `then: nextObject` 32-layer chain is close, slightly favoring TS in this run. The extra `then: [nextObject]` 32-layer chain has JSON depth66 and 66 rule nodes and is unsupported by the bridge's depth40 rule-data sanitization. It has no Rust timing.

| Payload bytes with 256 increment rules | Tagged input bytes | Representative run request bytes | Rust/TS TIME [95% interval] | Rust faster blocks |
|---:|---:|---:|---:|---:|
| 0 | 57 | 115 | 0.364 [0.329, 0.406] | 12/12 |
| 1,024 | 1,081 | 1,139 | 0.395 [0.362, 0.429] | 12/12 |
| 32,768 | 32,825 | 32,883 | 0.934 [0.845, 1.027] | 9/12 |
| 262,144 | 262,201 | 262,259 | 2.230 [2.057, 2.395] | 0/12 |

At this fixed compute volume, 32 KiB is inconclusive and 256 KiB favors TS. This brackets a reversal between the established Rust win at 1 KiB and established TS win at 256 KiB, without locating an exact byte threshold. The zero-byte payload slice deliberately repeats the 256-rule anchor; its interval overlaps the earlier anchor and shows why a single timing should not define the threshold. Slices execute in fixed order inside each arm process, so this duplicate is also a diagnostic for order, warmup, and drift effects; its point estimates are not expected to be identical.

Rust prepares an immutable program; the mutable TS rule API validates structure on each execution. Those costs remain part of the actual APIs under test. The results support choosing an API for this workload, rather than attributing all differences to Rust versus JavaScript execution. Payload serialization and the shared full-output consumer also affect the crossover.

Exact build hashes:

- TypeScript dist/index.mjs SHA256: `2ee464b289edc23e3cc124e290081081db404d32c759d4938d1af639e20075e1`.
- Rust binary SHA256: `149a9bcda421ee1645eaddf9869cd93553d5942718be493f94f7e73c3d57971d`, frozen source `91ef65e`.

Raw artifacts: [complete oracle verification](results/oracle.json), [pilot and fixed counts](results/pilot.json), [paired blocks](results/blocks.json), [machine-readable summary](results/summary.json), and [pre-timing failures](results/preflight-failures.md). Each phase has its own provenance JSON. The final runner refuses to reuse pilot counts after the Node executable/version or either build hash changes. See [method and rerun commands](README.md).
