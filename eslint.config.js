import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    // La simulation est pure : ni PixiJS, ni DOM.
    files: ['src/sim/**/*.ts', 'src/data/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'pixi.js',
            '**/render/**',
            '**/ui/**',
            '**/app/**',
            '**/save/**',
            '**/debug/**',
          ],
        },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'indexedDB', 'Date'],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Aléatoire uniquement via src/sim/rng.ts.' },
      ],
    },
  },
);
