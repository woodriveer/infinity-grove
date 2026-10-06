// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/** Banned in domain/ and services/ (RFR-7, AD-6): time, randomness and I/O come from ports. */
const bannedPureGlobals = [
  { name: 'fetch', message: 'Use the HttpPort (services/ports) instead of fetch (RFR-5).' },
  { name: 'window', message: 'domain/ and services/ never touch DOM globals (RFR-5).' },
  { name: 'document', message: 'domain/ and services/ never touch DOM globals (RFR-5).' },
  { name: 'localStorage', message: 'Use a port; domain/ and services/ never touch browser storage.' },
  { name: 'indexedDB', message: 'Use the SaveStore port.' },
  { name: 'setTimeout', message: 'Use the injected Clock / TickDriver (AD-6).' },
  { name: 'setInterval', message: 'Use the injected Clock / TickDriver (AD-6).' },
  { name: 'performance', message: 'Use the injected Clock (RFR-7).' },
  { name: 'crypto', message: 'Use the injected Rng / IdGenerator / Cipher port (AD-6).' },
  { name: 'process', message: 'domain/ and services/ never read process state.' },
];

const bannedPureProperties = [
  { object: 'Date', property: 'now', message: 'Use the injected Clock (RFR-7).' },
  { object: 'Math', property: 'random', message: 'Use the injected Rng (RFR-7).' },
  { object: 'performance', property: 'now', message: 'Use the injected Clock (RFR-7).' },
  { object: 'crypto', property: 'randomUUID', message: 'Use the injected IdGenerator (AD-6).' },
];

const wallClockSyntax = [
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message: 'new Date() reads the wall clock; use the injected Clock (RFR-7).',
  },
  {
    selector: "CallExpression[callee.name='Date']",
    message: 'Date() reads the wall clock; use the injected Clock (RFR-7).',
  },
];

export default tseslint.config(
  {
    ignores: [
      'node_modules/**', 'dist/**', 'dist-test/**', 'dist-desktop/**', 'release/**', 'artifacts/**',
      'src/generated/**', 'tests/lint/fixtures/**', 'vendor/**', 'test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['**/src/domain/**/*.ts', '**/src/services/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', ...bannedPureGlobals],
      'no-restricted-properties': ['error', ...bannedPureProperties],
      'no-restricted-syntax': [
        'error',
        ...wallClockSyntax,
        {
          // AD-22: no affix roll result is produced outside BackendAffixRollSource.
          selector: 'Identifier[name=/^rollAffix/]',
          message: 'Affix rolls are server-authoritative (AD-22); only BackendAffixRollSource returns them.',
        },
      ],
    },
  },
  {
    files: ['**/src/services/crafting/BackendAffixRollSource.ts'],
    rules: { 'no-restricted-syntax': ['error', ...wallClockSyntax] },
  },
  {
    // Theme tokens are the only place colors are written (DESIGN.md Colors).
    files: ['**/src/presentation/**/*.{ts,tsx}'],
    ignores: ['**/src/presentation/theme/tokens.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]', message: 'Hex colors live only in presentation/theme/tokens.ts.' },
        { selector: 'Literal[raw=/^0x[0-9a-fA-F]{6}$/]', message: 'Phaser colors live only in presentation/theme/tokens.ts.' },
      ],
    },
  },
);
