/**
 * Layer allowlist from ARCHITECTURE AD-1. Paths use `(^|/)src/<layer>/` so the same
 * rules apply to the negative fixtures under tests/lint/fixtures/src/ (RFR-5).
 * Adding an entry here means amending AD-1 (and AD-3 for a new package).
 */
const L = (layer) => `(^|/)src/${layer}/`;

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      comment: 'domain/ imports only domain/ (AD-1; the big-number type is a port of BreakInfinity.cs, see PORT_MAP amendments).',
      severity: 'error',
      from: { path: L('domain') },
      to: { pathNot: L('domain') },
    },
    {
      name: 'services-allowlist',
      comment: 'services/ -> domain, services, generated, zod; openapi-fetch only in services/backend.',
      severity: 'error',
      from: { path: L('services') },
      to: {
        pathNot: [L('domain'), L('services'), L('generated'), 'node_modules/zod/', 'node_modules/openapi-fetch/'],
      },
    },
    {
      name: 'openapi-fetch-only-in-services-backend',
      severity: 'error',
      from: { pathNot: L('services/backend') },
      to: { path: 'node_modules/openapi-fetch/' },
    },
    {
      name: 'presentation-allowlist',
      comment: 'presentation/ -> services, domain, generated/assets.gen, phaser, preact, @preact/signals.',
      severity: 'error',
      from: { path: L('presentation') },
      to: {
        pathNot: [
          L('presentation'),
          L('services'),
          L('domain'),
          `${L('generated')}assets\\.gen`,
          'node_modules/phaser/',
          'node_modules/preact/',
          'node_modules/@preact/signals',
        ],
      },
    },
    {
      name: 'presentation-domain-types-and-formatters-only',
      comment: 'F5: presentation imports domain values only from bignum/format; everything else is type-only.',
      severity: 'error',
      from: { path: L('presentation') },
      to: {
        path: L('domain'),
        pathNot: [`${L('domain')}bignum/format`],
        dependencyTypesNot: ['type-only'],
      },
    },
    {
      name: 'game-store-writes-only-in-services',
      comment: 'AD-5: only services/ and the app/ composition root may import the writable GameStore.',
      severity: 'error',
      from: { path: '(^|/)src/', pathNot: [L('services'), L('app')] },
      to: { path: `${L('services')}state/GameStore` },
    },
    {
      name: 'platform-implements-ports',
      comment: 'platform/ -> services ports and other platform modules only.',
      severity: 'error',
      from: { path: L('platform') },
      to: { path: [L('presentation'), L('app')] },
    },
    {
      name: 'nobody-imports-app',
      severity: 'error',
      from: { path: '(^|/)src/', pathNot: [L('app'), '(^|/)src/main\\.ts$'] },
      to: { path: L('app') },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true, dependencyTypesNot: ['type-only'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['src/generated/api'] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
  },
};
