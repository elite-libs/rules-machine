# Runtime security review

Reviewed the structural executor, mutation journal and trace snapshots on the merged `ef4f3c5` baseline. Scope includes hostile JSON rules/data and the documented JavaScript graph boundary. Trusted injected engines can execute arbitrary host code; tests of their thrown values below ensure tracing adds no further getter/coercion calls. Proxy traps and externally changing property descriptors remain outside the sandbox contract.

## Attack map and confirmed findings

| Surface | Bounded probe | Classification and correction |
| --- | --- | --- |
| Atomic array truncation | `Object.preventExtensions([1,2,3])`, atomic `items.length = 0`, then `THROW("stop")` | **Confirmed contract violation.** Native truncation deleted configurable indices; rollback could not recreate properties on a nonextensible array. Baseline left length 0 and removed all three indices. Journal now rejects truncations with potentially removed configurable indices before the write. |
| Partial failed truncation | Nonextensible four-element array with a lower nonconfigurable index, shrink to 0 | **Confirmed same irreversible-write class.** Higher configurable indices could disappear before the lower index blocked ArraySetLength. Preflight considers every potentially removed index, before any deletion; earlier transaction writes roll back. |
| Trace errors | Injected engine throws Error with a message getter, or an object with coercion methods | **Confirmed tracing contract hardening.** Baseline invoked the message getter twice or arbitrary object coercion while describing the error. Executor now reads only an own string data-message descriptor, otherwise emits a descriptive marker; the original thrown identity propagates. This is not an arbitrary JSON-to-code exploit. |
| Snapshot traversal accounting | Direct snapshot of a 101-character key under maxStringLength 100; repeated alias with long keys under small work limit | **Confirmed helper accounting gap.** Keys were copied without charging their lengths. Snapshots now check/charge key strings before copying and charge generated BigInt/Symbol text. Public executor could previously reject later serialized text, after snapshot allocation; this closes the earlier traversal boundary. |

## Preserved behavior and rejected approaches

Default execution still leaves earlier writes in place on error, including successful non-atomic truncation of nonextensible arrays. Atomic nonextensible sparse-array truncation remains supported when no properties must be recreated on rollback. Extensible arrays retain exact rollback of holes and property attributes even when a lower nonconfigurable index causes a partial native truncation failure.

The journal rejects irreversible deletion rather than copying or replacing arrays: replacement would break identity, aliases, descriptors and host references. It does not reject every nonextensible array, because shrinking a hole-only tail can be reversed by restoring the existing length descriptor. It does not apply the restriction to ordinary execution.

Error formatting uses descriptors rather than try/catch around coercion: catching a getter exception would still execute its side effects. Ordinary own string Error messages keep their trace text. Thrown objects lacking a safe own string message use `[Thrown object]`; their getters, toString and Symbol.toPrimitive are never called by trace formatting.

No source changes were required for complete structural descriptor validation, callback reserved-field cleanup, nested atomic savepoints, sparse structural map/find behavior, or ResourceLimitError bypass of rule catches. Existing regressions cover these contracts. Rule arrays use own indexed descriptors during validation; logical lists are checked for dense enumerable own data values, and rule keys/symbols/accessors/unknown fields reject before execution. Input graph access remains lazy by contract, rather than eagerly walking every unused property.

The journal saves and restores callback scope before propagating callback failures. Restoration is mandatory cleanup and deliberately does not consume execution work: an already exhausted budget must not prevent rollback. Journal growth remains capped at 100,000 entries; the additional truncation scan charges property-name work before numeric classification.

The synchronous dynamic budget of nested injected custom-engine calls is a separate coordinator-owned design review. No JSON-level reentrant factory call was identified in this runtime review. Host plugins and Proxy traps are not treated as untrusted process isolation.

## Verification

Dedicated regressions live in `src/structural-engine/security-runtime.test.ts`. Before the patch, the nonextensible array restoration and message-getter tests failed with exact state/getter-count evidence. After the initial patch, 108 focused tests passed across security-runtime, limits-atomic, hardening and existing index trace snapshots. Additional targeted cases cover partial truncation, sparse nonextensible tails, BigInt/Symbol output, key accounting and arbitrary thrown-value coercion. The final dedicated/runtime executor run passed 26 tests, TypeScript typecheck passed, and owned-file Biome checks passed; the coordinator owns the integrated full-suite run.
