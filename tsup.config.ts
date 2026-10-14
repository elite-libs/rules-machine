import { defineConfig } from 'tsup';

const common = {
  entry: ['src/index.ts'],
  outDir: 'dist',
  target: 'es2022',
  bundle: true,
  sourcemap: true,
  minify: process.env.NODE_ENV === 'production',
};

export default defineConfig([
  {
    ...common,
    format: ['cjs', 'esm'],
    platform: 'neutral',
    // Bundle the reviewed parser patch for downstream consumers, too.
    noExternal: ['expressionparser'],
    outExtension: ({ format }) => ({ js: format === 'esm' ? '.mjs' : '.cjs' }),
    dts: true,
    clean: true,
  },
  {
    ...common,
    format: ['iife'],
    platform: 'browser',
    globalName: 'RulesMachine',
    outExtension: () => ({ js: '.global.js' }),
    noExternal: [/./],
    clean: false,
  },
]);
