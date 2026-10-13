# Performance Wizard + Ruthless Minimalist proposal

Read-only assessment, 2026-10-13. Sources: src/expression-engine/engine.ts, language.ts, language-utils.ts, src/structural-engine/executor.ts, utils.ts, arrays.test.ts, package.json. Read auto-tune-performance skill plus measurement and strategy references. No timings yet; these are hypotheses.

## Immediate findings

1. Trace-disabled execution still eagerly does JSON.stringify(input) for assignment evalRule logs and final complete log; logTrace checks trace only after arguments evaluate. Previous assignment values may also serialize. The catch log serializes state even when trace is off. This can make assignment-heavy work proportional to payload size and can throw on cyclic input. First experiment: guard these callsites with if (trace), retaining trace-enabled output. Profile expected: JSON.stringify disappears from trace=false assignment hot path. Do not conflate changed cyclic-input behavior with strict compatibility: explicitly document and test this incidental side effect change.
2. Every expression evaluation calls expressionparser.init with ruleExpressionLanguage, constructing infix/prefix tables and closures. Every compile scans assignment operators and splits source; it does not parse AST despite its name. Repeated programs and array callbacks repeatedly pay both costs. Parser API inspection after dependency installation must establish whether compiled thunks safely accept current context. Reusing a parser via a mutable resolver carries reentrancy/nested execution risks and must have context-restoration tests. Cache only source metadata first; bound caches or keep them factory-local.
3. termResolver calls lodash get via extractValueOrLiteral, and may call get again after nullish result. Missing/null behavior and literal handling are intertwined. Avoid blanket direct property replacement; lodash bracket/dotted path and inherited-property semantics matter.
4. Arrays repeatedly mutate input with $item/$index/$array; $array references source. Full state serialization on assignment inside arrays can dwarf arithmetic. Profile array-assignment plus scalar array predicates separately.
5. Each execute allocates closures/results and scans dangerous input keys. Security validation is required behavior; do not erase it for a score. Hoisting immutable name sets is low risk, probably low leverage unless measurements support it.

## Three comparison arms plus clean rebuild

A: exact current source/build + current lockfile. B: same public TypeScript semantics with measured optimizations; separately attribute dependency/tool upgrades before combining. C: rusty-rules implementation on an explicitly frozen shared subset; do not describe native subset wins as complete engine replacement. D: minimal faithful clean evaluator over the shared subset (preparsed expression nodes, explicit rule interpreter), isolated experimental arm. D tests whether parser/table/logging architecture is the avoidable cost. If implemented in Rust, still distinguish D from integrating an existing rusty-rules crate.

Do not compare Node import/JIT overhead on every request against a long-lived native Rust process. Native Rust and native Node report matching execution-only windows; additional cold process, parse/build and JSON boundary numbers are separate. If users would call Rust through CLI/IPC, time that end-to-end bridge as another result. Native throughput alone does not justify Node migration.

## Frozen workload/oracle proposal

Use deterministic canonical JSON fixtures and one fixture version shared across arms. Seed and hash rules and inputs. Each engine must evaluate actual serialized rules, not a hard-coded business function.

Shared subset: finite numbers, booleans, strings, objects with own plain safe keys and dotted paths, numeric arithmetic + - * / %, numeric comparisons and strict primitive equality, boolean AND/OR with short circuit, parentheses, simple assignment, rule arrays, if/then/else, top-level return; map/filter/some/every/find only if Rust arm supports compatible semantics by freeze time. Exclude date/time/random, undefined/missing/null coercion, NaN/Infinity, dynamic function names, object identity, try/catch, ambiguous assignments and prototype/inherited keys from cross-language speed claims. Keep those in full TypeScript compatibility tests. Reject unsupported cases explicitly rather than silently returning defaults.

