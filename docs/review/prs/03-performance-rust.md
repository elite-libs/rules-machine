# Draft PR: Add reproducible four-arm performance evaluation and Rust subset

Status: local review draft; no external PR created. Parent: [Wayfinder](../WAYFINDER.md). Ticket: [03](../tickets/03-performance-rust.md). Harness commits include `e68994d`, `776b956`, `38f389e`; evidence commits follow those on the umbrella branch.

Adds serialized fixtures with independent business-state oracles, timed completed-work/digest checks and failure sentinels, balanced independent process blocks, retained raw data, paired uncertainty analysis, and a native Rust subset interpreter. Original source/dependencies, upgrade-only, tuned and Rust arms are isolated. Array comparisons exclude only historically leaked internal scope fields; independent regressions verify the corrected cleanup behavior.

Confirmation: 12 fixed process blocks, no discarded valid runs. Tuned aggregate 13.67× [13.27,14.06] across seven reused-program slices; upgrade-only 1.00× [0.98,1.02]. Native Rust versus tuned is 5.83× [5.06,6.65] on the four shared scalar slices. Results include input reset and output digest work. See the tracked comparison report and raw results for boundaries, host drift and exclusions; these figures do not establish cold-start or production-bridge gains.

Rust remains an experimental subset with explicit gaps, not a replacement release. Full library functionality, JavaScript integration and wider resource guarantees require separate work.
