'use strict';

const RESIDENT_EVIL_2_SLUG = 'resident-evil-2-remake';
const INTERNAL_CAPTURE_KEYS = new Set([
  'captureManifest',
  'expectedFile',
  'plannedAlt',
  'plannedCaption',
  'dimensions',
  'screenshotStatus'
]);

function cloneWithoutInternalCaptureMetadata(value) {
  if (Array.isArray(value)) return value.map(cloneWithoutInternalCaptureMetadata);
  if (!value || typeof value !== 'object') return value;

  const pendingCaption = !String(value.imageSrc || value.image_src || '').trim()
    && /captura\s+pr[oó]pria\s+atlas\s+pendente/i.test(String(value.imageCaption || value.image_caption || ''));
  const sanitized = {};
  Object.entries(value).forEach(([key, item]) => {
    if (INTERNAL_CAPTURE_KEYS.has(key)) return;
    if (pendingCaption && ['imageCaption', 'image_caption'].includes(key)) return;
    sanitized[key] = cloneWithoutInternalCaptureMetadata(item);
  });
  return sanitized;
}

function sanitizePublicGuideGame(game = {}) {
  if (String(game?.slug || '').trim().toLowerCase() !== RESIDENT_EVIL_2_SLUG) return game;
  const sanitized = cloneWithoutInternalCaptureMetadata(game);
  if (sanitized.platinumBaseChecklist && typeof sanitized.platinumBaseChecklist === 'object') {
    delete sanitized.platinumBaseChecklist.notes;
  }
  return sanitized;
}

module.exports = { sanitizePublicGuideGame };
