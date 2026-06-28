const PROTECTED_VERIFIED_GUIDES = [
  { slug: 'life-is-strange-remastered', expectedStatus: 'verified' },
  { slug: 'astros-playroom', expectedStatus: 'verified' },
  { slug: 'celeste', expectedStatus: 'verified' },
  { slug: 'assassin-s-creed-mirage', expectedStatus: 'verified' },
  { slug: 'death-stranding', expectedStatus: 'verified' },
  { slug: 'subnautica', expectedStatus: 'verified' },
  { slug: 'clair-obscur-expedition-33', expectedStatus: 'verified' },
  { slug: 'death-stranding-2-on-the-beach', expectedStatus: 'verified' },
  { slug: 'resident-evil-requiem', expectedStatus: 'verified' },
  { slug: 'resident-evil-village', expectedStatus: 'verified' },
  { slug: 'resident-evil-7-biohazard', expectedStatus: 'verified' },
  { slug: 'nioh-2', expectedStatus: 'verified' },
  { slug: 'sekiro-shadows-die-twice', expectedStatus: 'verified' },
  { slug: 'bloodborne', expectedStatus: 'verified' },
  { slug: 'days-gone', expectedStatus: 'verified' },
  { slug: 'dark-souls-iii', expectedStatus: 'verified' },
  { slug: 'armored-core-vi-fires-of-rubicon', expectedStatus: 'verified' },
  { slug: 'hades', expectedStatus: 'verified' },
  { slug: 'star-wars-jedi-survivor', expectedStatus: 'verified' },
  { slug: 'the-evil-within-2', expectedStatus: 'verified' }
];

const PROTECTED_VERIFIED_GUIDE_SLUGS = new Set(
  PROTECTED_VERIFIED_GUIDES.map(guide => guide.slug)
);

function getProtectedVerifiedGuide(slug) {
  const normalizedSlug = String(slug || '').trim().toLowerCase();
  return PROTECTED_VERIFIED_GUIDES.find(guide => guide.slug === normalizedSlug) || null;
}

module.exports = {
  PROTECTED_VERIFIED_GUIDES,
  PROTECTED_VERIFIED_GUIDE_SLUGS,
  getProtectedVerifiedGuide
};
