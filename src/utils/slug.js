function slugifyGameName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
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
  buildSlugVariant
};
