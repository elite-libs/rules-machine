import { ruleFactory } from "./index";

it("should work", () => {
  const rules = [
    { if: { and: ["foo", "bar = true"] }, then: "1" },
    { return: "bar" },
  ];

  expect(ruleFactory(rules)({ foo: false })).toBe(undefined);
  expect(ruleFactory(rules)({ foo: true })).toBe(true);
});
