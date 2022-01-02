# Rules Machine

![Rules Machine](img/rules-machine-header.svg)

> _Rules Against The Machine_ 🤘

<!-- * One Rules Engine to rule them all.
* With great _Rules_, comes great observability. -->

**Table of Content**

- [What's a `Rules Machine`?](#whats-a-rules-machine)
  - [Key Goals](#key-goals)
  - [Key Terms](#key-terms)
- [Why Rules Engines?](#why-rules-engine)
  - [Pros](#pros)
  - [Cons](#cons)
- [Examples](#examples)
    - [Example Rule: Apply Either $5 or $10 Discount](#example-rule-apply-either-5-or-10-discount)
    - [Example Rule: Apply $15 Discount if Employee, or Premium Customer](#example-rule-apply-15-discount-if-employee-or-premium-customer)
    - [Example Rule: Multiple Conditional, Nested Rules](#example-rule-multiple-conditional-nested-rules)
    - [Example Rule: Use variable between rules](#example-rule-use-variable-between-rules)
- [More Reading & Related Projects](#more-reading--related-projects)
- [TODO](#todo)

## What's a `Rules Machine`?

It's a fast, general purpose [`JSON Rules Engine`](https://martinfowler.com/bliki/RulesEngine.html) library for both the Browser & Node.js! 🚀

### Key Goals

- **Share business logic** - move logic around the I/O layer, just like data.
  - Shared validation logic (same logic from the web form to the backend)
  - Push rules where they are needed: Cloud functions, CloudFlare Workers, Lambda@Edge, etc.)
- **Organize complexity** - isolate complex Business Rules from App Logic and state.
  - Name, group and chain rules.
  - Don't repeat yourself: reference common rule(s) by name. (`applySalesTax`)
- **Modeling workflows** - model your business logic as a series of readable steps.
  - Help non-dev stakeholders (QA, Product) understand critical logic.
  - Simply formatting JSON Rules sheds light on both hierarchy & steps.


<!-- Designed to prioritize simplicity, limited operations, security - no access to runtime (`eval`/`new Func`).

 in one flavor or another, whether you realize it or not. In fact this sort of rough design is built into everything from [GitHub Actions](#reference-gh-actions), [VS Code Keybindings config](https://code.visualstudio.com/docs/getstarted/keybindings#_keyboard-rules), [Ansible Playbooks](https://docs.ansible.com/ansible/latest/user_guide/playbooks_conditionals.html#basic-conditionals-with-when), [Helm templates](https://helm.sh/docs/chart_template_guide/control_structures/), [Datree](https://hub.datree.io/basic-examples#c6-example-1) and so many more. -->

### Key Terms

`App Logic != Business Rules`

* **App Logic** - applies more broadly and changes less frequently than Business Rules.
  * _"Throw Error if ShoppingCart total is less than zero."_
  * _"Only one discount code can be applied at a time."_
* **Business Rules** - targeted & detailed, tends to change frequently. Supports business goals & objectives, accumulated from Product, A/B Tuning, Legal, Finance, etc.
  * _"Premium customers can apply 3 discounts, up to 25% off."_
  * _"Add covid19 discount for existing customers."_
  * _"If State is NY, add NY tax."_
  * _"If State is AZ and during Daylight Savings, offset an hour."_


App Logic is close to Core component behavior. For example, adding a `locale={countryCode}` to the `<Calendar>` component will change it's App Logic.

Whereas _"Prevent meeting requests on Weekends."_ is more of a Business Rule, because it's specific to a scheduling application, and its current context.

> Using this as a mental model greatly accelerates identifying specific places to utilize a Rules Engine.

(I know there are other ways to describe this concept. I'm choosing to avoid CS jargon stuffing.)

## Why Rules Engines?

Typically App Logic & Business Rules are woven together throughout the project. This co-location of logic is usually helpful, keeping things readable in small and even mid-sized projects.

This works great, until you run into one of the following challenges:

1. **Storing Rules**
    - A note taking app could let users create custom shortcuts, where typing "TODO" could load a template.
    - These "shortcuts" (JSON Rules) can be stored in a local file, synced to a database, or even broadcast over a mesh network.
2. **Unavoidable Complexity**
    - In many industries like healthcare, insurance, finance, etc. it's common to find 100's or 1,000s of rules run on every transaction.
    - Over time, "Hand-coded Rules" can distract & obscure from core App Logic.
    - Example: Adding a feature to a `DepositTransaction` controller shouldn't require careful reading of 2,000 lines of custom rules around currency hackery & country-code checks.
    - Without a strategy, code eventually sprawls as logic gets duplicated & placed arbitrarily. Projects become harder to understand, risky to modify, and adding new rules become high-stakes exercises.
3. **Tracing Errors or Miscalculations**
    - Complex pricing, taxes & discount policies can be fully "covered" by unit tests, yet still fail in surprising ways.
    - Determining how a customer's subtotal WAS calculated after the fact can be tedious & time consuming.

<details>

<summary>Additional Scenarios & Details</summary>

- Example: Sales tax rates and rules are defined by several layers of local government. (Mainly City, County, and State.)
  - Depending on the State rules, you'll need to calculate based on the Billing Address or Shipping Address.
- Scenario: A California customer has expanded into Canada. Their new shipping destination seems to cause double taxation!?!
  - In this situation, a trace of the computations can save hours of dev work, boost Customer Support' confidence issuing a partial refund, and the data team can use the raw data to understand the scope of the issue.
- Scenario: "Why did we approve a $10,000,000 loan for 'The Joker'?"
- Scenario: "How did an Ultra Sports Car ($1M+) qualify for fiscal hardship rates?"

</details>


<!-- Investigating these questions is usually a manual process, with expensive senior developers trudging through 10K-100Ks of lines of code, all to give you an unsatisfying shrug and a mere plausible cause. -->

### Pros

- Uses a subset of JavaScript and structured JSON object(s).
- Easy to start using & experimenting with, larger implementations require more planning.
- Provides a `trace`, with details on each step, what happened, and the time taken.

### Cons

- Sizable projects require up-front planning & design work to properly adapt this pattern. (1,000s rules, for example.)
- Possible early optimization or premature architecture decision.
- Not as easy to write compared to a native language.

## Examples

#### Example Rule: Apply Either $5 or $10 Discount

```json
[
  {"if": {"and": ["price >= 25", "price <= 50"]}, "then": "discount = 5"},
  {"if": "price > 50", "then": "discount = 10"},
  {"return": "discount"}
]
```

<details>
<summary>Show YAML</summary>

```yaml
- if: {and: [price >= 25, price <= 50]}
  then: discount = 5
- if: price > 50
  then: discount = 10
- return: discount
```
</details>

#### Example Rule: Apply $15 Discount if Employee, or Premium Customer

```json
[
  {
    "if": "user.plan == \"premium\"",
    "then": "discount = 15"
  },
  {
    "if": "user.employee == true",
    "then": "discount = 15"
  },
  {
    "return": "discount"
  }
]
```

#### Example Rule: Multiple Conditional, Nested Rules

```json
[
  {
    "if": "price <= 100",
    "then": "discount = 5"
  },
  {
    "if": {
      "or": [
        "price >= 100",
        "user.isAdmin == true"
      ]
    },
    "then": "discount = 20"
  },
  {
    "return": "discount"
  }
]
```

<details>
<summary>Show YAML</summary>

```yaml
- if: price <= 100
  then: discount = 5
- if:
    or: [price >= 100, user.isAdmin == true]
  then: discount = 20
- return: discount
```
</details>

#### Example Rule: Use variable between rules

```json
[
  {
    "if": "price <= 100",
    "then": [
      "discount = 5",
      "user.discountApplied = true"
    ]
  },
  {
    "if": {
      "and": [
        "price >= 90",
        "user.discountApplied != true"
      ]
    },
    "then": "discount = 20"
  },
  {
    "return": "discount"
  }
]
```

<details>
<summary>Show YAML</summary>

```yaml
- if: price <= 100
  then:
  - discount = 5
  - user.discountApplied = true
- if:
    and:
    - price >= 90
    - user.discountApplied != true
  then: discount = 20
- return: discount
```
</details>

## More Reading & Related Projects

- [Should I use a Rules Engine?](https://martinfowler.com/bliki/RulesEngine.html)
- [JSON Rules Engine](https://www.npmjs.com/package/json-rules-engine).
- GitHub Actions YAML conditional syntax.

## TODO

- [ ] **Publish modules for CJS, ESM, AMD, UMD. (Implement parceljs, rollup, etc.)**
- [ ] rule type: `{"runRules": "ruleSetName"}`
- [ ] rule type: `{"throw": "error message"}`
- [ ] rule type: `{"log": "rule/value expression"}`
- [ ] rule type: `{"set": "newVar = value"}`
- [ ] misc: Structured Type validation.
- [x] security: NEVER use `eval`/`Function('...')` parsing.
- [x] misc: Simplify TS, making `Rule[]` the sole recursive type.
- [x] misc: Use reduced JS syntax, scope.
- [x] misc: Use single object for input and output. (Doesn't mutate input.)
- [x] misc: Add support for multiple boolean expressions. (see: `{"and": []}` `{"or": []}`).
- [x] misc: Rules are serializable, and can be shared.

