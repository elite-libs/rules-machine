import { readFileSync } from 'node:fs';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import { describe, expect, test } from 'vitest';
import { ruleFactory } from './index';

/** Execute the actual trusted documentation block, keeping examples and tests aligned. */
function example(
  file: string,
  name: string,
): (input: Record<string, unknown>) => unknown {
  const markdown = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const block = [...markdown.matchAll(/```(?:ts|javascript)\n([\s\S]*?)\n```/g)]
    .map((match) => match[1])
    .find((source) => source.includes(`const ${name} =`));
  if (!block) throw new Error(`Missing documentation example ${name}`);
  const source = block.replace(/^import .*?;\s*$/gm, '');
  const output = transpileModule(source, {
    compilerOptions: {
      module: ModuleKind.CommonJS,
      target: ScriptTarget.ES2022,
    },
  }).outputText;
  // Documentation is trusted repository code; production expression execution does not use Function.
  return new Function('ruleFactory', 'console', `${output}\nreturn ${name};`)(
    ruleFactory,
    { log() {} },
  );
}

describe('executable documentation showcases', () => {
  test('guide tiers preserve higher discounts and map returns its mapped result', () => {
    const discount = example('docs/guide.md', 'calculateDiscount');
    expect(discount({ price: 150 })).toBe(20);
    expect(discount({ price: 75 })).toBe(10);
    expect(discount({ price: 20 })).toBe(0);
    const input = { numbers: [1, 2, 3] };
    expect(example('docs/guide.md', 'doubleNumbers')(input)).toEqual([2, 4, 6]);
    expect(input).toHaveProperty('doubled', [2, 4, 6]);
  });

  test('cart workflow maps item prices before summing and computes documented total', () => {
    const checkout = example('docs/examples.md', 'calculateCartTotal');
    expect(
      checkout({
        state: 'NY',
        cart: { items: [{ price: 25 }, { price: 35 }] },
      }),
    ).toBeCloseTo(65.325);
  });

  test('access and subscription defaults do not override explicit decisions', () => {
    const access = example('docs/examples.md', 'canAccessResource');
    expect(
      access({
        user: { id: 1, role: 'admin', permissions: [] },
        resource: { ownerId: 2, teamMembers: [] },
      }),
    ).toBe(true);
    expect(
      access({
        user: { id: 1, role: 'user', permissions: [] },
        resource: { ownerId: 2, teamMembers: [] },
      }),
    ).toBe(false);
    const eligible = example('docs/examples.md', 'checkUpgradeEligibility');
    expect(
      eligible({
        user: { status: 'inactive', currentPlan: { tier: 1 } },
        requestedPlan: { tier: 1 },
      }),
    ).toBe(false);
  });

  test('loan and fraud workflows return dictionaries and use host-supplied time', () => {
    expect(
      example(
        'docs/examples.md',
        'approveLoan',
      )({ applicant: { creditScore: 700, debtToIncome: 0.2, employed: true } }),
    ).toEqual({ decision: 'approved', maxAmount: 250000, rate: 4.5 });
    expect(
      example(
        'docs/examples.md',
        'detectFraud',
      )({
        transaction: { country: 'US', amount: 100, hour: 2, deviceId: 'known' },
        user: {
          homeCountry: 'US',
          transactionsLastHour: 0,
          knownDevices: ['known'],
        },
      }),
    ).toEqual({ action: 'approve', riskScore: 10 });
  });

  test('sales tax uses two-argument GET and excludes grocery items', () => {
    expect(
      example(
        'docs/examples.md',
        'calculateSalesTax',
      )({
        shippingAddress: { state: 'NY' },
        warehouse: { taxRate: 0.05 },
        taxRates: { NY: 0.1 },
        cart: {
          items: [
            { category: 'grocery', price: 10 },
            { category: 'book', price: 20 },
          ],
        },
      }),
    ).toBe(2);
  });

  test('loot outcomes replay supplied random rolls', () => {
    const loot = example('docs/examples.md', 'generateLoot');
    expect(
      loot({
        player: { luck: 10 },
        randomRolls: { common: 0.5, rare: 0.5, legendary: 0.5 },
      }),
    ).toEqual(['potion']);
    expect(
      loot({
        player: { luck: 50 },
        randomRolls: { common: 0.9, rare: 0.1, legendary: 0 },
      }),
    ).toEqual(['magic_sword', 'dragon_armor', 'bonus_chest']);
  });

  test('validation returns an object and handles absent fields safely', () => {
    const validate = example('docs/examples.md', 'validateUser');
    expect(
      validate({
        user: {
          name: 'Dan',
          email: 'dan@example.com',
          age: 30,
          password: 'long-password',
        },
      }),
    ).toEqual({ valid: true, errors: [] });
    expect(validate({ user: { age: 10 } })).toEqual({
      valid: false,
      errors: [
        'name is required',
        'email is required',
        'must be 18+',
        'password too short',
      ],
    });
  });
});
