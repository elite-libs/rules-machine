# Historical v3 Planning Notes

This file originated during version 3 planning. It is not a release announcement; the package version in `package.json` identifies the current release. Use the README for current execution contracts and limits.

## Array Literal Limitations

The expression parser does not reliably support nested array literals such as `[["a", 1], ["b", 2]]`. Pass nested arrays through the input object:

```javascript
const convertPairs = ruleFactory({ return: 'UNZIPDICT(pairs)' });
convertPairs({ pairs: [['a', 1], ['b', 2]] });
// { a: 1, b: 2 }
```

`DICT(["a", "b"], [1, 2])` uses flat arrays and does not require that workaround. The second argument to `ruleFactory` contains execution options such as `{ trace: true }`; a return rule belongs in the first argument.

## Compatibility Checks

Current hardening rejects malformed or ambiguous rule objects, unsafe assignment paths, and programs exceeding documented limits. Nested logical groups now execute recursively, nested returns propagate, and array callback variables no longer remain on the input after execution. Review applications that depended on those previous behaviors before upgrading.

Run `pnpm test` and `pnpm test:coverage` for the current test count and coverage. Historical coverage percentages in this planning document were not release guarantees.
