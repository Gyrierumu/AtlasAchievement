'use strict';

const REQUIRED_SOURCE_FIELDS = [
  'id', 'title', 'url', 'publisher', 'type', 'platform', 'version', 'purpose',
  'accessedAt', 'lastVerifiedAt', 'status', 'reliability', 'notes', 'claims'
];
const RELIABILITY = new Set(['A', 'B', 'C', 'D']);
const CLASSIFICATIONS = new Set(['stable', 'version_dependent', 'editorial', 'volatile']);
const CONFIDENCE = new Set(['HIGH', 'MEDIUM', 'LOW']);
const SOURCE_STATUSES = new Set(['OK', 'REDIRECT_VALID', 'BLOCKED', 'RATE_LIMITED', 'INCONCLUSIVE']);
const ONLINE_STATES = new Set(['CONFIRMED_AVAILABLE', 'APPARENTLY_AVAILABLE', 'DEGRADED', 'UNCONFIRMED', 'OFFLINE', 'UNKNOWN']);
const WORKFLOW_STATES = ['NEW', 'TRIAGED', 'NEEDS_EVIDENCE', 'ACCEPTED', 'REJECTED', 'IMPLEMENTED', 'VERIFIED', 'PUBLISHED'];
const REQUIRED_CLAIM_FIELDS = [
  'id', 'summary', 'classification', 'version', 'primarySource', 'supportingSources',
  'confidence', 'lastVerifiedAt', 'owner', 'surfaces'
];

function issue(code, message, id = null, severity = 'error') {
  return { code, message, id, severity };
}

function validateIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function validateSourceRegistry(registry = []) {
  const errors = [];
  const warnings = [];
  const ids = new Set();
  for (const source of registry) {
    for (const field of REQUIRED_SOURCE_FIELDS) {
      if (source?.[field] === undefined || source?.[field] === null || source?.[field] === '') {
        errors.push(issue('SOURCE_FIELD_MISSING', `Fonte sem campo obrigatório: ${field}.`, source?.id));
      }
    }
    if (ids.has(source?.id)) errors.push(issue('SOURCE_ID_DUPLICATE', 'ID de fonte duplicado.', source?.id));
    ids.add(source?.id);
    if (!RELIABILITY.has(source?.reliability)) errors.push(issue('SOURCE_RELIABILITY_INVALID', 'Confiabilidade deve ser A, B, C ou D.', source?.id));
    if (!SOURCE_STATUSES.has(source?.status)) errors.push(issue('SOURCE_STATUS_INVALID', 'Status editorial de fonte inválido.', source?.id));
    if (!validateIsoDate(source?.accessedAt) || !validateIsoDate(source?.lastVerifiedAt)) {
      errors.push(issue('SOURCE_DATE_INVALID', 'Datas da fonte devem usar YYYY-MM-DD.', source?.id));
    }
    try {
      const parsed = new URL(source?.url);
      if (parsed.protocol !== 'https:') errors.push(issue('SOURCE_URL_PROTOCOL', 'Fonte externa deve usar HTTPS.', source?.id));
    } catch (_error) {
      errors.push(issue('SOURCE_URL_INVALID', 'URL da fonte é inválida.', source?.id));
    }
    if (source?.reliability === 'D') warnings.push(issue('SOURCE_D_REQUIRES_REVIEW', 'Fonte D só pode ser pista temporária com revisão humana.', source?.id, 'warning'));
  }
  return { errors, warnings, valid: errors.length === 0, ids };
}

