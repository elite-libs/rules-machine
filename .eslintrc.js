/**
 * @type {import('@typescript-eslint/utils').TSESLint.Linter.Config}
 */
const config = {
  env: {
    node: true,
  },
  extends: 'standard-with-typescript',
  parser: '@typescript-eslint/parser',
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'coverage/',
  ],
  parserOptions: {
    // sourceType: 'module',
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'], // could be tsconfig.json too
  },
  rules: {
    curly: ['error', 'multi-or-nest', 'consistent'],
    semi: 'off',
    '@typescript-eslint/semi': ['error', 'always'],
    'comma-dangle': [
      'error',
      {
        arrays: 'always-multiline',
        objects: 'always-multiline',
        imports: 'always-multiline',
        exports: 'always-multiline',
        functions: 'only-multiline',
      },
    ],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/space-before-function-paren': ['error', 'never'],
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
    // note you must disable the base rule as it can report incorrect errors
    quotes: 'off',
    '@typescript-eslint/quotes': ['error', 'single', { avoidEscape: true }],
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
