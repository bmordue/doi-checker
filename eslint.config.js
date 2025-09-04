import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        crypto: 'readonly',
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-control-regex': 'off',
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        crypto: 'readonly',
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        process: 'readonly',
        test: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
        global: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-control-regex': 'off',
    },
  },
  {
    ignores: ['node_modules/**', 'terraform/dist/**', 'dist/**', 'reports/**'],
  },
];
