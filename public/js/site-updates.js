window.AtlasSiteUpdates = (() => {
  const editorialBatchUpdate = {
    id: '2026-subnautica-verified-batch',
    active: true,
    type: 'catalog_update',
    requiredCatalogSlug: 'subnautica',
    title: 'Novos guias e verificações no AtlasAchievement',
    subtitle: 'Subnautica entrou no catálogo, e uma nova leva de guias recebeu revisão editorial para ajudar você a escolher a próxima platina com mais confiança.',
    conservativeSubtitle: 'Subnautica entrou no catálogo, e uma nova leva de guias recebeu revisão editorial para ajudar você a escolher a próxima platina com mais confiança.',
    description: 'Confira o novo jogo adicionado e os guias em português que já estão marcados como verificados na base editorial.',
    localStorageKey: 'atlas_update_popup_seen_2026_subnautica_verified_batch',
    primaryCta: {
      label: 'Ver guias verificados',
      href: '/catalogo'
    },
    secondaryCta: {
      label: 'Explorar catálogo',
      href: '/catalogo'
    },
    sections: [
      {
        title: 'Novo jogo adicionado',
        items: [
          { label: 'Subnautica', href: '/jogo/subnautica', slug: 'subnautica' }
        ]
      },
      {
        title: 'Nova leva de guias verificados',
        fallbackTitle: 'Guias revisados recentemente',
        requiresVerifiedStatus: true,
        items: [
          { label: 'Resident Evil', href: '/jogo/resident-evil', slug: 'resident-evil' },
          { label: 'Hollow Knight', href: '/jogo/hollow-knight', slug: 'hollow-knight' },
          { label: 'Dead Cells', href: '/jogo/dead-cells', slug: 'dead-cells' },
          { label: 'God of War Ragnarök', href: '/jogo/god-of-war-ragnarok', slug: 'god-of-war-ragnarok' }
        ]
      }
    ]
  };

  return {
    activeHomeUpdate: editorialBatchUpdate
  };
})();
