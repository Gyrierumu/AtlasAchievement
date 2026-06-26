window.AppLibrary = (() => {
  function getLibraryKey(game, normalizeKey) {
    return normalizeKey(game);
  }

  function buildLibraryStatus(progress = 0) {
    if (progress >= 100) return 'completed';
    if (progress > 0) return 'in-progress';
    return 'saved';
  }

  function normalizeCompletedIds(values = []) {
    return [...new Set((Array.isArray(values) ? values : [])
      .map(id => String(id || '').trim())
      .filter(Boolean))];
  }

  function normalizeLibraryEntry(game, library, normalizeKey, options = {}) {
    const key = getLibraryKey(game, normalizeKey);
    const existing = library?.[key] || {};
    const trophyIds = new Set((Array.isArray(game?.trophies) ? game.trophies : Array.isArray(existing.trophies) ? existing.trophies : [])
      .map(trophy => String(trophy?.id || '').trim())
      .filter(Boolean));
    const rawCompleted = Array.isArray(options.completed)
      ? options.completed
      : Array.isArray(existing.completed)
        ? existing.completed
        : [];
    const completed = normalizeCompletedIds(rawCompleted).filter(id => !trophyIds.size || trophyIds.has(id));
    const trophies = Array.isArray(game?.trophies)
      ? game.trophies
      : Array.isArray(existing.trophies)
        ? existing.trophies
        : [];
    const total = trophies.length;
    const done = completed.length;
    const progress = total ? Math.round((done / total) * 100) : 0;
    const now = new Date().toISOString();
    return {
      ...existing,
      ...game,
      slug: game?.slug || key,
      completed,
      savedAt: existing.savedAt || options.savedAt || now,
      lastOpenedAt: options.lastOpenedAt || existing.lastOpenedAt || now,
      lastActivityAt: options.lastActivityAt || existing.lastActivityAt || now,
      progress,
      status: options.status || buildLibraryStatus(progress)
    };
  }

  function findLibraryEntryByGameIdentity(library = {}, game = {}) {
    const targetId = game?.id != null ? String(game.id) : '';
    const targetName = String(game?.name || '').trim().toLowerCase();
    return Object.entries(library || {}).find(([, entry]) => {
      const sameId = targetId && String(entry?.id || '') === targetId;
      const sameName = targetName && String(entry?.name || '').trim().toLowerCase() === targetName;
      return sameId || sameName;
    }) || null;
  }

  function resolveLibraryKey(library = {}, rawKey = '', normalizeKey) {
    const directKey = String(rawKey || '').trim();
    if (!directKey) return '';
    if (library[directKey]) return directKey;

    const normalizedKey = normalizeKey({ slug: directKey, name: directKey });
    if (normalizedKey && library[normalizedKey]) return normalizedKey;

    const lowerValue = directKey.toLowerCase();
    const match = Object.entries(library || {}).find(([key, entry]) => {
      const sameKey = key.toLowerCase() === lowerValue;
      const sameSlug = String(entry?.slug || '').trim().toLowerCase() === lowerValue;
      const sameName = String(entry?.name || '').trim().toLowerCase() === lowerValue;
      return sameKey || sameSlug || sameName;
    });

    return match ? match[0] : normalizedKey;
  }

  function removeEntriesByIdentity(library = {}, { id, name } = {}) {
    const nextLibrary = { ...(library || {}) };
    let removed = false

    Object.entries(nextLibrary).forEach(([key, entry]) => {
      const sameId = id && String(entry?.id || '') === String(id);
      const sameName = name && String(entry?.name || '').toLowerCase() === String(name).toLowerCase();
      if (sameId || sameName) {
        delete nextLibrary[key];
        removed = true;
      }
    });

    return { library: nextLibrary, removed };
  }

  return {
    getLibraryKey,
    buildLibraryStatus,
    normalizeLibraryEntry,
    findLibraryEntryByGameIdentity,
    resolveLibraryKey,
    removeEntriesByIdentity
  };
})();
