const migrate = require('../src/db/migrate');
const seed = require('../src/db/seed');
const env = require('../src/config/env');
const adminService = require('../src/services/admin.service');
const { db } = require('../src/db/db');

function closeDatabase() {
  return new Promise((resolve, reject) => {
    db.close(error => {
      if (error) return reject(error);
      resolve();
    });
  });
}

async function main() {
  env.assertRuntimeConfig();

  await migrate({ syncSeedData: env.runSeedSync });
  await adminService.ensureDefaultAdmin();
  await seed();

  console.log(`Database ready at ${env.databasePath}`);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await closeDatabase();
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
