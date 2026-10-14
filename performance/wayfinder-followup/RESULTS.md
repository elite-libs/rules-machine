# Post-merge Astra tuning: results and decisions

Wayfinder was fast-forwarded and pushed to `main` at `4f06377` on 2026-10-14. The subsequent one-hour tuning task ran on `perf/astra-followup-2026-10-14`. Four distinct mechanisms were evaluated with GPT-6-Astra; rejected candidates remain in git and evidence. No issues, PRs, releases or paid remote workers were created.

The accepted result is a smaller browser bundle plus a thrown-value correctness fix. **No runtime speedup is established.** Final code is `9adecf3`; later commits contain review/evidence/docs only. The [frozen plan](plan.md), [Astra audit](astra-review.md), [machine audit](results/astra-final-audit.json) and [local review ticket](../../docs/review/tickets/08-astra-performance-bundle.md) describe the exact scope.

## Accepted result and tradeoffs

| Metric | Merged baseline | Final | Change |
| --- | ---: | ---: | ---: |
| Browser IIFE raw bytes | 180,160 | 72,125 | -59.97% |
| Browser IIFE gzip-9 bytes | 32,875 | 22,101 | -32.77% |
| Browser IIFE Brotli bytes | 27,234 | 18,446 | -32.27% |
| npm packed bytes | 270,276 | 265,248 | -1.86% |
| npm unpacked bytes | 1,308,728 | 1,174,993 | -10.22% |

Node ESM/CJS entry files grow about 1.8% raw / 4.4% gzip because the string grammar and full license are now inlined rather than imported from an external dependency. Declarations are unchanged, and all source maps remain included. Browser payload savings do not describe total npm package savings. Per-file compression is independent, not summed into the tarball measurement.

| Artifact | Baseline raw bytes | Final raw bytes | Baseline gzip bytes | Final gzip bytes |
| --- | ---: | ---: | ---: | ---: |
| index.cjs | 139,741 | 142,163 | 27,880 | 29,094 |
| index.cjs.map | 247,229 | 251,013 | 50,533 | 52,130 |
| index.d.cts | 6,704 | 6,704 | 2,082 | 2,082 |
| index.d.ts | 6,704 | 6,704 | 2,082 | 2,082 |
| index.global.js | 180,160 | 72,125 | 32,875 | 22,101 |
| index.global.js.map | 299,852 | 260,838 | 60,905 | 60,783 |
| index.mjs | 139,042 | 141,588 | 27,729 | 28,959 |
| index.mjs.map | 247,119 | 250,941 | 50,415 | 52,031 |

[All raw/gzip/Brotli sizes and hashes](results/final-sizes.json), [baseline sizes](results/baseline-sizes.json), [packed baseline](results/baseline-package-size.json) and [packed final](results/final-package-size.json) retain every format. The final package measurement includes README/review-entry changes at measurement time; any subsequent root Markdown size change requires refreshing it before delivery.

## Tuning loops

1. **Default minification.** All-format minification shrank output but the preliminary Node pricing-32768 screen measured 0.725x throughput [0.662,0.806]. Reject that setting. The revised browser-only treatment preserves existing Node defaults and readable development builds. Browser IIFE shrank to 78,503 bytes in the isolated original-source arm; the correctness-fix baseline is 78,509 bytes. Initial timing uses the old short-warmup instrument and remains diagnostic, not final inference.
2. **Rule-validation allocation reduction.** Hoisted operator/allowed-key schemas, a single operator scan and reuse of descriptor-checked keys preserved security and accounting. Repaired six-pair screen: 1.067x [1.024,1.107] aggregate, but pricing-0 point 0.814 [0.603,1.133] failed the frozen strict per-slice point guard. Reject runtime changes despite aggregate gain; retain the new mutable-program revalidation regression. That slice slowdown is uncertain rather than established.
3. **Disabled-trace allocation reduction.** Guarded row construction and timestamps while preserving required reads and work charges. Repaired six-pair screen: 0.980x [0.886,1.088], map-256 0.742 [0.566,0.941]. Reject broad tuning. Separately retain only two error-row guards: trace=false previously formatted a thrown object and could invoke its toString, masking the original failure. The new regression verifies exact thrown identity and zero coercions.
4. **String-path specialization.** Replace general Lodash toPath coercion/dependency closure with the exact string-only grammar used by internal callers. Keep the full MIT notice in emitted JS, fresh mutable segment arrays and existing budget/security checks. A module-local cache stores at most 500 paths / 1 MiB of UTF-16 string-content accounting; entries above 16 KiB skip retention. Array/map overhead is excluded; this is not a heap bound and expression cache options/stats do not control it. Browser raw/gzip shrink another 8.13%/8.07% versus the minified correctness baseline, exceeding the frozen 5%/3% size thresholds. The bundle-composition profile drops from 50 Lodash source files to one (isObject). Six-pair runtime screen 1.089 [0.986,1.178] passes the bundle guard, without establishing speedup. [Compatibility evidence](results/loop4-path-differential.json).

The fourth mechanism's bundle tradeoff was frozen before implementation: aggregate throughput >=0.90 and no per-slice interval establishing a >10% regression. This differs from runtime-only candidates' >=3% gain/lower interval >1 and stricter point regression guard. Thresholds were not changed after candidate results. No samples were added until a favorable result appeared.