Cases:
- eligibility: 8-20 comparisons and nested branches on varied applicant inputs; verify exact eligibility + final mutation state.
- pricing: 12-30 arithmetic/assignment expressions with dotted fields and final return; payload size slices 0/1/32 KiB unrelated data expose stringify cost. Integer-friendly prices to prevent floating ambiguity; separate fractional fixtures with documented tolerance.
- arrays: map numeric adjustment, filter predicate, early/late/no-hit some/find; N=0,16,256,4096. Verify exact arrays, counts and final context fields where part of API.
- expression diagnostic: literal, dotted lookup, arithmetic expression and AND short circuit; report as microbench, not headline.
- unique-rule cold/prepare: new factory per operation, vary sources; repeated-rule warm: factory reused, independent fresh mutable inputs. Both matter to caching tradeoff.

Oracle outside timed execution: independent hand-derived expected outputs for canonical cases and deterministic host-language reference arithmetic; compare normalized full output and relevant input mutation after every batch. Include exact success count + digest of all outputs, checksum per index to defeat skipped work. Deliberately change/drop one output once to prove oracle fails. Prevent trace mode runtime timestamps from entering equality comparisons. Full current test suite must pass for B, with trace=true and false coverage and public CJS/ESM built artifact smoke checks.

## Harness freeze and decision criteria

Freeze before candidate timing: source/patch identities, dependency/runtime versions, compiler flags (Rust release), fixture hash, semantic exclusions, timed boundaries, iteration counts, warmup, independent process blocks, metrics and gates. Timer excludes fixture clone/serialization for execute-only; include equivalent setup in end-to-end batch result. Inputs must reset every evaluation: neither repeated mutation nor cached outputs counts as valid work.

Pilot A only to choose batch count reaching ~200-500ms per slice and characterize noise. Then fixed screening: 5 independent process blocks per candidate; choose one finalist. Confirmation: 12 fresh paired balanced AB/BA process blocks, consistent GC policy, no profiler, same host. Preserve all valid raw samples; invalid work is failure, never zero time. Report successful operations/s or ns/operation with paired per-block ratios and bootstrap confidence interval across blocks. Record Node/Rust/OS/CPU/memory and background load. Capture short Node CPU profile for A and finalist, timing separately.

Provisional acceptance: at least 15% geometric-mean throughput gain with lower 95% paired ratio bound above 1.05; no important slice more than 10% slower (report uncertain slices), full correctness gates, no unbounded retained memory growth; collect RSS separately. A smaller clear patch may be useful but label it a simplification without claiming meaningful speed improvement. Do not choose repeated samples until pass. Reserve 25% of four-hour envelope for confirmation, combined patch tests and report. Costs $0 local, no remote/paid services.

## Tool availability

rustc/cargo shims exist but have no default configured, so plain commands fail. `mise exec rust@1.99.0 -- rustc --version` succeeds: rustc 1.99.0 (b940084d7 2026-09-28). Installed toolchain /home/dan/.rustup/toolchains/1.99.0-x86_64-unknown-linux-gnu. No installation needed. Cargo can be invoked under same mise exec. node_modules absent during this inspection; coordinator arranging dependencies. Avoid global mise setting edits.

## Priority queue / disconfirmation

1. Guard trace-only work; low implementation complexity. Disconfirm if profile has no serialization or warm relevant workload gains remain below noise. Compatibility risk: eager serialization errors/side effects disappear when trace=false, usually desired but must be explicit.
2. Factory-local compile metadata cache or precompile immutable rule tree; modest complexity, requires accounting for externally mutated rule objects. Disconfirm if compile self time tiny or unique-rule memory/setup dominates.
3. Parser initialization reuse / actual AST cache; higher leverage hypothesis but highest reentrancy and lazy thunk capture risk. Demand changed-context, short circuit, nested/custom executor, repeated/concurrent logical calls tests before acceptance.
4. Only profile-supported lookup/allocation work next; no wholesale lodash replacement before behavior proof.
5. Minimal evaluator clean rebuild as bounded ~45 minute arm. It must consume same rule/expression inputs and verify equivalent outputs; missing language features mean subset prototype, never drop-in upgrade.
