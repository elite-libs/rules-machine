import { toBoolean } from './src/utils/utils';
import type { Format, Options } from 'tsup';

const format: Format[] = ['cjs', 'esm', 'iife'];

const env: 'production' | 'development' =
  process.env.NODE_ENV === 'production' ? 'production' : 'development';
const isProd = env === 'production';

const singleBundleFile = toBoolean(process.env.BUNDLE_ALL);
const inlinePackagePatterns = singleBundleFile
  ? [/lodash\/.*/, 'ms', /expressionparser\/.*/]
  : [];

export default <Options>{
  format,
  outDir: 'dist',
  platform: 'node',
  target: 'node14',
  entry: ['src/index.ts'],
  globalName: 'RulesMachine',
  clean: true,
  bundle: true,
  metafile: true,
  minify: isProd,
  resolve: true,
  dts: {
    resolve: true,
    // build types for `src/index.ts` only
    // otherwise `Options` will not be exported by `tsup`, not sure how this happens, probably a bug in rollup-plugin-dts
    entry: './src/index.ts',
  },

  skipNodeModulesBundle: singleBundleFile,
  sourcemap: true,
  // splitting: false,//
  noExternal: inlinePackagePatterns,
};
