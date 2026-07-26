import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.svelte-kit/**',
      '**/.expo/**',
      '**/.dart_tool/**',
      '**/coverage/**',
      '**/generated/**',
      '**/*.config.{js,cjs,mjs,ts}',
      'pnpm-lock.yaml',
      'apps/mobile/app.json',
      'apps/mobile/expo-env.d.ts',
    ],
  },
  ...tseslint.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // SvelteKit navigates with plain <a href> + data-sveltekit-preload-data;
      // article body links render authored (often external) URLs, so resolve()
      // does not apply. Enable per-route once a typed route-id helper is warranted.
      'svelte/no-navigation-without-resolve': 'off',
    },
  },
  prettier,
);