function validateClaims(claims = [], registry = []) {
  const errors = [];
  const warnings = [];
  const sources = new Map(registry.map(source => [source.id, source]));
  const ids = new Set();
  for (const claim of claims) {
    for (const field of REQUIRED_CLAIM_FIELDS) {
      if (claim?.[field] === undefined || claim?.[field] === null || claim?.[field] === '') {
        errors.push(issue('CLAIM_FIELD_MISSING', `Claim sem campo obrigatório: ${field}.`, claim?.id));
      }
    }
    if (ids.has(claim?.id)) errors.push(issue('CLAIM_ID_DUPLICATE', 'ID de claim duplicado.', claim?.id));
    ids.add(claim?.id);
    if (!CLASSIFICATIONS.has(claim?.classification)) errors.push(issue('CLAIM_CLASSIFICATION_INVALID', 'Classificação de claim inválida.', claim?.id));
    if (!CONFIDENCE.has(claim?.confidence)) errors.push(issue('CLAIM_CONFIDENCE_INVALID', 'Confiança de claim inválida.', claim?.id));
    if (!validateIsoDate(claim?.lastVerifiedAt)) errors.push(issue('CLAIM_DATE_INVALID', 'lastVerifiedAt deve usar YYYY-MM-DD.', claim?.id));
    if (!Array.isArray(claim?.surfaces) || claim.surfaces.length === 0) errors.push(issue('CLAIM_SURFACES_EMPTY', 'Claim precisa declarar superfícies públicas.', claim?.id));
    if (!Array.isArray(claim?.supportingSources)) errors.push(issue('CLAIM_SUPPORT_INVALID', 'supportingSources deve ser uma lista.', claim?.id));
    const sourceIds = [claim?.primarySource, ...(claim?.supportingSources || [])].filter(Boolean);
    const resolved = sourceIds.map(id => sources.get(id)).filter(Boolean);
    for (const sourceId of sourceIds) {
      if (!sources.has(sourceId)) errors.push(issue('CLAIM_SOURCE_MISSING', `Claim referencia fonte ausente: ${sourceId}.`, claim?.id));
    }
    if (!claim?.primarySource) errors.push(issue('CLAIM_PRIMARY_SOURCE_MISSING', 'Claim precisa de fonte primária.', claim?.id));
    if (['stable', 'version_dependent'].includes(claim?.classification) && !resolved.some(source => ['A', 'B'].includes(source.reliability))) {
      errors.push(issue('CLAIM_STRONG_EVIDENCE_MISSING', 'Claim factual/por versão precisa de ao menos uma fonte A ou B.', claim?.id));
    }
    if (resolved.length && resolved.every(source => source.reliability === 'D')) {
      if (claim?.classification !== 'volatile' || claim?.confidence !== 'LOW') {
        errors.push(issue('CLAIM_D_ONLY_INVALID', 'Fonte D isolada não verifica claim factual.', claim?.id));
      } else {
        warnings.push(issue('CLAIM_D_ONLY_UNCONFIRMED', 'Claim volátil sustentada apenas por pista D permanece não confirmada.', claim?.id, 'warning'));
      }
    }
    if (['version_dependent', 'volatile'].includes(claim?.classification) && !String(claim?.version || '').trim()) {
      errors.push(issue('CLAIM_VERSION_MISSING', 'Claim por versão/volátil precisa declarar plataforma e versão.', claim?.id));
    }
    if (claim?.classification === 'volatile' && !validateIsoDate(claim?.nextReviewAt)) {
      errors.push(issue('CLAIM_NEXT_REVIEW_MISSING', 'Claim volátil precisa de próxima revisão.', claim?.id));
    }
  }
  for (const source of registry) {
    for (const claimId of source.claims || []) {
      if (!ids.has(claimId)) errors.push(issue('SOURCE_CLAIM_MISSING', `Fonte referencia claim ausente: ${claimId}.`, source.id));
    }
  }
  return { errors, warnings, valid: errors.length === 0 };
}

function validateFreshness(authority = {}, previousAuthority = null) {
  const errors = [];
  const governance = authority.governance || {};
  if (!validateIsoDate(authority.reviewedAt)) errors.push(issue('EDITORIAL_DATE_INVALID', 'reviewedAt deve usar YYYY-MM-DD.'));
  if (governance.dateModified !== authority.reviewedAt || governance.lastEditorialReview !== authority.reviewedAt) {
    errors.push(issue('EDITORIAL_DATES_DIVERGE', 'reviewedAt, dateModified e lastEditorialReview devem coincidir.'));
  }
  if (governance.technicalAuditUpdatesEditorialDates !== false) {
    errors.push(issue('TECHNICAL_AUDIT_DATE_POLICY', 'Audit técnico não pode atualizar datas editoriais.'));
  }
  if (!ONLINE_STATES.has(governance.onlineStatus?.state)) errors.push(issue('ONLINE_STATE_INVALID', 'Status online inválido.'));
  if (!validateIsoDate(governance.onlineStatus?.lastVerifiedAt)) errors.push(issue('ONLINE_VERIFICATION_DATE_MISSING', 'Status online precisa de data de verificação.'));
  if (!validateIsoDate(governance.onlineStatus?.nextReviewAt)) errors.push(issue('ONLINE_NEXT_REVIEW_MISSING', 'Status online precisa de próxima revisão.'));
  const history = Array.isArray(authority.history) ? authority.history : [];
  if (!history.some(item => item.date === authority.reviewedAt)) errors.push(issue('CHANGELOG_DATE_MISSING', 'dateModified precisa de entrada editorial correspondente no changelog.'));
  if (previousAuthority && previousAuthority.reviewedAt !== authority.reviewedAt) {
    const previousChanges = new Set((previousAuthority.history || []).map(item => `${item.date}|${item.change}`));
    const hasNewEntry = history.some(item => item.date === authority.reviewedAt && !previousChanges.has(`${item.date}|${item.change}`));
    if (!hasNewEntry) errors.push(issue('DATE_CHANGED_WITHOUT_CHANGELOG', 'Data editorial mudou sem nova entrada de changelog.'));
  }
  return { errors, valid: errors.length === 0 };
}

