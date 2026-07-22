const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'artifacts', 're5-phase7', 'link-audit.json');
const ORIGIN = process.env.RE5_QA_ORIGIN || 'http://127.0.0.1:4319';
const PAGE_URL = `${ORIGIN}/jogo/resident-evil-5`;
const API_URL = `${ORIGIN}/api/games/slug/resident-evil-5`;
const USER_AGENT = 'Mozilla/5.0 (compatible; AtlasAchievementPhase7Audit/1.0; +https://atlasachievement.com.br/)';

function cleanTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 240) : '';
}

async function requestWithRedirects(url, maxRedirects = 6) {
  const redirects = [];
  let current = url;
  let response;
  let body = '';
  let error = null;
  try {
    for (let index = 0; index <= maxRedirects; index += 1) {
      response = await fetch(current, { redirect: 'manual', headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/pdf;q=0.9,*/*;q=0.8' }, signal: AbortSignal.timeout(18000) });
      if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
        const next = new URL(response.headers.get('location'), current).href;
        redirects.push({ status: response.status, from: current, to: next });
        current = next;
        continue;
      }
      body = await response.text();
      break;
    }
  } catch (caught) {
    error = caught.message;
  }
  return {
    requestedUrl: url,
    finalUrl: current,
    redirects,
    status: response?.status || 0,
    ok: Boolean(response?.ok),
    contentType: response?.headers.get('content-type') || '',
    title: cleanTitle(body),
    bytesRead: Buffer.byteLength(body),
    error
  };
}

function walkYoutube(value, context = [], output = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkYoutube(item, [...context, String(index)], output));
    return output;
  }
  if (value && typeof value === 'object') {
    const label = value.label || value.title || value.name || value.id || '';
    for (const [key, nested] of Object.entries(value)) walkYoutube(nested, label ? [...context, String(label), key] : [...context, key], output);
    return output;
  }
  if (typeof value === 'string' && /(?:youtube\.com\/watch|youtu\.be\/)/i.test(value)) output.push({ url: value, context: context.join(' > ') });
  return output;
}

function youtubeData(url) {
  const parsed = new URL(url);
  const id = parsed.hostname.includes('youtu.be') ? parsed.pathname.slice(1) : parsed.searchParams.get('v');
  const rawTime = parsed.searchParams.get('t') || '';
  const seconds = /^\d+$/.test(rawTime) ? Number(rawTime) : null;
  return { id, seconds };
}

async function main() {
  const [api, html] = await Promise.all([
    fetch(API_URL).then(response => response.json()),
    fetch(PAGE_URL).then(response => response.text())
  ]);

  const sourceResults = [];
  for (const source of api.editorialAuthority?.sources || []) {
    sourceResults.push({ ...source, ...(await requestWithRedirects(source.url)) });
  }

  const videoAuditById = new Map((api.videoAudit || []).map(item => [item.youtubeId, item]));
  const youtubeOccurrences = walkYoutube(api);
  const videosById = new Map();
  for (const occurrence of youtubeOccurrences) {
    const parsed = youtubeData(occurrence.url);
    if (!parsed.id) continue;
    if (!videosById.has(parsed.id)) videosById.set(parsed.id, { id: parsed.id, occurrences: [] });
    videosById.get(parsed.id).occurrences.push({ ...occurrence, timestampSeconds: parsed.seconds });
  }

  const videos = [];
  for (const video of videosById.values()) {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${video.id}`)}&format=json`;
    let oembed = null;
    let status = 0;
    let error = null;
    try {
      const response = await fetch(oembedUrl, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(18000) });
      status = response.status;
      if (response.ok) oembed = await response.json();
    } catch (caught) { error = caught.message; }
    const declared = videoAuditById.get(video.id) || null;
    const duration = Number(declared?.durationSeconds || 0);
    videos.push({
      ...video,
      declared,
      oembedStatus: status,
      available: status === 200 && Boolean(oembed?.title),
      currentTitle: oembed?.title || '',
      authorName: oembed?.author_name || '',
      timestampChecks: video.occurrences.filter(item => item.timestampSeconds !== null).map(item => ({
        url: item.url,
        context: item.context,
        timestampSeconds: item.timestampSeconds,
        withinDeclaredDuration: duration > 0 && item.timestampSeconds <= duration
      })),
      error
    });
  }

  const fragmentLinks = [...html.matchAll(/<a\b[^>]*\bhref=["']#([^"']+)["'][^>]*>/gi)].map(match => match[1]);
  const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/gi)].map(match => match[1]));
  const uniqueFragments = [...new Set(fragmentLinks)];
  const internalFragments = {
    occurrences: fragmentLinks.length,
    unique: uniqueFragments.length,
    valid: uniqueFragments.filter(fragment => ids.has(fragment)),
    broken: uniqueFragments.filter(fragment => !ids.has(fragment))
  };

  const result = {
    generatedAt: new Date().toISOString(),
    pageUrl: PAGE_URL,
    sources: sourceResults,
    videos,
    videoSummary: {
      uniqueIds: videos.length,
      urlOccurrences: youtubeOccurrences.length,
      available: videos.filter(video => video.available).length,
      invalidTimestamps: videos.flatMap(video => video.timestampChecks).filter(item => !item.withinDeclaredDuration).length
    },
    internalFragments
  };
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
  if (internalFragments.broken.length) throw new Error(`Broken internal fragments: ${internalFragments.broken.join(', ')}`);
  if (result.videoSummary.available !== result.videoSummary.uniqueIds) throw new Error('One or more YouTube videos are unavailable through oEmbed');
  if (result.videoSummary.invalidTimestamps) throw new Error('One or more timestamps exceed the declared video duration');
  process.stdout.write(`Phase 7 link audit passed: ${OUTPUT}\n`);
}

main().catch(error => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; });
