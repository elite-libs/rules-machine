# Draft PR: Make public workflows executable and document compatibility limits

Status: local review draft; no external PR created. Parent: [Wayfinder](../WAYFINDER.md). Commits: `29a348d`, `10b9501`, followed by final reconciliation records.

Existing examples advertised unsupported wildcard paths, arbitrary calls, JavaScript logical operators and object-valued return rules; some displayed totals were incorrect. Corrects the workflows, supplies host-derived random/hour values explicitly, explains mutation/return/array-scope semantics and limits, and executes seven workflows extracted directly from the Markdown. Marks older audit/version-planning text as historical.

Validation: all seven actual-Markdown workflow tests pass in the complete368-test suite. The audit retains the independent council proposals and expert/measurement critiques with a final disposition matrix, rather than treating initial suspicions as confirmed findings. Remaining parser/date/sandbox/type gaps have explicit follow-up acceptance criteria.
