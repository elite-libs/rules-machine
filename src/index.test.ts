import { RuleMachine } from "./index";

test("can process 'then' rules", () => {
  const input = { price: 100 };
  const calculateDiscount = [
    { if: "price >= 25", then: "discount = 5" },
    { if: "price >= 100", then: "discount = 20" },
    { return: "discount" },
  ];

  const result = RuleMachine("getDiscount", calculateDiscount)(input);

  // console.log(JSON.stringify(result.trace, null, 2));

  expect(result.returnValue).toBe(20);
  expect(result.input.discount).toBe(20);
});

test("can process omitted 'else' rules", () => {
  const input = { price: 10 };
  const calculateDiscount = [
    { if: "price >= 100", then: "discount = 20" },
    { return: "discount" },
  ];

  const result = RuleMachine("getDiscount", calculateDiscount)(input);

  // console.log(JSON.stringify(result.trace, null, 2));

  expect(result.returnValue).toBe(undefined);
});
