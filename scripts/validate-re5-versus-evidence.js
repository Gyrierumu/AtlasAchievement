'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VALIDATION_PATH = path.join(
  ROOT,
  'docs',
  'releases',
  'resident-evil-5-v2-versus-validation.md'
);
const WAIVER_PATH = path.join(
  ROOT,
  'docs',
  'releases',
  'resident-evil-5-v2-editorial-waiver.md'
);

const VALID_CLASSIFICATIONS = new Set([
  'APROVADO',
  'PARCIAL',
  'INDISPONIVEL',
  'FALHOU',
  'NAO_EXECUTADO'
]);
const VALID_MODE_RESULTS = new Set(['PASS', 'FAIL', 'BLOCKED', 'NOT_EXECUTED']);
const HUMAN_ROLES = new Set([
  'Responsável editorial',
  'Responsável técnico',
  'Responsável pela publicação'
]);
const INVALID_APPROVERS = /^(?:Codex|ChatGPT|Automação|Sistema)$/i;

function read(relativePath) {
  return fs.readFileSync(relativePath, 'utf8').replace(/^\uFEFF/, '');
}

function field(document, name) {
  const match = document.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'));
  assert(match, `campo obrigatório ausente: ${name}`);
  return match[1].trim();
}

function parseIsoDate(value, name) {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(value), `${name} deve usar YYYY-MM-DD`);
  const date = new Date(`${value}T00:00:00Z`);
  assert(!Number.isNaN(date.valueOf()), `${name} inválido`);
  assert.strictEqual(date.toISOString().slice(0, 10), value, `${name} inválido`);
  return date;
}

function parseIsoDateTime(value, name) {
  assert(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(value),
    `${name} deve usar ISO 8601 com fuso`
  );
  const date = new Date(value);
  assert(!Number.isNaN(date.valueOf()), `${name} inválido`);
  return date;
}

