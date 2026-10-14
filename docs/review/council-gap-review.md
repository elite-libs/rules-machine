# Independent gap-closure review

The gap follow-up reused the Architect and Performance Wizard with separate worktrees and an independent GPT-6-Astra review. The expert agent ended with a provider content flag before delivering a completed final review. Its useful findings were retained and checked by the coordinator/Architect; this is not a claim that the expert finished a comprehensive pass.

| Independent finding | Resolution |
| --- | --- |
| Native structural array methods invoke numeric accessors and constructor/species hooks | Descriptor-only indexed traversal, sparse-array semantics and zero-call regression counters |
| Structural rule validation reads getters or custom array iterators before rejecting | Own descriptor preflight and dense rule-list checks before input mutation |
| Deep trace snapshots fail with a native stack error | Typed depth limits before recursive descent |
| Bulk string operations evade useful-work accounting | String length/processing charges, output bounds and targeted resource tests |
| GET through generated containers loses nested input provenance and invokes a function | Descriptor reader applied at every path step; PUT/OMIT/DICT and changed-input regressions |

The Architect's final read-through found an additional atomic callback-context defect: a journaled assignment to `$item` could restore an expired temporary field during a later rollback. Commit `d4a88ea` journals context entry before callback writes. Nested callback assignments and actual-browser regression checks verify cleanup. A subsequent read-only Architect pass found no further concrete defects in the reviewed journal, budget, validation, callback and trace paths; that is bounded review evidence, not proof of absence of bugs.

The Performance Wizard independently found a quadratic Rust cycle-check path during native array measurements and a parent-side wire expansion gap. The coordinator also identified the wire gap; the Architect owns its bounded encoding regression. Measurements preserve the pre-tuning candidate and confirm the final candidate separately. Unsupported Rust language/transport semantics remain explicit.

The Architect also reviewed both additional Rust tuning candidates (`79e61d2` callback allocation reduction and `91ef65e` compiled path keys), checking restoration, mutation, nested contexts and fresh input reads. Both passed the bounded source review.

Original council proposals and prior evidence stay linked from [results](RESULTS.md). No agent recommendation was silently promoted into a correctness or performance claim.

The final independent Rust domain pass found mixed numeric-string coercion, INDEX validation order, pow exponent-NaN precedence and UNDEFINED constant handling. The coordinator's related checks found MIN/MAX zero/type propagation, COUNT_KEYS, intermediate array/path caps, append boundary and repeated-DAG cycle traversal issues. The performance worker added an 11,158-case numeric/domain grid, retained failures, matched supported semantics and explicitly rejected general fractional powers/NaN sorting where exact behavior was not claimed. A subsequent float-boundary pass found that serde_json’s default float parser changed some incoming values. Enabling `float_roundtrip` and replacing logarithmic power detection with exact significand-bit checks fixed those boundary errors. The earlier 56 power differences were confounded by changed input floats; they are not evidence that Rust libm and V8 alone caused the differences. The remaining power restriction is conservative. The memoized DAG regression proves bounded unique-node visits for the small shared-graph case; it is not a strict VM heap guarantee.
