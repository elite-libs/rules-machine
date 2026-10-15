# Security hardening cost diagnostic

Six paired process blocks per language;84 observations each. All seven frozen workload oracles, completion counts and skipped-work sentinels passed. Ratios are candidate throughput divided by baseline throughput; intervals are descriptive whole-block bootstraps with unadjusted slice intervals. The host was not isolated. No aggregate speed change is established for either language; no bridge or browser latency was measured.

| Fixture | TS baseline µs/op | TS security µs/op | TS ratio [interval] | Rust baseline µs/op | Rust security µs/op | Rust ratio [interval] |
|---|---:|---:|---|---:|---:|---|
| eligibility | 52.46 | 93.51 | 0.584× [0.436, 0.784] | 3.63 | 5.02 | 0.836× [0.543, 1.297] |
| pricing-0 | 121.09 | 66.24 | 1.491× [1.047, 2.033] | 8.98 | 6.89 | 1.055× [0.626, 1.551] |
| pricing-1024 | 79.62 | 107.29 | 0.858× [0.518, 1.424] | 6.61 | 7.33 | 0.870× [0.638, 1.115] |
| pricing-32768 | 124.47 | 113.90 | 0.994× [0.713, 1.376] | 10.35 | 11.91 | 0.956× [0.643, 1.431] |
| array-map-16 | 103.69 | 107.17 | 0.973× [0.789, 1.205] | 18.58 | 13.38 | 0.928× [0.686, 1.267] |
| array-map-256 | 1499.75 | 1093.38 | 1.363× [1.108, 1.677] | 309.92 | 228.68 | 1.218× [0.821, 1.926] |
| array-map-4096 | 14418.73 | 17318.13 | 0.953× [0.668, 1.235] | 5802.21 | 5058.40 | 1.121× [0.731, 1.604] |

Equal-weight aggregate: TS 0.991× [0.899, 1.083]; Rust 0.990× [0.852, 1.142]. The broad and differing per-slice intervals must not be hidden by the aggregate. No security check was reverted or tuned to these measurements.

| Artifact | Baseline raw bytes | Security raw bytes | Baseline gzip bytes | Security gzip bytes |
|---|---:|---:|---:|---:|
| index.mjs | 141588 | 144975 | 28959 | 29633 |
| index.cjs | 142163 | 145550 | 29094 | 29768 |
| index.global.js | 72125 | 73878 | 22101 | 22541 |
| index.d.ts | 6704 | 6704 | 2082 | 2082 |

The initial eligibility slice flagged a material slowdown: 0.584× [0.436, 0.784]. A separately predeclared12-pair,24-observation fresh targeted check did not reproduce it: 1.050× [0.797, 1.370] (baseline median95.49µs/op, security median80.01µs/op). Both cohorts remain retained without pooling or replacement. This broad interval cannot rule out a meaningful regression; it also fails the predeclared criterion for confirming one. No source was changed between them. A controlled deployment-relevant follow-up is warranted before asserting performance neutrality; no profile attribution or zero-cost claim is made.

Baseline artifacts match the previously recorded qualified source hashes. Candidate TypeScript6cf27cc; Rust8176e25. See PERFORMANCE-PLAN.md for exact commands, timing boundaries, failed-launch repair, fixture/source identities and limitations. All raw observations remain under evidence/ts-cost, evidence/rust-cost and evidence/eligibility-confirmation.
