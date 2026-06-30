// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'drizzle/migrations/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  // DDD boundaries: domain não importa de infra; domain de um módulo
  // não importa de domain de outro módulo. (no-restricted-imports)
  {
    files: ['src/modules/*/domain/**/*.ts', 'src/modules/*/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/infra/**', '@modules/*/infra/**'],
              message: 'domain/application não pode importar de infra/.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/modules/*/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@modules/*/domain/**', '../../*/domain/**', '../../../*/domain/**'],
              message: 'domain de um módulo não pode importar domain de outro módulo — use eventos ou interfaces explícitas.',
            },
            {
              group: ['**/infra/**'],
              message: 'domain não pode importar de infra/.',
            },
          ],
        },
      ],
    },
  },
);
