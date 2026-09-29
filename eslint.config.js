import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Imports a layer of the Angular app may not use: dependencies point inwards (CLAUDE.md). */
const forbid = (...groups) => ({
  'no-restricted-imports': [
    'error',
    {
      patterns: groups.map(([group, message]) => ({ group: [group], message })),
    },
  ],
});

const LAYER = 'Layer boundary (CLAUDE.md, «Frontend Angular»):';

export default defineConfig(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.angular/**'] },
  {
    files: ['packages/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['apps/angular/src/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        // The app's tsconfig.json only references these two, which projectService does not follow.
        project: ['apps/angular/tsconfig.app.json', 'apps/angular/tsconfig.spec.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['apps/angular/src/app/domain/**/*.ts'],
    rules: forbid(
      ['@angular/*', `${LAYER} domain is plain TypeScript, no Angular.`],
      ['rxjs', `${LAYER} domain ports return promises, not observables.`],
      ['**/application/**', `${LAYER} domain depends on nothing.`],
      ['**/infrastructure/**', `${LAYER} domain depends on nothing.`],
      ['**/ui/**', `${LAYER} domain depends on nothing.`],
    ),
  },
  {
    files: ['apps/angular/src/app/application/**/*.ts'],
    rules: forbid(
      ['**/infrastructure/**', `${LAYER} application reaches adapters only through ports.`],
      ['**/ui/**', `${LAYER} application knows nothing of the UI.`],
    ),
  },
  {
    files: ['apps/angular/src/app/infrastructure/**/*.ts'],
    rules: forbid(
      ['**/application/**', `${LAYER} adapters implement domain ports; app.config.ts binds them.`],
      ['**/ui/**', `${LAYER} adapters know nothing of the UI.`],
    ),
  },
  {
    files: ['apps/angular/src/app/ui/**/*.ts'],
    rules: forbid([
      '**/infrastructure/**',
      `${LAYER} the UI talks to the application, never to adapters.`,
    ]),
  },
);
