# Runtime security review

Reviewed the structural executor, mutation journal and trace snapshots on the merged `ef4f3c5` baseline. Scope includes hostile JSON rules/data and the documented JavaScript graph boundary. Trusted injected engines can execute arbitrary host code; tests of their thrown values below ensure tracing adds no further getter/coercion calls. Proxy traps and externally changing property descriptors remain outside the sandbox contract.

## Attack map and confirmed findings

| Surface | Bounded probe | Classification and correction |
| --- | --- | --- |
| Rule/input shared aliases | A first assignment replaces a later rule through `input.program === rules`, injecting an accessor return rule | **Confirmed preflight bypass.** Baseline executed the injected getter and returned 9 after validating only the original rule. The same path could inject a cyclic rule. Validation now builds a detached per-call program in the same descriptor walk. Input writes remain visible on the caller graph but do not change the current executable program. |
| Atomic array truncation | `Object.preventExtensions([1,2,3])`, atomic `items.length = 0`, then `THROW("stop")` | **Confirmed contract violation.** Native truncation deleted configurable indices; rollback could not recreate properties on a nonextensible array. Baseline left length 0 and removed all three indices. Journal now rejects truncations with potentially removed configurable indices before the write. |
| Partial failed truncation | Nonextensible four-element array with a lower nonconfigurable index, shrink to 0 | **Confirmed same irreversible-write class.** Higher configurable indices could disappear before the lower index blocked ArraySetLength. Preflight considers every potentially removed index, before any deletion; earlier transaction writes roll back. |
| Trace errors | Injected engine throws Error with a message getter, or an object with coercion methods | **Confirmed tracing contract hardening.** Baseline invoked the message getter twice or arbitrary object coercion while describing the error. Executor now reads only an own string data-message descriptor, otherwise emits a descriptive marker; the original thrown identity propagates. This is not an arbitrary JSON-to-code exploit. |
| Snapshot traversal accounting | Direct snapshot of a 101-character key under maxStringLength 100; repeated alias with long keys under small work limit | **Confirmed helper accounting gap.** Keys were copied without charging their lengths. Snapshots now check/charge key strings before copying and charge generated BigInt/Symbol text. Public executor could previously reject later serialized text, after snapshot allocation; this closes the earlier traversal boundary. |

## Preserved behavior and rejected approaches

Rule values are captured for the current execution, not permanently compiled at factory creation. Caller mutations between executions are still validated on every call. Tests verify that replacing a later rule or a conditional branch through an input alias never invokes its injected getter, and injecting a cycle never executes it; the next call rejects the now-malformed source program. Snapshot objects have null prototypes, rule lists are dense arrays, and strings remain immutable primitives. Shared rule DAGs are copied per occurrence, under the existing 10,000-node/work/depth bounds, rather than memoized in a way that could hide expansion. Input graphs are not copied into the program except allowed structural values. A second unchecked clone pass or revalidation only after mutation was rejected because it would leave a gap between validation and execution.

Default execution still leaves earlier writes in place on error, including successful non-atomic truncation of nonextensible arrays. Atomic nonextensible sparse-array truncation remains supported when no properties must be recreated on rollback. Extensible arrays retain exact rollback of holes and property attributes even when a lower nonconfigurable index causes a partial native truncation failure.

The journal rejects irreversible deletion rather than copying or replacing arrays: replacement would break identity, aliases, descriptors and host references. It does not reject every nonextensible array, because shrinking a hole-only tail can be reversed by restoring the existing length descriptor. It does not apply the restriction to ordinary execution.

Error formatting uses descriptors rather than try/catch around coercion: catching a getter exception would still execute its side effects. Ordinary own string Error messages keep their trace text. Thrown objects lacking a safe own string message use `[Thrown object]`; their getters, toString and Symbol.toPrimitive are never called by trace formatting.

Beyond detaching the validated structure, no source changes were required for structural descriptor validation, callback reserved-field cleanup, nested atomic savepoints, sparse structural map/find behavior, or ResourceLimitError bypass of rule catches. Existing regressions cover these contracts. Rule arrays use own indexed descriptors during validation; logical lists are checked for dense enumerable own data values, and rule keys/symbols/accessors/unknown fields reject before execution. Input graph access remains lazy by contract, rather than eagerly walking every unused property.

The journal saves and restores callback scope before propagating callback failures. Restoration is mandatory cleanup and deliberately does not consume execution work: an already exhausted budget must not prevent rollback. Journal growth remains capped at 100,000 entries; the additional truncation scan charges property-name work before numeric classification.

The synchronous dynamic budget of nested injected custom-engine calls is a separate coordinator-owned design review. No JSON-level reentrant factory call was identified in this runtime review. Host plugins and Proxy traps are not treated as untrusted process isolation.

## Verification

Dedicated regressions live in `src/structural-engine/security-runtime.test.ts`. Before the patch, the nonextensible array restoration and message-getter tests failed with exact state/getter-count evidence. After the initial patch, 108 focused tests passed across security-runtime, limits-atomic, hardening and existing index trace snapshots. Additional targeted cases cover partial truncation, sparse nonextensible tails, BigInt/Symbol output, key accounting and arbitrary thrown-value coercion. The final combined runtime/index run passed 127 tests, TypeScript typecheck passed, and owned-file Biome checks passed; the coordinator owns the integrated full-suite run.

## Independent coordinator-patch review

Reviewed the coordinator's standalone-engine cold-compilation budget, primitive source and own-descriptor metadata checks, and private WeakSet argument-array branding. No bypass was found in the focused variants. Source validation rejects object wrappers before method lookup; fake compiled source accessors and inherited source getters are not called; cached metadata ignores caller-supplied assignment/lhs getters. Evaluation restores the resolver in `finally` even on validation failure.

Argument lists receive authority only at internal comma/call construction sites. Ordinary copied arrays retain their data properties but do not inherit WeakSet authority. Independent variants laundered a forged marker/function array through ARRAY, REVERSE, FILTER_VALUES, CONS plus MAP, and REDUCE; none executed the host function. A marker getter was not consulted. Ordinary comma, MAP and REDUCE argument construction retained expected results. Generated result materialization creates new containers, so the private brand is not retained by copied output.

The coordinator's path guard rejects Object.prototype, Array.prototype and own constructor-function targets without inspecting constructor function properties; this closes the standard intrinsic-prototype alias considered during runtime review. The broader custom-prototype-record behavior remains governed by existing own-property shadowing tests, rather than replacing it with a new blanket rejection contract.

The combined dedicated security-runtime/security-engine/security-inputs run passed23 tests and TypeScript typecheck passed. The runtime helper also preserves ordinary empty Error trace text without reading inherited accessors. Full-suite validation remains coordinator-owned.
