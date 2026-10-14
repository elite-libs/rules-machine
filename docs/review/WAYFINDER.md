# Wayfinder: rules-machine overhaul

Started 2026-10-13. Original revision: `ee300adbf33a5a8b4d75c0b6eafd5198c1b5d230`.
Execution budget: up to four hours, at most four agents including reporting.
All tickets and PR drafts stay local in git, per the user's explicit choice.

```mermaid
flowchart TD
  W[Wayfinder uber ticket] --> S[01 Structural contracts and validation]
  W --> E[02 Expression correctness and resource safety]
  W --> P[03 Measured tuning and Rust subset]
  W --> D[04 Distribution and developer tooling]
  S --> V[Combined regression validation]
  E --> V
  P --> V
  D --> V
  V --> R[Evidence and residual gap reconciliation]
```

| Ticket | Owner | Acceptance | State |
| --- | --- | --- | --- |
| [01 Structural contracts](tickets/01-structural.md) | Architect | Nested returns/logical groups, array scope, validation, safe traces; regressions | Implemented and locally verified |
| [02 Expression safety](tickets/02-expression.md) | Coordinator | Correct assignment scanning, math domains, safe dictionaries and predicates; regressions | Implemented and locally verified |
| [03 Performance and Rust](tickets/03-performance-rust.md) | Performance Wizard | Frozen workload/oracles, original/tuned/Rust timings, explicit subset gaps | Implemented and locally verified |
| [04 Distribution](tickets/04-distribution.md) | Coordinator | Install/build/typecheck/lint/test and actual ESM/CJS/browser artifact checks | Implemented and locally verified |

## Final reconciliation

See [results and decisions](RESULTS.md), [compatibility notes](CHANGELOG.md), and [remaining contracts](tickets/05-residual-contracts.md). Runtime source is frozen at `79c23b6`. Final validation: 367 tests, typecheck/lint/build, packed ESM/CommonJS/browser/declarations and collaborative browser smoke pass. Twelve balanced process blocks confirm a 13.67× warm-workload improvement; see tracked performance evidence for scope and uncertainty.

Local PR drafts: [runtime](prs/01-runtime-hardening.md), [distribution](prs/02-distribution.md), [performance/Rust](prs/03-performance-rust.md), [documentation](prs/04-specification-docs.md). No external PRs were created or linked.

## Baseline evidence

- Original suite: 267 tests pass in 8 files (Vitest 3.2.4, Node 26.8.2).
- Original typecheck fails: examples import undeclared `aws-lambda` types.
- Original build succeeds but emits `dist/index.js`; package exports reference absent `dist/index.mjs`.
- Original lint: 92 warnings, no errors.
- Executable reproductions: nested return yields 2 instead of 1; `"hello = world"` mutates an invalid key; `x=1` does not mutate; `COSH(1)` computes cosine; strict lookup rejects explicit null.
- Independent proposals: [Architect](council-architect.md), [Performance Wizard](council-performance.md). These preserve initial hypotheses separately from verified final conclusions.

## Tracking policy

No Wayfinder-specific tool/CLI was found. A GitHub uber-issue attempt was rejected by automatic approval review; the user then explicitly chose local tickets and PR drafts. No external issue or PR was created. Git commits and these local records are the authoritative tracking mechanism for this run.
