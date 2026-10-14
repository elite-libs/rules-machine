# Independent measurement audit

Read-only audit, current session. Reviewed coordinator and performance worktree fixtures.mjs, worker.mjs, run.mjs, verify.mjs, analyze.mjs, plan.md; Rust main.rs/README/Cargo.toml; performance engine cache implementation. No loads, profiling, or timing campaigns run. Tiny probes evaluated two Rust requests and ordinary fixture oracle outputs only.

## Blockers before confirmation

### 1. Timed results are not verified

worker.mjs records first-pass outputs for run.mjs's exact hand-derived oracle check, then timed batch merely accumulates checksum. run.mjs never compares checksum with an expected checksum. operations is calculated as requested iterations times input count, not counted after successful evaluations. Array results add zero to checksum, so every array fixture has checksum zero regardless of all actual mapped values. Warmup/state-dependent bugs could pass the first oracle then silently corrupt all timed answers.

**Required correction:** independent oracle-derived expected digest/count; actual completed++ only after successful execute; update deterministic index-dependent digest of every timed result (including all array elements, not only length), and compare expected count/digest outside the timed window. Include known mutated business output fields if mutation correctness during timed loops is a claim. Reuse digest buffers/state to avoid per-element allocations. For shared Rust/Node numeric/boolean outputs, a common unsigned 32-bit rolling hash over float64 bits/type tags and fixture index is practical; arrays recursively include shape and values. Compute expected digest outside timing from oracle results repeated exactly requested iterations. Document digest overhead is included identically in compared execution paths. Sentinel should alter/drop/reorder a timed result and prove digest/count validation fails. First-pass exact mutated-state validation remains useful and should stay.

A mere numeric sum checked against expected is insufficient for arrays and does not detect reordered outputs or many compensating errors. First-pass outputs plus unchecked reported count/checksum is insufficient for the stated timed-work correctness gate.

### 2. Four-arm order is not balanced

run.mjs rotates arms by block % armCount, then reverses every odd block. With baseline/upgrade/tuned/rust, the four repeating orders are:

| block mod4 | order |
|---|---|
|0|baseline, upgrade, tuned, rust|
|1|baseline, rust, tuned, upgrade|
|2|tuned, rust, baseline, upgrade|
|3|tuned, upgrade, baseline, rust|

Baseline always occupies position1 or3, never2 or4. Upgrade/rust always2/4; tuned always1/3. This contradicts the balanced-order claim and can confound arm with thermal/background drift. Three-arm order happens to cycle through all six permutations; the problem appears when the new upgrade arm is present.

**Required correction:** plain cyclic rotation, with no odd-block reversal, gives every arm every position over four blocks; twelve blocks are balanced. Alternatively freeze a balanced Latin schedule with pair adjacency/carryover treatment documented. Update plan/schedule metadata to the actual procedure. Preserve chosen schedule before candidate measurements.

### 3. Generic Rust subset claim exceeds semantic equivalence

Observed tiny differential: `true OR false AND false` returns **false in current TypeScript**, **true in Rust**. TS assigns AND/OR equal precedence; Rust precedence gives AND higher priority. Observed Rust `[["1","2"]]` returns2, while TS nested Rule[] produces [1,2]. Rust also deliberately excludes negative literals/unary minus, case-insensitive keywords, nested returns in historical baseline, and missing/null semantics beyond short-circuit-unreached terms.

Timed fixtures avoid these divergences: compound comparisons are parenthesized, AND/OR mixing has explicit grouping, and nested sequences are used only for branch side effects before a final top-level return. Therefore the frozen fixture comparison remains usable, but unrestricted claims of shared booleans/rule sequences are inaccurate.

**Correction options:** match Rust precedence and nested sequence return semantics with differential regression cases; or explicitly narrow shared contract to those frozen grouping/sequence constraints, assert unsupported patterns are rejected rather than silently reinterpreted. Retain an exclusions list in final report. Do not describe subset wins as drop-in replacement evidence.

