import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Run existing public-contract tests against the actual delivered minified IIFE.
// This catches build/minifier behavior (including delegate arity), not browser latency.
const virtual = '\0rules-machine-delivered-iife';
const bundle = readFileSync(resolve('dist/index.global.js'), 'utf8');
export default defineConfig({
  plugins: [{
    name: 'delivered-iife-contract',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source === './index' && importer && /\/src\/(index|arrays|documentation)\.test\.ts$/.test(importer))
        return virtual;
    },
    load(id) {
      if (id === virtual)
        return `const lib = new Function(${JSON.stringify(`${bundle}\nreturn RulesMachine;`)})();
export const {ResourceLimitError,createExpressionEngine,createRuleExecutor,extractValueOrLiteral,ruleFactory}=lib;`;
    },
  }],
  test: {
    include: ['src/index.test.ts', 'src/arrays.test.ts', 'src/documentation.test.ts'],
  },
});
