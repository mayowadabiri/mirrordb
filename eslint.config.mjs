import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/.next/**',
            '**/coverage/**',
            '**/*.gen.ts',
            '**/prisma/generated/**',
            '**/prisma.config.ts',
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
                allowDefaultProject: ['*.js', '*.mjs'],
            },
        },
        rules: {
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-non-null-assertion': 'warn',
            '@typescript-eslint/no-floating-promises': 'off',
            '@typescript-eslint/no-misused-promises': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/no-unsafe-optional-chain': 'off',
            '@typescript-eslint/prefer-promise-reject-errors': 'off',
            '@typescript-eslint/require-await': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
        },
    }
);
