const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const nPlugin = require('eslint-plugin-n');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'eslint.config.js', 'jest.config.js'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  nPlugin.configs['flat/recommended-script'],
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // TypeScript já cobre resolução de módulos/imports
      'n/no-missing-import': 'off',
      'n/no-unpublished-import': 'off',
    },
  },
  eslintConfigPrettier,
);
