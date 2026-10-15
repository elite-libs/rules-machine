# Security integration and documentation refresh

On October 14, 2026 (America/Denver; October 15 UTC), the user authorized merging the security branch and updating the README and documentation. Main was fast-forwarded from `ef4f3c5` to `047782b`, retaining every security-review commit and the documentation refresh. This record is a subsequent documentation-only commit.

The documentation subagent reviewed the public README, getting-started guide and experimental Rust README against implementation and retained security evidence. Updates cover package formats, deterministic examples, all factory options, actual trace fields, input mutation, atomic rollback, cooperative limits, Rust lifecycle and subset boundaries. The coordinator also corrected example state initialization and misleading named-rule references. Historical performance and review artifacts remain unchanged; their original branch-only delivery statements describe that earlier phase.

Fresh integration checks:

- Node 24.21.0: all 499 TypeScript tests in 22 files pass.
- TypeScript typecheck and ESM/CommonJS/browser/declaration builds pass.
- Packed ESM, CommonJS, browser-global and declaration consumer checks pass. The initial sandbox denied spawning `npm pack`; the authorized local retry passed without publishing.
- The documentation reviewer executed the revised TypeScript and Rust bridge examples against the built implementations.
- All 32 relative file links across the five public documentation files resolve; `git diff --check` passes. The previous execution-contract anchor remains available.

No runtime source changed during this integration; the [security report](RESULTS.md) retains the broader Node 24/26, browser, Rust and adversarial qualification. Hosted CI is triggered by the main push and is separate from these local checks. Tickets and PR drafts remain local in git; no GitHub issue, PR or release was created.
