# Unreleased overhaul notes

This branch changes behavior and requires compatibility review before a release. No package was published.

- Nested returns stop the enclosing pipeline; returns inside array `run` stop only that callback. The string `BREAK` is ordinary data.
- Recursive and/or groups execute with short circuiting. Empty AND is true; empty OR is false. Equality precedence is explicit, and assignment follows logical operations.
- Array scope variables are restored, including on failure. Caller input can be reused. User assignments still mutate caller input.
- Assignment recognizes compact and bracket targets and ignores operators inside quoted strings. Nested/chained assignments and unsafe paths reject. Own data keys are resolved consistently, including literal dotted keys.
- Malformed/ambiguous/cyclic rule structures and invalid array destinations reject before structural execution; runtime evaluation failures can still leave prior mutations.
- Explicit null values, empty/singleton literals, COSH, primality, boolean/number classification, dictionary keys and bounded while predicates are corrected.
- Unsupported operators/calls, malformed strings and empty function calls reject rather than silently becoming unrelated values. Legacy leading `return ` expression text remains accepted but is not an early-return rule; use `{ return: 'expression' }`.
- Rule and expression limits plus finite numeric/range limits now reject formerly unbounded programs. Refer to README for exact bounds and remaining sandbox limitations.
- Disabled tracing skips JSON serialization. Enabled trace snapshots tolerate circular values and BigInt without masking original errors; this does not add general cyclic-object expression support.
- Reused factories cache up to 512 parsed expressions while resolving current inputs on every evaluation. Resolver restoration covers reentrancy and failure.
- Node ESM/CJS exports and browser IIFE are smoke-tested; the parser null fix is bundled downstream. The engine factories and RuleMachineOptions are exported.
- Validation uses pinned pnpm 10.34.6, Vitest 5.0.3 and Node 24/26 CI. The library typecheck is separate from standalone examples. The pnpm lockfile is authoritative.

See [Wayfinder](WAYFINDER.md) for review drafts, measured evidence, and remaining gaps.
