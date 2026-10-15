# rules-machine 0.1.1

Published to https://crates.io/crates/rules-machine/0.1.1 from commit `15f10cb`. Cargo confirmed upload and registry availability. Tag: `rules-machine-v0.1.1`.

The package is a functional library entry point that re-exports all public APIs of `rusty-rules-experiment` pinned to 0.1.1. Consumers import `rules_machine::{Program, Value, Session}`. The existing worker binary and benchmark tooling retain their names; no full-language compatibility claim is added.

Verification: downloaded the core from crates.io, built the entry point, executed the documented rule example as a Rust doctest, and passed Cargo package verification in both the dry run and publication. The seven-file archive contains source, metadata, lockfile, README and BSD-3-Clause license. Credentials remain outside git and the package.

Install with `cargo add rules-machine@0.1.1`. This remains an experimental Rust subset; see the crate README for limits.
