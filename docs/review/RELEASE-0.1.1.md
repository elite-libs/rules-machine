# Rust 0.1.1 release preparation

Prepared on October 14, 2026 (America/Denver), at commit `191403d`.

- Rust crate: `rusty-rules-experiment` 0.1.0 → 0.1.1.
- JavaScript manifest: 2.0.0-rc1 → 2.0.0-rc2. No npm publication requested or performed.
- Added crates.io metadata, BSD-3-Clause license, self-contained registry README and an explicit ten-file package allowlist. Credentials and Node bridge files are excluded.
- All 36 Rust tests pass; Cargo publish dry run and the actual upload's package build verification pass.
- The crates.io upload was rejected with HTTP 400: the account requires a verified email address. No successful publication or release tag is claimed.

Verify the account email at https://crates.io/settings/profile, then retry `cargo publish --locked --manifest-path experiments/rusty-rules/Cargo.toml` with `CARGO_REGISTRY_TOKEN` loaded securely from the ignored `.env`. After registry confirmation, remove the pending-publication note from the Rust README and tag the published source. Never commit the token.
