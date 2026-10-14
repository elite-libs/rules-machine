# October review: results and decisions

Original revision `ee300ad`; interpreter source `79c23b6`; final security dependency/build candidate `ad5c47a`. All work is local on `overhaul/wayfinder-2026-10`; no issue, PR, release, remote worker, or deployment was created externally.

## Outcome

The original 267-test suite passed despite reproducible structural, expression and packaging defects. The accepted implementation passes 368 tests across 15 files, including new regression tests and seven workflows extracted from actual Markdown. Type checking, lint (zero errors; 97 warnings and two informational diagnostics), declarations, packed external ESM/CommonJS consumers, browser-global VM execution and the collaborative browser smoke pass. The interpreter-source coverage snapshot is91.35% lines and89.35% branches. Hosted CI was configured for Node24/26 but not executed in this local-only run.

The final security dependency/build tree was confirmed in twelve fresh balanced process blocks. Tuned throughput improved14.24× [13.96,14.55] on seven reused-program slices; upgrade-only yielded1.01× [0.99,1.03], supporting no isolated upgrade gain. On the same four scalar slices, native Rust improved6.06× [5.74,6.42] over tuned TypeScript. All300 confirmation samples passed exact first-pass business-state/output oracles and timed actual-work/digest checks; no valid samples were discarded. These local synthetic results include input reset and output consumption and do not establish production SLOs or a JavaScript/Rust bridge advantage.

The original pre-security confirmation remains unmodified under`performance/comparison/results/2026-10-14/`; final dependency-tree evidence is under`performance/comparison/results/2026-10-14-security/`. Do not infer a security-patch speedup from differences between the two campaigns. Cold-create and small retention diagnostics were collected separately before the dependency follow-up, not repeated or promoted into final warm-workload claims.

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
| Dependency claims | Historical audit described obsolete versions and speculative RCE. User subsequently authorized the scan;16 advisories were reported and patched. The production OMIT prototype-deletion path was reproduced safely; no RCE is claimed. | Fresh audit: zero known advisories; [ticket06](tickets/06-dependency-advisories.md) |
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

The user subsequently authorized the public advisory scan. It reported16 advisories, all resolved by the patched locked tree; a second scan reports zero known advisories. This is a point-in-time database result and does not establish absence of unknown vulnerabilities. Before/after responses and the reachable production OMIT regression are tracked in ticket06. Remote/paid compute was not launched; model/reporting cost is unavailable.

Full timings, raw samples, profiles, compiler/dependency identities and rerun commands are in the [comparison report](../../performance/comparison/results/2026-10-14-security/report.md) and [comparison README](../../performance/comparison/README.md).

## Reviewable delivery

[Wayfinder](WAYFINDER.md), [unreleased compatibility notes](CHANGELOG.md), [runtime PR draft](prs/01-runtime-hardening.md), [distribution PR draft](prs/02-distribution.md), [performance/Rust PR draft](prs/03-performance-rust.md), [documentation PR draft](prs/04-specification-docs.md), and [retained validation evidence](evidence/).
