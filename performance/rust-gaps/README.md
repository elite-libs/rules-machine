# Rust core compatibility and boundary measurements

The expanded Rust core passes 419 shared differential/rejection cases and 10,478 deterministic numeric/domain probes, with explicit rejection domains. It supports 35 of 97 named TypeScript functions, nested sequence results and returns, null versus undefined, recursive conditions, all five array rules and try/catch. See [machine-readable scope](spec.json), [function domains](../../experiments/rusty-rules/README.md), and [final report](results/2026-10-14/report.md).

The final 12-block comparison measures TS **8.68× [8.23, 9.16]** versus original, native Rust **8.32× [7.88, 8.78]** versus final TS on the same seven slices, and the persistent Node bridge **0.291× [0.274, 0.310]** versus direct TS. The bridge loses at the actual encode/pipe/decode boundary. Final TS is **0.720× [0.700, 0.740]** the throughput of the earlier security-only candidate after the added protection bundle. These are local within-campaign estimates, not portable guarantees.

The Rust source is `de6ca7f`; the TS runtime source is `d4a88ea`; source, binary, module, lock and dependency hashes are in [provenance](results/2026-10-14/provenance.json). Node 26.8.2 was measured; Node 24 was unavailable. Cost: $0. Original benchmark fixtures and historical security evidence remain unchanged.

From the repository root, build and validate:

```sh
mise exec rust@1.99.0 -- cargo test --offline --manifest-path experiments/rusty-rules/Cargo.toml
mise exec rust@1.99.0 -- cargo build --offline --release --manifest-path experiments/rusty-rules/Cargo.toml
node --test experiments/rusty-rules/bridge.test.mjs
node performance/rust-gaps/differential.mjs dist/index.mjs experiments/rusty-rules/target/release/rusty-rules-experiment /tmp/gap-correctness
node performance/rust-gaps/numeric-grid.mjs dist/index.mjs experiments/rusty-rules/target/release/rusty-rules-experiment /tmp/gap-numeric
```

Run independent confirmation only in a quiet CPU window, preserving exact baseline dependencies:

```sh
node performance/rust-gaps/native-run.mjs baseline=/tmp/rules-machine-baseline/dist/index.js upgrade=/tmp/rules-machine-upgrade-only/dist/index.js tuned=dist/index.mjs rust=experiments/rusty-rules/target/release/rusty-rules-experiment blocks=12 output=/tmp/gap-native
node performance/rust-gaps/analyze-native.mjs /tmp/gap-native
node performance/rust-gaps/measure-bridge.mjs dist/index.mjs experiments/rusty-rules/target/release/rusty-rules-experiment /tmp/gap-bridge 12
```

`measure-bridge` also runs paired cold factory/worker preparation diagnostics and matched long-lived cache/input retention probes in three independent processes per arm. It checks completed work, returned values, bounded Rust cache statistics and sampled caller-input liveness after GC. RSS and heap snapshots are retained, without claiming that a finite probe proves absence of every leak.

Preparation and process startup are excluded from native warm timing. Native timings include fresh input construction/reset, execution and checked result digest. Bridge timings include parent encoding, bounded framing, pipe transport, worker execution, returned result/input decoding and the same digest. Thus native speed does not predict bridge speed. Full traces, arbitrary JS objects, all library functions, exact TS budget/options parity and other excluded syntax remain outside the core contract.

Earlier complete screening campaigns, interrupted campaigns and failing development probes are retained and classified in the final report. The final complete preplanned campaign is primary; no earlier samples are selected to increase the reported gain. CPU profiles and causal context ablation are separate diagnostics.
