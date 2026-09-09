module.exports = {
  root: true,
  extends: [
    'plugin:@typescript-eslint/recommended',
    'prettier'
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  env: {
    node: true,
    es2022: true
  },
  rules: {
    // Ratchet: these rules have pre-existing violations across the codebase.
    // They are warnings for now so lint can gate CI; tighten per package as
    // violations are cleaned up.
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/ban-ts-comment': 'warn',
    // ban-types was removed in typescript-eslint v8 and split into three rules.
    '@typescript-eslint/no-empty-object-type': 'warn',
    '@typescript-eslint/no-unsafe-function-type': 'warn',
    '@typescript-eslint/no-restricted-types': 'warn',
    '@typescript-eslint/no-var-requires': 'warn',
    '@typescript-eslint/no-namespace': 'warn',
    'prefer-const': 'error',
    'no-var': 'error'
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    '.next/',
    '*.js'
  ]
}