# Astra independent TypeScript security review

Reviewed the TypeScript changes after `ef4f3c5`, including `d264414`, `f039078`, and `af2d97c`, plus the coordinator's follow-up intrinsic-alias guard. This was a focused independent defensive pass, not a proof of sandbox isolation. Rust source was being reviewed separately and was excluded from this pass.

## Confirmed finding: intrinsic iterator prototype aliases remained writable

The first intrinsic-prototype guard rejected `Object.prototype`, `Array.prototype`, and objects with an own data-valued function `constructor`. That left three concrete native prototype shapes writable on Node 26:

| Target | Own constructor | Parent | Before-fix result |
|---|---|---|---|
| `%IteratorPrototype%` | Accessor | `Object.prototype` | Marker assignment succeeded |
| `%AsyncGeneratorPrototype%` | Object value | `%AsyncIteratorPrototype%`, which has no constructor | Marker assignment succeeded |
| `%AsyncIteratorPrototype%` | Absent | `Object.prototype` | Marker assignment succeeded |

For each, a bounded isolated Node process passed the prototype through an input alias, assigned one uniquely named property through `ruleFactory`, checked for the property, and deleted it in `finally`. No prototype method or getter was invoked. The tested built artifact contained the initial `af2d97c` host-prototype guard. The finding was reported immediately to the coordinator.

This requires the host application to supply a live intrinsic prototype object as input. It is not an ordinary JSON input exploit, nor an escape from a trusted Proxy or custom engine. Nevertheless, assignment through that explicitly supplied alias modified a shared intrinsic, contrary to the intended prototype-write boundary.

The coordinator's follow-up rejects an own constructor accessor as well as a function-valued constructor, and rejects non-array write targets with own `Symbol.iterator`, `Symbol.asyncIterator`, or `Symbol.toStringTag` metadata. Inspection uses descriptors and own-key membership without invoking their values. This catches the observed sync/async/generator prototype families across realms without relying on same-realm identity captures or inspecting a potentially hostile constructor object. I reviewed the final patch and its thirteen local/foreign-realm regression targets, including Object/Array prototypes and Math. The focused source suite passed all 10 tests in `evidence/iterator-prototype-compatibility.txt`; it also checks that protocol/constructor accessors are never invoked and ordinary JSON constructor-object data remains writable. Final combined Node/browser qualification remains the coordinator's responsibility.

Compatibility consequence: non-array JavaScript records deliberately carrying these well-known protocol symbols become opaque for writes. Ordinary JSON records cannot carry symbol keys and are unaffected. Arrays retain their established symbol-field treatment. Constructor accessors are rejected without invocation; an ordinary nested JSON record with a data-valued object constructor must remain writable through an unrelated safe key. The follow-up is a deliberate conservative host-graph boundary, not a claim to identify every possible object ever used as a prototype.

## Reviewed fixes and conclusions

- **Argument authenticity and provenance:** The private WeakSet authenticates parser-created argument arrays; copied `isArgumentsArray` properties no longer confer authority. Built-in argument dispatch also checks callable arguments against protected input provenance. I inspected comma/higher-order construction, `OMIT`, generated containers, `GET`/`PUT`, and materialization. I found no remaining ordinary-data marker-laundering route in this pass. Raw host callbacks remain rejected.
- **Cold compilation and public metadata:** Convenience evaluation compiles under the same budget as evaluation. Explicit preparation remains separately supported, and warm cache hits intentionally avoid charging parsing again. `compile` rejects nonprimitive sources; `evaluate` accepts an own string data source and ignores forged assignment metadata. Resolver state is restored on rejection and exceptions. I found no new metadata-getter bypass.
- **Validated-rule snapshots:** Recursive descriptor-based snapshots detach execution from mutable rule/input aliases before any input mutation. Arrays, branches, logical groups, and nested bodies are copied into interpreter-owned structures; expression strings are immutable. The mutable caller program is still revalidated on later executions. This closes the ordinary alias TOCTOU route examined here.
- **Atomic truncation:** Before shortening a nonextensible array, the journal detects removable indices and rejects before deletion. Extensible-array rollback still records descriptors and original length; nonextensible holes can be shortened and restored when no index recreation is required. I reviewed budget-failure ordering, partial truncation, nonconfigurable indices, savepoints, and callback context restoration. No additional interpreter-owned rollback defect was identified in this pass.
- **Trace/error snapshots:** Error message handling reads an own data descriptor rather than invoking getters or coercion hooks. Snapshot key and generated primitive-text accounting are now charged. Traversal is descriptor-based; arrays retain length, cycles receive markers, and historical aliases are copied. No new supplied-getter invocation was identified for ordinary supported objects.

## Scope and residual limits

Functions, custom engines/resolvers, proxies, and modified host intrinsics require their documented trust treatment. Native operations such as key enumeration, regular-expression matching, bigint text conversion, or JSON serialization may finish before the next cooperative budget check; the controls are not a strict heap cap or preemptive timeout. The prototype-family enumeration was bounded and covered sync/async iterators, generators, typed arrays, DataView, function families, Date, RegExp, Promise, Error, Symbol, and BigInt; it was not an exhaustive inventory of every browser/Node host object.

No additional ordinary-JSON security bypass was confirmed. The intrinsic-write gap described above requires caller-held host aliases. Passing focused regression tests does not establish absence of all vulnerabilities. All reproductions were local and bounded; no external scans, production systems, paid compute, or destructive probes were used.
