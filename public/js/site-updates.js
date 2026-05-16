window.AtlasSiteUpdates = (() => {
  const sarosPragmataUpdate = {
    id: '2026-saros-pragmata-verified-guides',
    active: true,
    type: 'catalog_update',
    title: 'Novidades no AtlasAchievement',
    subtitle: 'Saros e Pragmata chegaram ao catálogo, e uma nova leva de guias foi verificada.',
    conservativeSubtitle: 'Saros e Pragmata chegaram ao catálogo, e uma nova leva de guias foi revisada.',
    description: 'Confira os guias em português com roadmap, checklist e informações editoriais revisadas para planejar sua próxima platina.',
    localStorageKey: 'atlas_update_popup_seen_2026_saros_pragmata_verified_guides',
    primaryCta: {
      label: 'Ver novidades',
      href: '/catalogo'
    },
    secondaryCta: {
      label: 'Explorar catálogo',
      href: '/catalogo'
    },
    sections: [
      {
        title: 'Novos jogos adicionados',
        items: [
          { label: 'Saros', href: '/jogo/saros', slug: 'saros' },
          { label: 'Pragmata', href: '/jogo/pragmata', slug: 'pragmata' }
        ]
      },
      {
        title: 'Guias verificados',
        fallbackTitle: 'Guias revisados recentemente',
        requiresVerifiedStatus: true,
        items: [
          { label: 'Elden Ring', href: '/jogo/elden-ring', slug: 'elden-ring' },
          { label: 'Hades', href: '/jogo/hades', slug: 'hades' },
          { label: 'Hades II', href: '/jogo/hades-ii', slug: 'hades-ii' },
          { label: 'Ghost of Tsushima', href: '/jogo/ghost-of-tsushima', slug: 'ghost-of-tsushima' },
          { label: 'Astro Bot', href: '/jogo/astro-bot', slug: 'astro-bot' },
          { label: 'Astro’s Playroom', href: '/jogo/astros-playroom', slug: 'astros-playroom' },
          { label: 'Resident Evil 4 Remake', href: '/jogo/resident-evil-4-remake', slug: 'resident-evil-4-remake' },
          { label: 'Nioh 2', href: '/jogo/nioh-2', slug: 'nioh-2' },
          { label: 'Nioh 3', href: '/jogo/nioh-3', slug: 'nioh-3' }
        ]
      }
    ]
  };

  return {
    activeHomeUpdate: sarosPragmataUpdate
  };
})();
