const env = require('../src/config/env');
const appModule = require('../src/app');
const statusPage = require('../src/views/statusPage');

const contracts = [
  ['env.port', Number.isInteger(env.port)],
  ['env.canonicalOrigin', typeof env.canonicalOrigin === 'string'],
  ['env.assertRuntimeConfig', typeof env.assertRuntimeConfig === 'function'],
  ['app.createApp', typeof appModule.createApp === 'function'],
  ['app.app', typeof appModule.app?.listen === 'function'],
  ['statusPage.renderStatusPage', typeof statusPage.renderStatusPage === 'function']
];

const failures = contracts.filter(([, valid]) => !valid);
if (failures.length > 0) {
  console.error(`Contratos inválidos: ${failures.map(([name]) => name).join(', ')}`);
  process.exit(1);
}

env.assertRuntimeConfig();
console.log('Contratos dos módulos JavaScript validados.');