function detectSurfaceDivergences(expectations = {}) {
  const errors = [];
  for (const [claimId, surfaces] of Object.entries(expectations)) {
    const entries = Object.entries(surfaces || {}).filter(([, value]) => value !== undefined && value !== null && value !== '');
    if (entries.length < 2) continue;
    const canonical = JSON.stringify(entries[0][1]);
    const divergent = entries.filter(([, value]) => JSON.stringify(value) !== canonical);
    if (divergent.length) {
      errors.push(issue('SURFACE_DIVERGENCE', `${claimId} diverge entre: ${entries.map(([name]) => name).join(', ')}.`, claimId));
    }
  }
  return { errors, valid: errors.length === 0 };
}

function detectObsolescence(authority = {}, today = new Date()) {
  const day = new Date(`${today.toISOString().slice(0, 10)}T00:00:00Z`);
  const alerts = [];
  for (const claim of authority.claims || []) {
    if (claim.nextReviewAt && new Date(`${claim.nextReviewAt}T00:00:00Z`) < day) {
      alerts.push(issue('CLAIM_REVIEW_OVERDUE', `Revisão vencida em ${claim.nextReviewAt}.`, claim.id, 'warning'));
    }
  }
  for (const source of authority.sourceRegistry || []) {
    if (['BROKEN', 'CONTENT_MISMATCH'].includes(source.status)) alerts.push(issue('SOURCE_REQUIRES_ACTION', `Fonte com status ${source.status}.`, source.id, 'warning'));
    const verified = validateIsoDate(source.lastVerifiedAt) ? new Date(`${source.lastVerifiedAt}T00:00:00Z`) : null;
    const ageDays = verified ? Math.floor((day - verified) / 86400000) : null;
    if ((source.reliability === 'D' || source.type === 'temporary_status') && (ageDays === null || ageDays > 30)) {
      alerts.push(issue('VOLATILE_SOURCE_OVERDUE', `Fonte volátil sem revisão válida nos últimos 30 dias.`, source.id, 'warning'));
    }
  }
  return alerts;
}

function validateFeedbackTransition(record = {}, targetState = '') {
  const errors = [];
  const current = record.state || 'NEW';
  if (!WORKFLOW_STATES.includes(current) || !WORKFLOW_STATES.includes(targetState)) {
    return { valid: false, errors: [issue('WORKFLOW_STATE_INVALID', 'Estado editorial inválido.')] };
  }
  const allowed = {
    NEW: ['TRIAGED', 'REJECTED'], TRIAGED: ['NEEDS_EVIDENCE', 'ACCEPTED', 'REJECTED'],
    NEEDS_EVIDENCE: ['TRIAGED', 'ACCEPTED', 'REJECTED'], ACCEPTED: ['IMPLEMENTED', 'REJECTED'],
    REJECTED: [], IMPLEMENTED: ['VERIFIED'], VERIFIED: ['PUBLISHED', 'IMPLEMENTED'], PUBLISHED: []
  };
  if (!(allowed[current] || []).includes(targetState)) errors.push(issue('WORKFLOW_TRANSITION_INVALID', `Transição ${current} → ${targetState} não permitida.`));
  if (targetState === 'ACCEPTED' && !(record.evidence || []).length) errors.push(issue('WORKFLOW_EVIDENCE_REQUIRED', 'ACCEPTED exige evidência registrada.'));
  if (targetState === 'ACCEPTED' && !(record.tests || []).length) errors.push(issue('WORKFLOW_TEST_REQUIRED', 'ACCEPTED exige teste planejado ou executado.'));
  if (targetState === 'IMPLEMENTED' && !record.changeReference) errors.push(issue('WORKFLOW_CHANGE_REQUIRED', 'IMPLEMENTED exige referência da mudança.'));
  if (targetState === 'VERIFIED' && (!(record.tests || []).length || !record.reviewer)) errors.push(issue('WORKFLOW_VERIFICATION_REQUIRED', 'VERIFIED exige testes e revisor humano.'));
  if (targetState === 'PUBLISHED' && record.state !== 'VERIFIED') errors.push(issue('WORKFLOW_VERIFIED_REQUIRED', 'PUBLISHED exige estado VERIFIED.'));
  return { errors, valid: errors.length === 0 };
}

function buildRollbackPlan({ currentSnapshot, previousSnapshot, userProgress } = {}) {
  return {
    operation: 'replace-editorial-snapshot-only',
    currentSnapshot,
    restoreSnapshot: previousSnapshot,
    userProgress,
    userProgressTouched: false,
    destructiveCommands: false,
    steps: ['pausar publicação', 'preservar snapshot atual', 'restaurar snapshot editorial anterior', 'executar audits', 'republicar após aprovação']
  };
}

module.exports = {
  REQUIRED_SOURCE_FIELDS, RELIABILITY, CLASSIFICATIONS, CONFIDENCE, SOURCE_STATUSES,
  ONLINE_STATES, WORKFLOW_STATES, validateSourceRegistry, validateClaims,
  validateFreshness, detectSurfaceDivergences, detectObsolescence,
  validateFeedbackTransition, buildRollbackPlan, validateIsoDate
};
