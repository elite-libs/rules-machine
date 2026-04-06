# Why Use a Rules Engine?

Rules Machine helps you solve specific challenges that arise when business logic becomes complex, frequent-changing, or requires auditability.

## When to Consider a Rules Engine

### 1. Storing & Syncing Rules

You need to store rules outside your code and sync them across environments:

- **Mobile apps** — Update logic without app store approvals
- **Edge computing** — Deploy rules to CloudFlare Workers, Lambda@Edge
- **Multi-tenant SaaS** — Different rules per customer tier
- **A/B testing** — Swap rule sets to test different business policies

**Example:** A note-taking app lets users create custom shortcuts. Typing "TODO" loads a template. These rules can be stored locally, synced to a database, or shared between devices.

### 2. Managing Unavoidable Complexity

Your industry requires hundreds or thousands of rules per transaction:

- **Healthcare** — Eligibility, coverage, claim adjudication
- **Insurance** — Risk assessment, premium calculations, policy rules
- **Finance** — Compliance checks, loan approvals, fraud detection
- **E-commerce** — Pricing tiers, tax calculations, discount stacking

**Problem:** Hand-coded rules obscure core application logic. Adding features to a `DepositTransaction` controller shouldn't require reading 2,000 lines of currency and country-code checks.

**Solution:** Isolate business rules in JSON/YAML files. Name, group, and chain them logically. Reference common rules by name (`applySalesTax`) to avoid duplication.

### 3. Tracing Errors & Miscalculations

Complex pricing, taxes, and discount policies can be fully tested yet still fail in surprising ways. Determining **how** a customer's total was calculated after the fact is tedious.

**Scenario:** A California customer expands into Canada. Their new shipping destination causes double taxation!

**Without tracing:** Senior developers dig through 10K-100K lines of code to give a plausible cause.

**With tracing:** Query the execution trace to see exactly which rules fired, in what order, with what values.

**Example Scenarios:**

- "Why did we approve a $10,000,000 loan for 'The Joker'?"
- "How did an Ultra Sports Car ($1M+) qualify for fiscal hardship rates?"
- "Why was this customer charged NY tax instead of NJ tax?"

### 4. Modeling Workflows & Improving Communication

Business rules in JSON/YAML are more accessible to non-developers:

- **Product managers** can review pricing logic
- **QA teams** can validate rule coverage
- **Legal/Compliance** can audit decision trees
- **Business stakeholders** can understand critical logic

Simply formatting rules as structured JSON sheds light on hierarchy and steps.

---

## App Logic vs Business Rules

Understanding the difference helps you decide what belongs in a rules engine.

| **App Logic**                   | **Business Rules**                            |
| ------------------------------- | --------------------------------------------- |
| Changes infrequently            | Changes frequently                            |
| Core application behavior       | Business policies & decisions                 |
| Applied broadly                 | Targeted & detailed                           |
| _"Validate cart total > 0"_     | _"Premium users get 25% off"_                 |
| _"One discount per order"_      | _"NY residents pay NY tax"_                   |
| _"Throw error if user is null"_ | _"Double shipping estimates during lockdown"_ |

**App Logic** is close to core component behavior. For example, adding `locale={countryCode}` to a `<Calendar>` component changes its App Logic.

**Business Rules** support evolving business goals from Product, Leadership, Legal, Finance, A/B Testing, etc.

---

## Finding Opportunities for Rules

Look for these patterns in your codebase:

### ✅ Good Candidates for Rules

- **Conditional pricing** — "If price >= 100, apply 20% discount"
- **User segmentation** — "Premium users see feature X"
- **Tax calculations** — "If state is NY, add 8.875% tax"
- **Time-based logic** — "If during daylight savings, offset by 1 hour"
- **Approval workflows** — "If loan > $50K, require manager approval"
- **Compliance checks** — "If country is embargoed, reject transaction"

### ❌ Better as App Logic

- **Input validation** — "Email must be valid format" (use a validation library)
- **Authentication** — "User must be logged in" (use auth middleware)
- **Database operations** — "Save user to database" (use your ORM)
- **UI rendering** — "Show modal on click" (use your framework)

---

## Pros & Cons

### Pros

- **Declarative** — Uses structured JSON and a subset of JavaScript
- **Observable** — Provides execution traces with timing and step details
- **Portable** — Rules are serializable and can be shared across environments
- **Incremental** — Easy to start experimenting; scale as needed

### Cons

- **Upfront planning** — Large implementations (1,000s of rules) require design work
- **Possible over-engineering** — May be premature for simple projects
- **Learning curve** — Not as intuitive as native JavaScript for developers

---

## Real-World Scenarios

### Sales Tax Complexity

Sales tax rates and rules are defined by multiple layers of government (City, County, State). Depending on state rules, you calculate based on Billing Address or Shipping Address.

**Scenario:** A California customer expands into Canada. Double taxation occurs!

**Resolution:** Execution traces save hours of debugging, boost Customer Support confidence in issuing refunds, and provide data for understanding the issue scope.

### Healthcare Eligibility

**Scenario:** "Why was this procedure denied for this patient?"

**Rules involved:**

- Insurance plan coverage rules
- Pre-authorization requirements
- Network provider restrictions
- Deductible and co-insurance calculations

**Without rules engine:** Logic scattered across services, hard to trace decisions.

**With rules engine:** Each eligibility check is a named rule with full traceability.

---

## Next Steps

- Read the [Guide](./guide.md) to get started
- Explore [Examples](./examples.md) for patterns
- Review the [API Reference](../README.md#api-reference) for details
