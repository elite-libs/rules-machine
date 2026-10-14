# 08: Post-merge Astra performance and bundle tuning

Parent: [Wayfinder](../WAYFINDER.md). Status: complete with the declared evidence and limitations. User authorized merging the umbrella branch, then three or more performance/bundle tuning loops with Astra, bounded to one hour. Main fast-forwarded to `4f06377` and was pushed after fresh merged-source qualification. New work is isolated on `perf/astra-followup-2026-10-14`; issues and PR drafts remain local.

| Mechanism | Decision and acceptance |
| --- | --- |
| Default minification | All-format setting rejected after Node pricing regression. Browser-only revision retains Node defaults and source maps, with measured raw/compressed byte reduction. |
| Rule-validation allocation reduction | Rejected under the frozen per-slice point guard despite aggregate screening gain; retained mutable-program revalidation regression. |
| Disabled-trace allocation reduction | Rejected after map regression and no aggregate gain. Retained only the independently justified thrown-value identity fix and regression. |
| String-path dependency specialization | Exact old-library grammar, full MIT notice, bounded string-content cache and fresh segment arrays. Exhaustive/seeded compatibility and bundle/runtime gates; final source `9adecf3`. |

The [frozen plan](../../../performance/wayfinder-followup/plan.md) records objectives, thresholds, infrastructure failures and instrument repair. [Follow-up results](../../../performance/wayfinder-followup/RESULTS.md) retain every candidate decision, raw measurements, exact build identities, final qualification and limitations. Screening is separate from fresh confirmation. No runtime improvement is inferred from deterministic bundle-size savings.

Remaining boundaries: contended local host, synthetic equal-weight workloads, no fleet/SLO or independent browser-process timing. New path-cache string-content accounting excludes array/map overhead and is not a heap cap. General parser/path/security/atomic semantics remain required. The Rust core is unchanged; shared differential compatibility is rerun against the final TypeScript candidate.
