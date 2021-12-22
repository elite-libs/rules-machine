import { RuleMachine } from "./index";

test("can process conditional rules", () => {
  const calculateDiscount = [
    { if: "price >= 25", then: "discount = 5" },
    { if: "price >= 100", then: "discount = 20" },
    { return: "discount" },
  ];
  const result = RuleMachine(
    "getDiscount",
    calculateDiscount
  )({ price: 100 });
  console.log(result.trace);
  expect(result.returnValue).toBe(20);
  expect(result.input.discount).toBe(20);
});
