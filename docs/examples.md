# Rules Machine Examples

Real-world patterns and use cases for Rules Machine.

## Table of Contents

- [E-commerce](#e-commerce)
- [User Management](#user-management)
- [Finance & Compliance](#finance--compliance)
- [Gaming](#gaming)
- [Advanced Patterns](#advanced-patterns)

---

## E-commerce

### Tiered Discount Pricing

```ts
import { ruleFactory } from '@elite-libs/rules-machine';

const getDiscount = ruleFactory([
  { if: { and: ['price >= 25', 'price <= 50'] }, then: 'discount = 5' },
  { if: 'price > 50', then: 'discount = 10' },
  { if: 'price >= 100', then: 'discount = 20' },
  { return: 'discount' },
]);

getDiscount({ price: 40 }); // 5
getDiscount({ price: 75 }); // 10
getDiscount({ price: 150 }); // 20
```

### Stackable Discounts with State

```ts
const calculateStackableDiscount = ruleFactory([
  // First discount: base price threshold
  {
    if: 'price <= 100',
    then: ['discount = 5', 'user.discountApplied = true'],
  },
  // Second discount: only if first wasn't applied
  {
    if: { and: ['price >= 90', 'user.discountApplied != true'] },
    then: 'discount = 20',
  },
  // Third discount: premium users
  {
    if: 'user.plan == "premium"',
    then: 'discount = discount + 10',
  },
  { return: 'discount' },
]);
```

### Cart Total with Tax and Shipping

```ts
const calculateCartTotal = ruleFactory([
  // Subtotal
  'subtotal = SUM(cart.items[*].price)',

  // Discount
  { if: 'subtotal >= 100', then: 'discount = 10', else: 'discount = 0' },
  'afterDiscount = subtotal - discount',

  // Tax based on state
  { if: 'state == "NY"', then: 'taxRate = 0.08875' },
  { if: 'state == "CA"', then: 'taxRate = 0.0725' },
  { if: 'state == "OR"', then: 'taxRate = 0' },
  'tax = afterDiscount * taxRate',

  // Shipping
  { if: 'afterDiscount >= 50', then: 'shipping = 0', else: 'shipping = 5.99' },

  // Total
  'total = afterDiscount + tax + shipping',
  { return: 'total' },
]);

calculateCartTotal({
  state: 'NY',
  cart: {
    items: [{ price: 25 }, { price: 35 }],
  },
});
// 64.40 (60 - 10 discount + 5.31 tax + 5.99 shipping)
```

### Shipping Rules

```ts
const calculateShipping = ruleFactory([
  // Free shipping for premium members
  { if: 'user.isPremium', then: 'shipping = 0' },

  // Free shipping over $50
  { if: { and: ['subtotal >= 50', 'shipping != 0'] }, then: 'shipping = 0' },

  // Express shipping available
  {
    if: { and: ['shippingOption == "express"', 'shipping != 0'] },
    then: 'shipping = 24.99',
  },

  // Standard shipping
  { if: 'shipping == null', then: 'shipping = 5.99' },

  { return: 'shipping' },
]);
```

---

## User Management

### New User Onboarding

```ts
const onUserRegister = ruleFactory([
  // Apply free trial
  'user.trialEnds = DATEISO("+14 days")',

  // Welcome bonus for referred users
  { if: 'user.referralCode != null', then: 'user.balance = 10' },

  // Assign tier based on plan
  { if: 'user.plan == "premium"', then: 'user.tier = "gold"' },
  { if: 'user.plan == "basic"', then: 'user.tier = "silver"' },

  // Set permissions
  'user.permissions = ["read", "write"]',
  {
    if: 'user.tier == "gold"',
    then: 'user.permissions = CONCAT(user.permissions, ["admin"])',
  },

  { return: 'user' },
]);
```

### Role-Based Access Control

```ts
const canAccessResource = ruleFactory([
  // Admins can access everything
  { if: 'user.role == "admin"', then: 'access = true' },

  // Owners can access their own resources
  {
    if: { and: ['user.id == resource.ownerId', 'user.role == "user"'] },
    then: 'access = true',
  },

  // Team members with edit permission
  {
    if: {
      and: [
        'CONTAINS(user.id, resource.teamMembers)',
        'CONTAINS("edit", user.permissions)',
      ],
    },
    then: 'access = true',
  },

  // Default: no access
  { else: 'access = false' },

  { return: 'access' },
]);
```

### Subscription Eligibility

```ts
const checkUpgradeEligibility = ruleFactory([
  // Must be on active plan
  { if: 'user.status != "active"', then: 'eligible = false' },

  // Cannot downgrade mid-cycle
  {
    if: {
      and: [
        'requestedPlan.tier < user.currentPlan.tier',
        'user.billingCycleRemaining > 0',
      ],
    },
    then: 'eligible = false',
  },

  // Payment method required for upgrade
  {
    if: {
      and: [
        'requestedPlan.tier > user.currentPlan.tier',
        'user.paymentMethod == null',
      ],
    },
    then: 'eligible = false',
  },

  // Default: eligible
  { else: 'eligible = true' },

  { return: 'eligible' },
]);
```

---

## Finance & Compliance

### Loan Approval Rules

```ts
const approveLoan = ruleFactory([
  // Check credit score
  { if: 'applicant.creditScore < 600', then: 'decision = "denied"' },

  // Check debt-to-income ratio
  { if: 'applicant.debtToIncome > 0.43', then: 'decision = "denied"' },

  // Check employment status
  { if: 'applicant.employed != true', then: 'decision = "denied"' },

  // Determine loan amount
  {
    if: { and: ['applicant.creditScore >= 750', 'decision != "denied"'] },
    then: 'maxAmount = 500000',
  },
  {
    if: {
      and: [
        'applicant.creditScore >= 680',
        'applicant.creditScore < 750',
        'decision != "denied"',
      ],
    },
    then: 'maxAmount = 250000',
  },
  {
    if: {
      and: [
        'applicant.creditScore >= 600',
        'applicant.creditScore < 680',
        'decision != "denied"',
      ],
    },
    then: 'maxAmount = 100000',
  },

  // Set interest rate
  'baseRate = 3.5',
  { if: 'applicant.creditScore < 680', then: 'rate = baseRate + 2' },
  {
    if: 'applicant.creditScore >= 680 && applicant.creditScore < 750',
    then: 'rate = baseRate + 1',
  },
  { if: 'applicant.creditScore >= 750', then: 'rate = baseRate' },

  // Default approval
  { if: 'decision != "denied"', then: 'decision = "approved"' },

  { return: { decision, maxAmount, rate } },
]);
```

### Fraud Detection

```ts
const detectFraud = ruleFactory([
  'riskScore = 0',

  // Unusual location
  { if: 'transaction.country != user.homeCountry', then: 'riskScore += 20' },

  // High amount
  { if: 'transaction.amount > 10000', then: 'riskScore += 30' },
  { if: 'transaction.amount > 50000', then: 'riskScore += 20' },

  // Unusual time
  {
    if: 'HOUR(transaction.timestamp) < 6 || HOUR(transaction.timestamp) > 23',
    then: 'riskScore += 10',
  },

  // Multiple transactions in short time
  { if: 'user.transactionsLastHour > 5', then: 'riskScore += 25' },

  // New device
  { if: 'transaction.deviceId != user.knownDevices', then: 'riskScore += 15' },

  // Determine action
  { if: 'riskScore >= 70', then: 'action = "block"' },
  { if: 'riskScore >= 40 && riskScore < 70', then: 'action = "review"' },
  { if: 'riskScore < 40', then: 'action = "approve"' },

  { return: { action, riskScore } },
]);
```

### Tax Calculation

```ts
const calculateSalesTax = ruleFactory([
  // Determine tax jurisdiction
  { if: 'shippingAddress.state == null', then: 'jurisdiction = "origin"' },
  { else: 'jurisdiction = "destination"' },

  // Get tax rate based on jurisdiction
  { if: 'jurisdiction == "origin"', then: 'taxRate = warehouse.taxRate' },
  {
    if: 'jurisdiction == "destination"',
    then: 'taxRate = GET("taxRates." + shippingAddress.state)',
  },

  // Check for tax-exempt items
  'taxableAmount = 0',
  'map: cart.items',
  {
    map: 'cart.items',
    run: {
      if: '$item.category != "grocery"',
      then: 'taxableAmount += $item.price',
    },
  },

  // Calculate tax
  'tax = taxableAmount * taxRate',

  { return: 'tax' },
]);
```

---

## Gaming

### Achievement Unlocks

```ts
const checkAchievements = ruleFactory([
  'unlocked = []',

  // First purchase
  {
    if: {
      and: [
        'player.stats.totalPurchases == 1',
        '!CONTAINS("first_purchase", player.achievements)',
      ],
    },
    then: 'unlocked = CONCAT(unlocked, ["first_purchase"])',
  },

  // High scorer
  {
    if: {
      and: [
        'player.stats.highScore >= 10000',
        '!CONTAINS("high_scorer", player.achievements)',
      ],
    },
    then: 'unlocked = CONCAT(unlocked, ["high_scorer"])',
  },

  // Veteran player
  {
    if: {
      and: [
        'player.stats.daysPlayed >= 365',
        '!CONTAINS("veteran", player.achievements)',
      ],
    },
    then: 'unlocked = CONCAT(unlocked, ["veteran"])',
  },

  // Collector
  {
    if: {
      and: [
        'LENGTH(player.inventory) >= 100',
        '!CONTAINS("collector", player.achievements)',
      ],
    },
    then: 'unlocked = CONCAT(unlocked, ["collector"])',
  },

  { return: 'unlocked' },
]);
```

### Loot Table Drops

```ts
const generateLoot = ruleFactory([
  'loot = []',

  // Common drop (80% chance)
  { if: 'RAND() < 0.8', then: 'loot = CONCAT(loot, ["potion"])' },

  // Rare drop (20% chance)
  { if: 'RAND() < 0.2', then: 'loot = CONCAT(loot, ["magic_sword"])' },

  // Legendary drop (1% chance)
  { if: 'RAND() < 0.01', then: 'loot = CONCAT(loot, ["dragon_armor"])' },

  // Bonus for lucky players
  { if: 'player.luck >= 50', then: 'loot = CONCAT(loot, ["bonus_chest"])' },

  { return: 'loot' },
]);
```

### Matchmaking Rules

```ts
const findMatch = ruleFactory([
  'eligiblePlayers = []',

  // Filter by skill rating (±200 MMR)
  {
    filter: 'lobby',
    run: {
      and: [
        'ABS($item.mmr - player.mmr) <= 200',
        '$item.id != player.id',
        '$item.status == "searching"',
      ],
    },
    set: 'eligiblePlayers',
  },

  // Check region
  {
    filter: 'eligiblePlayers',
    run: '$item.region == player.region',
    set: 'eligiblePlayers',
  },

  // Check party size compatibility
  {
    filter: 'eligiblePlayers',
    run: '($item.partySize + player.partySize) <= 5',
    set: 'eligiblePlayers',
  },

  { return: 'eligiblePlayers' },
]);
```

---

## Advanced Patterns

### Dynamic Rule Selection

```ts
// Define rule sets
const discountRules = {
  standard: [
    { if: 'price >= 100', then: 'discount = 10' },
    { return: 'discount' },
  ],
  premium: [
    { if: 'price >= 50', then: 'discount = 15' },
    { if: 'price >= 100', then: 'discount = 25' },
    { return: 'discount' },
  ],
  employee: [{ if: 'true', then: 'discount = 30' }, { return: 'discount' }],
};

// Select rule set dynamically
function getDiscount(user, cart) {
  const ruleSet = discountRules[user.tier];
  const engine = ruleFactory(ruleSet);
  return engine({ ...user, ...cart });
}
```

### Rule Composition

```ts
// Base rules
const baseRules = [
  'subtotal = SUM(cart.items[*].price)',
  { if: 'subtotal >= 100', then: 'freeShipping = true' },
];

// Discount rules
const discountRules = [
  { if: 'user.plan == "premium"', then: 'discount = 0.10' },
  { if: 'user.plan == "basic"', then: 'discount = 0.05' },
];

// Tax rules
const taxRules = [
  { if: 'state == "NY"', then: 'taxRate = 0.08875' },
  { if: 'state == "CA"', then: 'taxRate = 0.0725' },
  'tax = subtotal * taxRate',
];

// Compose into complete checkout rules
const checkoutRules = ruleFactory([
  ...baseRules,
  ...discountRules,
  ...taxRules,
  'total = subtotal - (subtotal * discount) + tax',
  { return: 'total' },
]);
```

### Validation Pipeline

```ts
const validateUser = ruleFactory([
  'errors = []',

  // Required fields
  {
    if: 'user.name == null',
    then: 'errors = CONCAT(errors, ["name is required"])',
  },
  {
    if: 'user.email == null',
    then: 'errors = CONCAT(errors, ["email is required"])',
  },

  // Email format
  {
    if: 'user.email != null && !STRING_CONTAINS("@", user.email)',
    then: 'errors = CONCAT(errors, ["invalid email"])',
  },

  // Age requirement
  { if: 'user.age < 18', then: 'errors = CONCAT(errors, ["must be 18+"])' },

  // Password strength
  {
    if: 'LENGTH(user.password) < 8',
    then: 'errors = CONCAT(errors, ["password too short"])',
  },

  // Return validation result
  { if: 'LENGTH(errors) > 0', then: 'valid = false', else: 'valid = true' },
  { return: { valid, errors } },
]);
```

### Audit Trail with Tracing

```ts
// Enable tracing for audit requirements
const complianceEngine = ruleFactory(complianceRules, { trace: true });

const result = complianceEngine(transaction);

// Store audit trail
await auditLog.create({
  transactionId: transaction.id,
  decision: result.returnValue,
  trace: result.trace,
  timestamp: new Date().toISOString(),
});
```

---

## Next Steps

- Read the [Guide](./guide.md) for fundamentals
- Review [Why Use a Rules Engine?](./why.md) for use cases
- Check the [API Reference](../README.md) for details
