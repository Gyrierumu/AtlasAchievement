const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'artifacts', 're5-phase7', 'lighthouse');
const OUTPUT = path.join(ROOT, 'artifacts', 're5-phase7', 'performance-summary.json');

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function resources(report) {
  const items = report.audits['network-requests']?.details?.items || [];
  const totals = {};
  for (const item of items) {
    const key = item.resourceType || 'Other';
    if (!totals[key]) totals[key] = { requests: 0, transferBytes: 0, resourceBytes: 0 };
    totals[key].requests += 1;
    totals[key].transferBytes += Number(item.transferSize || 0);
    totals[key].resourceBytes += Number(item.resourceSize || 0);
  }
  return { items, totals };
}

function parse(file, profile, run) {
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert(!report.runtimeError, `${profile}-${run} has runtimeError: ${JSON.stringify(report.runtimeError)}`);
  const network = resources(report);
  const audit = id => Number(report.audits[id]?.numericValue || 0);
  return {
    profile,
    run,
    lighthouseVersion: report.lighthouseVersion,
    fetchTime: report.fetchTime,
    scores: Object.fromEntries(['performance', 'accessibility', 'best-practices', 'seo'].map(id => [id, Math.round(Number(report.categories[id]?.score || 0) * 100)])),
    metrics: {
      fcpMs: audit('first-contentful-paint'),
      lcpMs: audit('largest-contentful-paint'),
      tbtMs: audit('total-blocking-time'),
      cls: audit('cumulative-layout-shift'),
      speedIndexMs: audit('speed-index'),
      transferBytes: audit('total-byte-weight'),
      requests: network.items.length,
      domNodes: report.audits['dom-size'] ? audit('dom-size') : null,
      longTasks: (report.audits['long-tasks']?.details?.items || []).length,
      longTaskDurationMs: (report.audits['long-tasks']?.details?.items || []).reduce((sum, item) => sum + Number(item.duration || 0), 0),
      mainThreadWorkMs: audit('mainthread-work-breakdown'),
      bootupMs: audit('bootup-time')
    },
    resources: network.totals,
    a11yFailures: Object.values(report.audits).filter(item => item.scoreDisplayMode === 'binary' && item.score === 0 && report.categories.accessibility.auditRefs.some(ref => ref.id === item.id)).map(item => ({ id: item.id, title: item.title }))
  };
}

const runs = [];
for (const profile of ['mobile', 'desktop']) for (let run = 1; run <= 3; run += 1) runs.push(parse(path.join(DIR, `${profile}-${run}.json`), profile, run));
const browserReportPath = path.join(ROOT, 'artifacts', 're5-phase7', 'journeys-resilience-a11y.json');
const browserDomNodes = fs.existsSync(browserReportPath) ? JSON.parse(fs.readFileSync(browserReportPath, 'utf8')).intermediateLayout?.domNodes : null;
if (browserDomNodes) runs.forEach(run => { if (run.metrics.domNodes === null) run.metrics.domNodes = browserDomNodes; });
const medianKeys = Object.keys(runs[0].metrics);
const medians = {};
for (const profile of ['mobile', 'desktop']) {
  const selected = runs.filter(run => run.profile === profile);
  medians[profile] = {
    scores: Object.fromEntries(Object.keys(selected[0].scores).map(key => [key, median(selected.map(run => run.scores[key]))])),
    metrics: Object.fromEntries(medianKeys.map(key => [key, median(selected.map(run => run.metrics[key]))])),
    resources: {}
  };
  const types = [...new Set(selected.flatMap(run => Object.keys(run.resources)))];
  for (const type of types) {
    medians[profile].resources[type] = Object.fromEntries(['requests', 'transferBytes', 'resourceBytes'].map(key => [key, median(selected.map(run => run.resources[type]?.[key] || 0))]));
  }
}

const phase5 = {
  mobile: { performance: 97, lcpMs: 2459, cls: 0.00004, tbtMs: 0, requests: 10, transferBytes: 455344, domNodes: 8589 },
  desktop: { performance: 99, lcpMs: 906, cls: 0.001729, tbtMs: 0, requests: 10, transferBytes: 455349, domNodes: 8589 }
};
const comparison = {};
for (const profile of ['mobile', 'desktop']) {
  const current = medians[profile];
  comparison[profile] = {
    performanceDelta: current.scores.performance - phase5[profile].performance,
    lcpDeltaMs: current.metrics.lcpMs - phase5[profile].lcpMs,
    clsDelta: current.metrics.cls - phase5[profile].cls,
    tbtDeltaMs: current.metrics.tbtMs - phase5[profile].tbtMs,
    requestDelta: current.metrics.requests - phase5[profile].requests,
    transferDeltaBytes: current.metrics.transferBytes - phase5[profile].transferBytes,
    domDelta: current.metrics.domNodes - phase5[profile].domNodes
  };
}

assert(runs.every(run => run.a11yFailures.length === 0), 'Lighthouse accessibility has binary failures');
assert(runs.every(run => run.scores.accessibility === 100), 'Accessibility score must be 100 in all runs');
const result = { generatedAt: new Date().toISOString(), runs, medians, phase5, comparison, inpNote: 'INP não foi certificado: Lighthouse local não substitui dados de campo.' };
fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`Lighthouse summary written: ${OUTPUT}\n`);
