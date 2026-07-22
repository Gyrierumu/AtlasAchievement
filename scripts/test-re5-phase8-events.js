const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const contract = require(path.join(ROOT, 'public', 'js', 're5-production.js'));
const analyticsService = require(path.join(ROOT, 'src', 'services', 'analytics.service.js'));
const env = require(path.join(ROOT, 'src', 'config', 'env.js'));

async function main() {
  const eventNames = Object.keys(contract.EVENT_PROPERTIES);
  assert.strictEqual(eventNames.length, 22, 'event contract count');
  eventNames.forEach(name => assert(analyticsService.RE5_EVENT_TYPES.includes(name), `server missing ${name}`));

  assert.strictEqual(contract.queryLengthBucket(0), '0');
  assert.strictEqual(contract.queryLengthBucket(4), '1-4');
  assert.strictEqual(contract.queryLengthBucket(10), '5-10');
  assert.strictEqual(contract.queryLengthBucket(20), '11-20');
  assert.strictEqual(contract.queryLengthBucket(21), '21+');
  assert.strictEqual(contract.resultCountBucket(0), '0');
  assert.strictEqual(contract.resultCountBucket(11), '11-25');
  assert.strictEqual(contract.resultCountBucket(51), '51+');
  assert.strictEqual(contract.progressBucket(0, 51), '0%');
  assert.strictEqual(contract.progressBucket(1, 51), '1-24%');
  assert.strictEqual(contract.progressBucket(13, 51), '25-49%');
  assert.strictEqual(contract.progressBucket(51, 51), '100%');

  const searchPayload = contract.createEventPayload('guide_internal_search', {
    query_length_bucket: '5-10',
    result_count_bucket: '11-25',
    query: 'meu e-mail@example.com',
    url: 'https://example.com/?token=secret'
  });
  assert.deepStrictEqual(searchPayload.metadata, {
    query_length_bucket: '5-10',
    result_count_bucket: '11-25'
  });

  const checklistPayload = contract.createEventPayload('checklist_first_toggle', {
    progress_bucket: '1-24%',
    trophy_id: 're5_platinum',
    trophy_name: 'RESIDENT EVIL 5 Platinum Trophy',
    completed_ids: ['re5_platinum']
  });
  assert.deepStrictEqual(checklistPayload.metadata, { progress_bucket: '1-24%' });

  const vitalPayload = contract.createEventPayload('guide_web_vital', {
    metric: 'LCP',
    value_ms: 2488.4,
    rating: 'good',
    device_class: 'mobile',
    connection_bucket: '4g',
    initial_tab: 'summary',
    frontend_version: '4.0.0-build+ignored',
    ad_state: 'none',
    user_agent: 'forbidden'
  });
  assert.strictEqual(vitalPayload.metadata.value_ms, 2488);
  assert.strictEqual(vitalPayload.metadata.frontend_version, '4.0.0-buildignored');
  assert(!('user_agent' in vitalPayload.metadata));

  assert.strictEqual(contract.createEventPayload('unknown_event', {}), null);
  assert.strictEqual(contract.createEventPayload('guide_view', {}, '/jogo/outro'), null);
  assert.deepStrictEqual(contract.normalizeProperties('roadmap_step_open', { step_index: 8 }), {});
  assert.deepStrictEqual(contract.normalizeProperties('guide_filter_change', { filter: 'free', value: 'anything' }), {});

  assert.strictEqual(env.re5ProductAnalyticsEnabled, false, 'analytics must default off in the test environment');
  assert.strictEqual(env.re5CoreWebVitalsEnabled, false, 'CWV must default off');
  assert.strictEqual(env.re5AdsEnabled, false, 'ads must default off');
  assert.strictEqual(env.re5AdsTestPlaceholders, false, 'placeholders must default off');

  const disabledStore = await analyticsService.createPublicEvent(searchPayload);
  assert.deepStrictEqual(disabledStore, { stored: false }, 'server must reject RE5 events while flag is off');

  const metricRows = Array.from({ length: 200 }, (_, index) => ({
    event_type: 'guide_web_vital',
    page: '/jogo/resident-evil-5',
    game_slug: 'resident-evil-5',
    metadata_json: JSON.stringify({ metric: 'LCP', value_ms: index < 150 ? 2400 : 2600, device_class: 'mobile', ad_state: 'none' }),
    created_at: `2026-07-${String(1 + (index % 7)).padStart(2, '0')}T12:00:00.000Z`
  }));
  const aggregate = analyticsService.aggregateResidentEvil5Metrics([
    { event_type: 'guide_view', page: '/jogo/resident-evil-5', game_slug: 'resident-evil-5', metadata_json: '{"visit_type":"first"}', created_at: '2026-07-01T12:00:00.000Z' },
    { event_type: 'guide_internal_search', page: '/jogo/resident-evil-5', game_slug: 'resident-evil-5', metadata_json: '{"query_length_bucket":"5-10"}', created_at: '2026-07-01T12:01:00.000Z' },
    ...metricRows
  ]);
  assert.strictEqual(aggregate.funnel.guideViews, 1);
  assert.strictEqual(aggregate.searches, 1);
  assert.strictEqual(aggregate.fieldVitals.segments[0].status, 'ready');
  assert.strictEqual(aggregate.fieldVitals.segments[0].p75, 2400);
  assert.strictEqual(aggregate.fieldVitals.status, 'dados insuficientes', 'all five metric families are required');
  assert(!JSON.stringify(aggregate).includes('query_length_bucket'), 'aggregate must not expose event-level search metadata');

  const frontendSource = fs.readFileSync(path.join(ROOT, 'public', 'js', 're5-production.js'), 'utf8');
  assert(!/adsbygoogle|ca-pub-|googlesyndication|gtag\s*\(/i.test(frontendSource), 'real ad/GA tag found in RE5 production module');
  assert(frontendSource.includes("credentials: 'omit'"), 'analytics transport must omit credentials');

  const serialized = JSON.stringify([searchPayload, checklistPayload, vitalPayload]);
  ['e-mail@example.com', 'token=secret', 're5_platinum', 'Platinum Trophy', 'forbidden'].forEach(value => {
    assert(!serialized.includes(value), `forbidden value leaked: ${value}`);
  });

  process.stdout.write(`Phase 8 event contract passed (${eventNames.length} events, flags off, no PII payloads).\n`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
