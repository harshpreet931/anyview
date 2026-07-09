import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default defineConfig(
  {
    ignores: ['dist/**', 'node_modules/**', '*.config.ts', '*.config.js'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      globals: { ...globals.browser, ...globals.worker },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // TypeScript handles undefined identifiers; disabling avoids false
      // positives on DOM/Worker globals.
      'no-undef': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // react-hooks v7's `recommended` targets React Compiler readiness.
      // set-state-in-effect flags a same-tick setState as a perf nit (an
      // extra render pass), not a correctness bug; we intentionally do this
      // to reset/derive local state from store subscriptions and prop
      // changes (e.g. clearing search text on close, clearing a stale text
      // layer when the adapter changes). Keep it visible as a warning
      // instead of silencing it outright.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
);
