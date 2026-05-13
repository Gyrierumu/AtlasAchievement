(function attachCatalogModel(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./editorialModel'));
    return;
  }
  if (root) root.AtlasCatalogModel = factory(root.AtlasEditorialModel);
})(typeof globalThis !== 'undefined' ? globalThis : this, function catalogModelFactory(editorial = {}) {
  const FALLBACK_TIME_VALUE = editorial.FALLBACK_TIME_VALUE || Number.MAX_SAFE_INTEGER;
  const getTimeValue = editorial.getTimeValue || (() => FALLBACK_TIME_VALUE);
  const parseTimeValue = editorial.parseTimeValue || (() => null);
  const hasMissableRiskText = editorial.hasMissableRiskText || (() => false);
  const getEditorialTrustStatus = editorial.getEditorialTrustStatus || (() => 'in_review');
  const getEditorialTrustBadge = editorial.getEditorialTrustBadge || (() => ({ status: 'in_review', label: 'Em revisão', tone: 'review', badge: 'review' }));

  const catalogFacetMeta = {
    all: {
      id: 'all',
      serviceFacet: 'all',
      slug: 'all',
      path: '/catalogo',
      title: 'Catálogo de jogos | AtlasAchievement',
      description: 'Navegue pelo catálogo de jogos com dificuldade, tempo estimado, troféus e atalhos por faixa de desafio e duração.',
      name: 'Catálogo de jogos',
      heroTitle: 'Navegue sem depender da busca',
      heroDescription: 'Veja todos os jogos em uma lista filtrável com dificuldade, tempo estimado, troféus e acesso direto à página de guia.',
      collectionTitle: 'Catálogo completo',
      collectionDescription: 'Use a visão geral para comparar jogos por dificuldade, tempo e densidade de checklist antes de decidir onde investir seu tempo.',
      reason: 'Boa para quem ainda não sabe o que jogar e quer sentir o tamanho real do catálogo.',
      checklist: 'Ordene por recomendação, abra um destaque e valide roadmap, perdíveis e esforço total.',
      introTitle: 'Pontos de entrada para escolher melhor',
      introBody: 'Este catálogo foi pensado para reduzir a dúvida antes de abrir um guia. Em vez de depender só da busca, você compara esforço, duração, densidade da lista e risco de retrabalho antes de escolher qual página de jogo vale abrir.',
      chipLabel: 'Todos',
      chipDescription: 'Ver o catálogo completo.',
      related: ['difficulty-low', 'time-short', 'trophies-large']
    },
    'difficulty-low': {
      id: 'difficulty-low',
      serviceFacet: 'difficulty-low',
      slug: 'dificuldade-baixa',
      path: '/catalogo/dificuldade-baixa',
      title: 'Jogos de dificuldade baixa | AtlasAchievement',
      description: 'Veja jogos com dificuldade de 1 a 3 para começar listas de troféus e concluir mais rápido.',
      name: 'Jogos de dificuldade baixa',
      heroTitle: 'Coleção para começar com menos atrito',
      heroDescription: 'Abra jogos de dificuldade baixa quando quiser uma platina mais viável, com menos risco de travar logo no começo.',
      collectionTitle: 'Jogos de dificuldade baixa',
      collectionDescription: 'Esta faixa funciona bem para primeiras platinas, descansos entre projetos maiores e sessões em que você quer avançar sem pressão excessiva.',
      reason: 'Filtra jogos que tendem a exigir menos execução avançada e deixam a leitura do guia mais direta.',
      checklist: 'Confira se o jogo também é curto e se já possui roadmap suficiente para virar uma entrada segura.',
      introTitle: 'Quando esta coleção faz sentido',
      introBody: 'Jogos de dificuldade baixa costumam funcionar melhor como porta de entrada para primeiras platinas ou como respiro entre projetos mais pesados. Esta faixa ajuda a separar jogos com execução mais acessível, tempo controlável e menor risco logo na primeira run.',
      chipLabel: 'Fácil',
      chipDescription: 'Jogos mais acessíveis para começar.',
      related: ['time-short', 'difficulty-mid', 'trophies-small']
    },
    'difficulty-mid': {
      id: 'difficulty-mid',
      serviceFacet: 'difficulty-mid',
      slug: 'dificuldade-media',
      path: '/catalogo/dificuldade-media',
      title: 'Jogos de dificuldade média | AtlasAchievement',
      description: 'Explore jogos com dificuldade de 4 a 6 e escolha projetos intermediários para continuar.',
      name: 'Jogos de dificuldade média',
      heroTitle: 'Projetos intermediários para continuar em bom ritmo',
      heroDescription: 'Use esta coleção quando quiser algo mais substancial do que uma platina fácil, mas sem cair direto em maratonas brutais.',
      collectionTitle: 'Jogos de dificuldade média',
      collectionDescription: 'Boa faixa para quem já está confortável com checklists, mas ainda quer equilíbrio entre progresso consistente e desafio moderado.',
      reason: 'Ajuda a separar jogos que já pedem mais atenção sem virar projetos excessivamente punitivos.',
      checklist: 'Abra a página e valide se o tempo total e o roadmap combinam com a sua disponibilidade atual.',
      introTitle: 'O que caracteriza uma dificuldade média',
      introBody: 'Aqui entram projetos que já pedem mais atenção, mas ainda mantêm um custo de entrada administrável. Isso ajuda a responder buscas de intenção intermediária e melhora a leitura editorial da coleção.',
      chipLabel: 'Média dificuldade',
      chipDescription: 'Desafio intermediário.',
      related: ['difficulty-low', 'time-medium', 'trophies-medium']
    },
    'difficulty-high': {
      id: 'difficulty-high',
      serviceFacet: 'difficulty-high',
      slug: 'dificuldade-alta',
      path: '/catalogo/dificuldade-alta',
      title: 'Jogos de dificuldade alta | AtlasAchievement',
      description: 'Encontre jogos com dificuldade de 7 a 10 para quem busca listas mais exigentes.',
      name: 'Jogos de dificuldade alta',
      heroTitle: 'Listas exigentes para quem quer desafio real',
      heroDescription: 'Entre nesta faixa quando quiser projetos mais duros, que pedem leitura cuidadosa e mais comprometimento de execução.',
      collectionTitle: 'Jogos de dificuldade alta',
      collectionDescription: 'Ideal para usuários que já sabem onde estão entrando e querem separar jogos realmente exigentes do restante do catálogo.',
      reason: 'Concentra projetos que costumam exigir mais habilidade, persistência e leitura disciplinada do guia.',
      checklist: 'Antes de começar, confirme tempo total, troféus sensíveis e se há roadmap suficiente para não desperdiçar horas.',
      introTitle: 'Antes de abrir uma lista exigente',
      introBody: 'Coleções de dificuldade alta precisam explicar risco, compromisso e densidade do guia. Isso melhora a utilidade para o leitor e dá mais contexto semântico para buscas ligadas a desafios e platinas difíceis.',
      chipLabel: 'Difícil',
      chipDescription: 'Jogos mais exigentes.',
      related: ['time-long', 'trophies-large', 'difficulty-mid']
    },
    'time-short': {
      id: 'time-short',
      serviceFacet: 'time-short',
      slug: 'ate-15-horas',
      path: '/catalogo/ate-15-horas',
      title: 'Jogos até 15 horas | AtlasAchievement',
      description: 'Veja jogos com tempo estimado mais curto para concluir troféus em até 15 horas.',
      name: 'Jogos até 15 horas',
      heroTitle: 'Coleção de entrada rápida',
      heroDescription: 'Veja projetos mais curtos para fechar uma platina sem transformar o jogo em compromisso de várias semanas.',
      collectionTitle: 'Jogos até 15 horas',
      collectionDescription: 'Ótima faixa para fins de semana, descanso entre listas grandes e usuários que querem retorno rápido por hora investida.',
      reason: 'Reduz o risco de escolher algo que parece simples, mas vira uma maratona maior do que o esperado.',
      checklist: 'Cheque a dificuldade real e se existe algum perdível escondido antes de assumir que o jogo é só rápido.',
      introTitle: 'Para quem quer retorno rápido',
      introBody: 'Páginas focadas em jogos curtos respondem bem a buscas de alta intenção, especialmente quando a lista já nasce com texto explicativo e cards em HTML no servidor.',
      chipLabel: 'Curto',
      chipDescription: 'Campanhas e listas mais curtas.',
      related: ['difficulty-low', 'time-medium', 'trophies-small']
    },
    'time-medium': {
      id: 'time-medium',
      serviceFacet: 'time-medium',
      slug: '16-a-40-horas',
      path: '/catalogo/16-a-40-horas',
      title: 'Jogos de 16 a 40 horas | AtlasAchievement',
      description: 'Encontre jogos com tempo estimado de 16 a 40 horas para projetos de médio prazo.',
      name: 'Jogos de 16 a 40 horas',
      heroTitle: 'Projetos médios para manter tração',
      heroDescription: 'Abra esta faixa quando quiser algo mais completo, mas ainda compatível com uma rotina normal de sessões.',
      collectionTitle: 'Jogos de 16 a 40 horas',
      collectionDescription: 'Aqui ficam projetos equilibrados para quem quer uma trilha mais longa, sem cair nos extremos do catálogo.',
      reason: 'Ajuda a encontrar jogos que rendem progresso contínuo e ainda cabem melhor no calendário.',
      checklist: 'Compare dificuldade, roadmap e tamanho da lista para decidir qual deles encaixa melhor no seu momento.',
      introTitle: 'Faixa intermediária de tempo',
      introBody: 'Coleções de médio prazo ajudam a capturar usuários que querem profundidade sem assumir uma maratona longa. Esse texto reforça intenção de busca e melhora contexto da página.',
      chipLabel: 'Médio',
      chipDescription: 'Projetos médios para continuar.',
      related: ['difficulty-mid', 'time-short', 'time-long']
    },
    'time-long': {
      id: 'time-long',
      serviceFacet: 'time-long',
      slug: 'mais-de-40-horas',
      path: '/catalogo/mais-de-40-horas',
      title: 'Jogos com mais de 40 horas | AtlasAchievement',
      description: 'Navegue por jogos longos e maratonas com listas de troféus acima de 40 horas.',
      name: 'Jogos com mais de 40 horas',
      heroTitle: 'Maratonas para abrir com plena consciência',
      heroDescription: 'Veja projetos longos quando estiver procurando uma trilha mais extensa e quiser validar melhor o custo total de tempo.',
      collectionTitle: 'Jogos com mais de 40 horas',
      collectionDescription: 'Esta coleção serve para separar maratonas que pedem planejamento real, disciplina de checklist e expectativa ajustada desde o começo.',
      reason: 'Evita entrar em jogos longos sem antes comparar esforço, densidade da lista e necessidade de revisão contínua.',
      checklist: 'Abra a página e confirme quantas etapas existem no roadmap e quais troféus podem gerar retrabalho tardio.',
      introTitle: 'Quando vale abrir uma maratona',
      introBody: 'Projetos longos precisam de explicação editorial ainda mais forte, porque a intenção do usuário costuma ser comparar custo de tempo, não só clicar no primeiro resultado.',
      chipLabel: 'Longo',
      chipDescription: 'Jogos longos e maratonas.',
      related: ['difficulty-high', 'time-medium', 'trophies-large']
    },
    'trophies-small': {
      id: 'trophies-small',
      serviceFacet: 'trophies-small',
      slug: 'ate-30-trofeus',
      path: '/catalogo/ate-30-trofeus',
      title: 'Jogos com até 30 troféus | AtlasAchievement',
      description: 'Abra listas menores, com até 30 troféus, para organizar checklists mais curtos.',
      name: 'Jogos com até 30 troféus',
      heroTitle: 'Checklists menores para seguir com leveza',
      heroDescription: 'Explore listas curtas quando quiser menos itens para controlar e uma leitura mais rápida da página do jogo.',
      collectionTitle: 'Jogos com até 30 troféus',
      collectionDescription: 'Boa faixa para quem gosta de checklists enxutos e quer sentir progresso sem navegar por listas muito extensas.',
      reason: 'Ajuda a filtrar jogos com menos volume estrutural de troféus, úteis para sessões mais leves.',
      checklist: 'Mesmo com lista pequena, confirme se há roadmap e troféus sensíveis antes de começar despreocupado.',
      introTitle: 'Menos itens para acompanhar',
      introBody: 'Listas menores costumam ter apelo forte para jogadores que querem gestão simples de progresso. A coleção ganha força quando essa promessa fica clara já no HTML.',
      chipLabel: 'Poucos troféus',
      chipDescription: 'Listas menores.',
      related: ['time-short', 'difficulty-low', 'trophies-medium']
    },
    'trophies-medium': {
      id: 'trophies-medium',
      serviceFacet: 'trophies-medium',
      slug: '31-a-60-trofeus',
      path: '/catalogo/31-a-60-trofeus',
      title: 'Jogos com 31 a 60 troféus | AtlasAchievement',
      description: 'Explore jogos com listas intermediárias de 31 a 60 troféus.',
      name: 'Jogos com 31 a 60 troféus',
      heroTitle: 'Volume intermediário de checklist',
      heroDescription: 'Use esta coleção quando quiser listas mais completas, mas ainda legíveis em um fluxo normal de acompanhamento.',
      collectionTitle: 'Jogos com 31 a 60 troféus',
      collectionDescription: 'Aqui ficam jogos com densidade intermediária de troféus, bons para usuários que gostam de progresso granular sem excesso.',
      reason: 'Separa projetos com mais profundidade de checklist, mas ainda sem o peso de listas muito grandes.',
      checklist: 'Compare o número de etapas do roadmap e o tempo estimado para evitar escolher só pelo tamanho da lista.',
      introTitle: 'Equilíbrio entre densidade e leitura',
      introBody: 'Listas de volume intermediário ficam entre checklists leves e maratonas densas. Use esta faixa quando quiser muitos objetivos para acompanhar, mas sem abrir uma página com dezenas de etapas difíceis de revisar.',
      chipLabel: 'Troféus médios',
      chipDescription: 'Tamanho intermediário de checklist.',
      related: ['difficulty-mid', 'time-medium', 'trophies-large']
    },
    'trophies-large': {
      id: 'trophies-large',
      serviceFacet: 'trophies-large',
      slug: 'mais-de-60-trofeus',
      path: '/catalogo/mais-de-60-trofeus',
      title: 'Jogos com mais de 60 troféus | AtlasAchievement',
      description: 'Veja jogos com listas longas, acima de 60 troféus, para acompanhar por etapas.',
      name: 'Jogos com mais de 60 troféus',
      heroTitle: 'Listas densas para quem gosta de profundidade',
      heroDescription: 'Abra esta faixa quando quiser jogos com muitos troféus e sensação forte de progresso ao longo de várias sessões.',
      collectionTitle: 'Jogos com mais de 60 troféus',
      collectionDescription: 'Essa coleção funciona como vitrine das listas mais densas do catálogo, boas para quem valoriza acompanhamento detalhado.',
      reason: 'Ajuda a encontrar jogos em que o checklist é parte central da experiência, não só um complemento.',
      checklist: 'Antes de entrar, valide tempo total, risco de retrabalho e se o roadmap já está forte o suficiente para sustentar a maratona.',
      introTitle: 'Quando a densidade da lista importa',
      introBody: 'Listas muito grandes pedem mais planejamento antes do clique. Esta faixa é útil quando você quer comparar tempo, quantidade de troféus, risco de perdível e força do roadmap antes de assumir uma maratona.',
      chipLabel: 'Muitos troféus',
      chipDescription: 'Listas longas para acompanhar.',
      related: ['time-long', 'difficulty-high', 'trophies-medium']
    },
    'online-none': {
      id: 'online-none',
      serviceFacet: 'online-none',
      slug: 'sem-online',
      path: '/catalogo',
      title: 'Catálogo de jogos sem online obrigatório | AtlasAchievement',
      description: 'Filtre jogos que não exigem online obrigatório para a platina.',
      name: 'Sem online',
      heroTitle: 'Jogos sem online obrigatório',
      heroDescription: 'Use este filtro para evitar dependência de servidor, fila, PS+ ou requisitos online antes de escolher a próxima platina.',
      collectionTitle: 'Jogos sem online obrigatório',
      collectionDescription: 'Esta visão prioriza jogos que parecem poder ser concluídos sem requisito online obrigatório, usando os campos editoriais atuais.',
      reason: 'Boa para quem quer evitar risco de servidor, coop online ou janela ruim de multiplayer.',
      checklist: 'Mesmo sem online obrigatório, abra o guia para confirmar coop local, DLC e perdíveis antes de começar.',
      introTitle: 'Evitar online na platina',
      introBody: 'O filtro usa os resumos editoriais e marcações disponíveis para separar jogos sem exigência online obrigatória. Se um guia não tiver dados claros, ele deve ser revisado antes de entrar aqui.',
      chipLabel: 'Sem online',
      chipDescription: 'Evitar requisitos online obrigatórios.',
      related: ['time-short', 'difficulty-low', 'missable-none']
    },
    'online-required': {
      id: 'online-required',
      serviceFacet: 'online-required',
      slug: 'com-online',
      path: '/catalogo',
      title: 'Catálogo de jogos com online | AtlasAchievement',
      description: 'Filtre jogos com sinais de online ou multiplayer obrigatório na platina.',
      name: 'Com online',
      heroTitle: 'Jogos com requisito online',
      heroDescription: 'Use este filtro quando quiser ver quais guias pedem atenção com online, multiplayer, servidor, SOS ou Guild Cards.',
      collectionTitle: 'Jogos com online',
      collectionDescription: 'Esta lista destaca jogos em que o planejamento precisa considerar requisito online ou multiplayer.',
      reason: 'Ajuda a decidir cedo se vale começar agora ou deixar para quando houver servidor, dupla ou sessão disponível.',
      checklist: 'Leia o resumo online do guia antes de começar para entender se o requisito é obrigatório, opcional ou só coop local.',
      introTitle: 'Quando o online muda a decisão',
      introBody: 'Requisitos online podem travar uma platina mesmo quando tempo e dificuldade parecem bons. O filtro destaca esses sinais para reduzir surpresa.',
      chipLabel: 'Com online',
      chipDescription: 'Tem requisito online/multiplayer.',
      related: ['coop-required', 'time-long', 'difficulty-high']
    },
    'coop-required': {
      id: 'coop-required',
      serviceFacet: 'coop-required',
      slug: 'coop-obrigatorio',
      path: '/catalogo',
      title: 'Catálogo de jogos com coop obrigatório | AtlasAchievement',
      description: 'Filtre jogos que exigem outro jogador em coop local ou online.',
      name: 'Coop obrigatório',
      heroTitle: 'Jogos que pedem dupla',
      heroDescription: 'Use este filtro para encontrar platinas que não podem ser feitas solo e exigem planejamento com outro jogador.',
      collectionTitle: 'Coop obrigatório',
      collectionDescription: 'Jogos aqui dependem de coop, dupla ou segundo jogador segundo os campos editoriais disponíveis.',
      reason: 'Ajuda a evitar começar um jogo que parece tranquilo, mas exige coordenação com outra pessoa do início ao fim.',
      checklist: 'Confirme se o coop pode ser local, online ou ambos, e se todos os jogadores recebem troféus.',
      introTitle: 'Planejar platinas em coop',
      introBody: 'Coop obrigatório muda completamente a logística da platina. Este filtro separa esses jogos antes do clique no guia.',
      chipLabel: 'Coop',
      chipDescription: 'Exige outro jogador.',
      related: ['online-required', 'time-medium', 'missable-none']
    },
    'missable-present': {
      id: 'missable-present',
      serviceFacet: 'missable-present',
      slug: 'com-perdiveis',
      path: '/catalogo',
      title: 'Catálogo de jogos com perdíveis | AtlasAchievement',
      description: 'Filtre jogos que têm troféus perdíveis ou alertas de atenção cedo.',
      name: 'Com perdíveis',
      heroTitle: 'Jogos que pedem leitura antes da primeira run',
      heroDescription: 'Use este filtro para enxergar jogos com risco de perda, rota sensível ou alerta editorial antes do cleanup.',
      collectionTitle: 'Jogos com perdíveis',
      collectionDescription: 'Esta faixa reúne guias com troféus marcados como perdíveis ou resumos editoriais que indicam risco de retrabalho.',
      reason: 'Boa para quem quer saber quais jogos exigem roadmap antes de jogar livremente.',
      checklist: 'Abra o guia e leia o roadmap antes de avançar na história.',
      introTitle: 'Perdíveis mudam a ordem da platina',
      introBody: 'Quando há perdíveis, o catálogo precisa mostrar isso antes do clique. Este filtro evita escolher uma lista sensível achando que dá para limpar tudo depois.',
      chipLabel: 'Perdíveis',
      chipDescription: 'Tem risco de perder troféus.',
      related: ['missable-none', 'time-long', 'difficulty-high']
    },
    'missable-none': {
      id: 'missable-none',
      serviceFacet: 'missable-none',
      slug: 'sem-perdiveis',
      path: '/catalogo',
      title: 'Catálogo de jogos sem perdíveis fortes | AtlasAchievement',
      description: 'Filtre jogos sem troféus perdíveis marcados nos dados atuais.',
      name: 'Sem perdíveis',
      heroTitle: 'Jogos para uma run mais tranquila',
      heroDescription: 'Use este filtro quando quiser reduzir risco de bloquear troféus por ordem errada.',
      collectionTitle: 'Jogos sem perdíveis fortes',
      collectionDescription: 'Esta visão mostra jogos sem perdíveis marcados nos dados atuais e sem alerta textual forte de perda permanente.',
      reason: 'Boa para jogar com menos ansiedade e deixar parte do cleanup para depois.',
      checklist: 'Ainda vale confirmar coletáveis, Chapter Select e troféus de dificuldade no guia.',
      introTitle: 'Baixo risco não é zero atenção',
      introBody: 'Sem perdíveis fortes significa que os dados atuais não indicam bloqueio permanente claro. Cleanup e troféus técnicos ainda podem exigir planejamento.',
      chipLabel: 'Sem perdíveis',
      chipDescription: 'Baixo risco de perda permanente.',
      related: ['online-none', 'difficulty-low', 'time-short']
    },
    'grind-present': {
      id: 'grind-present',
      serviceFacet: 'grind-present',
      slug: 'com-grind',
      path: '/catalogo',
      title: 'Catálogo de jogos com grind | AtlasAchievement',
      description: 'Filtre jogos com sinais de farm, grind, RNG ou endgame longo.',
      name: 'Com grind',
      heroTitle: 'Jogos com farm ou repetição relevante',
      heroDescription: 'Use este filtro para separar platinas que podem exigir grind, RNG, rank, farm ou endgame repetido.',
      collectionTitle: 'Jogos com grind',
      collectionDescription: 'Esta lista usa resumos editoriais e campos de grind para destacar jogos que podem ficar longos no fim.',
      reason: 'Ajuda a não confundir tempo estimado com ritmo real de execução.',
      checklist: 'Confira se o grind envolve RNG, online, dificuldade alta ou apenas repetição controlável.',
      introTitle: 'Quando o grind pesa',
      introBody: 'Grind pode ser o fator que transforma uma platina boa em cansativa. O catálogo precisa sinalizar isso antes do guia.',
      chipLabel: 'Grind',
      chipDescription: 'Farm/RNG/endgame relevante.',
      related: ['time-long', 'difficulty-high', 'trophies-large']
    },
    'dlc-base': {
      id: 'dlc-base',
      serviceFacet: 'dlc-base',
      slug: 'base-game',
      path: '/catalogo',
      title: 'Catálogo de jogos sem DLC necessária | AtlasAchievement',
      description: 'Filtre guias focados em lista base ou sem DLC obrigatória.',
      name: 'Sem DLC necessária',
      heroTitle: 'Guias de lista base',
      heroDescription: 'Use este filtro para priorizar jogos em que o guia declara lista base, sem DLC obrigatória ou expansão separada.',
      collectionTitle: 'Sem DLC necessária',
      collectionDescription: 'Esta visão depende do campo editorial de escopo de DLC e só usa jogos com sinal claro de lista base ou sem DLC obrigatória.',
      reason: 'Boa para evitar comprar expansão ou misturar listas antes de escolher a próxima platina.',
      checklist: 'Confirme no guia se DLCs, updates ou versões diferentes ficaram fora do escopo.',
      introTitle: 'Separar base game de DLC',
      introBody: 'Para confiar no catálogo, o jogador precisa saber quando a platina usa apenas a lista base. Este filtro mostra os guias com esse escopo declarado.',
      chipLabel: 'Base game',
      chipDescription: 'Sem DLC obrigatória declarada.',
      related: ['online-none', 'time-short', 'missable-none']
    },
    'chapter-select': {
      id: 'chapter-select',
      serviceFacet: 'chapter-select',
      slug: 'chapter-select',
      path: '/catalogo',
      title: 'Catálogo de jogos com Chapter Select | AtlasAchievement',
      description: 'Filtre jogos cujo guia menciona Chapter Select ou seleção de capítulos.',
      name: 'Chapter Select',
      heroTitle: 'Jogos com recuperação por capítulo',
      heroDescription: 'Use este filtro quando quiser jogos em que o guia menciona Chapter Select, seleção de capítulos ou cleanup por capítulo.',
      collectionTitle: 'Com Chapter Select',
      collectionDescription: 'O filtro depende dos textos editoriais disponíveis e mostra jogos com menção clara a seleção de capítulos.',
      reason: 'Ajuda a diferenciar perdível permanente de cleanup recuperável.',
      checklist: 'Confirme no guia quais troféus realmente voltam por capítulo e quais exigem atenção antes.',
      introTitle: 'Chapter Select reduz retrabalho',
      introBody: 'Quando o jogo permite voltar capítulos, o risco da platina muda. Este filtro só aparece por sinais textuais já cadastrados.',
      chipLabel: 'Chapter Select',
      chipDescription: 'Cleanup recuperável por capítulo.',
      related: ['missable-none', 'time-short', 'difficulty-low']
    },
    'editorial-verified': {
      id: 'editorial-verified',
      serviceFacet: 'editorial-verified',
      slug: 'verificados',
      path: '/catalogo',
      title: 'Catálogo de guias verificados | AtlasAchievement',
      description: 'Filtre guias marcados como verificados manualmente.',
      name: 'Guias verificados',
      heroTitle: 'Guias com verificação manual',
      heroDescription: 'Use este filtro para priorizar guias cujo status indica verificação manual.',
      collectionTitle: 'Guias verificados',
      collectionDescription: 'O filtro usa os campos de status editorial já existentes.',
      reason: 'Ajuda quando confiança editorial pesa mais que tempo ou dificuldade.',
      checklist: 'Mesmo verificado, confira versão, DLC e roadmap antes de começar.',
      introTitle: 'Confiança editorial no catálogo',
      introBody: 'A verificação manual é um sinal de confiança, não uma substituição da leitura do guia.',
      chipLabel: 'Verificados',
      chipDescription: 'Status manual verificado.',
      related: ['editorial-review', 'difficulty-low', 'online-none']
    },
    'editorial-review': {
      id: 'editorial-review',
      serviceFacet: 'editorial-review',
      slug: 'em-revisao',
      path: '/catalogo',
      title: 'Catálogo de guias em revisão | AtlasAchievement',
      description: 'Filtre guias publicados ou em revisão editorial.',
      name: 'Em revisão',
      heroTitle: 'Guias em revisão editorial',
      heroDescription: 'Use este filtro para identificar guias que ainda pedem leitura crítica de status antes de confiar totalmente.',
      collectionTitle: 'Guias em revisão',
      collectionDescription: 'O filtro usa verification_status, is_verified e status editorial já existentes.',
      reason: 'Bom para saber quando abrir o guia com mais cautela.',
      checklist: 'Valide contagens, DLC, perdíveis e online antes de seguir cegamente.',
      introTitle: 'O que significa revisão',
      introBody: 'Guias em revisão podem ser úteis, mas devem deixar claro que ainda não têm verificação manual final.',
      chipLabel: 'Em revisão',
      chipDescription: 'Status editorial pede validação.',
      related: ['editorial-verified', 'missable-present', 'online-required']
    }
  };

  const catalogFacetIds = Object.keys(catalogFacetMeta);
  const catalogFacetPageMap = Object.fromEntries(
    catalogFacetIds.map(id => {
      const item = catalogFacetMeta[id];
      return [id === 'all' ? 'all' : item.slug, item];
    })
  );
  const catalogFacetPathMap = Object.fromEntries(catalogFacetIds.map(id => [id, catalogFacetMeta[id].path]));

  function getGameTotal(game = {}) {
    return Number(game?.trophy_count || game?.trophies?.length || 0);
  }

  function hasKnownTimeValue(value) {
    return Number.isFinite(value) && value !== FALLBACK_TIME_VALUE;
  }

  function getRoadmapCount(game = {}) {
    return Number(game?.roadmap_count || game?.roadmap?.length || 0);
  }

  function hasGuideRisk(game = {}) {
    return Number(game?.missable_count || 0) > 0 || hasMissableRiskText(game?.missable || game?.missable_summary || '');
  }

  function normalizeCatalogSignalText(value = '') {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function getCatalogText(game = {}, keys = []) {
    return normalizeCatalogSignalText(keys.map(key => game?.[key]).filter(Boolean).join(' '));
  }

  function hasCatalogOnlineRequired(game = {}) {
    const text = getCatalogText(game, ['online_summary', 'guide_online', 'online']);
    if (!text) return false;
    if (/nao ha trofeus online obrigatorios tradicionais|nao ha exigencia online|nao ha trofeus online|sem online obrigatorio|nao exige online/.test(text)) {
      return /sos flare|guild cards?|quests multiplayer|online\/multiplayer|100 quests em multiplayer|pvp|servidor obrigatorio|server obrigatorio/.test(text);
    }
    return /online\/multiplayer|sos flare|guild cards?|quests multiplayer|multiplayer obrigatorio|online obrigatorio|pvp|servidor|server|ps\+ obrigatorio/.test(text);
  }

  function hasCatalogCoopRequired(game = {}) {
    const text = getCatalogText(game, ['online_summary', 'guide_online', 'online', 'before_you_start']);
    return /exige 2 jogadores|2 jogadores|dois jogadores|nao pode ser platinado solo|nao pode ser feito solo|coop obrigatorio|co-op obrigatorio|campanha em coop|segundo jogador|dupla/.test(text);
  }

  function hasCatalogMissables(game = {}) {
    const count = Number(game?.missable_count || 0);
    const text = getCatalogText(game, ['missable_summary', 'missable']);
    if (count > 0) return true;
    if (!text) return false;
    if (/nao ha .*perdivel|nao ha .*perdiveis|nao ha perda permanente|sem perdivel permanente|sem perdiveis|nada .*perdivel/.test(text)) return false;
    return hasMissableRiskText(text) || /perdivel|perdiveis|perda permanente|bloqueado|bloquear|perder definitivamente/.test(text);
  }

  function hasCatalogGrind(game = {}) {
    const text = getCatalogText(game, ['grind_summary', 'guide_grind', 'grind', 'cleanup_advice']);
    if (!text) return false;
    if (/sem grind|nao ha grind|nao exige grind|grind leve|sem farm pesado/.test(text)) return false;
    return /grind|farm|rng|rank|coroa|coroas|crown|crowns|boss stem cell|bsc|level|nivel|endgame longo|repeticao/.test(text);
  }

  function hasCatalogBaseGameScope(game = {}) {
    const text = getCatalogText(game, ['dlc_scope', 'guide_dlc', 'dlc']);
    if (!text) return false;
    return /lista base|jogo base|base game|sem dlc|nao inclui|nao e necessaria|dlc nao necessaria|nao ha dlc|platina propria|sem dlcs/.test(text);
  }

  function hasCatalogChapterSelect(game = {}) {
    const text = getCatalogText(game, ['missable_summary', 'cleanup_advice', 'first_run_advice', 'before_you_start']);
    return /chapter select|selecao de capitulo|selecao de capitulos|selecionar capitulo|capitulos/.test(text);
  }

  function isCatalogVerified(game = {}) {
    return getEditorialTrustStatus(game) === 'verified';
  }

  function isCatalogInReview(game = {}) {
    const status = getEditorialTrustStatus(game);
    return status !== 'verified' && status !== 'draft';
  }

  function hasCatalogEditorialStatus(game = {}, status = '') {
    return getEditorialTrustStatus(game) === status;
  }

  function hasCatalogCriticalEditorialStatus(game = {}) {
    const badge = getEditorialTrustBadge(game);
    return Boolean(badge?.critical);
  }

  function getCatalogDecisionSignals(game = {}) {
    const onlineRequired = hasCatalogOnlineRequired(game);
    const coopRequired = hasCatalogCoopRequired(game);
    const hasMissable = hasCatalogMissables(game);
    const hasGrind = hasCatalogGrind(game);
    const baseGame = hasCatalogBaseGameScope(game);
    const chapterSelect = hasCatalogChapterSelect(game);
    const signals = [];

    signals.push(onlineRequired
      ? { id: 'online', label: 'Online', tone: 'warning', icon: 'fa-wifi' }
      : { id: 'no-online', label: 'Sem online', tone: 'safe', icon: 'fa-wifi' });
    if (coopRequired) signals.push({ id: 'coop', label: 'Coop obrigatório', tone: 'warning', icon: 'fa-users' });
    signals.push(hasMissable
      ? { id: 'missable', label: 'Perdíveis', tone: 'risk', icon: 'fa-triangle-exclamation' }
      : { id: 'no-missable', label: 'Sem perdíveis', tone: 'safe', icon: 'fa-shield-halved' });
    if (hasGrind) signals.push({ id: 'grind', label: 'Grind', tone: 'warning', icon: 'fa-repeat' });
    if (baseGame) signals.push({ id: 'base-game', label: 'Base game', tone: 'neutral', icon: 'fa-layer-group' });
    if (chapterSelect) signals.push({ id: 'chapter-select', label: 'Chapter Select', tone: 'neutral', icon: 'fa-book-open' });

    return {
      onlineRequired,
      coopRequired,
      hasMissable,
      hasGrind,
      baseGame,
      chapterSelect,
      isVerified: isCatalogVerified(game),
      inReview: isCatalogInReview(game),
      editorialStatus: getEditorialTrustStatus(game),
      signals
    };
  }

  function resolveCatalogFacetId(facet = 'all') {
    if (typeof facet === 'object' && facet) {
      return facet.serviceFacet || facet.id || resolveCatalogFacetId(facet.slug || 'all');
    }
    const value = String(facet || 'all');
    if (catalogFacetMeta[value]) return value;
    if (catalogFacetPageMap[value]) return catalogFacetPageMap[value].serviceFacet || 'all';
    return 'all';
  }

  function getCatalogFacet(facet = 'all') {
    return catalogFacetMeta[resolveCatalogFacetId(facet)] || catalogFacetMeta.all;
  }

  function getCatalogPageBySlug(slug = 'all') {
    return catalogFacetPageMap[String(slug || 'all')] || null;
  }

  function getCatalogPath(facet = 'all') {
    return getCatalogFacet(facet).path || '/catalogo';
  }

  function getCatalogFacetFromPath(pathname = '/') {
    const normalized = String(pathname || '/').replace(/\/+$/, '') || '/';
    const match = Object.entries(catalogFacetPathMap).find(([, facetPath]) => facetPath === normalized);
    return match ? match[0] : 'all';
  }

  function matchesCatalogFacet(game = {}, facet = 'all') {
    const id = resolveCatalogFacetId(facet);
    const difficulty = Number(game?.difficulty || 0);
    const timeValue = getTimeValue(game);
    const trophyCount = getGameTotal(game);

    if (id === 'difficulty-low') return difficulty > 0 && difficulty <= 3;
    if (id === 'difficulty-mid') return difficulty >= 4 && difficulty <= 6;
    if (id === 'difficulty-high') return difficulty >= 7 && difficulty <= 10;
    if (id === 'time-short') return hasKnownTimeValue(timeValue) && timeValue <= 15;
    if (id === 'time-medium') return hasKnownTimeValue(timeValue) && timeValue > 15 && timeValue <= 40;
    if (id === 'time-long') return hasKnownTimeValue(timeValue) && timeValue > 40;
    if (id === 'trophies-small') return trophyCount > 0 && trophyCount <= 30;
    if (id === 'trophies-medium') return trophyCount > 30 && trophyCount <= 60;
    if (id === 'trophies-large') return trophyCount > 60;
    if (id === 'online-none') return !hasCatalogEditorialStatus(game, 'needs_online_check') && !hasCatalogOnlineRequired(game);
    if (id === 'online-required') return hasCatalogOnlineRequired(game);
    if (id === 'coop-required') return hasCatalogCoopRequired(game);
    if (id === 'missable-present') return hasCatalogMissables(game);
    if (id === 'missable-none') return !hasCatalogEditorialStatus(game, 'needs_missables_check') && !hasCatalogMissables(game);
    if (id === 'grind-present') return hasCatalogGrind(game);
    if (id === 'dlc-base') return hasCatalogBaseGameScope(game);
    if (id === 'chapter-select') return hasCatalogChapterSelect(game);
    if (id === 'editorial-verified') return isCatalogVerified(game);
    if (id === 'editorial-review') return isCatalogInReview(game);
    return true;
  }

  function getCatalogFacetCountFromGames(facet = 'all', games = []) {
    const list = Array.isArray(games) ? games : [];
    return list.filter(game => matchesCatalogFacet(game, facet)).length;
  }

  function getCatalogFacetCountsFromGames(games = []) {
    return Object.fromEntries(catalogFacetIds.map(facet => [facet, getCatalogFacetCountFromGames(facet, games)]));
  }

  function getCatalogCounts(response = {}, allGames = []) {
    if (response?.facetCounts && typeof response.facetCounts === 'object') return response.facetCounts;
    return getCatalogFacetCountsFromGames(allGames);
  }

  function getCatalogFacetCount(facetConfigOrId, facetCounts = {}) {
    const key = resolveCatalogFacetId(facetConfigOrId);
    return Number(facetCounts?.[key] || 0);
  }

  function formatCatalogCount(count) {
    const value = Number(count || 0);
    return `${value} ${value === 1 ? 'jogo' : 'jogos'}`;
  }

  function getRelatedCatalogFacets(facet = 'all', facetCounts = {}, options = {}) {
    const meta = getCatalogFacet(facet);
    const includeEmpty = Boolean(options.includeEmpty);
    return (meta.related || [])
      .map(id => getCatalogFacet(id))
      .filter(item => item.id && item.path)
      .map(item => ({ ...item, count: getCatalogFacetCount(item, facetCounts) }))
      .filter(item => includeEmpty || item.count > 0);
  }

  function classifyGameCollections(game = {}, trophies = []) {
    const difficulty = Number(game?.difficulty || 0);
    const timeValue = getTimeValue(game);
    const trophyCount = Array.isArray(trophies) ? trophies.length : getGameTotal(game);
    const roadmapCount = getRoadmapCount(game);
    const trophyRows = Array.isArray(trophies) ? trophies : [];
    const missableCount = trophyRows.length
      ? trophyRows.filter(trophy => trophy?.is_missable).length
      : Number(game?.missable_count || 0);
    const hasMissableRisk = hasMissableRiskText(game?.missable || game?.missable_summary || '');

    const facetIds = [];
    if (difficulty > 0) facetIds.push(difficulty <= 3 ? 'difficulty-low' : difficulty <= 6 ? 'difficulty-mid' : 'difficulty-high');
    if (hasKnownTimeValue(timeValue)) facetIds.push(timeValue <= 15 ? 'time-short' : timeValue <= 40 ? 'time-medium' : 'time-long');
    if (trophyCount > 0) facetIds.push(trophyCount <= 30 ? 'trophies-small' : trophyCount <= 60 ? 'trophies-medium' : 'trophies-large');

    const badges = [];
    if (difficulty > 0 && difficulty <= 3) badges.push({ label: 'Bom para iniciantes', tone: 'close' });
    if (hasKnownTimeValue(timeValue) && timeValue <= 15) badges.push({ label: 'Platina rápida', tone: 'soft' });
    if (missableCount === 0 && !hasMissableRisk) badges.push({ label: 'Baixo risco de perdível', tone: 'close' });
    if (missableCount >= 1 || hasMissableRisk) badges.push({ label: 'Exige atenção cedo', tone: 'warm' });
    if (roadmapCount >= 4) badges.push({ label: 'Pede roadmap', tone: 'accent' });
    if (hasKnownTimeValue(timeValue) && timeValue > 40) badges.push({ label: 'Projeto longo', tone: 'hot' });

    const collectionLinks = [...new Set(facetIds)]
      .map(id => getCatalogFacet(id))
      .filter(item => item.id && item.path)
      .slice(0, 3)
      .map(item => ({
        id: item.id,
        label: item.name,
        path: item.path,
        reason: item.reason || item.collectionDescription || 'Abra esta coleção para comparar jogos parecidos antes de escolher o próximo projeto.'
      }));

    return { collectionLinks, badges: badges.slice(0, 4) };
  }

  function buildCatalogIntentConfigs(items = []) {
    const list = Array.isArray(items) ? items : [];
    const count = matcher => list.filter(matcher).length;
    const configs = [
      {
        id: 'first-platinum',
        label: 'Primeira platina',
        icon: 'fa-seedling',
        facet: 'difficulty-low',
        sort: 'recommended-desc',
        count: count(game => matchesCatalogFacet(game, 'difficulty-low')),
        helper: `${count(game => matchesCatalogFacet(game, 'difficulty-low'))} opção(ões) mais acessíveis`
      },
      {
        id: 'weekend-run',
        label: 'Projeto de fim de semana',
        icon: 'fa-bolt',
        facet: 'time-short',
        sort: 'time-asc',
        count: count(game => matchesCatalogFacet(game, 'time-short')),
        helper: `${count(game => matchesCatalogFacet(game, 'time-short'))} jogo(s) curtos agora`
      },
      {
        id: 'steady-project',
        label: 'Projeto médio',
        icon: 'fa-layer-group',
        facet: 'time-medium',
        sort: 'recommended-desc',
        count: count(game => matchesCatalogFacet(game, 'time-medium')),
        helper: `${count(game => matchesCatalogFacet(game, 'time-medium'))} opção(ões) equilibradas`
      },
      {
        id: 'dense-checklist',
        label: 'Checklist denso',
        icon: 'fa-list-check',
        facet: 'trophies-large',
        sort: 'trophies-desc',
        count: count(game => matchesCatalogFacet(game, 'trophies-large')),
        helper: `${count(game => matchesCatalogFacet(game, 'trophies-large'))} lista(s) longas`
      },
      {
        id: 'high-challenge',
        label: 'Desafio real',
        icon: 'fa-mountain',
        facet: 'difficulty-high',
        sort: 'difficulty-desc',
        count: count(game => matchesCatalogFacet(game, 'difficulty-high')),
        helper: `${count(game => matchesCatalogFacet(game, 'difficulty-high'))} projeto(s) exigentes`
      }
    ];
    return configs.filter(item => item.count > 0);
  }

  function formatHomeCatalogProof(gamesCount = 0, totalTrophies = 0, totalRoadmaps = 0) {
    const gameValue = Number(gamesCount || 0);
    const trophyValue = Number(totalTrophies || 0);
    const roadmapValue = Number(totalRoadmaps || 0);
    if (!gameValue && !trophyValue && !roadmapValue) {
      return 'Guias de platina com roadmap, checklist e progresso para acompanhar sua próxima run.';
    }
    const gamesLabel = `${gameValue} ${gameValue === 1 ? 'jogo mapeado' : 'jogos mapeados'}`;
    const trophiesLabel = `${trophyValue} ${trophyValue === 1 ? 'troféu' : 'troféus'}`;
    const roadmapLabel = `${roadmapValue} ${roadmapValue === 1 ? 'etapa de roadmap' : 'etapas de roadmap'}`;
    return `${gamesLabel} · ${trophiesLabel} · ${roadmapLabel}`;
  }

  function getHomeRecommendationScore(game = {}) {
    const difficulty = Number(game?.difficulty || 0);
    const timeValue = getTimeValue(game);
    const roadmapCount = getRoadmapCount(game);
    const total = getGameTotal(game);
    let score = 0;
    if (Number.isFinite(timeValue)) score += Math.max(0, 32 - Math.min(timeValue, 32));
    if (difficulty > 0) score += Math.max(0, 12 - Math.min(difficulty, 10));
    score += Math.min(roadmapCount * 5, 20);
    score += total >= 20 && total <= 60 ? 6 : 0;
    score += game?.updated_at ? 4 : 0;
    return score;
  }

  function getHomeFeaturedReason(game = {}) {
    const difficulty = Number(game?.difficulty || 0);
    const roadmapCount = getRoadmapCount(game);
    const timeValue = getTimeValue(game);
    const hasRisk = hasGuideRisk(game);

    if (roadmapCount >= 4 && hasRisk) return 'Roadmap forte para entrar sem perder a rota.';
    if (roadmapCount >= 4) return 'Roadmap claro para começar sem improviso.';
    if (Number.isFinite(timeValue) && timeValue <= 15 && difficulty > 0 && difficulty <= 4) return 'Curta, legível e com baixo atrito.';
    return 'Tempo, dificuldade e rota em bom equilíbrio.';
  }

  function getHomeRevisionNote(game = {}) {
    const roadmapCount = getRoadmapCount(game);
    const hasRisk = hasGuideRisk(game);
    if (hasRisk && roadmapCount >= 3) return 'Riscos e roadmap merecem leitura antes do primeiro save.';
    if (roadmapCount >= 3) return 'Roadmap revisado para orientar a ordem da platina.';
    return 'Leitura editorial recente para validar o próximo clique.';
  }

  function selectHomeShowcaseGames(games = [], limit = 6) {
    const list = Array.isArray(games) ? games.filter(game => game?.slug) : [];
    const showcaseList = list.filter(game => !hasCatalogCriticalEditorialStatus(game));
    const candidateList = showcaseList.length ? showcaseList : list;
    const bySlug = new Map(candidateList.map(game => [game.slug, game]));
    const prioritySlugs = [
      'little-nightmares-ii',
      'monster-hunter-world',
      'it-takes-two',
      'hollow-knight',
      'dead-cells',
      'clair-obscur-expedition-33',
      'a-way-out'
    ];
    const selected = [];
    const seen = new Set();

    prioritySlugs.forEach(slug => {
      const game = bySlug.get(slug);
      if (!game || seen.has(slug)) return;
      selected.push(game);
      seen.add(slug);
    });

    candidateList
      .slice()
      .sort((a, b) => getHomeRecommendationScore(b) - getHomeRecommendationScore(a))
      .forEach(game => {
        if (seen.has(game.slug) || selected.length >= limit) return;
        selected.push(game);
        seen.add(game.slug);
      });

    return selected.slice(0, Math.max(Number(limit || 0), 0));
  }

  function buildHomeIntentCardsModel(games = []) {
    const list = Array.isArray(games) ? games : [];
    const countOptions = value => `${value} ${value === 1 ? 'opção' : 'opções'}`;
    const shortCount = getCatalogFacetCountFromGames('time-short', list);
    const easyCount = getCatalogFacetCountFromGames('difficulty-low', list);
    const mediumCount = getCatalogFacetCountFromGames('time-medium', list);
    const hardCount = getCatalogFacetCountFromGames('difficulty-high', list);
    return [
      {
        facet: 'time-short',
        count: shortCount,
        icon: 'fa-bolt',
        tone: 'short',
        tag: 'Curto',
        title: 'Curto e direto',
        description: 'Até 15 horas para fechar sem virar compromisso.',
        metric: countOptions(shortCount)
      },
      {
        facet: 'difficulty-low',
        count: easyCount,
        icon: 'fa-shield-halved',
        tone: 'easy',
        tag: 'Fácil',
        title: 'Baixo atrito',
        description: 'Dificuldade baixa para começar sem pressão.',
        metric: countOptions(easyCount)
      },
      {
        facet: 'time-medium',
        count: mediumCount,
        icon: 'fa-layer-group',
        tone: 'medium',
        tag: 'Médio',
        title: 'Projeto médio',
        description: '16 a 40 horas para manter tração com calma.',
        metric: countOptions(mediumCount)
      },
      {
        facet: 'difficulty-high',
        count: hardCount,
        icon: 'fa-fire-flame-curved',
        tone: 'challenge',
        tag: 'Desafio',
        title: 'Alta exigência',
        description: 'Para quando você quer execução e paciência.',
        metric: countOptions(hardCount)
      }
    ];
  }

  function buildCatalogDiscoveryCards(items = []) {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return [];
    const getTimeValueSafe = game => {
      const value = parseTimeValue(game?.time || '');
      return Number.isFinite(value) ? value : FALLBACK_TIME_VALUE;
    };
    const pick = matcher => list.find(matcher);
    const cards = [
      {
        title: 'Primeira platina',
        kicker: 'Entrada recomendada',
        text: 'Use esta rota quando quiser começar com algo mais acessível e com menor atrito de execução.',
        game: pick(game => Number(game?.difficulty || 0) > 0 && Number(game?.difficulty || 0) <= 3 && getTimeValueSafe(game) <= 20) || pick(game => Number(game?.difficulty || 0) > 0 && Number(game?.difficulty || 0) <= 3)
      },
      {
        title: 'Projeto de fim de semana',
        kicker: 'Curto e direto',
        text: 'Boa escolha para quem quer retorno rápido sem abrir uma maratona longa.',
        game: pick(game => getTimeValueSafe(game) <= 15) || pick(game => getTimeValueSafe(game) <= 25)
      },
      {
        title: 'Desafio com contexto',
        kicker: 'Para quem quer pressão',
        text: 'Aqui a ideia é abrir algo mais exigente já sabendo melhor o custo de execução.',
        game: pick(game => Number(game?.difficulty || 0) >= 7) || pick(game => Number(game?.difficulty || 0) >= 5)
      }
    ];
    return cards.filter(card => card.game).map(card => ({
      ...card,
      meta: `${Number(card.game?.difficulty || 0) || '-'} / 10 · ${card.game?.time || 'Tempo não informado'} · ${getGameTotal(card.game)} troféu(s)`
    }));
  }

  function buildCatalogCompareLabel(game = {}) {
    const difficulty = Number(game?.difficulty || 0);
    const total = getGameTotal(game);
    const timeValue = parseTimeValue(game?.time || '');
    const hasTimeValue = Number.isFinite(timeValue);
    const roadmapCount = getRoadmapCount(game);
    if (difficulty <= 3 && hasTimeValue && timeValue <= 15) return 'Melhor porta de entrada';
    if (difficulty >= 7) return 'Mais exigente da faixa';
    if (roadmapCount >= 3 && total >= 40) return 'Mais contexto para comparar';
    if (hasTimeValue && timeValue > 40) return 'Compromisso de longo prazo';
    return 'Boa opção para comparar';
  }

  function buildEditorialCollectionItems(collectionSlug, items = []) {
    const list = Array.isArray(items) ? items : [];
    const isLowRisk = game => {
      const trophies = Array.isArray(game?.trophies) ? game.trophies : [];
      const missableCount = trophies.length
        ? trophies.filter(trophy => trophy?.is_missable).length
        : Number(game?.missable_count || 0);
      return missableCount === 0 && !hasMissableRiskText(game?.missable || game?.missable_summary || '');
    };

    const filtered = list.filter(game => {
      const difficulty = Number(game?.difficulty || 0);
      const timeValue = getTimeValue(game);
      if (collectionSlug === 'primeira-platina') return difficulty > 0 && difficulty <= 3 && timeValue <= 25;
      if (collectionSlug === 'platinas-rapidas') return timeValue <= 15;
      if (collectionSlug === 'baixo-risco-de-perdiveis') return !hasCatalogEditorialStatus(game, 'needs_missables_check') && isLowRisk(game);
      return true;
    });

    return filtered
      .sort((a, b) => {
        const diffScore = Number(a?.difficulty || 99) - Number(b?.difficulty || 99);
        const timeScore = getTimeValue(a) - getTimeValue(b);
        return diffScore || timeScore || String(a?.name || '').localeCompare(String(b?.name || ''), 'pt-BR');
      });
  }

  return {
    FALLBACK_TIME_VALUE,
    catalogFacetMeta,
    catalogFacetPageMap,
    catalogFacetPathMap,
    catalogFacetIds,
    resolveCatalogFacetId,
    getCatalogFacet,
    getCatalogPageBySlug,
    getCatalogPath,
    getCatalogFacetFromPath,
    getGameTotal,
    getRoadmapCount,
    hasGuideRisk,
    getCatalogDecisionSignals,
    isCatalogVerified,
    isCatalogInReview,
    hasCatalogEditorialStatus,
    hasCatalogCriticalEditorialStatus,
    matchesCatalogFacet,
    getCatalogFacetCountFromGames,
    getCatalogFacetCountsFromGames,
    getCatalogCounts,
    getCatalogFacetCount,
    formatCatalogCount,
    getRelatedCatalogFacets,
    classifyGameCollections,
    buildCatalogIntentConfigs,
    formatHomeCatalogProof,
    getHomeRecommendationScore,
    getHomeFeaturedReason,
    getHomeRevisionNote,
    selectHomeShowcaseGames,
    buildHomeIntentCardsModel,
    buildCatalogDiscoveryCards,
    buildCatalogCompareLabel,
    buildEditorialCollectionItems
  };
});
