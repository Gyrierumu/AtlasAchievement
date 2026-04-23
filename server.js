const app = require('./src/app');
const migrate = require('./src/db/migrate');
const seed = require('./src/db/seed');
const env = require('./src/config/env');
const adminService = require('./src/services/admin.service');

async function start() {
  env.assertRuntimeConfig();

  await migrate();
  const adminBootstrap = await adminService.ensureDefaultAdmin();
  await seed();

  const warnings = env.getStartupWarnings();
  warnings.forEach(warning => console.warn(`Aviso: ${warning}`));

  app.listen(env.port, () => {
    console.log(`Servidor rodando em http://localhost:${env.port}`);

    if (adminBootstrap.created) {
      console.log(`Administrador inicial criado: ${adminBootstrap.username}`);
    } else if (adminBootstrap.skipped) {
      console.log('Bootstrap automático de administrador desativado.');
    } else if (adminBootstrap.username) {
      console.log(`Administrador disponível: ${adminBootstrap.username}`);
    }
  });
}

start().catch(error => {
  console.error('Falha ao iniciar aplicação:', error);
  process.exit(1);
});
