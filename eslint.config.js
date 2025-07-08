import eslintJs from '@eslint/js';
import eslintTs from '@typescript-eslint/eslint-plugin';
import eslintTsParser from '@typescript-eslint/parser';
import globals from 'globals';
import fs from 'node:fs';

export default [
    eslintJs.configs.recommended,
    {
        files: ['**/*.ts', 'eslint.config.js'],
        languageOptions: {
            parser: eslintTsParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
            },
            globals: {
                // Add all globals and utilize no-restricted-globals to prevent usage of globals in specific runtimes
                Bun: 'readonly',
                ...globals.nodeBuiltin,
                ...globals.browser,
            },
        },
        plugins: {
            '@typescript-eslint': eslintTs,
        },
        rules: {
            ...eslintTs.configs.recommended.rules,
            '@typescript-eslint/no-unused-vars': 'error',
            '@typescript-eslint/no-explicit-any': 'warn',
            'prefer-const': 'error',
            'no-var': 'error',
            'no-undef': 'error',
        },
        linterOptions: {
            reportUnusedDisableDirectives: 'error',
        },
    },
    ...restrictRuntimeGlobals({
        bun: ['packages/backend/server/**/*.ts', '.cache/eslint-check/bun.ts'],
        node: ['.cache/eslint-check/node.ts'],
        browser: ['.cache/eslint-check/browser.ts'],
        mixed: [
            'packages/backend/core/**/*.ts',
            'packages/frontend/**/*.ts',
            'packages/shared/**/*.ts',
            '.cache/eslint-check/mixed.ts',
        ],
        none: ['.cache/eslint-check/none.ts'],
    }),
    {
        ignores: ['node_modules/', 'dist/', 'build/'],
    },
];

/**
 * @returns {import('eslint').Linter.Config}
 */
function restrictRuntimeGlobals(config) {
    const bunOnlyKeys = new Set(['Bun']);
    const nodeOnlyKeys = new Set(Object.keys(globals.nodeBuiltin));
    const browserOnlyKeys = new Set(Object.keys(globals.browser));
    const mixedKeys = new Set();

    for (const [key, value] of Object.entries(globals.browser)) {
        if (globals.nodeBuiltin[key] === value) {
            nodeOnlyKeys.delete(key);
            browserOnlyKeys.delete(key);
            mixedKeys.add(key);
        }
    }

    const restrictedWindowGlobals = [
        'event',
        'close',
        'open',
        'name',
        'length',
        'top',
        'parent',
        'self',
        'frames',
        'history',
        'location',
        'navigator',
        'screen',
        'status',
    ];

    const results = [];

    for (const [runtime, files] of Object.entries(config)) {
        /** @type {{ runtime: string, key: string }[]} */
        const runtimeRestrictedGlobals = [];

        if (runtime !== 'bun') {
            runtimeRestrictedGlobals.push(
                ...Array.from(bunOnlyKeys).map(key => ({ runtime: 'bun', key }))
            );
        }

        if (runtime !== 'node' && runtime !== 'bun') {
            runtimeRestrictedGlobals.push(
                ...Array.from(nodeOnlyKeys).map(key => ({ runtime: 'node', key }))
            );
        }

        if (runtime !== 'browser') {
            runtimeRestrictedGlobals.push(
                ...Array.from(browserOnlyKeys).map(key => ({ runtime: 'browser', key }))
            );
        }

        if (runtime === 'none') {
            runtimeRestrictedGlobals.push(
                ...Array.from(mixedKeys).map(key => ({ runtime: 'mixed', key }))
            );
        }

        results.push({
            files,
            rules: {
                'no-restricted-properties': [
                    'error',
                    ...runtimeRestrictedGlobals.map(g => ({
                        object: 'globalThis',
                        property: g.key,
                        message: `'${g.key}' is a ${g.runtime}-only global and should not be used in a ${runtime} environment`,
                    })),
                ],
                'no-restricted-globals': [
                    'error',
                    ...runtimeRestrictedGlobals.map(g => ({
                        name: g.key,
                        message: `'${g.key}' is a ${g.runtime}-only global and should not be used in a ${runtime} environment`,
                    })),
                    {
                        name: 'global',
                        message: `Do not use the global object directly. Use globalThis instead.`,
                    },
                    ...restrictedWindowGlobals.map(g => ({
                        name: g,
                        message: `Use window.${g} instead of global ${g}`,
                    })),
                ],
            },
        });
    }

    return results;
}

class CodeWriter {
    constructor() {
        this.lines = [];
        this.currentIndent = 0;
        this.tabCharacter = '    ';
    }

