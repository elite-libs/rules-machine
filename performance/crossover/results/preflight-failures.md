# Pre-timing harness failures

These attempts produced no timing samples and are excluded from the pilot and confirmation.

1. Sandboxed runner (Node v26.8.2): spawned Node exited 0 with no stdout, causing `SyntaxError: Unexpected end of JSON input` at run.mjs JSON.parse. A minimal `spawn(process.execPath,['-e','console.log(123)'])` also produced no stdout. Escalated local execution resolved the environment issue. The runner now waits for `close` rather than `exit` to ensure stdout is drained.
2. First escalated oracle: worker rust exited 1 with `TypeError: Wire value nesting exceeds 40` from wire.mjs measure. The intended unsupported `layers-32-array` was not matched because the initial error matcher expected the word `depth`. Matcher now accepts the exact public wire error `Wire value nesting exceeds 40` for that one slice only. Unexpected errors still fail the experiment.

After these corrections, complete TS/Rust oracle and fixed-count pilot passed on the recorded hashes before confirmation began. No engine source or workload was changed in response to timing.
