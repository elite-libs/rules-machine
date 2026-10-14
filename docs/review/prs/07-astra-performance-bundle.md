# Draft PR: Reduce browser bundle and preserve thrown error values

Local review draft; no external PR. Parent: [Wayfinder](../WAYFINDER.md), [ticket 08](../tickets/08-astra-performance-bundle.md). Follow-up branch: `perf/astra-followup-2026-10-14`.

Browser IIFE delivery was readable but unnecessarily large by default. Minify that format while retaining readable development builds, Node ESM/CommonJS defaults and all source maps. Replace general Lodash path coercion/dependency closure with the exact string-only grammar used by validated internal callers. Preserve fresh segment arrays; bound cached path text and retain the full MIT notice in emitted JS.

With tracing disabled, formatting a thrown object could call its toString and replace the original error. Guard only the two error-row constructions responsible, preserving original thrown identity. Add this regression and a mutable-rule validation regression. Broader validation and trace optimizations were measured and reverted when workload guards failed.

See [final evidence](../../../performance/wayfinder-followup/RESULTS.md) for all size formats, runtime screening/confirmation, source/build hashes, Node 24/26 and actual-browser qualification. Exhaustive 111,111 short paths plus 5,000 seeded paths match the installed Lodash reference. Host contention and unsupported production claims remain explicit; no speedup is claimed from bundle shrinkage alone.
