# 06: Authorized dependency scan and remediation

Parent: [Wayfinder](../WAYFINDER.md). Status: patched, re-audited and performance-reconfirmed. Implementation: `ad5c47a`.

After the user explicitly authorized disclosure to pnpm's public advisory service, the locked tree reported16 advisories:10 high,5 moderate,1 low. All16 are resolved in the patched tree; a fresh scan reports zero known advisories. This is a point-in-time advisory result, not proof of absence of unknown vulnerabilities.

| Package | Before | Patched | Findings | Relevance |
| --- | --- | --- | --- | --- |
| lodash |4.17.23|4.18.1|1 high,1 moderate|Production dependency. OMIT prototype-deletion path reproduced through actual library; template injection API is not used by library. |
| vite |7.3.1|7.3.7|3 high,2 moderate|Build/test tooling; dev-server and Windows-specific preconditions vary. |
| postcss |8.5.8|8.5.29|2 high,2 moderate|Build tooling; attacker-controlled CSS/source-map preconditions. |
| nanoid |3.3.11|3.3.20|3 high|Build transitive dependency; generator input preconditions. |
| esbuild |0.27.7|0.28.2|1 low|Build tooling; reported Windows development-server condition. |
| source-map-js |1.2.1|1.2.2|1 high|Coverage tooling; crafted indexed-source-map precondition. |

The esbuild override crosses its0.x minor boundary because tsup8.5.1 declares^0.27; full test/build/packed-consumer validation passed with0.28.2. Other selected versions stay in their existing compatible major lines. Exact overrides prevent the lockfile resolving the vulnerable transitive versions again; no CVEs were ignored.

The regression creates only a test-owned configurable prototype marker, passes JSON-compatible array-wrapped paths through `ruleFactory('OMIT(paths, data)')`, verifies the marker survives, and removes it in finally. Before the dependency patch the same actual-library call deleted the marker. This proves the deletion route without touching built-in prototype methods. It does not establish overwrite capability or RCE.

Evidence: [before summary](../evidence/advisories/before-summary.json), [full before response](../evidence/advisories/before.json), [after response](../evidence/advisories/after.json), and `src/expression-engine/dependency-security.test.ts`.

Primary references: [Lodash omit/unset](https://github.com/lodash/lodash/security/advisories/GHSA-f23m-r3pf-42rh), [Lodash template](https://github.com/lodash/lodash/security/advisories/GHSA-r5fr-rjxr-66jc). All16 advisory identifiers and source URLs are retained in the before summary.

Final confirmation:12 fresh balanced blocks/300 samples, all valid, with measured candidate dependency/build commit`ad5c47a`. Full checks and offline frozen install pass; actual browser security regression also passes. [Final performance evidence](../../../performance/comparison/results/2026-10-14-security/report.md).
