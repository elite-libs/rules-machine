# Rule Organization Examples

## A Layered Approach

This pattern relies on `import`/`export` (or `require()`) to access rule objects.

A top-level rules file (`app-hooks.ts`) can be used to organize rules from across your app.

Granular rules are defined separately. They are imported by name into `app-hooks.ts`, where we'll organize them by high-level named hooks (e.g. `onUserRegister`, `getDiscountPercent`).

```ts
// `./src/app-hooks.ts`
import { ruleFactory } from '@elite-libs/rules-machine';
// Import plain old rule objects
import { userRules } from './rules/users';
import { rewardsRules } from './rules/rewards';

const appHooks = {
  onUserRegister: [
    userRules.applyFreeTrial,
    userRules.applyNewUserPromotion,
  ],
  getDiscountPercent: [
    rewardsRules.convertRewardsToPercentDiscount
  ],
}

export const onUserRegister = ruleFactory(appHooks.onUserRegister);
export const getDiscountPercent = ruleFactory(appHooks.getDiscountPercent);
```

### App Usage example

Here's where we use our app-level functions (`registerUser`, `calculateCartDiscount`) which leverage our rules.

```ts
// `./src/users/index.ts`
import { onUserRegister, getDiscountPercent } from './src/app-hooks';

export function registerUser(user) {
  // Call a rules function just like any other function.
  const updatedUser = onUserRegister(user);
  // Then continue on to your business logic.
  return api.post(updatedUser);
}

export function calculateCartDiscount({user, cart}) {
  const percentDiscount = getDiscountPercent(user);
  return cart.total * percentDiscount;
}
```

### Granular Rule Definition

See `userRules` and `rewardsRules` below for an idea how to layer your detailed rules.

```ts
// `./src/users/rules.ts` - locate next to user module.
// OR
// `./src/rules/user.ts` - locate in central rules folder.
export const userRules: Record<string, Rule[]> = {
  /**
   * Example Input: (User object)
   * ```js
   * {
   *   user: {
   *     plan: 'premium',
   *     name: 'Dan',
   *     rewardsBalance: 0,
   *   }
   * }
   * ```
   */
  applyNewUserPromotion: ["user.rewardsBalance = 500"],
  applyFreeTrial: ["user.subscriptionExpires = DATEISO('+1 month')"],

};

// `./src/rules/rewards.ts`
export const rewardsRules: Record<string, Rule[]> = {
  /**
   * convertRewardsToPercentDiscount determines a user's `discountPercent`.
   */
  convertRewardsToPercentDiscount: [
    { if: 'user.rewardsBalance >= 1000', then: 'discountPercent = 0.05' },
    { if: 'user.rewardsBalance >= 250', then: 'discountPercent = 0.02' },
    { if: 'user.rewardsBalance >= 100', then: 'discountPercent = 0.01', else: 'discountPercent = 0' },
    { return: 'discountPercent' },
  ],
}

```