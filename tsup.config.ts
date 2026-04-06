import { toBoolean } from './src/utils/utils';
import { defineConfig } from 'tsup';

export default defineConfig({
  format: ['cjs', 'esm', 'iife'],
  outDir: 'dist',
  platform: 'node',
  target: 'node24',
  entry: ['src/index.ts'],
  globalName: 'RulesMachine',
  clean: true,
  bundle: true,
  metafile: true,
  minify: process.env.NODE_ENV === 'production',
  dts: {
    entry: './src/index.ts',
  },
  skipNodeModulesBundle: !toBoolean(process.env.BUNDLE_ALL),
  sourcemap: true,
  noExternal: toBoolean(process.env.BUNDLE_ALL)
    ? [/lodash/, 'ms', /expressionparser/]
    : [],
});
