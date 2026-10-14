# Draft PR: Remediate dependency advisories and protect OMIT prototype paths

Local-only review draft; no external PR created. Parent: [Wayfinder](../WAYFINDER.md). Ticket: [06](../tickets/06-dependency-advisories.md). Implementation `ad5c47a` follows the prior overhaul commits.

The authorized audit found16 known advisories, including a production lodash prototype-deletion defect reachable through the rule language's OMIT function. Upgrade lodash4.17.23→4.18.1 and pin patched transitive Vite/PostCSS/nanoid/esbuild/source-map-js versions. Add an actual-rule regression that safely detects deletion of a temporary prototype marker. No advisory exceptions or ignored CVEs are introduced.

Validation:368 tests plus complete typecheck/lint/build/packed-consumer checks pass. A second public audit reports zero known advisories. Before/after scan responses are tracked. Performance is reconfirmed in12 fresh balanced blocks against the final dependency/build tree, with the prior measurements preserved separately; source interpreter code itself remains unchanged.
