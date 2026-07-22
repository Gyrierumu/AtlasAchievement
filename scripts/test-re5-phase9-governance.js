'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  validateSourceRegistry, validateClaims, validateFreshness, detectSurfaceDivergences,
  validateFeedbackTransition, buildRollbackPlan
} = require('../src/shared/re5GovernanceValidators');
const { classifyHttpResult } = require('./audit-guide-links');
const feedbackService = require('../src/services/feedback.service');
const { requirePublicFormCsrf } = require('../src/middleware/csrfProtection');

const ROOT = path.resolve(__dirname, '..');

function expectAppError(fn, code) {
  assert.throws(fn, error => error?.code === code, `esperado AppError ${code}`);
}

function testCsrf() {
  const makeReq = token => ({
    method: 'POST', session: { csrfToken: 'known-token' },
    get(name) {
      const headers = { origin: 'http://localhost:3000', host: 'localhost:3000', 'x-csrf-token': token };
      return headers[String(name).toLowerCase()] || null;
    }
  });
  let validReached = false;
  requirePublicFormCsrf(makeReq('known-token'), {}, error => {
    assert.ifError(error);
    validReached = true;
  });
  assert(validReached, 'CSRF válido deve alcançar a rota');
  let missingError;
  requirePublicFormCsrf(makeReq(null), {}, error => { missingError = error; });
  assert.strictEqual(missingError?.code, 'CSRF_TOKEN_INVALID');
}

