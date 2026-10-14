# Draft PR: Repair distribution exports and validation tooling

Status: local review draft; no external PR created. Parent: [Wayfinder](../WAYFINDER.md). Ticket: [04](../tickets/04-distribution.md). Main implementation commit: `e9ea2f0`, plus public factory exports in `c127a2a`.

The package advertised a nonexistent ESM file and a browser bundle built for Node; CI still used Node14/yarn although the package requires Node24+. The change emits matching ESM/CommonJS names, a bundled browser IIFE, and bundles the minimal parser null fix for downstream consumers. It upgrades pinned pnpm/Vitest, removes unused debug, modernizes CI, and separates the library typecheck from standalone examples.

Validation: frozen install, typecheck, lint, suite, declaration build, packed external ESM/CommonJS consumers, isolated browser-global execution, and real collaborative browser smoke pass. CI configuration was updated; hosted CI was not run because nothing was published. Advisory scan was not authorized by automatic review; no vulnerability-free dependency claim is made.

Official upgrade references: [Vitest migration](https://vitest.dev/guide/migration/), [setup-node releases](https://github.com/actions/setup-node/releases), [pnpm 10 settings](https://github.com/pnpm/pnpm.io/blob/main/versioned_docs/version-10.x/settings.md). Versions were also checked using public npm metadata; the project retains its intended 72-hour release-age policy.