function assertPrivacy(document, name) {
  assert(!/[A-Z]:\\Users\\/i.test(document), `${name} contém caminho local de usuário`);
  assert(!/file:\/\//i.test(document), `${name} contém file://`);
  assert(!/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/.test(document), `${name} contém e-mail`);
  assert(!/\bPSN(?:\s+ID)?\s*[:=]\s*[A-Za-z0-9_-]{3,}\b/i.test(document), `${name} contém possível ID PSN`);
  assert(!/\b(?:password|senha|token)\s*[:=]\s*\S+/i.test(document), `${name} contém possível credencial`);
}

function assertRequiredText(document, fragments, name) {
  for (const fragment of fragments) {
    assert(document.includes(fragment), `${name} não contém: ${fragment}`);
  }
}

function validateModeTable(validation) {
  const modes = new Map();
  for (const mode of ['Slayers', 'Survivors', 'Team Slayers', 'Team Survivors']) {
    const line = validation
      .split(/\r?\n/)
      .find(candidate => candidate.startsWith(`| ${mode} |`));
    assert(line, `linha do modo ausente: ${mode}`);
    const results = [...line.matchAll(/`([A-Z_]+)`/g)].map(match => match[1]);
    assert(results.length >= 5, `resultados insuficientes para ${mode}`);
    for (const result of results) {
      assert(VALID_MODE_RESULTS.has(result), `resultado inválido em ${mode}: ${result}`);
    }
    modes.set(mode, results);
  }
  return modes;
}

function validateWaiver(waiver) {
  const status = field(waiver, 'waiverStatus');
  assert(['NAO_APROVADA', 'APROVADA'].includes(status), 'waiverStatus inválido');

  for (const required of [
    'decisionId',
    'game',
    'scope',
    'reason',
    'evidenceAvailable',
    'evidenceMissing',
    'risk',
    'publicImpact',
    'mitigations',
    'approvedBy',
    'role',
    'approvedAt',
    'expiresAt',
    'nextValidationDate',
    'revalidationOwner',
    'revalidationMethod',
    'publicationDecision'
  ]) {
    field(waiver, required);
  }

  assert.strictEqual(field(waiver, 'game'), 'resident-evil-5');
  parseIsoDate(field(waiver, 'nextValidationDate'), 'nextValidationDate');

  if (status === 'APROVADA') {
    const approvedBy = field(waiver, 'approvedBy');
    const role = field(waiver, 'role');
    const approvedAt = parseIsoDate(field(waiver, 'approvedAt'), 'approvedAt');
    const expiresAt = parseIsoDate(field(waiver, 'expiresAt'), 'expiresAt');
    const validityDays = Math.round((expiresAt - approvedAt) / 86_400_000);

    assert(!INVALID_APPROVERS.test(approvedBy), 'aprovador automatizado é inválido');
    assert(!approvedBy.startsWith('PENDENTE_'), 'approvedBy continua pendente');
    assert(HUMAN_ROLES.has(role), 'função de aprovação inválida');
    assert(validityDays >= 0 && validityDays <= 30, 'dispensa deve valer no máximo 30 dias');
    assert(['A', 'B', 'C'].includes(field(waiver, 'publicationDecision')), 'decisão deve ser A, B ou C');
  } else {
    assert(waiver.includes('DISPENSA NÃO APROVADA'), 'dispensa pendente deve ser explícita');
    assert(field(waiver, 'approvedBy').startsWith('PENDENTE_'));
    assert(field(waiver, 'role').startsWith('PENDENTE_'));
    assert(field(waiver, 'approvedAt').startsWith('PENDENTE_'));
    assert(field(waiver, 'expiresAt').startsWith('PENDENTE_'));
    assert.strictEqual(field(waiver, 'publicationDecision'), 'PENDENTE');
  }
}

function validate() {
  const validation = read(VALIDATION_PATH);
  const waiver = read(WAIVER_PATH);
  const classification = field(validation, 'classification');
  const humanExecution = field(validation, 'humanExecution');
  const testerCount = Number(field(validation, 'testerCount'));
  const accountCount = Number(field(validation, 'accountCount'));
  const nativeGameVersion = field(validation, 'nativeGameVersion');

  assert(VALID_CLASSIFICATIONS.has(classification), 'classification inválida');
  assert(Number.isInteger(testerCount) && testerCount >= 0, 'testerCount inválido');
  assert(Number.isInteger(accountCount) && accountCount >= 0, 'accountCount inválido');
  assert(
    ['PS4', 'PS4_ALVO_NAO_OBSERVADO'].includes(nativeGameVersion),
    'nativeGameVersion deve representar a versão PS4'
  );
  const modes = validateModeTable(validation);

  assertRequiredText(validation, [
    'PENDENTE DE EXECUÇÃO HUMANA',
    'TESTE VERSUS NÃO EXECUTADO',
    'O resultado deste bloco não remove os bloqueadores do Bloco 7B.',
    'Team Slayers',
    'Team Survivors',
    'Ataques físicos',
    'PS5 backward compatibility'
  ], 'validação');

  if (classification === 'APROVADO') {
    assert.strictEqual(humanExecution, 'EXECUTADO', 'APROVADO exige execução humana');
    parseIsoDateTime(field(validation, 'testedAt'), 'testedAt');
    assert.strictEqual(nativeGameVersion, 'PS4', 'APROVADO exige versão PS4 observada');
    assert(testerCount >= 4, 'APROVADO exige quatro testadores');
    assert(accountCount >= 4, 'APROVADO exige quatro contas');
    assert(!validation.includes('| Nenhuma | — |'), 'APROVADO exige evidências');
    for (const [mode, results] of modes) {
      assert(results.every(result => result === 'PASS'), `APROVADO exige PASS em ${mode}`);
    }
  } else if (classification === 'NAO_EXECUTADO') {
    assert.strictEqual(humanExecution, 'PENDENTE_DE_EXECUCAO_HUMANA');
    assert.strictEqual(field(validation, 'testedAt'), 'NAO_EXECUTADO');
    assert.strictEqual(nativeGameVersion, 'PS4_ALVO_NAO_OBSERVADO');
  }

  validateWaiver(waiver);
  assertRequiredText(waiver, [
    'O resultado deste bloco não remove os bloqueadores do Bloco 7B.',
    'Nenhum dado do guia foi alterado nesta etapa.',
    'proposedWaiverLevel: A'
  ], 'dispensa');

  assertPrivacy(validation, 'validação');
  assertPrivacy(waiver, 'dispensa');

  return {
    classification,
    humanExecution,
    testerCount,
    accountCount,
    waiverStatus: field(waiver, 'waiverStatus'),
    publicationDecision: field(waiver, 'publicationDecision')
  };
}

if (require.main === module) {
  try {
    const result = validate();
    console.log(JSON.stringify({ status: 'PASS', ...result }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      status: 'FAIL',
      message: error.message
    }, null, 2));
    process.exitCode = 1;
  }
}

module.exports = { validate };
