# Final source review before exact-power confirmation

Reviewed before any new acceptance timing:

* The power-domain predicate now examines sign-stripped IEEE-754 bits. Normal finite powers require a zero fraction and exponent 1..2046; subnormal powers require exactly one fraction bit. Zero, NaN and infinities are excluded from this helper and handled by the surrounding JS-special-case branch.
* Exhaustive predicate tests enumerate every normal exponent pattern and all 52 single-bit subnormal powers; near powers, adjacent 2.0 values, largest subnormal, zero and nonfinite cases reject where required. Integration tests exercise the public compiled-program boundary.
* The adjacent-bit differential inventory caught default serde_json rounding 1.9999999999999998 to 2 before the guard. The built-in float_roundtrip feature now preserves JSON number bits; direct decoder regressions and 300 deterministic full-width wire values exercise the transport. No new dependency or network fetch is needed.
* Remaining operator/function domains, null/undefined transport, callback returns/scopes, bounded syntax cache, output expansion, bridge cancellation/framing and prior resource guard regressions remain covered by the final gates. Power special cases preserve NaN-exponent priority and JS zero/nonfinite behavior; finite general exponentiation remains explicitly rejected.
* Native and bridge instruments and old fixture/digest bytes are unchanged. Fresh whole 12-block campaigns are required after the exact guard/parser-feature change. Earlier de6ca7f campaigns remain diagnostic, with no samples carried into final inference. Prior TS comparison remains applicable only after verifying unchanged TS module hash.

Pre-freeze gates: 24 Rust tests (22 integration + 2 unit), 15 bridge tests, 419 shared differential/rejection cases, 11158 numeric/domain probes. The earlier 10718-case boundary run failed 14 cases due to default JSON float parsing and is retained in full.

Independent focused review is requested from the existing architect agent before source freeze; its conclusion will be recorded below.

Independent architect conclusion: approved source freeze. The bit guard accepts normal zero-fraction powers and single-bit subnormals, excludes zero/nonfinite and ignores sign; caller retains NaN/infinite special handling. float_roundtrip closes the adjacent-value decoding bypass. The independent DataView oracle uses consistent endianness, TS comparison on supported inputs and required Rust errors on declared rejections. No contract-critical issue found. Architect performed source review; full correctness gates were run by the performance agent.
