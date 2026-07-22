const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'artifacts', 're5-phase8', 'lighthouse');
const OUTPUT = path.join(ROOT, 'artifacts', 're5-phase8', 'performance-comparison.json');

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function parse(mode, profile, run) {
  const file = path.join(DIR, `${mode}-${profile}-${run}.json`);
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  const network = report.audits['network-requests']?.details?.items || [];
  const audit = id => Number(report.audits[id]?.numericValue || 0);
  const scripts = network.filter(item => item.resourceType === 'Script');
  const styles = network.filter(item => item.resourceType === 'Stylesheet');
  return {
    mode,
    profile,
    run,
    lighthouseVersion: report.lighthouseVersion,
    scores: Object.fromEntries(['performance', 'accessibility', 'best-practices', 'seo'].map(id => [id, Math.round(Number(report.categories[id]?.score || 0) * 100)])),
    metrics: {
      fcpMs: audit('first-contentful-paint'),
      lcpMs: audit('largest-contentful-paint'),
      tbtMs: audit('total-blocking-time'),
      cls: audit('cumulative-layout-shift'),
      speedIndexMs: audit('speed-index'),
      transferBytes: audit('total-byte-weight'),
      requests: network.length,
      javascriptTransferBytes: scripts.reduce((sum, item) => sum + Number(item.transferSize || 0), 0),
      cssTransferBytes: styles.reduce((sum, item) => sum + Number(item.transferSize || 0), 0),
      longTasks: (report.audits['long-tasks']?.details?.items || []).length,
      longTaskDurationMs: (report.audits['long-tasks']?.details?.items || []).reduce((sum, item) => sum + Number(item.duration || 0), 0)
    },
    forbiddenRequests: network.map(item => item.url).filter(url => /googlesyndication|doubleclick|adsbygoogle|googletagmanager|google-analytics/i.test(url)),
    a11yFailures: Object.values(report.audits).filter(item => item.scoreDisplayMode === 'binary' && item.score === 0 && report.categories.accessibility.auditRefs.some(ref => ref.id === item.id)).map(item => item.id)
  };
}

const runs = [];
for (const mode of ['off', 'placeholders']) {
  for (const profile of ['mobile', 'desktop']) {
    for (let run = 1; run <= 3; run += 1) runs.push(parse(mode, profile, run));
  }
}

const metricKeys = Object.keys(runs[0].metrics);
const medians = {};
for (const mode of ['off', 'placeholders']) {
  medians[mode] = {};
  for (const profile of ['mobile', 'desktop']) {
    const selected = runs.filter(item => item.mode === mode && item.profile === profile);
    medians[mode][profile] = {
      scores: Object.fromEntries(Object.keys(selected[0].scores).map(key => [key, median(selected.map(item => item.scores[key]))])),
      metrics: Object.fromEntries(metricKeys.map(key => [key, median(selected.map(item => item.metrics[key]))]))
    };
  }
}

const comparison = {};
for (const profile of ['mobile', 'desktop']) {
  const before = medians.off[profile];
  const after = medians.placeholders[profile];
  comparison[profile] = {
    performanceDelta: after.scores.performance - before.scores.performance,
    lcpDeltaMs: after.metrics.lcpMs - before.metrics.lcpMs,
    clsDelta: after.metrics.cls - before.metrics.cls,
    tbtDeltaMs: after.metrics.tbtMs - before.metrics.tbtMs,
    requestDelta: after.metrics.requests - before.metrics.requests,
    transferDeltaBytes: after.metrics.transferBytes - before.metrics.transferBytes,
    javascriptDeltaBytes: after.metrics.javascriptTransferBytes - before.metrics.javascriptTransferBytes,
    cssDeltaBytes: after.metrics.cssTransferBytes - before.metrics.cssTransferBytes
  };
}

assert(runs.every(item => item.a11yFailures.length === 0), 'Lighthouse accessibility failures found');
assert(runs.every(item => item.scores.accessibility === 100), 'Accessibility must remain 100');
assert(runs.every(item => item.metrics.cls <= 0.1), 'CLS exceeded 0.1');
assert(runs.every(item => item.forbiddenRequests.length === 0), 'Real analytics/ad request detected');
assert(Object.values(comparison).every(item => item.performanceDelta >= -3), 'Placeholder performance regression exceeds 3 points');
assert(Object.values(comparison).every(item => item.tbtDeltaMs <= 100), 'Placeholder TBT regression exceeds 100 ms');

const output = {
  generatedAt: new Date().toISOString(),
  sampleType: 'laboratory',
  fieldDataStatus: 'dados insuficientes — nenhuma medição pós-deploy foi simulada',
  runs,
  medians,
  comparison,
  inpNote: 'INP requer dados de campo; Lighthouse/TBT não substituem INP.'
};
fs.writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
process.stdout.write(`Phase 8 Lighthouse comparison passed: ${OUTPUT}\n`);
