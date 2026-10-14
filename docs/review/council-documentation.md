# Documentation and executor follow-up

Reviewed README, guide, examples, layered examples, design notes, historical v3 notes, and integrated executor. Freshness: current working session; executable probes in docs-repro.ts and docs-more.ts used current integrated source. This report distinguishes observed baseline failures from fixes being integrated.

## Documentation corrections implemented in architect worktree

- README/guide grading uses nested else rather than invalid standalone `{else:...}`. Descending independent threshold assignments previously replaced A with B; nested branches now preserve A.
- Guide discount and layered reward tiers now initialize zero and evaluate ascending thresholds, preserving highest qualifying discount.
- README and guide correctly describe inline AND/OR short circuit, assignment mutations, no-return last evaluated values, and callback-local returns.
- String concatenation uses STRING([...]); `+` is numeric. Claimed %= assignment removed.
- Array map example correctly returns mapped array and describes mutation separately.
- Unsupported riskyOperation() replaced with explicit THROW so try/catch actually demonstrates errors.
- Cart wildcard paths replaced by structural map then SUM. Numeric cart result corrected to 65.325; currency rounding remains host policy.
- Access/eligibility defaults moved to initial assignments instead of standalone else. Host-provided transaction.hour replaces nonexistent HOUR(). Host randomRolls fields replace nonexistent RAND(), with Math.random generation shown outside rule strings.
- Object-valued return rules replaced by string DICT expressions. Sales-tax GET now receives key and object arguments; invalid string `map: cart.items` removed.
- Null versus undefined is explicit; structural logical guards protect optional strings before LENGTH/STRING_CONTAINS.
- Fixed-duration DATEISO("14d")/DATEISO("30d") examples replace unsupported long/single-quoted relative date inputs. No date API overhaul.
- Layered app hooks use matching named import, consistent {user} input wrapping, explicit return for registration, and imported Rule type.
- Historical design alternatives labeled as proposals; v3 document labeled historical planning, invalid factory-options snippet fixed, stale coverage/release guarantees removed.
- README documents trusted mutable JSON input, own-property reads, forbidden assignment paths, synchronous nonsandbox execution, structural/expression/numeric bounds, and legacy FILTER_VALUES exclusion semantics.

## Additional executable findings reported to coordinator

1. Unsupported expression tokens can be silently ignored upstream: false && true => true; true || false => false; HOUR(timestamp) => timestamp; RAND()/riskyOperation() => undefined. Engine syntax validation being integrated.
2. NULL constant was absent, so explicit input null == null returned false. Coordinator now added NULL handling.
3. Missing == precedence misplaced mixed logical comparisons. Coordinator now corrected precedence; docs use structural logical guards for optional fields.
4. Empty and singleton array literals failed baseline parsing. Coordinator is fixing ARRAY wrapping; performance agent is normalizing empty token pairs. Keep ordinary literal syntax in docs, preserve nested-array limitation.

## Executor follow-up

- Prevalidation now rejects array destination unsafe paths before callbacks/earlier assignments execute (commit 7985e3a). Blank source paths and invalid input types receive UserError. This closes observed side-effect-before-error gap.
- Structural validation bounds recursion before visiting child nodes, rejects cyclic programs, handles shared DAG nodes without false cycle positives, and inspects sparse arrays through for-of.
- Per-array returns stop current callback; nested control flow propagates correctly to that boundary. Context restoration is in finally; exceptions restore outer callback state and remove transient keys. Mutations to actual item objects remain caller-visible by design.
- Frozen/preventExtensions input still cannot execute arrays (context injection requires mutation), even for read-only callbacks. README now explicitly requires mutable input. Plain expression reads against frozen input are allowed. Avoid claiming a general immutable engine.
- trace:false no longer serializes input. Trace-enabled serialization handles cycles and BigInt, preserves repeated noncyclic references, and does not replace original rule errors when toJSON throws. Raw trace value/result references remain live in some row fields, so trace is not a deep immutable audit snapshot; consider a future trace schema/version if immutable audit records are required.
- Input is trusted JSON. Functions/getters/class instances can produce behavior during property access, parser traversal, or JSON serialization; key validation is not a sandbox for hostile JS objects. No global prototype pollution/RCE claim was established.
- Fixed hard limits are not a wall-clock budget. Large valid nested array pipelines can still multiply work; isolation/worker timeout remains host responsibility if accepting untrusted programs.

## Verification

Added 7 tests that extract and execute actual Markdown showcase blocks (guide tiers/map, cart, access/eligibility, loan/fraud, sales tax, loot replay, validation). They intentionally use trusted documentation compilation in test code only. Additional null-parser regression committed as 45058a7; structural prevalidation regression committed as 7985e3a.
