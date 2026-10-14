# Close host-value, resource, date, trace and type contracts

Parent: [Wayfinder](../WAYFINDER.md), [gap ticket](../tickets/05-residual-contracts.md). Local review draft; no external PR.

Returning a frozen/cyclic input graph previously triggered recursive materialization, mutation or host function calls. Return protected input values by identity, propagate provenance through every path read, reject accessors and opaque host traversal, and execute structural arrays without input constructors/species/iterators. Regression cases include generated containers and subsequent input mutation.

Bound parser tokens, shared execution work, arrays, strings, data depth and cooperative duration. Add conservative byte-aware syntax cache accounting. Resource errors bypass rule catches; these controls do not provide process isolation or a VM heap limit. The cold parser charges source scanning before work begins.

DATE/DATEISO accept epochs, validated ISO dates/explicit-zone datetimes and unit-bearing durations. Invalid/ambiguous inputs reject. Traces retain historical snapshots; runtime errors stop unsolicited console output. Default errors preserve earlier writes; opt-in atomic execution rolls back interpreter property changes while preserving aliases, cycles, array holes and descriptors. Literal trace options select precise factory return modes.

Validation: combined458 tests, TypeScript, lint with zero errors, three build formats and nine actual collaborative-browser checks passed before the final cold-source accounting correction. Final full package validation and comparative performance evidence will be reconciled in [results](../RESULTS.md).

Compatibility: stricter data/rule/date/resource contracts can reject legacy programs. Atomic mode is opt-in. Dynamic strings cannot infer static result types. Host code and Proxy side effects are outside rollback/preemption guarantees.
