# Rules-machine — final security reconciliation

Source: coordinator final reconciliation near **2026-10-15 00:39 UTC** (2026-10-14 18:39 America/Denver). Qualification used **54.63 minutes of the 120-minute cap**. Reporter has not independently rerun checks. Reporting responsibilities complete; no ongoing reporter job or timer.

| Responsibility | Final state | Evidence |
|---|---|---|
| Security fixes and qualification | ✅ Complete | Runtime `252629f`: TypeScript `6cf27cc`, Rust `8176e25`, bridge `252629f` |
| Independent review | ✅ Scoped review complete | Astra final read-only hash/count audit: zero mismatches; no unrestricted security-proof claim |
| Test discovery safety | ✅ Qualified `7ad27f8` | Default Vitest scope restricted to `src`, preventing ignored worktree-copy contamination; unfiltered default command 499 tests passes on Node 24/26; typecheck passes |
| Security-branch delivery | ✅ Qualified source pushed/verified | Remote `7ad27f8`; main remains `ef4f3c5`; delivery-only metadata/generated-attributes commit and push finishing at snapshot |
| Reports and local tracking | ✅ Complete | Results, performance, reconciliation and delivery evidence; local PR draft 08 |
| Reporting | ✅ Complete | Final snapshot retained; no future checkpoint, loop or timer |

| Final validation | Result |
|---|---|
| TypeScript / Rust / bridge | **499 tests on Node 24/26**, **36 Rust**, **20 bridge on both Nodes** |
| Differential parity | **419 shared + 11,158 numeric cases**, zero differences |
| Built-IIFE qualification | **7,956 probes / 97 functions + 58 public tests** |
| Browser and hostile boundaries | **12 actual-browser/all-format cases**; **10,864 hostile probes, zero host-hook calls** |
| TypeScript coverage | **94.38% lines, 90.9% branches** |
| Root advisory audit | **Zero known advisories across 150 dependencies** |
| Hosted topic CI | **Not run**: confirmed empty run list; workflow targets main/PR only |

Cost remains uncertain: whole TypeScript throughput **0.991× [0.899, 1.083]**, Rust **0.990× [0.852, 1.142]**. Initial eligibility slowdown **0.584× [0.436, 0.784]** did not replicate in fixed fresh 12-pair confirmation **1.05× [0.80, 1.37]**; both cohorts retained. Host CPU was not isolated. No no-cost or production-readiness claim is made. Browser bundle grew **2.43% raw / 1.99% gzip**; declarations unchanged.

Legacy advisory preserved: GitHub alert #38 remains open, medium severity, esbuild in the legacy AWS example's development manifest, separate from the root library audit. No example migration or advisory dismissal performed.

Durable [results](/home/dan/code/oss/rules-machine/docs/security-review/RESULTS.md), [performance analysis](/home/dan/code/oss/rules-machine/docs/security-review/PERFORMANCE.md), [reconciliation](/home/dan/code/oss/rules-machine/docs/security-review/evidence/reconciliation.json), [delivery evidence](/home/dan/code/oss/rules-machine/docs/security-review/evidence/delivery.json).

No issues, PRs, releases or main merge created. No paid remote compute; model/reporting costs unknown. Coordinator is finishing delivery metadata only; no source/timing job remains. Reporting is closed with no further activity scheduled.
