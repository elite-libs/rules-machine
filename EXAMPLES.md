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

export const appHooks = {
  onUserRegister: ruleFactory([
    userRules.applyFreeTrial,
    userRules.applyNewUserPromotion,
    { return: 'user' },
  ]),
  getDiscountPercent: ruleFactory([
    rewardsRules.convertRewardsToPercentDiscount,
  ]),
};
```

### App Usage example

Here's where we use our app-level functions (`registerUser`, `calculateCartDiscount`) which leverage our rules.

```ts
// `./src/users/index.ts`
import { appHooks } from '../app-hooks';

const { onUserRegister, getDiscountPercent } = appHooks;

export function registerUser(user) {
  // Call a rules function just like any other function.
  const updatedUser = onUserRegister({ user });
  // Then continue on to your business logic.
  return api.post(updatedUser);
}

export function calculateCartDiscount({ user, cart }) {
  const percentDiscount = getDiscountPercent({ user });
  return cart.total * percentDiscount;
}
```

### Granular Rule Definition

See `userRules` and `rewardsRules` below for an idea how to layer your detailed rules.

````ts
// `./src/rules/users.ts`
import type { Rule } from '@elite-libs/rules-machine';
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
  applyNewUserPromotion: ['user.rewardsBalance = 500'],
  // Fixed 30-day trial; calendar-month arithmetic belongs in the host.
  applyFreeTrial: ['user.subscriptionExpires = DATEISO("30d")'],
};

// `./src/rules/rewards.ts`
export const rewardsRules: Record<string, Rule[]> = {
  /**
   * convertRewardsToPercentDiscount determines a user's `discountPercent`.
   */
  convertRewardsToPercentDiscount: [
    'discountPercent = 0',
    { if: 'user.rewardsBalance >= 100', then: 'discountPercent = 0.01' },
    { if: 'user.rewardsBalance >= 250', then: 'discountPercent = 0.02' },
    { if: 'user.rewardsBalance >= 1000', then: 'discountPercent = 0.05' },
    { return: 'discountPercent' },
  ],
};
````
