'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { ROOT, ARTIFACT_DIR, hash, writeJsonAndMarkdown } = require('./re5-audit-utils');

function runCommand(id, args) {
  const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const executable = fs.existsSync(npmCli) ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
  const commandArgs = fs.existsSync(npmCli) ? [npmCli, ...args] : args;
  const result = spawnSync(executable, commandArgs, { cwd: ROOT, encoding: 'utf8', timeout: 180000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  const output = `${result.stdout || ''}\n${result.stderr || ''}\n${result.error?.message || ''}`.trim();
  return {
    id,
    command: `npm ${args.join(' ')}`,
    exitCode: result.status ?? 1,
    status: result.status === 0 ? 'PASS' : 'FAIL',
    outputTail: output.split(/\r?\n/).slice(-30).join('\n')
  };
}

function feedbackOpenCount() {
  return new Promise(resolve => {
    const database = new sqlite3.Database(path.join(ROOT, 'database.sqlite'), sqlite3.OPEN_READONLY);
    database.get(
      `SELECT COUNT(*) AS total FROM feedbacks
        WHERE guide_slug = 'resident-evil-5'
          AND COALESCE(workflow_state, 'NEW') NOT IN ('REJECTED', 'PUBLISHED')`,
      [],
      (error, row) => {
        database.close(() => resolve(error ? null : Number(row?.total || 0)));
      }
    );
  });
}

function markdown(report) {
  const testRows = report.tests.map(test => `| ${test.status} | \`${test.command}\` | ${test.exitCode} |`).join('\n');
  return `# Relatório de qualidade contínua — Resident Evil 5

- Estado: **${report.status}**
- Último check técnico: ${report.freshness.lastTechnicalCheck}
- Última revisão editorial: ${report.freshness.lastEditorialReview}
- Próxima revisão volátil: ${report.freshness.nextVolatileReview}
- Claims: ${report.claims.total} (${Object.entries(report.claims.confidence).map(([key, value]) => `${key}=${value}`).join(', ')})
- Fontes: ${report.sources.total}; links OK=${report.links.ok}; bloqueados=${report.links.blocked}; quebrados=${report.links.broken}
- Feedbacks RE5 abertos: ${report.feedback.openCount ?? 'indisponível'} (somente contagem; mensagens e contatos não foram lidos)
- Snapshot: \`${report.snapshot.sha256}\`

## Checks

| Status | Comando | Exit code |
|---|---|---:|
${testRows}

Audit estrutural: ${report.audits.structural}. Audit de links: ${report.audits.links}. Browser QA: ${report.audits.browser}. Divergências abertas: ${report.divergences.length}. Alertas de obsolescência: ${report.obsolescence.length}.

Falha de teste/refactor técnico não atualiza \`dateModified\`, \`reviewedAt\` ou changelog público.
`;
}

async function main() {
  const structural = JSON.parse(fs.readFileSync(path.join(ARTIFACT_DIR, 'structural-audit.json'), 'utf8'));
  const links = JSON.parse(fs.readFileSync(path.join(ARTIFACT_DIR, 'link-audit.json'), 'utf8'));
  const browser = JSON.parse(fs.readFileSync(path.join(ARTIFACT_DIR, 'browser-feedback-qa.json'), 'utf8'));
  const game = require('../src/data/sampleGames').find(item => item.slug === 'resident-evil-5');
  const authority = game.editorialAuthority;
  let tests;
  const reuseTests = process.argv.includes('--reuse-tests');
  if (reuseTests) {
    const previous = JSON.parse(fs.readFileSync(path.join(ARTIFACT_DIR, 'quality-report.json'), 'utf8'));
    tests = previous.tests;
    if (!Array.isArray(tests) || tests.length !== 5) throw new Error('Resultados anteriores incompletos; execute sem --reuse-tests.');
  } else {
    tests = [
      runCommand('governance-simulations', ['run', 'test:re5:governance']),
      runCommand('guide-layer', ['run', 'test:guide', '--', 'resident-evil-5']),
      runCommand('seo-layer', ['run', 'test:seo']),
      runCommand('build', ['run', 'build']),
      runCommand('global-regression', ['test'])
    ];
  }
  const required = tests.filter(test => test.id !== 'global-regression');
  const globalRegression = tests.find(test => test.id === 'global-regression');
  const divergences = structural.checks.filter(check => !check.ok);
  const sourceCounts = links.summary;
  const confidence = (authority.claims || []).reduce((counts, claim) => {
    counts[claim.confidence] = (counts[claim.confidence] || 0) + 1;
    return counts;
  }, {});
  const technicalTimes = [structural.lastChecked, links.lastChecked, browser.lastChecked].filter(Boolean).sort();
  const snapshotRaw = fs.readFileSync(path.join(ROOT, 'data/guides/resident-evil-5.json'), 'utf8');
  const regressionWarning = globalRegression.status === 'FAIL' ? {
    code: 'GLOBAL_REGRESSION_BASELINE',
    detail: globalRegression.outputTail,
    scope: 'catálogo global; separado dos checks determinísticos RE5'
  } : null;
  const deterministicFailure = required.some(test => test.status !== 'PASS')
    || structural.status !== 'PASS'
    || links.summary.deterministicFailures > 0
    || browser.status !== 'PASS';
  const report = {
    schemaVersion: 1,
    guide: 'resident-evil-5',
    status: deterministicFailure ? 'FAIL' : (regressionWarning ? 'PASS_WITH_WARNING' : 'PASS'),
    freshness: {
      lastTechnicalCheck: technicalTimes.at(-1),
      lastEditorialReview: authority.reviewedAt,
      dateModified: authority.governance.dateModified,
      nextVolatileReview: authority.governance.nextVolatileReview,
      technicalCheckChangedEditorialDates: false
    },
    counts: structural.counts,
    claims: { total: authority.claims.length, confidence },
    sources: { total: authority.sourceRegistry.length, public: authority.sources.length },
    links: sourceCounts,
    feedback: { openCount: await feedbackOpenCount(), contentRead: false, contactRead: false },
    snapshot: { schemaVersion: 1, sha256: hash(JSON.parse(snapshotRaw)), bytes: Buffer.byteLength(snapshotRaw) },
    audits: { structural: structural.status, links: links.status, browser: browser.status },
    divergences,
    obsolescence: structural.obsolescence,
    warnings: regressionWarning ? [regressionWarning] : [],
    tests,
    publicChangelog: authority.history.slice(0, authority.governance.publicHistoryLimit),
    generatedAt: new Date().toISOString()
  };
  const paths = writeJsonAndMarkdown('quality-report', report, markdown(report));
  process.stdout.write(`Relatório de qualidade ${report.status}: ${paths.jsonPath}\n`);
  if (deterministicFailure) process.exitCode = 1;
}

main().catch(error => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
