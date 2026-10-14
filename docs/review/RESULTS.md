# October review: results and decisions

Original revision `ee300ad`; accepted runtime source `79c23b6`. All work is local on `overhaul/wayfinder-2026-10`; no issue, PR, release, remote worker, or deployment was created externally.

## Outcome

The original 267-test suite passed despite reproducible structural, expression and packaging defects. The accepted implementation passes 367 tests across 14 files, including new regression tests and seven workflows extracted from actual Markdown. Type checking, lint (zero errors; 97 warnings and two informational diagnostics), declarations, packed external ESM/CommonJS consumers, browser-global VM execution and the collaborative browser smoke pass. Coverage is 91.35% lines and 89.35% branches. Hosted CI was configured for Node24/26 but not executed in this local-only run.

The fresh twelve-block local confirmation supports retaining the syntax cache and disabled-trace serialization fixes together with correctness hardening. Geometric-mean throughput improved 13.67× [13.27,14.06] on seven reused-program slices. Upgrade-only yielded 1.00× [0.98,1.02], so no speed improvement is attributed to dependency/tool upgrades. On the same four scalar slices, native Rust improved 5.83× [5.06,6.65] over tuned TypeScript. Separate cold-create diagnostics did not support a gain. This is one busy local Intel i7-7700K host on Node26.8.2, not a production capacity claim.

## Findings disposition

| Area | Evidence and decision | State |
| --- | --- | --- |
| Nested returns/BREAK | Branch/try/sequence returns lost; string BREAK collided with control flow. Symbol signal now propagates; callback return has a tested local boundary. | Fixed |
| Recursive logic | Typed/documented nested logical children were skipped. Recursive short-circuit evaluator and empty-group identities added. | Fixed |
| Array scope | Reserved variables leaked and inner iterations corrupted outer context. Restore in finally, including failures. | Fixed |
| Structural validation | Malformed/ambiguous/cyclic programs and unsafe array destinations failed late or silently. Preflight checks shapes, paths, depth and node limits. | Fixed |
| Assignment | Text matching confused strings with assignment and missed compact/bracket paths. Quote-aware scanning, RHS handling and own-path read/write consistency added. | Fixed |
| Grammar/precedence | Unknown calls/operators and malformed literals silently changed meaning; == precedence missing. Reject unsupported syntax and correct equality/assignment groups. | Fixed |
| Math/resources | COSH used cosine; primality domains wrong; GCD/RANGE could run indefinitely. Correct formulas and enforce finite safe-domain/allocation bounds. | Fixed within documented scope |
| Data utilities | Boolean tests encoded array-index bugs; dictionaries changed local prototypes; while predicates read past end. Correct classification, safe own dictionary keys and predicate ordering. | Fixed |
| Null/literals | Null data failed dependency materialization; strict lookup rejected null; basic array literals failed. Minimal bundled null patch and empty/singleton literal fixes added. | Fixed |
| Tracing | Disabled tracing serialized input and could throw on unrelated cyclic/BigInt values. Skip serialization; safe enabled snapshots. | Fixed for tested snapshots; object-reference history remains open |
| Runtime performance | Rebuilt parser/operator tables and reparsed every expression. Cache syntax per factory, bounded512 entries, with current resolver and reentrancy/failure restoration. | Accepted with measured evidence |
| Distribution | Advertised ESM file absent; Node-specific browser build; stale Node14/yarn CI; example type dependency broke global check. Repair artifacts and library validation boundary. | Fixed locally; hosted CI unrun |
| Dependency claims | Historical audit described obsolete versions and speculative RCE. Current versions verified for upgrade compatibility; blanket pollution/RCE not established. Advisory scan disclosure rejected by automatic review. | Claims corrected; advisory scan unperformed |
| Rust | Shared scalar fixtures,100 held-out input cases, short-circuit/rejection checks and four Rust unit tests pass. No full-spec or bridge claim. | Experimental subset, gaps open |
| Broader parser/date/resource behavior | Returned host objects, flat-expression stack limits, relative dates, byte budgets, transactionality and type ergonomics need their own contracts. | [Follow-up05](tickets/05-residual-contracts.md) |

## Council and independent review

Three distinct lenses were used, with their original proposals retained:

- [Architect / Detail Detective](council-architect.md): structural contracts and correctness, then [documentation checks](council-documentation.md). This changed return propagation, validation and scope design. It rejected a blanket deep input blacklist and unproven RCE claims.
- [Performance Wizard / Ruthless Minimalist](council-performance.md): measured hot paths, isolated original/upgrade/tuned/Rust arms and clean-rebuild subset. It rejected unbounded caching and language-only explanations of native timings.
- [Expert Doomsayer, GPT-6-Astra](council-expert.md): found malformed-literal/call gaps, exact dotted-key inconsistency, bracket-path support gaps and late unsafe array destinations. All four actionable findings were fixed; preexisting object-materialization and general resource issues remain explicit.

The Architect independently [audited the measurement instrument](council-measurement-audit.md). Timed-result verification and arm-position balancing were corrected before confirmation. Initial review files describe findings at inspection time; this disposition table states the final result. No council member dropped out. The reporter was reused for checkpoint artifacts under `/tmp/rules-machine-review-reports`.

## Limits and next action

Retain the confirmed TypeScript implementation. Review compatibility notes before release; this branch does not publish or deploy. Rust warrants a separately scoped differential-spec/FFI investigation only if production workloads justify it. The local timing result is strong for warm reused programs, while cold preparation, arrays beyond map, production workload skew, retained-byte limits and JavaScript/Rust bridge latency remain limited or unmeasured. Host load and frequency drift are included in raw observations; no valid slow sample was deleted. Per-slice intervals are not adjusted for multiple comparisons.

An optional public advisory scan remains blocked because automatic approval review rejected sending the dependency inventory. No other work depends on it and no vulnerability-free claim is made. Remote/paid compute was not launched; model/reporting cost is unavailable.

Full timings, raw samples, profiles, compiler/dependency identities and rerun commands are in the [comparison report](../../performance/comparison/results/2026-10-14/report.md) and [comparison README](../../performance/comparison/README.md).

## Reviewable delivery

[Wayfinder](WAYFINDER.md), [unreleased compatibility notes](CHANGELOG.md), [runtime PR draft](prs/01-runtime-hardening.md), [distribution PR draft](prs/02-distribution.md), [performance/Rust PR draft](prs/03-performance-rust.md), [documentation PR draft](prs/04-specification-docs.md), and [retained validation evidence](evidence/).
