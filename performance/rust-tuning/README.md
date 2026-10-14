# Two measured Rust tuning loops

Final Rust source `91ef65e` passes **27 Rust tests, 15 bridge tests, 419 shared cases and 11,158 numeric/domain probes**. Independent source review preceded final confirmation. [Full evidence and limitations](results/report.md), [paired Rust confirmation](results/combined-confirmation/analysis.json), [final four-arm comparison](results/final-native/analysis.json), and [final bridge/cold/retention](results/final-bridge/analysis.json) are retained locally in git.

The two changes remove callback allocation work and prepare immutable expression path segments once. A separate allocation-count example explains the mechanism; its counting allocator is never linked into the timed CLI. At 4096 map items, allocations per operation fall from **32,789 to 12,305** and requested allocation bytes from **1,495,297 to 365,759**. Requested bytes are cumulative allocator traffic, not peak memory.

Independent 12-block paired confirmation against reviewed source `127d762` measures **1.640× [1.590, 1.689]** throughput across the same seven frozen slices. Final native Rust is **10.63× [10.38, 10.90]** final TS throughput on those slices. The persistent bridge is **0.300× [0.288, 0.312]** direct TS throughput, so process/serialization costs still outweigh the native gain for this workload. These are local within-campaign estimates, not portable guarantees or a full-language replacement claim.

The original seven fixtures, result/input oracles and digest remain unchanged. All earlier screening and pre-tuning campaigns remain retained, including uncertain slice results; no earlier samples were selected into final inference. Only Node 26.8.2 performance is measured; Node 24.21.0 correctness/package qualification is recorded separately by the coordinator. No paid remote compute; model/reporting costs unavailable.

Rerun the focused diagnostics and paired comparison from the repository root:

```sh
mise exec rust@1.99.0 -- cargo test --offline --manifest-path experiments/rusty-rules/Cargo.toml
mise exec rust@1.99.0 -- cargo build --offline --release --bins --example allocation_probe --manifest-path experiments/rusty-rules/Cargo.toml
node performance/rust-tuning/allocation.mjs experiments/rusty-rules/target/release/examples/allocation_probe /tmp/rust-alloc SOURCE_ID
node performance/rust-tuning/measure.mjs /absolute/baseline-rust /absolute/candidate-rust /tmp/rust-paired 12 BASELINE_ID CANDIDATE_ID
```

Build each source in isolation, copy binaries before changing source, and preserve compiler/dependency identities. Screening uses six balanced paired process blocks; final acceptance uses twelve independent blocks. The baseline-only pilot freezes batch counts; actual completed work, weighted digest, full untimed oracles and intentionally skipped-work sentinels are checked. Run CPU measurements only in a quiet window. Full native and bridge rerun commands are recorded in their environment files and the [gap-phase recipe](../rust-gaps/README.md).
