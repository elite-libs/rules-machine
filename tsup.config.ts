import type { Format, Options } from 'tsup';

const format: Format[] = ['cjs', 'esm', 'iife'];

const env: 'production' | 'development' =
  process.env.NODE_ENV === 'production' ? 'production' : 'development';
const isProd = env === 'production';

export default {
  format,
  outDir: 'dist',
  platform: 'node',
  target: 'es2020',
  entry: ['src/index.ts'],
  globalName: 'RulesMachine',
  clean: true,
  bundle: true,
  dts: true,
  metafile: true,
  minify: isProd,
  skipNodeModulesBundle: false,
  sourcemap: true,
  // splitting: false,//
} as Options;
