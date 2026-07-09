import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Permite marcar intencionalmente como no usado con prefijo `_` (args, vars y catch).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Reglas nuevas/estrictas del React Compiler (eslint-plugin-react-hooks v7) y de DX de
      // Fast Refresh: se dejan como warning (no bloquean CI) porque corregirlas a mano implica
      // reescrituras arriesgadas en admin/checkout/modales. Quedan visibles como deuda (issue #152).
      // `rules-of-hooks` se mantiene como error (es correctitud real) y se corrige en código.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-refresh/only-export-components': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
])
