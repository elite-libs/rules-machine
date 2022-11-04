/**
 * @type {import('@typescript-eslint/utils').TSESLint.Linter.Config}
 */
const config = {
  root: true,
  env: {
    node: true,
  },
  extends: ['standard-with-typescript', 'prettier'],
  parser: '@typescript-eslint/parser',
  ignorePatterns: ['node_modules/', 'dist/', 'coverage/'],
  parserOptions: {
    // sourceType: 'module',
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'], // could be tsconfig.json too
  },
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/consistent-type-assertions': 'off',
    '@typescript-eslint/strict-boolean-expressions': 'off',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/restrict-template-expressions': [
      'warn',
      {
        allowAny: true,
        allowNumber: true,
        allowBoolean: true,
        allowNullish: true,
        allowRegExp: true,
      },
    ],
    '@typescript-eslint/no-floating-promises': [
      'error',
      {
        ignoreVoid: true,
        ignoreIIFE: true,
      },
    ],

    '@typescript-eslint/no-misused-promises': [
      'error',
      {
        checksConditionals: true,
        checksVoidReturn: true,
      },
    ],
  },
};

module.exports = config;
