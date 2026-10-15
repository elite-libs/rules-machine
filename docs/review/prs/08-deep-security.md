# Draft PR: Harden input authority, execution safety and Rust worker limits

Local review draft; no external PR. Parent: [Wayfinder](../WAYFINDER.md), [ticket 09](../tickets/09-deep-security.md). Branch: `security/deep-review-2026-10-14`, baseline `ef4f3c5`.

Copied argument markers could invoke supplied callbacks, input aliases could replace already-validated instructions, and atomic truncation could irreversibly delete nonextensible array elements. Authenticate internal arguments privately, detach validated programs per execution, reject irreversible atomic writes, and harden host-prototype aliases, metadata access, tracing and resource accounting.

The experimental Rust worker now bounds native collection/string work before allocation, validates request IDs, and rejects zero cache limits. Its Node bridge validates error and typed success responses before settling pending work, fails all queued requests consistently, and rejects malformed tagged Unicode.

Fresh qualification:499 TypeScript tests on Node 24/26;36 Rust tests;20 bridge tests on both Nodes;419 shared and 11,158 numeric/domain cases;7,956 delivered-IIFE compatibility probes;12 actual-browser security checks;10,864 hostile hook probes with zero invocation. Packed consumers, typecheck, lint and build pass. TypeScript coverage94.38% lines / 90.9% branches; lint warnings remain. Root audit0/150; the legacy AWS example's separate esbuild alert remains open.

Compatibility tightening, all 12 finding families, before/after proof, independent reviews, exact hashes and residual limits are in the [security report](../../security-review/RESULTS.md). Browser IIFE adds2.43% raw/1.99% gzip; declarations are unchanged. [Measured runtime costs](../../security-review/PERFORMANCE.md) remain uncertain, including an initial slice slowdown that failed to replicate in fixed independent confirmation. Security checks were retained. This records the original review delivery. The user subsequently authorized the main merge and documentation refresh; see [integration](../../security-review/INTEGRATION.md). No release, issue or PR publication is part of that integration.
