'use strict';

const fs = require('fs');
const path = require('path');
const {
  ROOT, ARTIFACT_DIR, assertRe5Slug, startAuditServer, stopAuditServer,
  ensureArtifactDir, writeJsonAndMarkdown
} = require('./re5-audit-utils');

const USER_AGENT = 'AtlasAchievementEditorialAudit/1.0 (+https://atlasachievement.com.br/sobre; contato editorial)';
const TIMEOUT_MS = Number(process.env.RE5_LINK_TIMEOUT_MS || 15000);
const MAX_REDIRECTS = 4;
const MAX_BODY_BYTES = 65536;
const CONCURRENCY = 2;

function cleanTitle(html = '') {
  const match = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().slice(0, 300) : '';
}

function classifyHttpResult(result = {}, expectedTitleTerms = []) {
  if (result.error) return 'INCONCLUSIVE';
  if (result.status === 403) return 'BLOCKED';
  if (result.status === 429) return 'RATE_LIMITED';
  if ([404, 410].includes(result.status) || result.status >= 500 || result.redirectLimitExceeded) return 'BROKEN';
  if (result.status >= 200 && result.status < 300) {
    const title = String(result.title || '').toLowerCase();
    const terms = (expectedTitleTerms || []).map(term => String(term).toLowerCase()).filter(Boolean);
    if (terms.length && title && !terms.some(term => title.includes(term))) return 'CONTENT_MISMATCH';
    return result.redirects?.length ? 'REDIRECT_VALID' : 'OK';
  }
  return 'INCONCLUSIVE';
}

