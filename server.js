const { app } = require('./src/app');
const env = require('./src/config/env');

env.assertRuntimeConfig();

const server = app.listen(env.port, () => {
  console.log(`AtlasAchievement disponível na porta ${env.port}.`);
});

function shutdown(signal) {
  console.log(`${signal} recebido; encerrando servidor.`);

  const forceExitTimer = setTimeout(() => {
    console.error('Encerramento excedeu o limite de tempo.');
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();

  server.close(error => {
    clearTimeout(forceExitTimer);
    if (error) {
      console.error('Falha ao encerrar servidor:', error);
      process.exit(1);
    }
    process.exit(0);
  });
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
