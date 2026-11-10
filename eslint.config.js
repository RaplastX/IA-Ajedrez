import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores([
    '**/dist/**',
    '**/node_modules/**',
    'apps/web/public/engine/**',
    'apps/web/playwright-report/**',
    'apps/web/test-results/**',
    'apps/mobile/android/**',
    'apps/mobile/ios/**',
    'ml/**',
  ]),
  tseslint.configs.recommended,
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    files: [
      'apps/server/**/*.ts',
      'scripts/**/*.mjs',
      '**/*.config.{js,ts}',
      'apps/*/scripts/**',
      'apps/*/build.mjs',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/web/public/**/*.js'],
    languageOptions: { globals: globals.serviceworker },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
    },
  },
);
