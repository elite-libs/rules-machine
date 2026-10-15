# Rust 0.1.1 release

Prepared on October 14, 2026 (America/Denver), at commit `191403d`. Published successfully on retry from `211fcb2`; Cargo confirmed registry availability. Release tag: `rusty-rules-experiment-v0.1.1`.

- Rust crate: `rusty-rules-experiment` 0.1.0 → 0.1.1.
- JavaScript manifest: 2.0.0-rc1 → 2.0.0-rc2. No npm publication requested or performed.
- Added crates.io metadata, BSD-3-Clause license, self-contained registry README and an explicit ten-file package allowlist. Credentials and Node bridge files are excluded.
- All 36 Rust tests pass; Cargo publish dry run and the actual upload's package build verification pass.
- The initial upload was rejected with HTTP 400 because the account required a verified email address. The user requested a retry; package verification, upload and registry availability confirmation then succeeded.

Published crate: https://crates.io/crates/rusty-rules-experiment/0.1.1

Install the worker with `cargo install rusty-rules-experiment --version 0.1.1 --locked`, or add the library with `cargo add rusty-rules-experiment@0.1.1`. The registry token was loaded from the ignored `.env` into the Cargo child environment and was not committed.