function main() {
  const game = require('../src/data/sampleGames').find(item => item.slug === 'resident-evil-5');
  const authority = game.editorialAuthority;
  assert.strictEqual(authority.sourceRegistry.length, 11);
  assert.strictEqual(authority.sources.length, 6);
  assert.strictEqual(authority.claims.length, 17);
  assert(validateSourceRegistry(authority.sourceRegistry).valid);
  assert(validateClaims(authority.claims, authority.sourceRegistry).valid);
  assert(validateFreshness(authority).valid);

  const missingSourceClaims = structuredClone(authority.claims);
  missingSourceClaims[0].primarySource = 'fonte-ausente';
  assert(validateClaims(missingSourceClaims, authority.sourceRegistry).errors.some(item => item.code === 'CLAIM_SOURCE_MISSING'));

  const changedDate = structuredClone(authority);
  changedDate.reviewedAt = '2026-07-19';
  changedDate.governance.dateModified = '2026-07-19';
  changedDate.governance.lastEditorialReview = '2026-07-19';
  assert(validateFreshness(changedDate, authority).errors.some(item => item.code === 'DATE_CHANGED_WITHOUT_CHANGELOG'));

  const divergence = detectSurfaceDivergences({
    're5-score-stars-18': { checklist: 18, alt: 18, fallback: 17, svg: 18 }
  });
  assert(!divergence.valid);
  assert(divergence.errors.some(item => item.code === 'SURFACE_DIVERGENCE'));

  const dSource = [{ ...authority.sourceRegistry.find(item => item.reliability === 'D'), id: 'd-only', claims: ['fact-d-only'] }];
  const dClaim = [{
    id: 'fact-d-only', summary: 'Requisito factual', classification: 'version_dependent', version: 'PS4',
    primarySource: 'd-only', supportingSources: [], confidence: 'HIGH', lastVerifiedAt: '2026-07-18',
    nextReviewAt: null, owner: 'Editorial', surfaces: ['seed']
  }];
  assert(validateClaims(dClaim, dSource).errors.some(item => item.code === 'CLAIM_D_ONLY_INVALID'));

  assert(!validateFeedbackTransition({ state: 'TRIAGED', evidence: [] }, 'ACCEPTED').valid);
  assert(validateFeedbackTransition({ state: 'TRIAGED', evidence: ['fonte-a'], tests: [] }, 'ACCEPTED').errors.some(item => item.code === 'WORKFLOW_TEST_REQUIRED'));
  assert(!validateFeedbackTransition({ state: 'IMPLEMENTED', tests: [], reviewer: 'Editor' }, 'VERIFIED').valid);
  assert(validateFeedbackTransition({ state: 'IMPLEMENTED', tests: ['audit:guide'], reviewer: 'Editor' }, 'VERIFIED').valid);

  assert.strictEqual(classifyHttpResult({ status: 404 }), 'BROKEN');
  assert.strictEqual(classifyHttpResult({ status: 403 }), 'BLOCKED');
  assert.strictEqual(classifyHttpResult({ status: 429 }), 'RATE_LIMITED');
  assert.strictEqual(classifyHttpResult({ error: 'timeout' }), 'INCONCLUSIVE');
  assert.strictEqual(classifyHttpResult({ status: 200, redirects: [{}], contentType: 'text/html', title: 'Resident Evil 5' }, ['resident evil 5']), 'REDIRECT_VALID');
  assert.strictEqual(classifyHttpResult({ status: 200, redirects: [], contentType: 'text/html', title: 'Página totalmente diferente' }, ['resident evil 5']), 'CONTENT_MISMATCH');

  const validFeedback = feedbackService.validateFeedbackPayload({
    type: 'Erro em guia', relatedGame: 'Resident Evil 5',
    pageUrl: 'https://atlasachievement.com.br/jogo/resident-evil-5?utm_source=private#guideTab-dlc',
    message: 'A descrição observada parece divergir do requisito publicado.',
    guideSlug: 'resident-evil-5', category: 'Informação incorreta', sectionAnchor: '#guideTab-dlc',
    platformVersion: 'PS4/Remaster', sourceUrl: 'https://example.org/evidencia',
    frontendVersion: 'web-4.0.0', viewportBucket: 'small', activeTab: 'dlc'
  });
  assert.strictEqual(validFeedback.pageUrl, 'https://atlasachievement.com.br/jogo/resident-evil-5');
  assert.strictEqual(validFeedback.workflowState, 'NEW');
  assert.strictEqual(validFeedback.reportDate, new Date().toISOString().slice(0, 10));
  expectAppError(() => feedbackService.validateFeedbackPayload({
    type: 'Erro em guia', pageUrl: 'https://atlasachievement.com.br/jogo/resident-evil-5',
    message: '<img src=x onerror=alert(1)>', guideSlug: 'resident-evil-5', category: 'Outro',
    sectionAnchor: '#summary', platformVersion: 'PS4'
  }), 'FEEDBACK_HTML_NOT_ALLOWED');
  expectAppError(() => feedbackService.validateFeedbackPayload({
    type: 'Erro em guia', pageUrl: 'https://atlasachievement.com.br/jogo/resident-evil-5',
    message: 'Mensagem segura com contexto suficiente.', guideSlug: 'resident-evil-5', category: 'Link quebrado',
    sectionAnchor: '#summary', platformVersion: 'PS4', sourceUrl: 'javascript:alert(1)'
  }), 'FEEDBACK_INVALID_URL');
  expectAppError(() => feedbackService.validateFeedbackPayload({
    type: 'Erro em guia', pageUrl: 'https://atlasachievement.com.br/jogo/resident-evil-5',
    message: 'Mensagem segura com contexto suficiente.', guideSlug: 'resident-evil-5', category: 'Categoria inventada',
    sectionAnchor: '#summary', platformVersion: 'PS4'
  }), 'FEEDBACK_INVALID_CATEGORY');
  testCsrf();

  const progress = { completed: ['re5_platinum'], notes: 'progresso do usuário' };
  const rollback = buildRollbackPlan({ currentSnapshot: 'v2', previousSnapshot: 'v1', userProgress: progress });
  assert.strictEqual(rollback.userProgressTouched, false);
  assert.deepStrictEqual(rollback.userProgress, progress);

  const feedbackClient = fs.readFileSync(path.join(ROOT, 'public/js/app-feedback.js'), 'utf8');
  assert(!/fetch\s*\(\s*(?:payload\.)?sourceUrl|window\.open\s*\(\s*(?:payload\.)?sourceUrl/.test(feedbackClient), 'URL enviada nunca deve ser aberta automaticamente');
  assert(!/completedIds|checklistState|trophyProgress/.test(feedbackClient), 'feedback não deve capturar estado do checklist');
  const ssr = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
  const hydrated = fs.readFileSync(path.join(ROOT, 'public/js/ui-guide.js'), 'utf8');
  assert(/history\.slice\(0, publicHistoryLimit\)/.test(ssr));
  assert(/history\.slice\(0, publicHistoryLimit\)/.test(hydrated));

  process.stdout.write('Fase 9 governance/security simulations passed (claims, links, feedback, workflow, rollback).\n');
}

main();
