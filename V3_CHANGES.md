# Rules Machine v3 Breaking Changes

## Summary

This document outlines the breaking changes and improvements in version 3.

## Breaking Changes

### 1. Nested Array Literal Limitation

**Issue**: The expression parser does not support inline nested array literals like `[[\"a\", 1], [\"b\", 2]]`.

**Workaround**: Pass nested arrays via the input object:

```javascript
// Instead of (doesn't work):
ruleFactory('UNZIPDICT([["a", 1], ["b", 2]])')()

// Use this (works):
ruleFactory('UNZIPDICT(pairs)', { return: 'result' })({ 
  pairs: [['a', 1], ['b', 2]] 
})
```

**Affected Functions**:
- `DICT(keys, values)` - Works when keys/values come from input
- `UNZIPDICT(pairs)` - Works when pairs come from input

**Future**: In v4, we may vendor the expression parser to add full nested literal support.

## Coverage Improvements in v3

Test coverage improved from 68.86% to 87.58%:

- **language.ts**: 54.42% → 78.58% (+24.16%)
- **executor.ts**: 90.48% (branch coverage 82.56% → 83.78%)
- **utils.ts**: 45.28% → 100% (+54.72%)
- **engine.ts**: 83.33% → 100% (+16.67%)
- **language-utils.ts**: 58.85% → 98.85% (+40%)

## New Tests Added

- 267 total tests (up from 51)
- Comprehensive math function tests
- Array function tests
- Object function tests
- Executor edge case tests
- Error handling tests

## Migration Guide

No migration needed for existing code. The nested array limitation only affects new code patterns that weren't previously documented or tested.
