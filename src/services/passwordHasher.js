const crypto = require('crypto');

let bcryptImpl = null;
let bcryptLoadError = null;

try {
  bcryptImpl = require('bcrypt');
} catch (error) {
  bcryptLoadError = error;
}

function ensureBcrypt() {
  if (!bcryptImpl) {
    const details = bcryptLoadError?.message ? ` Detalhes: ${bcryptLoadError.message}` : '';
    throw new Error(
      `Não foi possível carregar o módulo de hash de senha. Use Node 20.x e reinstale as dependências antes de iniciar o servidor.${details}`
    );
  }
  return bcryptImpl;
}

async function hashPassword(value, saltRounds) {
  return ensureBcrypt().hash(value, saltRounds);
}

async function comparePassword(value, hash) {
  return ensureBcrypt().compare(value, hash);
}

function getHasherInfo() {
  return {
    algorithm: bcryptImpl ? 'bcrypt' : 'bcrypt-unavailable',
    node: process.versions.node,
    runtime: crypto?.webcrypto ? 'node-modern' : 'node-legacy'
  };
}

module.exports = {
  hashPassword,
  comparePassword,
  getHasherInfo
};
