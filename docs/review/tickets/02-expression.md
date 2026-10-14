# 02: Expression correctness and bounded operations

Parent: [Wayfinder](../WAYFINDER.md).

Fix quote-aware assignment detection including compact syntax and comparison exclusion; enforce writable literal paths. Correct COSH and primality; reject non-finite/unsafe integer GCD arguments; bound RANGE allocation and primality work. Prevent while predicates reading beyond the array. Make dictionary construction preserve dangerous-looking keys as own data properties. Correct boolean and numeric classification rather than retaining tests that encode bugs.

Acceptance: behavioral regressions and existing expression suite; resource limits documented as compatibility changes. Broader sandbox isolation remains a separate residual requirement.

Final disposition and limitations: [results and decisions](../RESULTS.md). No external ticket or PR was published.