async function fetchManual(url, options = {}) {
  const redirects = [];
  let current = url;
  let response = null;
  for (let index = 0; index <= MAX_REDIRECTS; index += 1) {
    response = await fetch(current, {
      method: options.method || 'GET',
      redirect: 'manual',
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/json,application/pdf;q=0.9,*/*;q=0.7',
        ...(options.headers || {})
      },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      const next = new URL(response.headers.get('location'), current).href;
      redirects.push({ status: response.status, from: current, to: next });
      current = next;
      continue;
    }
    return { response, finalUrl: current, redirects, redirectLimitExceeded: false };
  }
  return { response, finalUrl: current, redirects, redirectLimitExceeded: true };
}

async function readLimitedBody(response) {
  if (!response?.body) return '';
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (total < MAX_BODY_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = MAX_BODY_BYTES - total;
      const chunk = value.length > remaining ? value.slice(0, remaining) : value;
      chunks.push(chunk);
      total += chunk.length;
    }
  } finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks.map(value => Buffer.from(value))).toString('utf8');
}

async function auditExternalSource(source) {
  const requestedUrl = source.youtubeId
    ? `https://www.youtube.com/oembed?url=${encodeURIComponent(source.url)}&format=json`
    : source.url;
  const result = {
    id: source.id, sourceUrl: source.url, requestedUrl, finalUrl: requestedUrl,
    methodSequence: [], redirects: [], status: 0, contentType: '', title: '', bytesRead: 0,
    error: null, classification: 'INCONCLUSIVE', previousEditorialStatus: source.status,
    expectedTitleTerms: source.expectedTitleTerms || []
  };
  try {
    const head = await fetchManual(requestedUrl, { method: 'HEAD' });
    result.methodSequence.push({ method: 'HEAD', status: head.response?.status || 0 });
    result.status = head.response?.status || 0;
    result.finalUrl = head.finalUrl;
    result.redirects = head.redirects;
    result.contentType = head.response?.headers.get('content-type') || '';
    result.redirectLimitExceeded = head.redirectLimitExceeded;

    if (result.status !== 429) {
      const get = await fetchManual(requestedUrl, { method: 'GET', headers: { range: `bytes=0-${MAX_BODY_BYTES - 1}` } });
      result.methodSequence.push({ method: 'GET_RANGE', status: get.response?.status || 0 });
      result.status = get.response?.status || 0;
      result.finalUrl = get.finalUrl;
      result.redirects = get.redirects;
      result.contentType = get.response?.headers.get('content-type') || '';
      result.redirectLimitExceeded = get.redirectLimitExceeded;
      const body = await readLimitedBody(get.response);
      result.bytesRead = Buffer.byteLength(body);
      if (source.youtubeId && get.response?.ok) {
        try { result.title = JSON.parse(body).title || ''; }
        catch (_error) { result.title = ''; }
      } else {
        result.title = cleanTitle(body);
      }
    }
  } catch (error) {
    result.error = error?.name === 'TimeoutError' || error?.name === 'AbortError' ? `timeout após ${TIMEOUT_MS}ms` : String(error.message || error);
  }
  result.classification = classifyHttpResult(result, source.expectedTitleTerms);
  return result;
}

async function mapConcurrent(items, limit, worker) {
  const output = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return output;
}

function walkYoutube(value, output = []) {
  if (Array.isArray(value)) value.forEach(item => walkYoutube(item, output));
  else if (value && typeof value === 'object') Object.values(value).forEach(item => walkYoutube(item, output));
  else if (typeof value === 'string' && /^https:\/\/(?:www\.)?(?:youtube\.com\/watch|youtu\.be\/)/i.test(value)) output.push(value);
  return output;
}

function youtubeUrlData(value = '') {
  try {
    const url = new URL(value);
    const id = url.hostname.includes('youtu.be') ? url.pathname.slice(1) : url.searchParams.get('v');
    const raw = url.searchParams.get('t') || '';
    let seconds = null;
    if (/^\d+s?$/.test(raw)) seconds = Number(raw.replace(/s$/, ''));
    else if (/^(?:\d+h)?(?:\d+m)?(?:\d+s)?$/.test(raw) && raw) {
      seconds = Number(raw.match(/(\d+)h/)?.[1] || 0) * 3600
        + Number(raw.match(/(\d+)m/)?.[1] || 0) * 60
        + Number(raw.match(/(\d+)s/)?.[1] || 0);
    }
    return { id, seconds };
  } catch (_error) { return { id: null, seconds: null }; }
}

function updateHistory(current) {
  ensureArtifactDir();
  const historyPath = path.join(ARTIFACT_DIR, 'link-audit-history.json');
  let history = [];
  try { history = JSON.parse(fs.readFileSync(historyPath, 'utf8')); }
  catch (_error) { history = []; }
  history.push({
    lastChecked: current.lastChecked,
    status: current.status,
    summary: current.summary,
    sources: current.sources.map(item => ({ id: item.id, classification: item.classification, status: item.status }))
  });
  history = history.slice(-3);
  fs.writeFileSync(historyPath, `${JSON.stringify(history, null, 2)}\n`);
  return history;
}

function markdown(report) {
  const rows = report.sources.map(item => `| ${item.classification} | ${item.id} | ${item.status || 0} | ${item.finalUrl} |`).join('\n');
  return `# Audit de links RE5 — Fase 9

- Resultado: **${report.status}**
- Verificação técnica: ${report.lastChecked}
- User-Agent identificado: \`${USER_AGENT}\`
- Concorrência: ${CONCURRENCY}
- Timeout: ${TIMEOUT_MS} ms
- Política: HEAD seguido de GET leve; até ${MAX_REDIRECTS} redirecionamentos; 403/429/antibot não são classificados como quebrados.

| Status | Fonte | HTTP | Destino final |
|---|---|---:|---|
${rows}

Fragments internos quebrados: ${report.internalFragments.broken.length}. Assets locais quebrados: ${report.localAssets.broken.length}. Timestamps verificados: ${report.videoTimestamps.withTimestamp}; inválidos: ${report.videoTimestamps.invalid}.
`;
}

async function main() {
  assertRe5Slug();
  const lastChecked = new Date().toISOString();
  const port = Number(process.env.RE5_PHASE9_LINK_PORT || (4490 + (process.pid % 100)));
  const game = require('../src/data/sampleGames').find(item => item.slug === 'resident-evil-5');
  let server;
  try {
    server = await startAuditServer(port);
    const pageResponse = await fetch(`${server.origin}/jogo/resident-evil-5`);
    const html = await pageResponse.text();
    const sources = await mapConcurrent(game.editorialAuthority.sourceRegistry, CONCURRENCY, auditExternalSource);

    const durations = new Map((game.videoAudit || []).map(item => [item.youtubeId, Number(item.durationSeconds || 0)]));
    for (const source of game.editorialAuthority.sourceRegistry) {
      if (source.youtubeId && source.durationSeconds) durations.set(source.youtubeId, Number(source.durationSeconds));
    }
    const youtubeOccurrences = walkYoutube(game);
    const timestampChecks = youtubeOccurrences.map(url => {
      const parsed = youtubeUrlData(url);
      const durationSeconds = durations.get(parsed.id) || 0;
      return {
        url, youtubeId: parsed.id, timestampSeconds: parsed.seconds, durationSeconds,
        valid: parsed.seconds === null || (durationSeconds > 0 && parsed.seconds <= durationSeconds)
      };
    });
    const invalidTimestamps = timestampChecks.filter(item => !item.valid);

    const hrefFragments = [...html.matchAll(/<a\b[^>]*\bhref=["']#([^"']+)["'][^>]*>/gi)].map(match => match[1]);
    const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/gi)].map(match => match[1]));
    const uniqueFragments = [...new Set(hrefFragments)];
    const internalFragments = {
      occurrences: hrefFragments.length,
      unique: uniqueFragments.length,
      valid: uniqueFragments.filter(fragment => ids.has(fragment)),
      broken: uniqueFragments.filter(fragment => !ids.has(fragment))
    };

    const assetPaths = [game.editorialAuthority.socialImage?.src, ...(game.instructionalVisuals || []).map(item => item.src)].filter(Boolean);
    const localAssets = { checked: [], broken: [] };
    for (const asset of [...new Set(assetPaths)]) {
      const resolved = path.resolve(ROOT, 'public', asset.replace(/^\/+/, ''));
      const insidePublic = resolved.startsWith(path.resolve(ROOT, 'public') + path.sep);
      const exists = insidePublic && fs.existsSync(resolved) && fs.statSync(resolved).isFile();
      localAssets.checked.push({ asset, exists });
      if (!exists) localAssets.broken.push(asset);
    }

    const deterministic = sources.filter(item => ['BROKEN', 'CONTENT_MISMATCH'].includes(item.classification));
    const warningStatuses = sources.filter(item => ['BLOCKED', 'RATE_LIMITED', 'INCONCLUSIVE'].includes(item.classification));
    const failureCount = deterministic.length + internalFragments.broken.length + localAssets.broken.length + invalidTimestamps.length + (pageResponse.ok ? 0 : 1);
    const summary = {
      total: sources.length,
      ok: sources.filter(item => item.classification === 'OK').length,
      redirectValid: sources.filter(item => item.classification === 'REDIRECT_VALID').length,
      blocked: sources.filter(item => item.classification === 'BLOCKED').length,
      rateLimited: sources.filter(item => item.classification === 'RATE_LIMITED').length,
      inconclusive: sources.filter(item => item.classification === 'INCONCLUSIVE').length,
      broken: sources.filter(item => item.classification === 'BROKEN').length,
      contentMismatch: sources.filter(item => item.classification === 'CONTENT_MISMATCH').length,
      deterministicFailures: failureCount,
      warnings: warningStatuses.length
    };
    const report = {
      schemaVersion: 1, audit: 'resident-evil-5-links', lastChecked,
      editorialReviewUnchanged: game.editorialAuthority.reviewedAt,
      status: failureCount ? 'FAIL' : 'PASS_WITH_WARNINGS',
      policy: { userAgent: USER_AGENT, concurrency: CONCURRENCY, timeoutMs: TIMEOUT_MS, maxRedirects: MAX_REDIRECTS, maxBodyBytes: MAX_BODY_BYTES, antiBotBypass: false },
      summary, sources,
      videoTimestamps: {
        occurrences: timestampChecks.length,
        withTimestamp: timestampChecks.filter(item => item.timestampSeconds !== null).length,
        invalid: invalidTimestamps.length,
        checks: timestampChecks
      },
      internalFragments, localAssets
    };
    report.history = updateHistory(report);
    report.obsolescenceAlerts = [];
    if (report.history.length === 3) {
      for (const source of sources) {
        if (report.history.every(entry => entry.sources?.find(item => item.id === source.id)?.classification === 'INCONCLUSIVE')) {
          report.obsolescenceAlerts.push({ code: 'LINK_INCONCLUSIVE_THREE_RUNS', sourceId: source.id });
        }
      }
    }
    const paths = writeJsonAndMarkdown('link-audit', report, markdown(report));
    process.stdout.write(`Audit de links ${report.status}: ${paths.jsonPath}\n`);
    if (failureCount) process.exitCode = 1;
  } finally { await stopAuditServer(server); }
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { classifyHttpResult, auditExternalSource, cleanTitle, mapConcurrent };
