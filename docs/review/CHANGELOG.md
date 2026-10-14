# Unreleased overhaul notes

This branch changes behavior and requires compatibility review before a release. No package was published.

- Nested returns stop the enclosing pipeline; returns inside array `run` stop only that callback. The string `BREAK` is ordinary data.
- Recursive and/or groups execute with short circuiting. Empty AND is true; empty OR is false. Equality precedence is explicit, and assignment follows logical operations.
- Array scope variables are restored, including on failure. Caller input can be reused. User assignments still mutate caller input.
- Assignment recognizes compact and bracket targets and ignores operators inside quoted strings. Nested/chained assignments and unsafe paths reject. Own data keys are resolved consistently, including literal dotted keys.
- Malformed/ambiguous/cyclic rule structures and invalid array destinations reject before structural execution; runtime evaluation failures leave prior mutations by default; opt-in `atomic` restores interpreter writes on uncaught failure.
- Explicit null values, empty/singleton literals, COSH, primality, boolean/number classification, dictionary keys and bounded while predicates are corrected.
- Unsupported operators/calls, malformed strings and empty function calls reject rather than silently becoming unrelated values. Legacy leading `return ` expression text remains accepted but is not an early-return rule; use `{ return: 'expression' }`.
- Rule and expression limits plus finite numeric/range limits now reject formerly unbounded programs. Refer to README for exact bounds and remaining sandbox limitations.
- Disabled tracing skips JSON serialization. Enabled trace snapshots tolerate circular values and BigInt without masking original errors; input cycles and aliases can be returned by identity without recursive mutation.
- Reused factories cache up to 512 parsed expressions with an additional 8 MiB conservative accounting ceiling while resolving current inputs on every evaluation. Resolver restoration covers reentrancy and failure.
- Node ESM/CJS exports and browser IIFE are smoke-tested; the parser null fix is bundled downstream. The engine factories and RuleMachineOptions are exported.
- Validation uses pinned pnpm 10.34.6, Vitest 5.0.3 and Node 24/26 CI. The library typecheck is separate from standalone examples. The pnpm lockfile is authoritative.

- Authorized dependency follow-up upgrades lodash to4.18.1 and pins patched build/coverage transitives. All16 reported advisories are resolved; a rule-language OMIT prototype-deletion regression was added.

See [Wayfinder](WAYFINDER.md) for review drafts, measured evidence, and remaining gaps.

## Gap closure follow-up

- Host input values are protected lazily; materialization never invokes supplied functions or mutates returned input graphs. Nested GET reads preserve protection through generated containers. Array traversal uses data descriptors and avoids constructor/species/iterator hooks.
- Shared configurable work, array, string, traversal-depth and cooperative duration budgets supplement syntax bounds. Resource errors bypass rule catches. Cold source scanning counts toward work.
- DATE/DATEISO now enforce epoch, explicit ISO and unit-bearing duration contracts. This intentionally rejects formerly ambiguous/fallback date inputs.
- Trace rows preserve historical values without getters or toJSON. Unexpected runtime errors do not write to the console. `atomic: true` adds rollback while retaining the default partial-write behavior.
- Factory overloads distinguish literal trace modes; dynamic trace options retain a union. Arbitrary rule strings still cannot provide static result inference.
- Compact negative comma arguments now parse consistently with spaced forms.
- Rust has an expanded, differentially checked core and bounded persistent Node child-process bridge. It remains an experiment with explicit unsupported functions and transport differences; see its README and shared specification.
