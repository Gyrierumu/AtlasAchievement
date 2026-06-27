function slugifyGameName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

const CANONICAL_GAME_SLUG_ALIASES = Object.freeze({
  'astro-s-playroom': 'astros-playroom',
  'astro-playroom': 'astros-playroom',
  'astros-playrrom': 'astros-playroom',
  'astro-s-playrrom': 'astros-playroom',
  'god-of-war-2018': 'god-of-war',
  'assassins-creed-mirage': 'assassin-s-creed-mirage',
  'assassins-creed-odyssey': 'assassin-s-creed-odyssey',
  'assassins-creed-origins': 'assassin-s-creed-origins',
  'assassins-creed-shadows': 'assassin-s-creed-shadows',
  'assassins-creed-valhalla': 'assassin-s-creed-valhalla'
});

function getCanonicalGameSlug(value) {
  const slug = slugifyGameName(value);
  return CANONICAL_GAME_SLUG_ALIASES[slug] || slug;
}

function buildSlugVariant(baseSlug, sequence = 0) {
  const fallbackBase = baseSlug || 'jogo';
  if (sequence <= 0) {
    return fallbackBase;
  }

  const suffix = `-${sequence + 1}`;
  const trimmedBase = fallbackBase.slice(0, Math.max(1, 96 - suffix.length));
  return `${trimmedBase}${suffix}`;
}

module.exports = {
  slugifyGameName,
  getCanonicalGameSlug,
  CANONICAL_GAME_SLUG_ALIASES,
  buildSlugVariant
};
