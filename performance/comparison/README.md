# Reproduce the local comparison

The frozen contract is [plan.md](plan.md). These are local synthetic workloads on Node 26.8.2, not a production SLA or a full Rust replacement comparison.

1. Create an isolated copy of revision `ee300ad`, install with `pnpm@10.12.0 install --frozen-lockfile`, and build. Keep its node_modules unchanged. The run used `/tmp/rules-machine-baseline/dist/index.js`.
2. Create another copy of the same baseline source and build configuration, resolving dependencies from the upgraded candidate install. The run used `/tmp/rules-machine-upgrade-only/dist/index.js`. This arm isolates the parser null patch and tool/dependency upgrades from runtime source tuning.
3. Build the final candidate (`pnpm build`). Build/test Rust with `mise exec rust@1.99.0 -- cargo test --manifest-path experiments/rusty-rules/Cargo.toml` and `mise exec rust@1.99.0 -- cargo build --release --manifest-path experiments/rusty-rules/Cargo.toml`.
4. Run `node performance/comparison/verify.mjs /absolute/candidate/dist/index.mjs`. Stop other task-owned build/test loads before measurement.
5. Run the harness with explicit module paths:

```sh
node performance/comparison/run.mjs \
  baseline=/tmp/rules-machine-baseline/dist/index.js \
  upgrade=/tmp/rules-machine-upgrade-only/dist/index.js \
  tuned=/absolute/candidate/dist/index.mjs \
  blocks=12 output=/tmp/rules-machine-confirmation
node performance/comparison/analyze.mjs /tmp/rules-machine-confirmation
```

The worker must be able to spawn independent Node and Rust processes. A sandbox EPERM is an invalid sample, not an engine error. Do not substitute source files for built module paths. Profile only in separate diagnostics; the acceptance timing runs must remain uninstrumented.

Each timing includes cloning/reset of fresh inputs, output digest computation and actual completion counting. First-pass exact output/mutation validation runs outside the measured interval; intentionally skipped measured work must fail in all arms before the pilot starts. Array comparisons exclude only the three historically leaked reserved context fields, which the tuned executor now cleans up.

Rust supports only the frozen scalar subset. The documented rejection cases fail explicitly; nested-return and other unvalidated constructs remain outside scope even where the prototype accepts them. Arrays are TypeScript-only slices. Native results do not include a JavaScript bridge. Complete-batch process boundary values include import/compile, validation, warmup and output transport and cannot be interpreted as one-request IPC latency. Memory RSS samples are end-of-process Node observations, not peaks or cross-language memory comparisons. A small forced-GC unique-source retention diagnostic is retained separately; general retained-memory behavior and production concurrency remain unmeasured.