## Fresh final runtime confirmation

Twelve balanced paired process blocks, seven unchanged business fixtures and 168 valid observations compare merged baseline `4f06377` with final `9adecf3` on Node 26.8.2 / Linux x64 / Intel i7-7700K. Every fresh process warms for at least 250 ms; baseline-only warmed pilot freezes operation counts. Full independent result/input oracles run before and after timing; actual completed counts and weighted output digest gate each observation, and an intentionally skipped-work sentinel must fail. Timing includes clone/evaluate/digest; preparation, warmup and oracle assertions are excluded.

Aggregate final/baseline throughput is **0.9884x [0.9229,1.0712]**. This meets the declared bundle guard, with the aggregate interval also above 0.90, but does not establish a speedup or equivalence. No per-slice upper interval is below 0.90. Important unresolved points remain visible: pricing-0 is 0.8049 [0.5695,1.1613]; map-16 is 0.8674 [0.5712,1.2795]. These wide intervals cannot rule out workload regressions. [Full per-slice report](results/final-confirmation/report.md), [analysis](results/final-confirmation/analysis.json), [raw data](results/final-confirmation/raw.json), [environment and hashes](results/final-confirmation/environment.json).

Intervals use 10,000 deterministic bootstrap resamples of whole paired process blocks; slice intervals are exploratory and unadjusted. Equal weighting is synthetic, not production traffic. Host load at 23:16 UTC was about 17 on eight logical CPUs; unrelated jobs were observed and left alone. Contention limits precision and portability. Only Node 26 performance is measured. No cold-start, production SLO, fleet concurrency, cross-host result or strict memory gain is claimed.

The initial short-warmup screens are preserved separately. An audited task-local instrument repaired insufficient warmup before new screens. Final runner cleanup only removed unused Rust metadata/dependency and clarified role labels; its worker and TS execution algorithm stayed identical to repaired screens. Rust is not a timed arm here.

## Correctness and artifact qualification

Final source passes 467 tests across 19 files on Node 24.21.0 and 26.8.2, typecheck, lint with zero errors / 95 warnings / 2 infos, all builds and packed ESM/CJS/browser/declaration consumers on both Nodes. All 419 shared Rust cases pass against the unchanged Rust binary. Path grammar matches installed Lodash 4.18.1 on 111,111 exhaustive short strings and 5,000 seeded paths, plus named Unicode/quoted/malformed/cache-isolation cases.

The actual collaborative browser passes all seven complete fixture result/input oracles plus thrown-error identity and quoted-path identity checks on the final 72,125-byte minified IIFE. [Browser evidence](results/final-browser.json). Earlier six paired within-tab minification diagnostics retain 84 rows, but are not independent browser-process performance evidence. A delivered-IIFE public-contract suite passes 58 existing tests through Node. An additional built-artifact matrix compares valid/invalid arities and domains for all 97 named functions against the merged baseline, including successful-domain probes for 96 functions and expected errors for THROW; this is compatibility qualification, not complete function coverage. Both are distinct from actual-browser tests. [Public-contract log](results/delivered-iife-tests.txt), [function matrix](results/delivered-function-matrix.json).

Astra independently verified every final count/digest, the fixed schedule, minimum 250.066 ms warmup, matching module hashes, and embedded source-map content: all 14 baseline source files match git `4f06377`, and all 15 final source files match `9adecf3`. [Independent audit](results/astra-final-audit.json). Build artifacts in ignored caches are reproducible from those sources; tracked hashes identify exact measured bytes.

## Reproduce and delivery

Run one heavy job at a time. Build each source in isolation with the same pinned dependency tree, preserve output directories, then use:

```sh
TMPDIR="$PWD/.cache/wayfinder-followup" pnpm test -- src
pnpm typecheck
pnpm lint
pnpm build
pnpm test:package
node performance/wayfinder-followup/run.mjs baseline=/absolute/baseline/index.mjs tuned=/absolute/final/index.mjs blocks=12 role=confirmation output=/absolute/results
node performance/wayfinder-followup/analyze.mjs /absolute/results
node performance/wayfinder-followup/sizes.mjs dist /absolute/sizes.json
TMPDIR="$PWD/.cache/wayfinder-followup" pnpm exec vitest run --config performance/wayfinder-followup/browser-vitest.config.ts
```

The initial infrastructure failures and invalid capture/launch attempts are described in the [attempt record](results/attempts.md), plan and retained logs. No valid timed observation was removed. Final branch and evidence are pushed under the standing branch-push authorization; main contains the requested Wayfinder merge, while subsequent tuning remains isolated for review. No issue or PR is published. Local compute only; model/reporting costs unavailable.

## Post-merge advisory reconciliation

The final GitHub push reports one remaining moderate default-branch alert, down from 144 before the Wayfinder merge. A read-only alert lookup verifies #38 is `esbuild` in `examples/aws-lambda-service/package.json`, development scope. The standalone legacy example migration remains a separate documented boundary; no advisory was dismissed or example deployment changed. This is GitHub alert reconciliation, not a new public advisory scan. [Retained verification](results/merge-verification.json).
