# Draft PR: Enforce rule contracts and bound expression work

Status: local review draft; no external PR created. Parent: [Wayfinder](../WAYFINDER.md). Tickets: [01](../tickets/01-structural.md), [02](../tickets/02-expression.md).

Target: `main` at `ee300ad`; implementation is tracked on `overhaul/wayfinder-2026-10`. Runtime source freezes at `79c23b6`. The local implementation commits include `c8b38fe`, `3726b97`, `5a0636e`, `b994bca`, `c127a2a`, `f3fb2cc`, `dd6038b`, `8e33c3a`, `11a8fe6`, `a749997`, `e503343`, `79c23b6`. These commits depend on shared helpers and parser packaging; review as part of the umbrella branch, not independent cherry-picks without dependencies.

Previously a return inside `then` continued execution, nested logical groups were skipped, map iteration left reserved variables in the input, and malformed expression text could silently evaluate another value. The change propagates explicit control signals, evaluates recursive conditions, restores callback scope, prevalidates structure and write destinations, parses assignment boundaries, and rejects unsupported syntax. It also corrects numerical/data utility defects and bounds previously unbounded operations.

Validation: original 267 tests pass; final 367 tests pass including regression and Markdown-workflow tests. Line coverage 91.35%, branch coverage 89.35%. Ordinary trace snapshots preserved. See [unreleased compatibility notes](../CHANGELOG.md) and [residual contracts](../tickets/05-residual-contracts.md).