    /**
     * @param {string[]} lines
     */
    writeLine(...lines) {
        if (lines.length === 0) {
            this.lines.push('\n');
        } else {
            for (const line of lines) {
                this.lines.push(`${this.tabCharacter.repeat(this.currentIndent)}${line}\n`);
            }
        }
    }

    writeBlock(openingLine, closingLine, write) {
        this.writeLine(openingLine);
        this.currentIndent++;
        write();
        this.currentIndent--;
        this.writeLine(closingLine);
    }

    writeComment(...lines) {
        for (const line of lines) {
            this.writeLine(`// ${line}`);
        }
    }

    writeDocComment(...lines) {
        if (this.lines[this.lines.length - 1]?.trimStart() === '*/\n') {
            this.lines.pop();
        } else {
            this.writeLine('/**');
        }
        for (const line of lines) {
            this.writeLine(` * ${line}`);
        }
        this.writeLine(' */');
    }

    toString() {
        return this.lines.join('');
    }
}

(() => {
    const bunGlobals = ['Bun'];
    const nodeGlobals = ['process', 'Buffer'];
    const browserGlobals = ['window', 'document', 'alert'];
    const mixedGlobals = ['console', 'setTimeout'];
    const windowGlobals = ['event', 'open', 'close', 'name'];

    /**
     * @param {'bun' | 'node' | 'browser' | 'mixed' | 'none'} runtime
     */
    function generateLintCheckFile(runtime) {
        if (!fs.existsSync(`.cache/eslint-check`)) {
            fs.mkdirSync(`.cache/eslint-check`, { recursive: true });
        }

        const code = new CodeWriter();
        code.writeDocComment(
            'DO NOT EDIT: Generated by eslint.config.js',
            `This file is used to check for globals that are allowed in the ${runtime} runtime.`,
            'If you see lint errors in this file, it means the eslint.config.js file is not setup correctly'
        );
        code.writeLine();

        code.writeBlock('export default () => [', '];', () => {
            code.writeDocComment(
                `bun-only globals should ${runtime !== 'bun' ? 'NOT ' : ''}be available in a ${runtime} runtime.`
            );
            for (const key of bunGlobals) {
                if (runtime !== 'bun') {
                    code.writeLine(`// eslint-disable-next-line no-restricted-globals`);
                }
                code.writeLine(`${key},`);
            }

            code.writeLine();
            code.writeDocComment(
                `node-only globals should ${runtime !== 'node' && runtime !== 'bun' ? 'NOT ' : ''}be available in a ${runtime} runtime.`
            );
            for (const key of nodeGlobals) {
                if (runtime !== 'node' && runtime !== 'bun') {
                    code.writeLine(`// eslint-disable-next-line no-restricted-globals`);
                }
                code.writeLine(`${key},`);
            }

            code.writeLine();
            code.writeDocComment(
                `browser-only globals should ${runtime !== 'browser' ? 'NOT ' : ''}be available in a ${runtime} runtime.`
            );
            for (const key of browserGlobals) {
                if (runtime !== 'browser') {
                    code.writeLine(`// eslint-disable-next-line no-restricted-globals`);
                }
                code.writeLine(`${key},`);
            }

            code.writeLine();
            code.writeDocComment(
                `mixed globals should ${runtime === 'none' ? 'NOT ' : ''}be available in a ${runtime} runtime.`
            );
            for (const key of mixedGlobals) {
                if (runtime === 'none') {
                    code.writeLine(`// eslint-disable-next-line no-restricted-globals`);
                }
                code.writeLine(`${key},`);
            }

            if (runtime === 'browser') {
                code.writeLine();
                code.writeDocComment(
                    'window globals should never be available and should be accessed from the window object.',
                    'Also local variables should be able to be declared with the same name as the window global.'
                );
                for (const key of windowGlobals) {
                    code.writeComment(`eslint-disable-next-line no-restricted-globals`);
                    code.writeLine(`${key},`);
                    code.writeLine(`window.${key},`);
                    code.writeComment('eslint-disable-next-line @typescript-eslint/no-unused-vars');
                    code.writeLine(`(() => { const ${key} = '${key}'; }),`);
                }
            }
        });

        fs.writeFileSync(`.cache/eslint-check/${runtime}.ts`, code.toString(), { flag: 'w+' });
    }

    generateLintCheckFile('bun');
    generateLintCheckFile('node');
    generateLintCheckFile('browser');
    generateLintCheckFile('mixed');
    generateLintCheckFile('none');
})();