## What is sound

- Inputs/rules are actual JSON programs interpreted by all arms; no hard-coded business evaluator substituted for an engine. Cloning resets every evaluation and reused factory measures the intended warm-program workload.
- Eligibility independent oracle has both outcomes (21 true, 11 false among32), with input mutation checked. Pricing has31 distinct results among32inputs and checks subtotal/tax/shipping/discount/total/nested final mutation. Unrelated payload sizes expose serialization cost without changing answers. Array oracle checks every expected mapped value in the first pass.
- Array normalization removes exactly $item/$index/$array for array fixtures only, making baseline's known leaked context exclusion explicit. It still checks ordinary inputs/outputs/mutations; tuned cleanup has independent structural regressions. This is an honest semantic exclusion, not proof of baseline/tuned equivalence for those internals.
- Each sample runs in a new process. Node/Rust windows include input reset/cloning and execution, exclude first oracle/compilation, and warm reused programs. Rust releases are native restricted interpreter plus different data representation; Node structuredClone and serde_json clone are different costs and this is documented.
- Boundary duration includes process startup, preparation, oracle, warmup, timed work, result serialization. Report correctly avoids calling that per-request FFI/IPC latency.
- First-pass oracle sentinel changes an eligibility result and verifies exact assertion failure. Rust unsupported-case suite explicitly rejects compound assignment/functions/bracket paths/null/dangerous paths/nonfinite arithmetic. Short-circuit tests access missing data only in unreachable branches. Held-out differential tests vary independent inputs beyond timed fixtures.
- Paired block ratios and whole-block aggregate bootstrap avoid request-level pseudoreplication. Per-slice intervals are explicitly not multiplicity-adjusted. All chronological raw samples are retained. Acceptance thresholds are predeclared.

## Cache/input retention inspection

Engine syntax cache is factory-local, bounded512 entries. Cached metadata contains strings and cached thunks resolve term names through the current activeResolver rather than retaining an input-specific resolver. evaluate saves/restores activeResolver in finally, including reentrancy and exceptions. Public metadata is copied on compile, avoiding caller mutation of cached metadata. I found no direct input/result retention in the cached entry graph. This is source evidence, not a heap-retention measurement. Cache may retain up to512 large source strings/thunks, so bounded entry count is not a strict byte budget; length100000 caps each source. Avoid claiming zero retained input based solely on one RSS value.

## Secondary reproducibility/report corrections

- fixtureVersion currently says shared-subset-v2 while implemented freeze prose still says v1. Synchronize metadata/prose at final freeze.
- environment.json hashes fixtures/worker/run/verify but omits analyze.mjs and plan.md; add these hashes for reproducible analysis/contract. Module hash alone does not freeze external dependencies. Record baseline/candidate lockfile hashes/resolved dependency identities and Rust source/Cargo.lock/compiler version/flags with artifacts.
- analyze.mjs includes upgrade values in analysis.json but its Markdown table and aggregate narrative omit the upgrade-only arm. Include upgrade-only measured effects in the human-readable report so code changes are distinguished from tool/dependency changes.
- process RSS is one post-run snapshot, not sustained memory growth evidence. Label it accurately; targeted retention tests are separate from throughput runs.
- README/plan should not imply broad workloads were measured: actual confirmation covers7 warm reuse slices, no cold/unique-rule preparation slice, no filter/find/some/every or array assignment callback, and no production Rust bridge.
- run.mjs should validate finite positive elapsedNs, actual completed count/digest, and complete per-block arm coverage before analysis; invalid work must fail rather than enter ratios. A spawn timeout is useful operationally for broken workers, though fixtures are trusted and limits are bounded.

## Confirmation gate

Do not begin confirmation until timed digest/count verification and four-arm balancing are corrected. Rust semantic mismatches require either fixes or explicit frozen-contract restriction. No evidence found that the fixture oracles are intrinsically vacuous; the vacuity is specifically timed array checksum and unchecked timed work.
