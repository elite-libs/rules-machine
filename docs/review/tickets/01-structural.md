# 01: Structural contracts and validation

Parent: [Wayfinder](../WAYFINDER.md). Related historical GitHub reports: #49, #48, #41, #42 (read-only context).

Fix lost returns in branches/sequences/try/catch; use an unforgeable return signal. A return in array `run` ends only that callback. Evaluate recursive and/or groups with short circuiting and explicit empty-group identities. Restore array contexts through nested execution and exceptions. Reject malformed, ambiguous, cyclic, or excessively deep rule structures before mutation. Avoid trace work when disabled; avoid trace serialization masking original errors. Preserve ordinary trace snapshots where possible. Cover null and exported literal helper semantics.

Acceptance: targeted regression cases plus original suite, no unsupported global pollution/RCE claim. Implementation and validation evidence pending.
