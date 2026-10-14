# Attempt and infrastructure record

These failures are not performance observations and were never interpreted as fast samples. Valid timed samples in the retained campaigns were not discarded.

| Attempt | Evidence and disposition |
| --- | --- |
| Sandboxed report launch | Synthetic /tmp/.git mount registration failed with quota error before command execution. Escalated task-scoped writes worked. Reporter artifacts stay in ignored .cache. |
| Initial baseline suite with default /tmp | Vitest failed to load 17 suites with ENOENT transform-cache paths; one suite / 99 tests passed. Full stdout was tool output rather than a saved file; this row retains its essential failure excerpt. Setting task TMPDIR and rerunning passed all 462 source tests. |
| First minification launch | Wrong `--key=value` syntax fell back to a missing historical baseline module before sampling; loop1-screen.txt retains stderr. Correct key=value retry is separate. |
| Candidate suite discovery | Copied baseline *.test.ts files under .cache were also discovered, producing seven documentation-fixture failures (918 tests passed). loop2-tests.txt retains output. Removed only those owned cached tests and targeted src explicitly; source suite passed. |
| Missing-candidate launch | Candidate build was blocked by the preceding infrastructure failure. loop2-screen.txt records ENOENT before any sampling. Successful retry is separate. |
| Monolithic browser diagnostic | Tool returned `Preview automation evaluate timed out after 15000ms`; no complete result was captured or used. Split into bounded per-block calls, retained all 84 resulting diagnostic rows. These within-tab observations are not independent browser-process performance evidence. |
| Initial copied source snapshot | It briefly included the uncommitted validation edit. The isolated minification executor source was restored explicitly from git HEAD before building; no contaminated candidate was measured. Astra independently verified final baseline/final source-map identities. |
| Expanded artifact qualification | Initial 7,954-probe function matrix passed. It lacked a successful UNZIP/UNZIPDICT input, so two valid domain probes were added; initial summary remains alongside the expanded result. This was correctness qualification, not performance resampling. |

Staged whitespace checking flags trailing spaces and blank lines in verbatim Vitest/Biome stdout. These raw bytes are preserved for auditability; source/documentation whitespace checking excludes only the results directory. This is a log-format exception, not a waived source or test failure.
