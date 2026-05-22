const fs = require('fs');
const express = require('express');
const session = require('express-session');
const path = require('path');
const requestContext = require('./middleware/requestContext');
const securityHeaders = require('./middleware/securityHeaders');
const { issueCsrfToken, requireCsrf } = require('./middleware/csrfProtection');
const { escapeXml } = require('./utils/xml');
const env = require('./config/env');
const authRoutes = require('./routes/auth.routes');
const meRoutes = require('./routes/me.routes');
const gamesRoutes = require('./routes/games.routes');
const feedbackRoutes = require('./routes/feedback.routes');
const uploadsRoutes = require('./routes/uploads.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const errorHandler = require('./middleware/errorHandler');
const gamesService = require('./services/games.service');
const sharedEditorialModel = require('./shared/editorialModel');
const sharedGuideViewModel = require('./shared/guideViewModel');
const sharedCardModel = require('./shared/cardModel');
const sharedCatalogModel = require('./shared/catalogModel');
const { loginRateLimit, registerRateLimit, registerFailedLoginAttempt } = require('./middleware/loginRateLimit');
const SqliteSessionStore = require('./services/sqliteSessionStore');
const AppError = require('./utils/AppError');
const packageJson = require('../package.json');

const app = express();
app.set('trust proxy', 1);

const publicIndexPath = path.join(__dirname, '../public/index.html');
const publicIndexTemplate = fs.readFileSync(publicIndexPath, 'utf8');
const catalogFacetPageMap = sharedCatalogModel.catalogFacetPageMap;
const PUBLIC_CATALOG_PAGE_SIZE = 24;
const PRODUCTION_CANONICAL_ORIGIN = 'https://atlasachievement.com.br';
const DEFAULT_SOCIAL_IMAGE_PATH = '/assets/brand/atlasachievement-og.png';
const NO_STORE_CACHE_CONTROL = 'no-cache, no-store, must-revalidate';
const NO_CACHE_CONTROL = 'no-cache';
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const APP_VERSION = [
  packageJson.version || '0.0.0',
  process.env.APP_VERSION || process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || process.env.SOURCE_VERSION || process.env.BUILD_ID || process.env.RENDER_SERVICE_ID || ''
].filter(Boolean).join('-');
const HOME_SEO_TITLE = 'AtlasAchievement — Guias de troféus e platina em português';
const HOME_SEO_DESCRIPTION = 'Escolha sua próxima platina com tempo estimado, dificuldade, roadmap, checklist, troféus perdíveis, online/coop e guias em português.';
const REQUIEM_EDITORIAL_SUMMARY = [
  'Resident Evil Requiem combina campanha, coletáveis, objetivos situacionais e runs condicionais. A platina gira em torno de acompanhar saves manuais, controlar arquivos e colecionáveis, separar troféus de personagem e planejar restrições como speedrun, cura e uso do Blood Collector.',
  'O ponto mais importante é não tratar toda tarefa situacional como perdível definitivo. Alguns objetivos exigem atenção em janelas específicas, mas muitos podem ser organizados com saves, nova run ou cleanup. Use a checklist para separar riscos reais, spoilers, coletáveis, dificuldade e objetivos acumuláveis.',
  'A melhor rota é começar com uma campanha exploratória, mantendo saves manuais e marcando arquivos, Mr. Raccoons, cofres, containers da BSAA, armas, upgrades e eventos situacionais. Depois, use o roadmap para separar runs condicionais, limpeza de bônus, dificuldade e pendências da lista base.'
];
const HADES_EDITORIAL_SUMMARY = [
  'Hades é uma platina baseada em progresso acumulado entre runs. O foco não está em troféus perdíveis, mas em transformar cada tentativa em avanço real: evoluir a Mirror of Night, liberar armas, distribuir Nectar, trabalhar relacionamentos, completar profecias da Fated List e avançar a história até o epílogo.',
  'A melhor estratégia é não tentar limpar tudo nas primeiras fugas. Use as runs iniciais para aprender armas, boons, chefes e padrões de combate. Depois que a primeira fuga estiver consistente, comece a organizar Keepsakes, Companions, Pact of Punishment, Heat e objetivos longos sem desperdiçar runs aleatórias.',
  'God Mode não bloqueia troféus e pode ser usado como recurso opcional. A platina base é totalmente offline, sem coop obrigatório e sem DLC necessária. O cleanup final gira em torno de relacionamentos, Fated List, Keepsakes no rank máximo, Companions, Heat e pendências de armas ou recursos.'
];
const GHOST_EDITORIAL_SUMMARY = [
  'Ghost of Tsushima é uma platina de mundo aberto acessível, baseada em campanha, exploração, Tales of Tsushima, Mythic Tales, liberação de regiões e limpeza de atividades pelo mapa. A lista base não exige online, coop, Legends, Iki Island ou New Game+, então dá para jogar a campanha com calma e deixar o cleanup para o free roam.',
  'A melhor rota é avançar a história enquanto desbloqueia ferramentas, posturas, viagem rápida e acesso às regiões. Ao mesmo tempo, vale completar atividades próximas ao caminho, como fontes termais, bambus, haiku, santuários, faróis, acampamentos e contos secundários, para reduzir a limpeza final.',
  'Depois da campanha, use o free roam para finalizar coletáveis, Tales pendentes, Mythic Tales, atividades regionais, cosméticos e troféus situacionais. Como não há perdíveis obrigatórios na lista base, o foco do guia é organizar o checklist para evitar retrabalho e separar claramente o que pertence à platina base do conteúdo extra.'
];
const GOD_OF_WAR_2018_EDITORIAL_SUMMARY = [
  'God of War (2018) tem uma platina focada em campanha, exploração dos reinos e cleanup pós-história. A lista base não exige online, coop ou dificuldade específica, então o maior desafio não está em perder troféus, mas em organizar coletáveis, favores, melhorias, Valkyries, Muspelheim, Niflheim e atividades opcionais sem deixar tudo acumulado para o final.',
  'A melhor estratégia é jogar a história em uma dificuldade confortável, explorando naturalmente e abrindo o máximo possível de atalhos, baús, favores e áreas secundárias. Não é necessário limpar tudo logo de início, porque o jogo permite voltar depois da campanha para resolver pendências com mais recursos, equipamentos e habilidades.',
  'Depois da história, foque no cleanup dos reinos, mapas do tesouro, artefatos, corvos, baús, favores, Valkyries e objetivos ligados a Muspelheim e Niflheim. Separar história, exploração e limpeza final deixa a platina mais controlada e evita retrabalho.'
];
const GOD_OF_WAR_RAGNAROK_EDITORIAL_SUMMARY = [
  'God of War Ragnarök tem uma platina focada em campanha, exploração dos reinos e cleanup pós-história. A lista base não exige online, coop ou dificuldade específica, então o desafio principal está em organizar favores, coletáveis, equipamentos, upgrades, Berserkers, Gná, Muspelheim, Cratera/Vanaheim e atividades opcionais sem transformar o final em uma limpeza enorme.',
  'A melhor estratégia é jogar a história em uma dificuldade confortável, explorando naturalmente e abrindo caminhos, baús, favores e atividades quando estiverem no caminho. Não é necessário limpar tudo logo de início, porque o jogo permite voltar depois da campanha para resolver pendências com mais recursos, equipamentos e acesso aos reinos.',
  'Depois da história, foque no cleanup por região: artefatos, lore, corvos de Odin, baús Nornir, fendas, favores, relíquias, punhos de espada, lápides Berserker, desafios de Muspelheim, Cratera/Vanaheim e chefes opcionais. Valhalla e outros extras ficam fora da rota da platina base.'
];
const HADES2_EDITORIAL_SUMMARY = [
  'Hades II é uma platina longa de roguelite, baseada em progresso acumulado entre runs. O foco está em evoluir Melinoë, liberar armas, ferramentas, Arcana, Incantations, Familiars, Keepsakes, rotas do Submundo e da Superfície, além de avançar diálogos e objetivos da Fated List.',
  'A melhor rota é usar as primeiras runs para estabilizar a Crossroads, entender os Guardians e abrir sistemas permanentes antes de tentar limpar tudo. Depois que as rotas estiverem mais consistentes, organize armas, aspectos, recursos raros, relacionamentos, Chaos Trials, Oath of the Unseen e objetivos longos sem desperdiçar runs aleatórias.',
  'A platina base não exige online, coop ou DLC. God Mode pode ser usado como recurso opcional sem bloquear troféus. O cleanup final gira em torno de Fated List, Arcana, Incantations, Familiars, Keepsakes, relacionamentos, rotas avançadas, Chronos, Surface e pendências situacionais.'
];
const ASTRO_BOT_EDITORIAL_SUMMARY = [
  'Astro Bot é uma platina curta, acessível e focada em exploração de fases, resgate de bots, coleta de puzzle pieces, fases secretas da Lost Galaxy e objetivos situacionais no Crash Site. Nada é perdível na lista base, então dá para jogar a campanha com calma e voltar depois para limpar o que ficou pendente.',
  'A melhor rota é avançar pelos mundos principais explorando bem cada fase, mas sem tentar fazer 100% perfeito logo na primeira passagem. Depois que a seleção de fases estiver mais aberta, revise bots, puzzle pieces, saídas secretas, desafios especiais e atividades do Crash Site com o checklist ao lado.',
  'O cleanup final gira em torno de completar bots, puzzle pieces, Lost Galaxy, Gatcha Lab, interações no hub e troféus situacionais. A platina base não exige coop obrigatório, não exige online obrigatório e não depende de DLC.'
];
const PRAGMATA_EDITORIAL_SUMMARY = [
  'PRAGMATA é uma platina sci-fi single-player baseada em campanha, exploração, hacking com Diana, progressão no Abrigo, LMTs, Mini Cabins, escotilhas, Red Zones, Training Sims, Unknown Signal e uma jogada separada em Lunatic. A rota exige atenção ao perdível e aos objetivos situacionais, mas não depende de online, coop ou DLC.',
  'A melhor estratégia é fazer a primeira campanha aprendendo o ciclo Hugh + Diana, conversando com Diana no Abrigo e acompanhando coletáveis desde cedo. Durante essa run, mantenha atenção ao alerta de You\'re Not Getting Away That Easy, além de registrar LMTs, Mini Cabins, escotilhas, Red Zones e objetivos que podem exigir setup específico.',
  'Depois da campanha, use o pós-jogo e Unknown Signal para limpar setores, Training Sims, upgrades, coletáveis e troféus situacionais. A etapa de Lunatic deve ser tratada como jogada separada, deixando a run de dificuldade para quando você já conhecer bem combate, hacking, chefes e rotas.'
];
const SAROS_EDITORIAL_SUMMARY = [
  'Saros é uma platina baseada em progressão por runs, domínio de combate e evolução gradual dos sistemas permanentes. A rota deve ser tratada como guia próprio: use as primeiras tentativas para aprender movimentação, padrões de chefes, armas, upgrades, salas especiais e como o jogo estrutura objetivos acumulativos.',
  'A melhor estratégia é avançar a campanha sem tentar limpar tudo de uma vez. Priorize sobrevivência, desbloqueios permanentes, familiaridade com biomas, Nightmare Gates, melhorias e objetivos que se acumulam naturalmente entre runs. Como não há online ou coop obrigatório, a platina depende principalmente de consistência, leitura de risco e organização da checklist.',
  'Depois de estabilizar a base, foque em chefes restantes, coletáveis, desafios, troféus situacionais, epílogo e cleanup final. Objetivos de run sem dano ou execução perfeita devem ser tratados como risco de run/dificuldade, não como perdíveis definitivos, quando puderem ser repetidos.'
];
const RE4_REMAKE_EDITORIAL_SUMMARY = [
  'Resident Evil 4 Remake é uma platina baseada em múltiplas campanhas, domínio dos capítulos, saves manuais, coletáveis, pedidos do Mercador, Clockwork Castellans, tesouros, Shooting Range, armas, troféus situacionais e runs de restrição. A lista base não exige online, coop, Separate Ways, VR Mode, The Mercenaries ou tickets pagos.',
  'A melhor estratégia é usar a primeira campanha para aprender rotas, chefes, economia de recursos e pontos sem volta, enquanto já adianta tesouros, pedidos do Mercador, castelões e armas importantes. Não tente combinar todas as restrições logo de início; separar objetivos reduz o risco de quebrar uma run e evita retrabalho.',
  'Depois da primeira campanha, organize runs específicas para NG+, Professional, S+, Minimalist, Frugalist, Silent Stranger, Sprinter, Shooting Range e cleanup de troféus situacionais. Como o jogo não tem chapter select tradicional nem free roam final, saves manuais por capítulo e checklist atualizado fazem diferença para evitar repetir campanhas desnecessárias.'
];
const NIOH2_EDITORIAL_SUMMARY = [
  'Nioh 2 é uma platina de progressão longa, focada em dominar o combate, concluir missões da lista base, explorar regiões e fechar objetivos acumulativos como Kodama, Hot Springs, Soul Cores, proficiência de armas e registros de yokai. A lista base não tem perdíveis definitivos, então o risco principal não é perder troféus, e sim deixar muita limpeza acumulada para o final.',
  'A melhor rota é avançar a campanha aprendendo sistemas como Ki Pulse, Burst Counter, Yokai Shift, Guardian Spirits e Soul Cores, enquanto limpa missões secundárias e acompanha coletáveis por região. O jogo permite retornar a missões, então a platina favorece organização, paciência e evolução consistente do personagem.',
  'Depois da história, concentre o cleanup em missões pendentes, proficiência, ferreiro, títulos, yokai, Kodama, Hot Springs e troféus situacionais. Coop e recursos online podem ajudar, mas não são obrigatórios para a platina base.'
];
const NIOH3_EDITORIAL_SUMMARY = [
  'Nioh 3 é uma platina longa e técnica, focada em avançar a campanha, dominar o combate e limpar missões, coletáveis e sistemas acumulativos da lista base. Online e coop não entram como requisitos obrigatórios: a rota principal pode ser organizada solo, com retorno a missões e cleanup por região.',
  'A melhor estratégia é usar a campanha para aprender a alternância entre Samurai e Ninja, fortalecer equipamentos, explorar Guardian Spirits, Battle Scroll, Yokai, ferreiro e trackers regionais. Como não há perdíveis definitivos na lista base, o risco principal não é perder troféus, mas acumular Kodama, Hot Springs, missões, Soul Cores, proficiência e objetivos situacionais para o fim.',
  'Depois da história, concentre o cleanup em missões pendentes, coletáveis por região, proficiência, armas, habilidades, Yokai, Battle Scroll e troféus situacionais. Separar campanha, sistemas e limpeza final deixa a platina mais controlada e reduz retrabalho.'
];
const TLOU_PART_I_EDITORIAL_SUMMARY = [
  'The Last of Us Part I tem uma platina concentrada na campanha principal, em Left Behind e na limpeza de coletáveis e interações opcionais. A lista não exige multiplayer/Factions, online ou coop, e também não depende de troféus perdíveis definitivos, já que o Chapter Select permite voltar para capítulos e corrigir pendências.',
  'A melhor estratégia é jogar a campanha com um checklist de coletáveis aberto desde o início, acompanhando artefatos, pingentes dos Vagalumes, quadrinhos, manuais, cofres, portas abertas com shiv, bancadas, suplementos e peças. Conversas opcionais e piadas da Ellie merecem atenção especial porque são fáceis de deixar passar durante a exploração.',
  'Depois da campanha, use o Chapter Select para fechar capítulos incompletos, completar Left Behind, revisar coletáveis restantes e finalizar troféus situacionais. O guia separa a platina da lista base do Part I de qualquer expectativa de multiplayer antigo, então o foco fica em exploração cuidadosa e cleanup organizado.'
];
const TLOU_PART_II_EDITORIAL_SUMMARY = [
  'The Last of Us Part II tem uma platina concentrada na campanha principal, exploração cuidadosa e cleanup de coletáveis. A lista base não exige online, coop, Factions, Grounded, Permadeath, No Return ou a versão Remastered; o foco está em artefatos, cartas colecionáveis, moedas, entradas de diário, cofres, bancadas, manuais de treinamento, armas e troféus situacionais.',
  'A melhor estratégia é jogar a campanha em uma dificuldade confortável, explorando todos os ambientes e mantendo um checklist de coletáveis aberto desde o início. Não há perdíveis definitivos, porque o Chapter Select permite voltar a capítulos, mas deixar cartas, moedas, cofres, bancadas e interações para o final aumenta bastante o cleanup.',
  'Depois da história, use Chapter Select para limpar capítulos incompletos e faça NG+ parcial para concluir upgrades de armas e personagens que exigem mais suplementos e peças do que uma campanha normalmente oferece. Mantenha Grounded, Permadeath, Remastered e No Return fora da rota da platina base.'
];

const editorialCollectionPageMap = {
  'primeira-platina': {
    path: '/colecoes/primeira-platina',
    title: 'Melhores jogos para primeira platina | AtlasAchievement',
    description: 'Veja uma seleção editorial de jogos mais acessíveis para começar sua primeira platina com menos atrito.',
    name: 'Primeira platina',
    heroTitle: 'Jogos para começar bem a primeira platina',
    heroDescription: 'Esta coleção prioriza jogos mais acessíveis, com risco mais baixo e boa relação entre tempo, dificuldade e clareza do guia.',
    collectionTitle: 'Seleção editorial para primeira platina',
    collectionDescription: 'A ideia aqui não é só mostrar jogos fáceis, mas destacar boas portas de entrada para criar consistência, entender o fluxo do site e terminar a primeira lista sem desgaste desnecessário.',
    reason: 'Boa para quem quer começar com mais confiança e sem cair em jogos que parecem simples, mas escondem retrabalho cedo.',
    checklist: 'Prefira abrir primeiro jogos curtos, de dificuldade baixa e com menos alertas de perdível ou necessidade de múltiplas runs.',
    introTitle: 'Como escolher sua primeira platina',
    introBody: 'Uma primeira platina boa precisa reduzir atrito, não só dificuldade. Por isso esta página cruza tempo, risco e clareza do roadmap antes de recomendar um clique.',
    faq: [
      { question: 'O que faz um jogo ser bom para primeira platina?', answer: 'Tempo controlado, dificuldade acessível, poucos pontos de retrabalho e um guia claro logo na primeira leitura.' },
      { question: 'Preciso escolher o jogo mais curto?', answer: 'Não necessariamente. O ideal é equilíbrio entre duração viável e baixo risco, não só o menor número de horas.' },
      { question: 'Vale começar por uma lista média?', answer: 'Só se o roadmap estiver claro e a execução parecer estável para o seu momento atual.' }
    ]
  },
  'platinas-rapidas': {
    path: '/colecoes/platinas-rapidas',
    title: 'Platinas rápidas para concluir em pouco tempo | AtlasAchievement',
    description: 'Seleção editorial de jogos curtos para quem quer uma platina rápida sem abrir uma maratona longa.',
    name: 'Platinas rápidas',
    heroTitle: 'Platinas rápidas para encaixar sem virar maratona',
    heroDescription: 'Use esta coleção quando quiser retorno rápido, projetos de fim de semana ou um descanso entre listas mais pesadas.',
    collectionTitle: 'Jogos curtos com boa chance de fechamento rápido',
    collectionDescription: 'Aqui entram jogos que tendem a caber melhor em uma janela curta, desde que o risco de perdível e a clareza do guia acompanhem a promessa de rapidez.',
    reason: 'Ajuda a evitar clicar em projetos que parecem curtos no papel, mas pedem cleanup torto, grind ou revisão tardia demais.',
    checklist: 'Antes de começar, confirme se o jogo curto também é realmente controlável em execução, e não só em tempo bruto.',
    introTitle: 'Quando uma platina rápida vale a pena',
    introBody: 'Jogos curtos respondem muito bem a buscas de alta intenção, mas só convertem de verdade quando a página deixa claro o risco escondido por trás da promessa de rapidez.',
    faq: [
      { question: 'Platina rápida significa platina fácil?', answer: 'Não sempre. Alguns jogos são curtos, mas podem ter execução exigente, troféus sensíveis ou cleanup desconfortável.' },
      { question: 'Quanto tempo conta como platina rápida?', answer: 'Nesta coleção, priorizamos jogos que parecem viáveis em até cerca de 15 horas.' },
      { question: 'Vale usar como intervalo entre jogos longos?', answer: 'Sim. Essa é uma das melhores funções desta coleção: manter ritmo sem abrir outro compromisso pesado.' }
    ]
  },
  'baixo-risco-de-perdiveis': {
    path: '/colecoes/baixo-risco-de-perdiveis',
    title: 'Jogos com baixo risco de perdíveis | AtlasAchievement',
    description: 'Encontre jogos em que o risco de perder troféus parece menor, ótimos para runs mais tranquilas.',
    name: 'Baixo risco de perdíveis',
    heroTitle: 'Coleção para quem quer uma run mais tranquila',
    heroDescription: 'Esta seleção prioriza jogos que, pelo cadastro atual, não mostram alertas fortes de troféus perdíveis logo no começo.',
    collectionTitle: 'Jogos mais tranquilos para jogar sem medo de travar a lista cedo',
    collectionDescription: 'Boa para quem quer aproveitar melhor a campanha sem a sensação de que uma escolha errada logo nas primeiras horas já estraga o 100%.',
    reason: 'Reduz a ansiedade de abrir um projeto novo quando você quer mais liberdade e menos leitura defensiva antes de cada passo.',
    checklist: 'Mesmo sem perdíveis fortes, vale revisar roadmap, troféus únicos e sinais de cleanup para não confundir liberdade com improviso total.',
    introTitle: 'O que significa baixo risco de perdível',
    introBody: 'Baixo risco não é ausência absoluta de atenção. A proposta desta coleção é destacar jogos em que o risco principal parece ser organização, e não bloqueio estrutural da run.',
    faq: [
      { question: 'Sem perdível quer dizer zero risco?', answer: 'Não. Ainda pode existir cleanup ruim, troféu técnico ou etapa que mereça atenção, mesmo sem perdível clássico.' },
      { question: 'Esses jogos são melhores para jogar sem guia?', answer: 'Em geral, eles toleram melhor uma leitura parcial no começo, mas continuar usando o guia ainda reduz retrabalho.' },
      { question: 'Posso usar esta coleção como filtro principal?', answer: 'Sim, principalmente se você valoriza runs mais soltas e quer evitar pressão logo nas primeiras horas.' }
    ]
  }
};

const organicSeoListPageMap = {
  '/platinas-faceis': {
    path: '/platinas-faceis',
    title: 'Platinas fáceis | AtlasAchievement',
    description: 'Lista de jogos com platinas fáceis em português, com tempo estimado, dificuldade, roadmap e checklist.',
    name: 'Platinas fáceis',
    heroTitle: 'Platinas fáceis',
    heroDescription: 'Jogos do catálogo com dificuldade baixa informada. A lista só usa dificuldade cadastrada, sem forçar jogos com dado ausente ou incerto.',
    collectionTitle: 'Critério da lista',
    collectionDescription: 'Entram jogos com dificuldade de 1 a 3/10 no cadastro atual. Quando a dificuldade não está informada, o jogo fica fora desta seleção.',
    reason: 'Boa para encontrar uma platina mais acessível antes de abrir o guia completo.',
    checklist: 'Mesmo em platinas fáceis, confirme tempo, online, perdíveis e roadmap antes de começar.',
    introTitle: 'Como lemos platina fácil',
    introBody: 'Aqui “fácil” significa dificuldade baixa cadastrada no guia, não promessa absoluta de platina automática. Use os cards para comparar tempo, dificuldade e riscos antes do clique.',
    sort: compareOrganicByDifficultyThenTime,
    matches: game => hasKnownDifficulty(game, 1, 3)
  },
  '/platinas-curtas': {
    path: '/platinas-curtas',
    title: 'Platinas curtas | AtlasAchievement',
    description: 'Encontre jogos curtos para platinar, com guias em português, tempo estimado, dificuldade e checklist.',
    name: 'Platinas curtas',
    heroTitle: 'Platinas curtas',
    heroDescription: 'Jogos com tempo estimado curto e confiável no catálogo. A seleção evita jogos cuja faixa máxima passa de 20 horas.',
    collectionTitle: 'Critério da lista',
    collectionDescription: 'Entram jogos com tempo máximo estimado até 20 horas. Quando o tempo está ausente, aberto ou acima desse limite, o jogo fica fora.',
    reason: 'Boa para quem quer um projeto menor, de fim de semana ou entre listas longas.',
    checklist: 'Platinas curtas ainda podem ter execução difícil ou troféu sensível; abra o guia para validar os detalhes.',
    introTitle: 'Como lemos platina curta',
    introBody: 'Esta página usa o tempo estimado estruturado do catálogo e considera a parte alta da faixa. Assim, um jogo de 20 a 30 horas não entra como curto só porque começa em 20.',
    sort: compareOrganicByTimeThenDifficulty,
    matches: game => hasReliableMaxTimeAtMost(game, 20)
  },
  '/platinas-sem-online': {
    path: '/platinas-sem-online',
    title: 'Platinas sem online | AtlasAchievement',
    description: 'Veja jogos para platinar sem online obrigatório, com roadmap, checklist e informações de troféus em português.',
    name: 'Platinas sem online',
    heroTitle: 'Platinas sem online',
    heroDescription: 'Jogos com informação explícita de que a platina não exige online obrigatório. Guias com texto incerto ficam fora por segurança.',
    collectionTitle: 'Critério da lista',
    collectionDescription: 'Entram apenas jogos cujo resumo editorial indica ausência de online obrigatório e não contém sinal de validação pendente sobre esse requisito.',
    reason: 'Boa para evitar dependência de servidor, PS+, multiplayer online ou troféus online obrigatórios.',
    checklist: 'Sem online não significa necessariamente solo: confira coop local, segundo jogador e outros requisitos no guia.',
    introTitle: 'Sem online, com cautela editorial',
    introBody: 'A lista é conservadora. Se o guia não diz claramente que não há online obrigatório, ou se o texto ainda pede validação, o jogo não entra nesta página.',
    sort: compareOrganicByDifficultyThenTime,
    matches: game => hasExplicitNoOnline(game)
  },
  '/platinas-sem-perdiveis': {
    path: '/platinas-sem-perdiveis',
    title: 'Platinas sem troféus perdíveis | AtlasAchievement',
    description: 'Lista de jogos sem troféus perdíveis para platinar com menos risco, usando guias em português.',
    name: 'Platinas sem troféus perdíveis',
    heroTitle: 'Platinas sem troféus perdíveis',
    heroDescription: 'Jogos com indicação explícita de ausência de troféus perdíveis definitivos. Seleção feita de forma conservadora.',
    collectionTitle: 'Critério da lista',
    collectionDescription: 'Entram jogos com zero troféus marcados como perdíveis e texto editorial claro indicando que não há perdíveis definitivos.',
    reason: 'Boa para jogar com menos risco de bloquear a platina por uma decisão ou capítulo antigo.',
    checklist: 'Mesmo sem perdíveis, ainda pode haver cleanup, coletáveis, grind ou troféus situacionais que merecem checklist.',
    introTitle: 'Sem perdíveis não é sem atenção',
    introBody: 'Esta lista não inventa segurança. Ela depende de marcação e texto existentes no guia, e deixa de fora jogos com confirmação incompleta ou ambígua.',
    sort: compareOrganicByDifficultyThenTime,
    matches: game => hasExplicitNoMissables(game)
  },
  '/platinas-para-iniciantes': {
    path: '/platinas-para-iniciantes',
    title: 'Platinas para iniciantes | AtlasAchievement',
    description: 'Jogos recomendados para quem está começando a platinar, com guias em português, roadmap, checklist e dicas para evitar erros.',
    name: 'Platinas para iniciantes',
    heroTitle: 'Platinas para iniciantes',
    heroDescription: 'Jogos mais amigáveis para quem está começando: dificuldade baixa, tempo controlado, sem online obrigatório explícito e roadmap claro.',
    collectionTitle: 'Critério da lista',
    collectionDescription: 'A seleção cruza dificuldade baixa, tempo até 30 horas, ausência explícita de online obrigatório, baixo risco de perdíveis e roadmap com etapas suficientes.',
    reason: 'Boa para criar hábito de usar roadmap e checklist sem começar por uma lista longa ou punitiva demais.',
    checklist: 'Leia o começo do guia antes de jogar, especialmente avisos sobre capítulo, coletáveis, coop e saves.',
    introTitle: 'Como escolhemos boas primeiras platinas',
    introBody: 'Para iniciantes, a melhor escolha não é só a mais fácil: é a que combina tempo viável, rota clara e baixo risco de erro irreversível.',
    sort: compareOrganicBeginner,
    matches: game => isBeginnerFriendlyGame(game)
  }
};

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


function safeJsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/<\/script/gi, '<\\/script')
    .replace(/</g, '\u003c')
    .replace(/>/g, '\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function normalizeOrigin(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return url.origin.replace(/\/+$/, '');
  } catch (error) {
    return raw.replace(/\/+$/, '');
  }
}

function isLegacyRenderOrigin(origin = '') {
  try {
    const { hostname } = new URL(origin);
    return hostname === 'onrender.com' || hostname.endsWith('.onrender.com');
  } catch (error) {
    return /(^|\.)onrender\.com$/i.test(String(origin || '').replace(/^https?:\/\//i, '').split('/')[0]);
  }
}

function getPublicOrigin(req) {
  const configuredOrigin = normalizeOrigin(env.canonicalOrigin || env.appUrl);
  if (configuredOrigin && !(env.isProduction && isLegacyRenderOrigin(configuredOrigin))) {
    return configuredOrigin;
  }
  if (env.isProduction) return PRODUCTION_CANONICAL_ORIGIN;
  return normalizeOrigin(`${req.protocol}://${req.get('host')}`);
}

function buildPublicUrl(req, pathname = '/') {
  const pathPart = String(pathname || '/').startsWith('/') ? String(pathname || '/') : `/${pathname}`;
  return `${getPublicOrigin(req)}${pathPart}`;
}

function resolveMetaImage(origin, imagePath) {
  if (!imagePath) return `${origin}${DEFAULT_SOCIAL_IMAGE_PATH}`;
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  return `${origin}${imagePath}`;
}


function buildInitialStateScript(payload = null) {
  if (!payload) return '<script>window.__INITIAL_STATE__ = null;</script>';
  return `<script>window.__INITIAL_STATE__ = ${safeJsonForHtml(payload)};</script>`;
}

function sanitizePublicGuideInitialStateGame(game = {}) {
  if (String(game?.slug || '').trim().toLowerCase() !== 'resident-evil-requiem') return game;
  const sanitized = { ...game };
  delete sanitized.quality_warnings;
  delete sanitized.qualityWarnings;
  return sanitized;
}

function getGoogleAnalyticsMeasurementId() {
  const measurementId = String(env.googleAnalyticsMeasurementId || '').trim();
  return /^G-[A-Z0-9]+$/i.test(measurementId) ? measurementId.toUpperCase() : '';
}

function buildAnalyticsHeadHtml() {
  if (!env.isProduction) return '';
  const measurementId = getGoogleAnalyticsMeasurementId();
  if (!measurementId) return '';

  const escapedId = escapeHtml(measurementId);
  const safeJsonId = safeJsonForHtml(measurementId);
  return `<!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${escapedId}"></script>
  <script>
    window.AtlasAnalyticsConfig = Object.freeze({ measurementId: ${safeJsonId} });
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', ${safeJsonId}, { send_page_view: false });
  </script>`;
}

function buildAdminLoginPageHtml() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AtlasAchievement - Acesso editorial</title>
  <meta name="robots" content="noindex,nofollow">
  <meta name="description" content="Acesso privado ao console editorial do AtlasAchievement.">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/css/utilities.css">
  <link rel="stylesheet" href="/css/tokens.css">
  <link rel="stylesheet" href="/css/base.css">
  <link rel="stylesheet" href="/css/layout.css">
  <link rel="stylesheet" href="/css/components.css">
  <link rel="stylesheet" href="/css/admin.css">
  <link rel="stylesheet" href="/css/responsive.css">
  <link rel="icon" href="/favicon.png" type="image/png" sizes="any">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <style>
    body[data-page="admin-login"] {
      background: linear-gradient(180deg, #050814 0%, #070b16 54%, #050710 100%);
    }

    body[data-page="admin-login"] .atlas-bg-orb {
      display: none;
    }

    .atlas-admin-login-main {
      min-height: calc(100vh - 88px);
      display: grid;
      place-items: center;
      padding: 32px 16px;
    }

    .atlas-admin-login-card {
      width: min(100%, 460px);
      border-radius: 18px;
    }

    .atlas-admin-login-card .atlas-input {
      min-height: 52px;
    }

    .atlas-admin-login-feedback {
      min-height: 22px;
    }

    @media (max-width: 640px) {
      .atlas-admin-login-main {
        align-items: start;
        padding-top: 24px;
      }
    }
  </style>
</head>
<body class="atlas-body min-h-screen" data-page="admin-login">
  <header class="sticky top-0 z-40 atlas-topbar atlas-topbar--admin">
    <div class="atlas-topbar__row max-w-[1320px] mx-auto px-4 lg:px-6 h-[88px] flex items-center justify-between gap-4">
      <a href="/" class="atlas-brand notranslate flex items-center gap-4" translate="no" aria-label="AtlasAchievement">
        <div class="w-12 h-12 rounded-2xl atlas-logo-mark flex items-center justify-center"><img src="/assets/brand/atlasachievement-logo.png" alt="" class="atlas-logo-image" width="44" height="44" decoding="async" aria-hidden="true"><span class="atlas-logo-letter notranslate sr-only" translate="no">A</span></div>
        <div class="atlas-brand__copy">
          <div class="atlas-brand__name notranslate text-[20px] font-extrabold leading-none" translate="no">AtlasAchievement</div>
          <div class="atlas-brand__tagline text-[11px] uppercase tracking-[0.28em] text-white/40 mt-1">Console Atlas</div>
        </div>
      </a>
      <a href="/" class="atlas-btn atlas-btn-secondary"><i class="fas fa-arrow-left" aria-hidden="true"></i><span>Site</span></a>
    </div>
  </header>

  <main class="atlas-admin-login-main">
    <section class="atlas-panel atlas-admin-login-card p-6 md:p-8" aria-labelledby="adminLoginTitle">
      <div class="atlas-eyebrow">Acesso restrito</div>
      <h1 id="adminLoginTitle" class="text-[28px] md:text-[36px] leading-none font-extrabold tracking-tight mt-2">Console editorial bloqueado</h1>
      <p class="mt-3 text-white/62">Entre com uma conta administradora para acessar guias, feedbacks e ferramentas editoriais.</p>

      <form id="adminLoginForm" class="space-y-4 mt-6" autocomplete="on">
        <label class="block">
          <span class="atlas-label">Usuário</span>
          <input id="adminUsername" name="username" type="text" class="atlas-input mt-2" autocomplete="username" required>
        </label>
        <label class="block">
          <span class="atlas-label">Senha</span>
          <input id="adminPassword" name="password" type="password" class="atlas-input mt-2" autocomplete="current-password" required>
        </label>
        <p id="adminLoginFeedback" class="atlas-admin-login-feedback text-sm text-rose-200" role="status" aria-live="polite"></p>
        <button id="adminLoginSubmit" type="submit" class="w-full atlas-btn atlas-btn-primary h-[54px]">Entrar no admin</button>
      </form>
    </section>
  </main>

  <script>
    (() => {
      const form = document.getElementById('adminLoginForm');
      const feedback = document.getElementById('adminLoginFeedback');
      const submit = document.getElementById('adminLoginSubmit');

      form?.addEventListener('submit', async event => {
        event.preventDefault();
        const username = document.getElementById('adminUsername')?.value.trim();
        const password = document.getElementById('adminPassword')?.value || '';
        feedback.textContent = '';
        submit.disabled = true;
        submit.textContent = 'Entrando...';

        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(payload?.error?.message || payload?.message || 'Não foi possível entrar agora.');
          }
          window.location.replace('/admin');
        } catch (error) {
          feedback.textContent = error.message || 'Não foi possível entrar agora.';
          submit.disabled = false;
          submit.textContent = 'Entrar no admin';
        }
      });
    })();
  </script>
</body>
</html>`;
}

function sendAdminPage(req, res) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  setNoStoreHeaders(res);

  if (!req.session?.admin) {
    res.type('html').send(buildAdminLoginPageHtml());
    return;
  }

  res.sendFile(path.join(__dirname, '../public/admin.html'));
}

function setNoStoreHeaders(res) {
  res.setHeader('Cache-Control', NO_STORE_CACHE_CONTROL);
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function setNoCacheHeaders(res) {
  res.setHeader('Cache-Control', NO_CACHE_CONTROL);
}

function hasHashedAssetName(filePath = '') {
  const basename = path.basename(String(filePath || ''));
  return /(?:[._-])[a-f0-9]{8,}(?=\.)/i.test(basename);
}

function setPublicStaticCacheHeaders(res, filePath = '') {
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (/(?:^|[\\/])(?:service-worker|sw)\.js$/i.test(filePath) || /(?:^|[\\/])(?:site\.webmanifest|manifest\.json)$/i.test(filePath)) {
    setNoStoreHeaders(res);
    return;
  }

  if (hasHashedAssetName(filePath)) {
    res.setHeader('Cache-Control', IMMUTABLE_CACHE_CONTROL);
    return;
  }

  setNoCacheHeaders(res);
}

function setHtmlRouteCacheHeaders(req, res, next) {
  setNoStoreHeaders(res);
  next();
}

function firstSeoText(...values) {
  return values.map(value => String(value || '').trim()).find(Boolean) || '';
}

function buildGameSeoTitle(game = {}) {
  const name = String(game?.name || 'Jogo').trim() || 'Jogo';
  return `${name}: guia de platina, troféus e roadmap | AtlasAchievement`;
}

function buildGameSeoDescription(game = {}) {
  const name = String(game?.name || 'este jogo').trim() || 'este jogo';
  if (String(game?.slug || '').trim().toLowerCase() === 'elden-ring') {
    return 'Guia de platina de Elden Ring em português, com tempo estimado, dificuldade, finais, armas lendárias, Bolt of Gransax, chefes, roadmap e checklist de troféus.';
  }
  if (String(game?.slug || '').trim().toLowerCase() === 'hades') {
    return 'Guia de platina de Hades em português, com tempo estimado, dificuldade, roadmap, checklist, Fated List, Keepsakes, Companions, Pact of Punishment, Heat e dicas para a platina.';
  }
  if (String(game?.slug || '').trim().toLowerCase() === 'pragmata') {
    return 'Guia de platina de PRAGMATA em português, com tempo estimado, dificuldade, troféus perdíveis, Lunatic, coletáveis, roadmap e checklist.';
  }
  if (String(game?.slug || '').trim().toLowerCase() === 'nioh-2') {
    return 'Guia de platina de Nioh 2 em português, com tempo estimado, dificuldade, missões, Kodama, Hot Springs, proficiência, Soul Cores, roadmap e checklist de troféus.';
  }
  if (String(game?.slug || '').trim().toLowerCase() === 'nioh-3') {
    return 'Guia de platina de Nioh 3 em português, com tempo estimado, dificuldade, troféus, Samurai, Ninja, missões, coletáveis, Battle Scroll, roadmap e checklist.';
  }
  if (String(game?.slug || '').trim().toLowerCase() === 'saros') {
    return 'Guia de platina de Saros em português, com tempo estimado, dificuldade, troféus, roadmap, checklist, coletáveis, bosses e dicas para a platina.';
  }
  if (String(game?.slug || '').trim().toLowerCase() === 'resident-evil-requiem') {
    return 'Guia de platina de Resident Evil Requiem em português, com tempo estimado, dificuldade, troféus, coletáveis, roadmap, checklist e dicas para a platina.';
  }
  if (String(game?.slug || '').trim().toLowerCase() === 'the-last-of-us-part-i') {
    return 'Guia de platina de The Last of Us Part I em português, com tempo estimado, dificuldade, troféus, coletáveis, Left Behind, Chapter Select, roadmap e checklist.';
  }
  if (String(game?.slug || '').trim().toLowerCase() === 'the-last-of-us-part-ii') {
    return 'Guia de platina de The Last of Us Part II em português, com tempo estimado, dificuldade, troféus, coletáveis, upgrades, Chapter Select, NG+ parcial, roadmap e checklist.';
  }
  if (String(game?.slug || '').trim().toLowerCase() === 'subnautica') {
    return 'Guia de platina de Subnautica em português, com tempo estimado, dificuldade, troféus, exploração, veículos, base, história, roadmap e checklist.';
  }
  const parts = [];
  const time = String(game?.time || '').trim();
  const difficulty = Number(game?.difficulty || 0);
  const onlineText = normalizeSeoSignalText(firstSeoText(game?.online_summary, game?.guide_online, game?.online));
  const missableText = normalizeSeoSignalText(firstSeoText(game?.missable_summary, game?.missable));
  const dlcText = normalizeSeoSignalText(firstSeoText(game?.dlc_scope, game?.guide_dlc, game?.dlc));
  const hasOnline = /online\/multiplayer|trofeus? online confirmad|red dead online|sport mode|sos flare|guild cards?|daily challenge|servidor|server|ps\+/.test(onlineText)
    && !/nao ha|sem online|nao exige online|online opcional|nao.*online obrigatorio|ps\+ nao/.test(onlineText);
  const noOnline = /nao ha (?:trofeus )?(?:online|exigencia online)|sem online obrigatorio|nao exige online|sem trofeus online|nao ha multiplayer obrigatorio/.test(onlineText)
    && !hasUncertainEditorialText(onlineText);
  const hasCoop = /exige 2 jogadores|2 jogadores obrigatorios|dois jogadores obrigatorios|nao pode ser platinado solo|coop obrigatorio|co-op obrigatorio/.test(onlineText);
  const missableCount = Number(game?.missable_count || 0);
  const hasMissables = missableCount > 0 || (!/nao ha|sem perdiveis|nada .*perdivel|0 perdiveis/.test(missableText) && /perdivel|perdiveis|ponto sem retorno|bloque/.test(missableText));

  if (time) parts.push(`tempo estimado de ${time}`);
  if (difficulty > 0) parts.push(`dificuldade ${difficulty}/10`);
  if (hasMissables) parts.push('alertas de troféus perdíveis');
  if (hasCoop) parts.push('coop obrigatório');
  else if (hasOnline) parts.push('requisitos online');
  else if (noOnline) parts.push('sem online obrigatório');
  if (/lista base|jogo base|base game|sem dlc|dlc nao necessaria|nao e necessaria|fora do escopo|nao inclui/.test(dlcText) && !hasUncertainEditorialText(dlcText)) {
    parts.push('DLC fora da platina base');
  }
  parts.push('roadmap e checklist');

  return `Guia de platina de ${name} em português, com ${parts.join(', ')}.`;
}

function buildGameGuideH1(game = {}) {
  const name = String(game?.name || 'Guia').trim() || 'Guia';
  const hasPlatinum = Array.isArray(game?.trophies)
    ? game.trophies.some(trophy => String(trophy?.type || '').trim().toLowerCase() === 'platina' || String(trophy?.type || '').trim().toLowerCase() === 'platinum')
    : Boolean(game?.platinumType || game?.platinum_type);
  if (hasPlatinum) return `${name} — Guia de platina e troféus`;
  return name;
}

function buildTrophyDetailsId(trophy = {}, index = 0) {
  const base = String(trophy?.id || trophy?.name || `trophy-${index}`)
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || `trophy-${index}`;
  return `trophy-details-${base}-${index}`;
}

function hasLongTrophyDescription(description = '') {
  const text = String(description || '').trim();
  return text.length > 130 || text.includes('\n');
}

function shouldShowTrophyDetailsToggle(trophy = {}, description = '', tip = '') {
  return Boolean(String(tip || '').trim() || hasLongTrophyDescription(description));
}

function cleanTrophyNameCandidate(value = '') {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text || /^(undefined|null|\[object Object\])$/i.test(text)) return '';
  return text;
}

function getTrophyOriginalName(trophy = {}) {
  return cleanTrophyNameCandidate(trophy?.trophyNameOriginal || trophy?.originalName || trophy?.officialName || trophy?.name) || 'Troféu';
}

function getTrophyEditorialName(trophy = {}) {
  const officialName = getTrophyOriginalName(trophy);
  const candidates = [
    trophy?.trophyNamePtBr,
    trophy?.localizedNamePt,
    trophy?.localizedNamePtBr,
    trophy?.name_pt,
    trophy?.namePt,
    trophy?.ptName,
    trophy?.translatedName
  ].map(cleanTrophyNameCandidate).filter(Boolean);
  const editorialName = candidates[0] || '';
  if (!editorialName) return '';
  return editorialName.includes(' / ') ? editorialName.split(' / ').map(cleanTrophyNameCandidate).find(Boolean) || '' : editorialName;
}

function getTrophyDisplayName(trophy = {}) {
  return getTrophyEditorialName(trophy) || getTrophyOriginalName(trophy);
}

function looksLikeEnglishTrophyDescription(value = '') {
  return /\b(Obtained|Reached|Achieved|Defeated|Acquired|Upgraded|Arrived|Restored|Used|Clear|Earn|Complete|Unlock|Max-rank|Equip|Choose|Purge|Forge|Trade|Pay|Fulfill|Catch|Compel|Have|Buy|Get|Beat|Slay|Pet)\b/i.test(String(value || ''));
}

function looksLikePortugueseTrophyDescription(value = '') {
  const text = String(value || '').trim();
  return /[áàâãéêíóôõúç]/i.test(text)
    || /\b(os|as|um|uma|todos|todas|com|em|de|do|da|dos|das|ao|aos|seu|sua|trofeus|troféus|conquistas|inimigos|areas|áreas|santuarios|santuários|farois|faróis|colete|obtenha|liberte|derrote|mate|conclua|aprenda|equipe|descubra|compre|personalize|reacenda|honre|enfrente|destrua|compareça|devolva|busque|faça|repare|lembre|melhore|complete|recupere)\b/i.test(text);
}

function cleanTrophyDescriptionCandidate(value) {
  if (value && typeof value === 'object') return '';
  const text = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!text) return '';
  if (/^(undefined|null|\[object Object\])$/i.test(text)) return '';
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/^descricao em revisao editorial\.\s*[.;]*\s*(?:undefined|null)?$/.test(normalized)) return '';
  return text.replace(/\s+([.;,!?])/g, '$1');
}

function getTrophyDisplayDescription(trophy = {}, game = {}) {
  const localizedDescription = [
    trophy.descriptionPtBr,
    trophy.ptDescription,
    trophy.localizedDescription?.ptBr,
    trophy.localizedDescription?.['pt-BR']
  ].map(cleanTrophyDescriptionCandidate).find(Boolean) || '';
  if (localizedDescription) return localizedDescription;

  const description = cleanTrophyDescriptionCandidate(trophy.description);
  if (description && looksLikePortugueseTrophyDescription(description) && !looksLikeEnglishTrophyDescription(description)) return description;
  if (description && looksLikePortugueseTrophyDescription(description)) return description;
  return 'Descrição em revisão editorial.';
}

function renderTrophyCardHtml(trophy, completedIds = new Set(), index = 0, game = {}) {
  const done = completedIds.has(trophy.id);
  const description = getTrophyDisplayDescription(trophy, game);
  const tip = trophy.tip || '';
  const officialName = getTrophyOriginalName(trophy);
  const editorialName = getTrophyEditorialName(trophy);
  const primaryName = getTrophyDisplayName(trophy);
  const riskTags = getGuideTrophyTags(trophy, game);
  const displayRiskTags = typeof sharedGuideViewModel.getGuideTrophyDisplayTags === 'function'
    ? sharedGuideViewModel.getGuideTrophyDisplayTags(trophy, game, 4)
    : riskTags.slice(0, 4);
  const riskTokens = riskTags.map(tag => tag.id).join(' ');
  const search = typeof sharedGuideViewModel.getGuideTrophySearchText === 'function'
    ? sharedGuideViewModel.getGuideTrophySearchText(trophy, riskTags)
    : `${trophy.trophyNameOriginal || trophy.name || ''} ${trophy.trophyNamePtBr || trophy.name_pt || ''} ${description} ${tip} ${trophy.type || ''} ${riskTags.map(tag => `${tag.id} ${tag.label}`).join(' ')}`.trim().toLowerCase();
  const detailsId = buildTrophyDetailsId(trophy, index);
  const hasDetailsToggle = shouldShowTrophyDetailsToggle(trophy, description, tip);
  const detailsToggleHtml = hasDetailsToggle
    ? `<button type="button" class="atlas-btn atlas-btn-secondary atlas-btn-compact atlas-trophy-details-toggle" data-trophy-details-toggle="true" aria-expanded="false" aria-controls="${escapeHtml(detailsId)}"><span data-details-label>Ver detalhes</span><i class="fas fa-chevron-down" aria-hidden="true"></i></button>`
    : '';
  const toggleLabel = done ? 'Desmarcar' : 'Concluir';
  const toggleAria = `${toggleLabel} ${primaryName}`;

  return `
    <article class="trophy-card atlas-trophy-card atlas-panel atlas-panel--quiet ${done ? 'completed' : ''} ${hasDetailsToggle ? 'has-details-toggle' : ''}" data-trophy-id="${escapeHtml(trophy.id || '')}" data-type="${escapeHtml(trophy.type || 'Bronze')}" data-risks="${escapeHtml(riskTokens)}" data-status="${done ? 'completed' : 'pending'}" data-search="${escapeHtml(search)}">
      <div class="atlas-trophy-card__layout">
        <div class="atlas-trophy-card__main">
          <div class="atlas-trophy-card__headline">
            <div class="atlas-trophy-card__title">
              <h4>${escapeHtml(primaryName)}</h4>
              ${editorialName ? `<p class="atlas-trophy-card__title-translation"><span>NOME ORIGINAL:</span>${escapeHtml(officialName)}</p>` : ''}
            </div>
            <div class="atlas-trophy-card__meta">
              <span class="atlas-trophy-type">${escapeHtml(trophy.type || 'Bronze')}</span>
              <span class="atlas-trophy-state ${done ? 'atlas-trophy-state--done' : ''}">${done ? 'Concluído' : 'Pendente'}</span>
            </div>
          </div>
          ${displayRiskTags.length ? `<div class="atlas-trophy-risk-list">${displayRiskTags.map(tag => `<span class="atlas-risk-chip atlas-risk-chip--${escapeHtml(tag.tone)}">${escapeHtml(tag.label)}</span>`).join('')}</div>` : ''}
          <div id="${escapeHtml(detailsId)}" class="atlas-trophy-details" data-trophy-details>
            <p class="atlas-trophy-description">${escapeHtml(description || 'Sem descrição.')}</p>
            ${tip ? `<div class="atlas-tip-box atlas-trophy-tip"><div class="atlas-tip-label">${trophy.is_spoiler ? 'Dica com spoiler' : 'Dica'}</div><p class="text-sm mt-2">${escapeHtml(tip)}</p></div>` : ''}
          </div>
          ${detailsToggleHtml}
        </div>
        <div class="atlas-trophy-card__actions">
          <button type="button" class="atlas-btn ${done ? 'atlas-btn-secondary' : 'atlas-btn-primary'} atlas-trophy-toggle" data-trophy-toggle="${escapeHtml(trophy.id || '')}" aria-pressed="${done ? 'true' : 'false'}" aria-label="${escapeHtml(toggleAria)}"><i class="fas ${done ? 'fa-rotate-left' : 'fa-check'}"></i><span>${escapeHtml(toggleLabel)}</span></button>
        </div>
      </div>
    </article>`;
}

function getDifficultyTone(difficulty) {
  return sharedEditorialModel.getDifficultyTone(difficulty);
}

function getDifficultyToneClass(difficulty) {
  return sharedEditorialModel.getDifficultyToneClass(difficulty);
}

function hasMissableRiskText(value = '') {
  return sharedEditorialModel.hasMissableRiskText(value);
}

function getTrophyRiskTags(trophy = {}) {
  return sharedEditorialModel.getTrophyRiskTags(trophy);
}

function getGuideTrophyTags(trophy = {}, game = {}) {
  return typeof sharedGuideViewModel.getGuideTrophyTags === 'function'
    ? sharedGuideViewModel.getGuideTrophyTags(trophy, game)
    : getTrophyRiskTags(trophy);
}

function buildThirtySecondVerdict(game = {}, viewModel = {}) {
  return sharedGuideViewModel.buildThirtySecondVerdict(game, viewModel);
}

function buildGuideNextActionModel(game = {}, viewModel = {}) {
  const completedIds = viewModel.completedIds instanceof Set ? Array.from(viewModel.completedIds) : [];
  return sharedGuideViewModel.deriveNextAction({ ...game, trophies: viewModel.trophies || [], roadmap: viewModel.roadmap || [] }, completedIds);
}

function formatDisplayDate(value) {
  return sharedGuideViewModel.formatDisplayDate(value);
}

function getEditorialBadge(game = {}) {
  return sharedEditorialModel.getEditorialBadge(game);
}

function getHomeTotal(game = {}) {
  return sharedCatalogModel.getGameTotal(game);
}

function getHomeRoadmapCount(game = {}) {
  return sharedCatalogModel.getRoadmapCount(game);
}

function formatHomeCatalogProof(gamesCount = 0, totalTrophies = 0, totalRoadmaps = 0) {
  return sharedCatalogModel.formatHomeCatalogProof(gamesCount, totalTrophies, totalRoadmaps);
}

function getHomeRecommendationScore(game = {}) {
  return sharedCatalogModel.getHomeRecommendationScore(game);
}

function getHomeFeaturedReason(game = {}) {
  return sharedCatalogModel.getHomeFeaturedReason(game);
}

function renderHomeImageHtml(model = {}, imageClass = 'atlas-card__image', options = {}) {
  const name = model.name || 'Jogo';
  const source = model.image || '';
  const width = options.width || 520;
  const height = options.height || 320;
  const sizes = options.sizes || '100vw';
  return `
    <span class="atlas-home-image-fallback" aria-hidden="true">${escapeHtml(name)}</span>
    ${source ? `<img src="${escapeHtml(source)}" alt="${escapeHtml(name)}" class="${escapeHtml(imageClass)}" loading="${escapeHtml(options.loading || 'lazy')}" decoding="${escapeHtml(options.decoding || 'async')}" width="${escapeHtml(String(width))}" height="${escapeHtml(String(height))}" sizes="${escapeHtml(sizes)}" onerror="this.hidden=true;this.parentElement.classList.add('atlas-home-image-shell--fallback-visible');">` : ''}
    `;
}

function renderEditorialBadgeHtml(statusBadge = {}, options = {}) {
  if (!statusBadge?.label) return '';
  const sizeClass = options.small ? ' atlas-editorial-badge--small' : '';
  return `<span class="atlas-editorial-badge${sizeClass} atlas-editorial-badge--${escapeHtml(statusBadge.status || statusBadge.badge || statusBadge.tone || 'in_review')}" title="${escapeHtml(statusBadge.detail || '')}">${escapeHtml(statusBadge.label)}</span>`;
}

function renderHomeIntentCardsHtml(games = []) {
  const items = sharedCatalogModel.buildHomeIntentCardsModel(games).filter(item => Number(item.count || 0) > 0);
  if (!items.length) {
    return '<div class="atlas-inline-empty atlas-intent-empty">As faixas aparecem aqui quando houver jogos suficientes no catálogo.</div>';
  }

  return items.map(item => `
    <button type="button" class="atlas-intent-card atlas-intent-card--${escapeHtml(item.tone)}" data-home-facet="${escapeHtml(item.facet)}">
      <div class="atlas-intent-card__head">
        <span class="atlas-intent-card__label">${escapeHtml(item.tag)}</span>
        <i class="fas ${escapeHtml(item.icon)}"></i>
      </div>
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.description)}</p>
      <span class="atlas-intent-card__meta">${escapeHtml(item.metric)}</span>
    </button>`).join('');
}

function renderHomeFeaturedGameHtml(games = []) {
  const showcase = typeof sharedCatalogModel.selectHomeShowcaseGames === 'function'
    ? sharedCatalogModel.selectHomeShowcaseGames(games, 1)
    : [];
  const game = showcase[0] || [...games].sort((a, b) => getHomeRecommendationScore(b) - getHomeRecommendationScore(a))[0] || null;
  if (!game) return '';
  const model = sharedCardModel.buildStandardGameCardModel(game);
  const slug = escapeHtml(model.slug);
  const image = model.image;
  const time = model.time;
  const difficulty = model.difficulty;
  const total = model.trophies;
  const difficultyTone = model.difficultyTone;
  const difficultyClass = model.difficultyClass;
  const reason = getHomeFeaturedReason(game);

  return `
    <article class="atlas-card atlas-card--game atlas-card--featured atlas-featured-game" data-difficulty-tone="${escapeHtml(difficultyTone)}">
      <div class="atlas-card__media atlas-featured-game__cover atlas-home-image-shell${image ? '' : ' atlas-home-image-shell--fallback-visible'}">
        ${renderHomeImageHtml(model, 'atlas-card__image atlas-featured-game__image', { width: 600, height: 900, sizes: '(min-width: 1024px) 180px, 42vw' })}
      </div>
      <div class="atlas-card__body atlas-featured-game__body">
        <div class="atlas-card__badges">${renderEditorialBadgeHtml(model.statusBadge, { small: true })}</div>
        <h3 class="atlas-card__title">${escapeHtml(model.name)}</h3>
        <p class="atlas-card__reason">${escapeHtml(reason)}</p>
        <div class="atlas-card__meta atlas-featured-game__meta" aria-label="Resumo da recomendação">
          <span class="atlas-meta-signal atlas-meta-signal--time"><i class="fas fa-clock"></i>${escapeHtml(time)}</span>
          <span class="atlas-meta-signal ${escapeHtml(difficultyClass)}"><i class="fas fa-gauge-high"></i>${escapeHtml(String(difficulty))}/10</span>
          <span class="atlas-meta-signal atlas-meta-signal--trophy"><i class="fas fa-trophy"></i>${escapeHtml(String(total))} troféus</span>
        </div>
        <div class="atlas-card__actions">
          <a href="/jogo/${slug}" class="atlas-btn atlas-btn-primary atlas-featured-game__cta" data-home-game="${escapeHtml(model.name)}" data-open-guide-card="${slug}"><i class="fas fa-book-open"></i>Abrir guia</a>
        </div>
      </div>
    </article>`;
}

function renderHomeDiscoveryGuidesHtml(games = []) {
  const showcaseGames = typeof sharedCatalogModel.selectHomeShowcaseGames === 'function'
    ? sharedCatalogModel.selectHomeShowcaseGames(games, 6)
    : games.slice(0, 6);
  if (!showcaseGames.length) {
    return '<div class="atlas-inline-empty">Nenhum guia recente disponível.</div>';
  }

  return showcaseGames.map(game => {
    const model = sharedCardModel.buildStandardGameCardModel(game);
    const slug = escapeHtml(model.slug);
    return `
      <article class="atlas-card atlas-card--game atlas-card--standard atlas-discovery-card" data-difficulty-tone="${escapeHtml(model.difficultyTone)}" data-risk="${model.hasRisk ? 'missable' : 'none'}">
        <div class="atlas-card__media atlas-discovery-card__media atlas-home-image-shell${model.image ? '' : ' atlas-home-image-shell--fallback-visible'}">
          ${renderHomeImageHtml(model, 'atlas-card__image', { width: 600, height: 900, sizes: '(min-width: 1024px) 20vw, (min-width: 640px) 28vw, 42vw' })}
        </div>
        <div class="atlas-card__body">
          <div class="atlas-card__badges">${renderEditorialBadgeHtml(model.statusBadge, { small: true })}<span class="atlas-card__status atlas-badge atlas-badge--partial">Novo guia</span></div>
          <h3 class="atlas-card__title">${escapeHtml(model.name)}</h3>
          <div class="atlas-card__meta">
            <span class="atlas-meta-signal ${escapeHtml(model.difficultyClass)}"><i class="fas fa-gauge-high"></i>${escapeHtml(String(model.difficulty))}/10</span>
            <span class="atlas-meta-signal atlas-meta-signal--time"><i class="fas fa-clock"></i>${escapeHtml(model.time)}</span>
            <span class="atlas-meta-signal atlas-meta-signal--trophy"><i class="fas fa-trophy"></i>${escapeHtml(String(model.trophies))} troféus</span>
          </div>
          <div class="atlas-card__actions">
            <a href="/jogo/${slug}" class="atlas-btn atlas-btn-primary atlas-btn-compact" data-home-game="${escapeHtml(model.name)}" data-open-guide-card="${slug}">Abrir guia</a>
          </div>
        </div>
      </article>`;
  }).join('');
}

function getHomeRevisionNote(game = {}) {
  return sharedCatalogModel.getHomeRevisionNote(game);
}

function renderHomeEditorialHistoryHtml(games = []) {
  if (!games.length) {
    return '<div class="atlas-inline-empty">Nenhuma revisão recente disponível.</div>';
  }

  return games.slice(0, 5).map(game => {
    const updatedLabel = formatDisplayDate(game.updated_at || game.created_at);
    const slug = escapeHtml(game.slug || '');
    return `
      <article class="atlas-editorial-update">
        <time datetime="${escapeHtml(game.updated_at || game.created_at || '')}">${escapeHtml(updatedLabel)}</time>
        <div class="atlas-editorial-update__body">
          <h3>${escapeHtml(game.name)}</h3>
          <p>${escapeHtml(getHomeRevisionNote(game))}</p>
        </div>
        <a href="/jogo/${slug}" class="atlas-editorial-update__link" data-home-game="${escapeHtml(game.name)}" data-open-guide-card="${slug}" aria-label="Abrir guia de ${escapeHtml(game.name)}">
          <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i>
          <span>Abrir</span>
        </a>
      </article>`;
  }).join('');
}

async function listAllHomeGames() {
  const items = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await gamesService.listGames({ page, limit: 100, sort: 'updated-desc' });
    items.push(...(response.items || []));
    totalPages = Number(response.pagination?.totalPages || 1);
    page += 1;
  } while (page <= totalPages);

  return items;
}

function normalizeSeoSignalText(value = '') {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getSeoGameText(game = {}, keys = []) {
  return normalizeSeoSignalText(keys.map(key => game?.[key]).filter(Boolean).join(' '));
}

function hasUncertainEditorialText(text = '') {
  return /precisa validar|revisao final|revisao editorial|dados atuais|ate o momento|confirmados?|sujeit[ao] a revisao|validacao pendente|sem nova validacao/.test(text);
}

function hasKnownDifficulty(game = {}, min = 1, max = 10) {
  const difficulty = Number(game?.difficulty || 0);
  return Number.isFinite(difficulty) && difficulty >= min && difficulty <= max;
}

function getReliableMaxTime(game = {}) {
  const maxHours = Number(game?.time_max_hours);
  if (Number.isFinite(maxHours) && maxHours > 0) return maxHours;
  const minHours = Number(game?.time_min_hours);
  const sortHours = Number(game?.time_sort_hours);
  const timeText = String(game?.time || '');
  if (Number.isFinite(minHours) && minHours > 0 && minHours === sortHours && !/[+–-]/.test(timeText)) return minHours;
  return null;
}

function hasReliableMaxTimeAtMost(game = {}, max = 20) {
  const maxHours = getReliableMaxTime(game);
  return Number.isFinite(maxHours) && maxHours <= max;
}

function hasExplicitNoOnline(game = {}) {
  if (sharedEditorialModel.getEditorialTrustStatus(game) === 'needs_online_check') return false;
  const text = getSeoGameText(game, ['online_summary', 'guide_online', 'online']);
  if (!text || hasUncertainEditorialText(text)) return false;
  const explicitNoOnline = /sem online(?: obrigatorio)?|sem trofeus online|nao ha (?:trofeus )?(?:exigencia )?online|nao exige online|nao ha requisito online|nao ha multiplayer obrigatorio|nao ha trofeus exclusivamente online/.test(text);
  if (!explicitNoOnline) return false;
  return !(/(?<!nao )exige online/.test(text)
    || /(trofeus online confirmados|exige ps\+|servidor obrigatorio|online\/multiplayer|pvp obrigatorio|daily challenge|depende de conexao|depende de rede)/.test(text));
}

function hasExplicitNoMissables(game = {}) {
  if (sharedEditorialModel.getEditorialTrustStatus(game) === 'needs_missables_check') return false;
  const text = getSeoGameText(game, ['missable_summary', 'missable']);
  if (!text || hasUncertainEditorialText(text)) return false;
  if (Number(game?.missable_count || 0) > 0) return false;
  return /sem (?:trofeus )?perdiveis|nao ha (?:trofeus )?perdiveis|0 perdiveis definitivos|sem perdivel permanente|sem perda permanente|nao ha perda permanente|nada e perdivel|nenhum trofeu .*perdivel/.test(text);
}

function hasCoopRequiredForSeo(game = {}) {
  const text = getSeoGameText(game, ['online_summary', 'guide_online', 'online', 'before_you_start']);
  return /exige 2 jogadores|2 jogadores do inicio ao fim|dois jogadores|nao e solo|nao pode ser platinado solo|coop obrigatorio|co-op obrigatorio|segundo jogador|dupla/.test(text);
}

function isBeginnerFriendlyGame(game = {}) {
  return hasKnownDifficulty(game, 1, 3)
    && hasReliableMaxTimeAtMost(game, 30)
    && hasExplicitNoOnline(game)
    && !hasCoopRequiredForSeo(game)
    && Number(game?.missable_count || 0) <= 1
    && Number(game?.roadmap_count || 0) >= 5;
}

function getOrganicSortTime(game = {}) {
  const maxHours = getReliableMaxTime(game);
  if (Number.isFinite(maxHours)) return maxHours;
  const sortHours = Number(game?.time_sort_hours);
  return Number.isFinite(sortHours) && sortHours > 0 ? sortHours : Number.MAX_SAFE_INTEGER;
}

function getOrganicVerifiedScore(game = {}) {
  if (game?.is_verified || game?.verification_status === 'verified') return 0;
  if (game?.verification_status === 'review' || game?.editorial_status === 'review' || game?.coverage_level === 'strong') return 1;
  return 2;
}

function compareOrganicByDifficultyThenTime(a = {}, b = {}) {
  return (Number(a?.difficulty || 99) - Number(b?.difficulty || 99))
    || (getOrganicSortTime(a) - getOrganicSortTime(b))
    || String(a?.name || '').localeCompare(String(b?.name || ''), 'pt-BR');
}

function compareOrganicByTimeThenDifficulty(a = {}, b = {}) {
  return (getOrganicSortTime(a) - getOrganicSortTime(b))
    || (Number(a?.difficulty || 99) - Number(b?.difficulty || 99))
    || String(a?.name || '').localeCompare(String(b?.name || ''), 'pt-BR');
}

function compareOrganicBeginner(a = {}, b = {}) {
  return (getOrganicVerifiedScore(a) - getOrganicVerifiedScore(b))
    || (Number(a?.missable_count || 0) - Number(b?.missable_count || 0))
    || compareOrganicByDifficultyThenTime(a, b);
}


function buildEditorialSignals(game, viewModel) {
  return sharedGuideViewModel.buildEditorialSignals(game, viewModel);
}


function buildContextualFaq(game = {}, viewModel = {}) {
  return sharedGuideViewModel.buildContextualFaq(game, viewModel);
}

function buildGuidePlayerFit(game = {}, viewModel = {}) {
  return sharedGuideViewModel.buildGuidePlayerFit(game, viewModel);
}

function buildGuideFaqStructuredData(canonicalUrl, viewModel) {
  const faqItems = Array.isArray(viewModel?.contextualFaq) ? viewModel.contextualFaq : [];
  if (!faqItems.length) return [];
  return [{
    '@type': 'FAQPage',
    url: canonicalUrl,
    mainEntity: faqItems.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer
      }
    }))
  }];
}

function renderGuideEditorialNotesHtml(game = {}, viewModel = {}) {
  const routeTrophies = Array.isArray(viewModel.routeChangingTrophies) ? viewModel.routeChangingTrophies.slice(0, 5) : [];
  const normalizedSlug = String(game?.slug || '').trim().toLowerCase();
  const faqLimit = ['nioh-3', 'saros', 'the-last-of-us-part-ii'].includes(normalizedSlug) ? 11 : (['the-last-of-us-part-i', 'subnautica'].includes(normalizedSlug) ? 10 : (['god-of-war-ragnarok', 'resident-evil-2-remake', 'resident-evil-3-remake'].includes(normalizedSlug) ? 8 : 6));
  const faqItems = Array.isArray(viewModel.contextualFaq) ? viewModel.contextualFaq.slice(0, faqLimit) : [];
  const playerFit = viewModel.playerFit || buildGuidePlayerFit(game, viewModel);
  const methodItems = Array.isArray(viewModel.editorial?.methodItems) ? viewModel.editorial.methodItems : [];
  const statusBadge = viewModel.editorial?.statusBadge || getEditorialBadge(game);
  const sectionCopy = normalizedSlug === 'the-last-of-us-part-ii'
    ? 'Respostas rápidas sobre perdíveis, online, coop, tempo, dificuldade, NG+, Chapter Select e extras fora da platina base.'
    : ['resident-evil-requiem', 'resident-evil-4-remake', 'hades', 'ghost-of-tsushima', 'god-of-war', 'god-of-war-2018', 'hades-ii', 'astro-bot', 'pragmata', 'saros', 'nioh-2', 'nioh-3', 'the-last-of-us-part-i'].includes(normalizedSlug)
      ? 'Respostas rápidas sobre perdíveis, online, coop, tempo, dificuldade e DLC da lista base.'
      : 'Respostas rápidas sobre perdíveis, online, coop, tempo, dificuldade e DLC da platina base.';
  return `
    <section id="guideEditorialNotesPanel" class="atlas-panel atlas-panel--editorial atlas-editorial-notes p-5 md:p-6">
      <div class="atlas-section-head atlas-section-head--compact">
        <div>
          <span class="atlas-section-kicker">Notas editoriais</span>
          <h2 class="text-xl md:text-2xl font-extrabold tracking-tight mt-2">Perguntas frequentes</h2>
          <p class="text-white/58 mt-2 max-w-4xl">${escapeHtml(sectionCopy)}</p>
        </div>
        <span class="atlas-tag atlas-tag--soft">${escapeHtml(statusBadge.label || 'Notas de apoio')}</span>
      </div>
        <div class="atlas-editorial-notes__grid">
          <details class="atlas-editorial-note" open>
            <summary><span>Pontos de atenção</span><small>${escapeHtml(String(routeTrophies.length || 0))}</small></summary>
            <div class="atlas-editorial-notes__column">
            <p class="atlas-muted-copy">Riscos, spoilers, runs condicionais e objetivos que merecem acompanhamento durante a platina.</p>
            ${routeTrophies.length ? routeTrophies.map(item => {
              const badge = Array.isArray(item.tags) && item.tags.length ? item.tags[0] : null;
              return `<article class="atlas-critical-row"><div><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.text)}</p></div><span class="atlas-badge atlas-badge--${escapeHtml(badge?.tone || 'neutral')}">${escapeHtml(badge?.label || item.type)}</span></article>`;
            }).join('') : '<p class="atlas-muted-copy">Nenhum troféu com risco editorial alto foi detectado nos dados atuais.</p>'}
            </div>
          </details>
          <details class="atlas-editorial-note atlas-editorial-note--quiet">
            <summary><span>Confiança editorial</span><small>Metodologia</small></summary>
            <div class="atlas-editorial-notes__column atlas-editorial-notes__column--quiet">
            <strong>${escapeHtml(viewModel.snapshot.confidence.label)}</strong>
            <p>${escapeHtml(viewModel.snapshot.confidence.detail)}</p>
            <p>${escapeHtml(playerFit.fit[0] || 'Para quem quer validar custo, risco e ordem antes de começar.')}</p>
            <p>${escapeHtml(methodItems[0] || viewModel.editorial.methodSummary)}</p>
            </div>
          </details>
          <details class="atlas-editorial-note">
            <summary><span>FAQ</span><small>${escapeHtml(String(faqItems.length || 0))}</small></summary>
            <div class="atlas-editorial-notes__column">
            <div class="atlas-faq-list">
              ${faqItems.map(item => `<article class="atlas-faq-item atlas-faq-row"><strong>${escapeHtml(item.question)}</strong><p>${escapeHtml(item.answer)}</p></article>`).join('')}
            </div>
            </div>
          </details>
        </div>
    </section>`;
}

function buildRelatedGamesServer(currentGame, pool = [], limit = 4) {
  return sharedCardModel.buildRelatedGames(currentGame, pool, limit);
}

function buildGuideComparisonModelServer(currentGame, relatedGames = []) {
  return sharedCardModel.buildGuideComparisonModel(currentGame, relatedGames);
}

function getRelatedGuideImageValue(value = '') {
  const image = String(value || '').trim();
  return image && !sharedCardModel.isPlaceholderGameImage(image) ? image : '';
}

function getRelatedGuideImageModel(game = {}) {
  const cover = getRelatedGuideImageValue(game?.cover_image);
  const banner = getRelatedGuideImageValue(game?.image);
  const derivedCover = cover ? '' : getRelatedGuideImageValue(sharedCardModel.deriveSteamLibraryCover(banner));
  const primary = cover || derivedCover || banner;
  const fallback = primary && banner && primary !== banner ? banner : '';
  const mode = cover || derivedCover ? 'poster' : banner ? 'banner' : 'fallback';
  return { primary, fallback, mode };
}

function renderRelatedGuideThumbHtml(game = {}) {
  const imageModel = getRelatedGuideImageModel(game);
  const fallbackAttr = imageModel.fallback ? ` data-fallback-src="${escapeHtml(imageModel.fallback)}"` : '';
  const image = imageModel.primary
    ? `<img src="${escapeHtml(imageModel.primary)}"${fallbackAttr} alt="" aria-hidden="true" loading="lazy" decoding="async" onerror="if(this.dataset.fallbackSrc&&!this.dataset.fallbackUsed){this.dataset.fallbackUsed='true';this.src=this.dataset.fallbackSrc;this.parentElement.classList.remove('atlas-related-guide-card__thumb--poster');this.parentElement.classList.add('atlas-related-guide-card__thumb--banner');return;}this.hidden=true;this.parentElement.classList.add('atlas-related-guide-card__thumb--fallback-visible');">`
    : '';
  return `
        <div class="atlas-related-guide-card__thumb atlas-related-guide-card__thumb--${escapeHtml(imageModel.mode)}${imageModel.primary ? '' : ' atlas-related-guide-card__thumb--fallback-visible'}">
          <span aria-hidden="true"></span>
          ${image}
        </div>`;
}

function renderGuideRelatedCardsServer(relatedGames = []) {
  if (!Array.isArray(relatedGames) || !relatedGames.length) {
    return '';
  }

  return relatedGames.map(item => {
    const card = sharedCardModel.buildCompactGuideCardModel(item);
      const game = card.game || item?.game || item;
      const slug = escapeHtml(card.slug || '');
      const hasImage = true;
      return `
      <article class="atlas-card atlas-card--game atlas-card--compact atlas-related-guide-card${hasImage ? ' atlas-related-guide-card--with-thumb' : ''}" data-difficulty-tone="${escapeHtml(card.difficultyTone)}" data-risk="${card.hasRisk ? 'missable' : 'none'}">
        ${renderRelatedGuideThumbHtml(game)}
        <div class="atlas-card__body">
          <h3 class="atlas-card__title">${escapeHtml(card.name)}</h3>
          <p class="atlas-card__reason">${escapeHtml(card.shortReason)}</p>
          <div class="atlas-card__meta">
            <span class="atlas-meta-signal ${escapeHtml(card.difficultyClass)}"><i class="fas fa-gauge-high"></i>${escapeHtml(card.difficulty)}/10</span>
            <span class="atlas-meta-signal atlas-meta-signal--time"><i class="fas fa-clock"></i>${escapeHtml(card.time)}</span>
          </div>
          <div class="atlas-card__actions">
            <a href="/jogo/${slug}" class="atlas-btn atlas-btn-primary atlas-btn-compact" data-home-game="${escapeHtml(game?.name || '')}" data-open-guide-card="${slug}">Abrir guia</a>
          </div>
        </div>
      </article>`;
    }).join('');
}

function renderGuideRelatedOverviewServer(game, relatedGames = []) {
  if (!Array.isArray(relatedGames) || !relatedGames.length) return '';
  return `<section class="atlas-related-suggestions md:col-span-2 space-y-4"><div class="atlas-decision-panel__header"><div><span class="atlas-section-kicker">Jogos relacionados</span><h2 class="text-lg md:text-xl font-extrabold mt-2">Guias parecidos para manter o ritmo</h2></div><span class="atlas-tag atlas-tag--soft">Descoberta</span></div><div class="atlas-related-suggestions__grid">${renderGuideRelatedCardsServer(relatedGames)}</div></section>`;
}

function buildGuideViewModel(game, completedSource = [], options = {}) {
  return sharedGuideViewModel.buildGuideViewModel(game, completedSource, {
    ...options,
    classifyGameCollections
  });
}

function getGuideRoadmapCount(game = {}, viewModel = {}) {
  return sharedEditorialModel.getGuideRoadmapCount(game, viewModel);
}

function buildGuideHeroStats(game = {}, viewModel = {}) {
  const quickDecision = typeof sharedGuideViewModel.buildGuideQuickDecisionModel === 'function'
    ? sharedGuideViewModel.buildGuideQuickDecisionModel(game, viewModel)
    : null;
  if (quickDecision?.cards?.length) {
    const labels = {
      time: 'Tempo',
      difficulty: 'Dificuldade',
      missables: 'Perdíveis',
      online: 'Online',
      coop: 'Coop',
      dlc: 'DLC'
    };
    return ['time', 'difficulty', 'missables', 'online', 'coop', 'dlc']
      .map(id => quickDecision.cards.find(card => card?.id === id))
      .filter(Boolean)
      .map(card => ({
        ...card,
        label: labels[card.id] || card.label,
          value: card.id === 'dlc' && String(game?.slug || '').trim().toLowerCase() === 'god-of-war-ragnarok'
            ? 'Valhalla fora da platina base'
            : card.id === 'dlc' && String(game?.slug || '').trim().toLowerCase() === 'the-last-of-us-part-ii'
            ? 'Extras fora da platina base'
            : card.id === 'dlc' && ['resident-evil-requiem', 'resident-evil-4-remake', 'hades', 'ghost-of-tsushima', 'god-of-war', 'god-of-war-2018', 'hades-ii', 'astro-bot', 'pragmata', 'saros', 'nioh-2', 'nioh-3'].includes(String(game?.slug || '').trim().toLowerCase())
            ? 'DLC fora da platina base'
            : card.id === 'coop' && /2 jogadores/i.test(String(card.detail || ''))
            ? '2 jogadores obrigatórios'
            : card.id === 'dlc' && /iceborne/i.test(`${card.value || ''} ${card.detail || ''}`)
              ? 'Base game sem Iceborne'
              : card.id === 'dlc' && /shadow of the erdtree|fora da platina base|out_of_base_scope/i.test(`${card.value || ''} ${card.detail || ''} ${game?.dlc_status || ''}`)
                ? 'DLC fora da platina base'
                : card.id === 'dlc' && /sem dlcs?|base game|não necessária|nao necessaria/i.test(`${card.value || ''} ${card.detail || ''}`)
                ? 'Base game sem DLCs'
                : card.value
        }));
  }
  if (typeof sharedGuideViewModel.buildGuideSummaryCards === 'function') {
    const cards = sharedGuideViewModel.buildGuideSummaryCards(game, viewModel);
    const compactLabels = new Set(['Tempo estimado', 'Tempo', 'Dificuldade', 'Perdíveis', 'Online', 'Coop', 'DLC']);
    const compactCards = cards.filter(item => compactLabels.has(item.label));
    if (compactCards.length) return compactCards.slice(0, 6);
    const essentials = new Set(['Tempo estimado', 'Tempo', 'Dificuldade', 'Perdíveis', 'Online', 'Coop', 'DLC']);
    return sharedGuideViewModel.buildGuideSummaryCards(game, viewModel).filter(item => essentials.has(item.label)).slice(0, 4);
  }
  return sharedEditorialModel.buildGuideHeroStats(game, viewModel);
}

function formatGuideReviewDate(value = '') {
  const text = String(value || '').trim();
  if (!text) return '';
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : text;
}

function renderEditorialTrustHtml(game = {}, viewModel = {}) {
  const badge = viewModel.editorial?.statusBadge || sharedEditorialModel.getEditorialTrustBadge(game);
  const reviewedAt = badge.lastReviewedAt || viewModel.editorial?.lastReviewedAt || game.last_reviewed_at || game.lastReviewedAt || '';
  const reviewedLabel = formatGuideReviewDate(reviewedAt);
  const isRequiem = String(game?.slug || '').trim().toLowerCase() === 'resident-evil-requiem';
  const detail = isRequiem
    ? sharedEditorialModel.getEditorialStatusMessage(game, badge)
    : (badge.detail || 'Este guia ainda está passando por revisão editorial.');
  const warnings = isRequiem ? [] : (Array.isArray(viewModel.editorial?.qualityWarnings) ? viewModel.editorial.qualityWarnings : (badge.qualityWarnings || []));
  return `
    <div class="atlas-editorial-trust">
      <div class="atlas-editorial-trust__row">
        <span class="atlas-editorial-badge atlas-editorial-badge--${escapeHtml(badge.status || badge.badge || badge.tone || 'in_review')}" title="${escapeHtml(detail)}"><i class="fas fa-clipboard-check" aria-hidden="true"></i>${escapeHtml(badge.label || 'Em revisão')}</span>
        ${reviewedLabel ? `<span class="atlas-editorial-trust__date">Revisado em ${escapeHtml(reviewedLabel)}</span>` : ''}
      </div>
      <p class="${badge.critical ? 'atlas-editorial-alert' : 'atlas-editorial-trust__copy'}">${escapeHtml(detail)}</p>
      ${warnings.length ? `<ul class="atlas-editorial-warning-list">${warnings.slice(0, 3).map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
    </div>`;
}

function getGuideCoverModel(game = {}, viewModel = {}) {
  const fallbackImage = sharedCardModel.getGameCoverImage(game) || viewModel.image || '';
  return viewModel.guideCover || {
    image: fallbackImage,
    backdropImage: game?.image || '',
    mode: fallbackImage ? 'poster' : 'fallback',
    className: fallbackImage ? 'atlas-guide-cover--poster' : 'atlas-guide-cover--fallback',
    alt: `Capa de ${game?.name || 'Jogo'}`
  };
}

function renderGuideHeroCoverHtml(game = {}, viewModel = {}) {
  const cover = getGuideCoverModel(game, viewModel);
  const title = game?.name || 'Jogo';
  const image = cover.image || '';
  const backdrop = cover.backdropImage && cover.mode === 'banner'
    ? `<img class="atlas-guide-cover__backdrop" src="${escapeHtml(cover.backdropImage)}" alt="" aria-hidden="true" loading="eager" decoding="async">`
    : '';
  const fallbackVisible = image ? '' : ' atlas-guide-cover--fallback-visible';
  return `
    <div class="atlas-guide-cover atlas-guide-cover--hero ${escapeHtml(cover.className || '')}${fallbackVisible}">
      <span class="atlas-guide-cover__fallback" aria-hidden="true">${escapeHtml(title)}</span>
      ${backdrop}
      ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(cover.alt || `Capa de ${title}`)}" class="atlas-guide-cover__image" loading="eager" decoding="sync" fetchpriority="high" width="600" height="900" sizes="(min-width: 1280px) 180px, (min-width: 768px) 104px, 88px" onerror="this.hidden=true;this.parentElement.classList.add('atlas-guide-cover--fallback-visible');var backdrop=this.parentElement.querySelector('.atlas-guide-cover__backdrop');if(backdrop)backdrop.setAttribute('hidden','hidden');">` : ''}
    </div>
  `;
}

function renderGuideHeaderHtml(game, viewModel) {
  const guideEyebrow = 'Resumo rápido do guia';
  const verdict = buildThirtySecondVerdict(game, viewModel);
  const heroStats = buildGuideHeroStats(game, viewModel);
  const nextAction = viewModel.nextActionModel || {};
  const scopeModel = viewModel.scopeModel || {};
  return `
    <section class="atlas-panel atlas-panel--primary atlas-guide-hero p-5 md:p-6">
      <div class="atlas-guide-hero__layout">
        ${renderGuideHeroCoverHtml(game, viewModel)}
        <div class="atlas-guide-hero__body">
          <div class="atlas-guide-hero__kicker">
            <span>${escapeHtml(guideEyebrow)}</span>
          </div>
          <h1>${escapeHtml(buildGameGuideH1(game))}</h1>
          ${renderEditorialTrustHtml(game, viewModel)}
          <p class="atlas-guide-hero__subtitle">${escapeHtml(scopeModel.subtitle || 'Guia de troféus e roadmap da platina')}</p>
          <p class="atlas-guide-hero__summary" hidden>${escapeHtml(verdict.summary || viewModel.decisionModel.verdictDetail)}</p>
          <div class="atlas-guide-start-card">
            <div>
              <span>Primeiro passo recomendado</span>
              <strong>${escapeHtml(nextAction.title || 'Abrir roadmap')}</strong>
              <p>${escapeHtml(nextAction.detail || 'Use o roadmap para entender a ordem antes de marcar troféus soltos.')}</p>
            </div>
          </div>
          <div class="atlas-guide-hero__facts">
            ${heroStats.map(item => `<span class="atlas-meta-signal ${escapeHtml(item.tone || 'atlas-meta-signal--partial')}" title="${escapeHtml(item.detail || '')}"><i class="fas ${escapeHtml(item.icon)}"></i><small>${escapeHtml(item.label)}</small><strong>${escapeHtml(item.value)}</strong></span>`).join('')}
          </div>
          <div class="atlas-guide-hero__actions">
            <button type="button" class="atlas-btn atlas-btn-primary" data-guide-action="roadmap"><i class="fas fa-route"></i> Roadmap</button>
            <button type="button" class="atlas-btn atlas-btn-secondary" data-guide-action="trophies"><i class="fas fa-list-check"></i> Checklist</button>
          </div>
        </div>
      </div>
    </section>`;
}

function renderGuideSidebarHtml(game, viewModel, options = {}) {
  const isSaved = Boolean(options?.isSaved || viewModel?.isSaved);
  const nextAction = viewModel.nextActionModel || buildGuideNextActionModel(game, viewModel);
  const libraryEntry = options?.libraryEntry || viewModel?.libraryEntry || null;
  const libraryLabel = isSaved ? `Na biblioteca • ${escapeHtml(libraryEntry?.status || 'salvo')}` : 'Ainda não salvo';
  const progressAccent = viewModel.progress >= 100 ? 'done' : (viewModel.progress >= 35 ? 'neutral' : 'partial');
  const momentumLabel = viewModel.progress ? `${viewModel.progress}% concluído` : 'Novo projeto';
  const guidanceCounts = viewModel.guidanceCounts || {};
  const criticalAlertsCount = Number(guidanceCounts.criticalAlertsCount ?? viewModel.criticalAlertsCount ?? 0);
  const checklistTipsCount = Number(guidanceCounts.checklistTipsCount ?? viewModel.checklistTipsCount ?? 0);
  const totalGuidanceCount = Number(guidanceCounts.totalGuidanceCount ?? viewModel.totalGuidanceCount ?? viewModel.riskCounts?.alertCount ?? 0);
  const guidanceCounterHtml = criticalAlertsCount > 0 && checklistTipsCount > 0
    ? `<span class="atlas-sidebar-counts__risk">${escapeHtml(String(criticalAlertsCount))} alertas críticos</span><span class="atlas-sidebar-counts__pending">${escapeHtml(String(checklistTipsCount))} dicas</span>`
    : `<span class="atlas-sidebar-counts__risk">${escapeHtml(String(totalGuidanceCount))} dicas e alertas</span>`;
  return `
    <section class="atlas-panel atlas-panel--section atlas-guide-sidebar-card p-5">
      <div class="atlas-guide-sidebar-card__top">
        <div>
          <div class="atlas-eyebrow">Progresso</div>
          <strong id="guideProgressLabel" data-guide-progress-label>${viewModel.progress}%</strong>
        </div>
        <span class="atlas-badge atlas-badge--${escapeHtml(progressAccent)}">${escapeHtml(momentumLabel)}</span>
      </div>
      <div class="atlas-sidebar-progress" aria-hidden="true">
        <span id="guideProgressBar" data-guide-progress-bar style="width: ${escapeHtml(String(viewModel.progress))}%"></span>
      </div>
      <div class="atlas-sidebar-counts">
        <span class="atlas-sidebar-counts__complete"><strong id="guideCompletedCount" data-guide-completed-count>${escapeHtml(String(viewModel.completed))}</strong> concluídos</span>
        <span class="atlas-sidebar-counts__pending"><strong id="guideRemainingCount" data-guide-remaining-count>${escapeHtml(String(viewModel.pending))}</strong> pendentes</span>
        ${guidanceCounterHtml}
      </div>
      <div class="atlas-sidebar-next">
        <div class="atlas-eyebrow">Próximo passo</div>
        <strong>${escapeHtml(nextAction.title || 'Abrir checklist')}</strong>
        <p>${escapeHtml(nextAction.detail || 'Use a lista principal para continuar sem perder contexto.')}</p>
        <button type="button" class="atlas-btn atlas-btn-primary atlas-btn-compact" data-guide-action="${escapeHtml(nextAction.focus || 'trophies')}">${escapeHtml(nextAction.cta || 'Continuar')}</button>
      </div>
      <div class="atlas-sidebar-actions">
        <div class="text-xs text-white/45">${libraryLabel}</div>
        <button type="button" class="atlas-btn ${isSaved ? 'atlas-btn-secondary atlas-btn-muted-action' : 'atlas-btn-primary'} atlas-btn-compact" data-toggle-save-game="true">${isSaved ? 'Remover da biblioteca' : 'Salvar na biblioteca'}</button>
        <button type="button" class="atlas-btn atlas-btn-secondary atlas-btn-compact" data-copy-game-link="${escapeHtml(game?.slug || '')}">Copiar link</button>
      </div>
    </section>`;
}

function renderGuideRoadmapTimelineHtml(roadmapStages = []) {
  if (!roadmapStages.length) return '<div class="atlas-inline-empty">Sem roadmap cadastrado.</div>';
  return `
    <ol class="atlas-roadmap-timeline">
      ${roadmapStages.map(stage => {
        const category = stage.category || { id: 'plan', label: 'Plano', icon: 'fa-route' };
        const actions = Array.isArray(stage.actions) && stage.actions.length
          ? stage.actions.slice(0, 5)
          : splitGuideRoadmapActions(stage.description || stage.objective).slice(0, 3);
        const focusLabel = stage.focus || (!stage.isStructured ? category.label : '');
        const primaryText = stage.objective || stage.description;
        const showObjectiveMeta = !stage.isStructured && stage.objective && String(stage.objective).trim() !== String(primaryText || '').trim();
        const metaItems = stage.isStructured
          ? [
              stage.warning ? `<span><strong>Alerta</strong>${escapeHtml(stage.warning)}</span>` : '',
              stage.note ? `<span><strong>Observação</strong>${escapeHtml(stage.note)}</span>` : '',
              stage.result ? `<span><strong>Resultado</strong>${escapeHtml(stage.result)}</span>` : ''
            ].filter(Boolean)
          : [
              showObjectiveMeta ? `<span><strong>Objetivo</strong>${escapeHtml(stage.objective)}</span>` : '',
              stage.risk ? `<span><strong>Risco</strong>${escapeHtml(stage.risk)}</span>` : '',
              stage.relatedTrophies?.length ? `<span><strong>Troféus relacionados</strong>${stage.relatedTrophies.map(escapeHtml).join(' / ')}</span>` : ''
            ].filter(Boolean);
        return `
        <li class="atlas-roadmap-step atlas-roadmap-step--${escapeHtml(category.id || 'plan')}${Number(stage.number) === 1 ? ' atlas-roadmap-step--first' : ''}">
          <div class="atlas-roadmap-step__marker">${escapeHtml(String(stage.number))}</div>
          <article class="atlas-roadmap-step__body">
            <div class="atlas-roadmap-step__head">
              <div>
                <h3>${escapeHtml(stage.title)}</h3>
              </div>
              ${focusLabel ? `<span class="atlas-roadmap-step__category atlas-roadmap-step__category--${escapeHtml(category.id || 'plan')}"><i class="fas ${escapeHtml(category.icon || 'fa-route')}" aria-hidden="true"></i>${escapeHtml(focusLabel)}</span>` : ''}
            </div>
            <p>${escapeHtml(primaryText)}</p>
            ${actions.length ? `<ul class="atlas-roadmap-step__actions">${actions.map(action => `<li>${escapeHtml(action)}</li>`).join('')}</ul>` : ''}
            ${metaItems.length ? `<div class="atlas-roadmap-step__meta">${metaItems.join('')}</div>` : ''}
          </article>
        </li>
      `;
      }).join('')}
    </ol>`;
}

function splitGuideRoadmapActions(value = '') {
  return String(value || '')
    .split(/(?:[.;]\s+|\n+|,\s+(?=e |depois|entao|então|antes|sem |com |use |faça |faca ))/i)
    .map(item => item.trim().replace(/^[-•]\s*/, ''))
    .filter(item => item.length > 18)
    .map(item => item.length > 120 ? `${item.slice(0, 117).trim()}...` : item);
}

function renderGuideInternalNavHtml() {
  const items = [
    { action: 'header', href: '#guideHeader', icon: 'fa-compass', label: 'Resumo' },
    { action: 'roadmap', href: '#guideRoadmapPanel', icon: 'fa-route', label: 'Roadmap' },
    { action: 'trophies', href: '#guideChecklistPanel', icon: 'fa-list-check', label: 'Checklist' },
    { action: 'risks', href: '#guideRiskSummaryPanel', icon: 'fa-triangle-exclamation', label: 'Alertas' },
    { action: 'related', href: '#guideRelatedPanel', icon: 'fa-layer-group', label: 'Relacionados' }
  ];
  return `
    <nav id="guideInternalNav" class="atlas-guide-nav" aria-label="Navegação interna do guia">
      ${items.map(item => `<a class="atlas-guide-nav__link" href="${escapeHtml(item.href)}" data-guide-action="${escapeHtml(item.action)}"><i class="fas ${escapeHtml(item.icon)}" aria-hidden="true"></i><span>${escapeHtml(item.label)}</span></a>`).join('')}
    </nav>`;
}

function renderGuideRoadmapPanelHtml(viewModel = {}) {
  const roadmapStages = Array.isArray(viewModel.roadmapStages) ? viewModel.roadmapStages : [];
  return `
    <section id="guideRoadmapPanel" class="atlas-panel atlas-panel--section atlas-roadmap-panel p-5 md:p-6">
      <div class="atlas-section-head atlas-section-head--compact">
        <div>
          <div class="atlas-eyebrow">Roadmap da platina</div>
          <h2 class="text-2xl md:text-3xl font-extrabold tracking-tight mt-2">Roadmap</h2>
          <p class="text-white/58 mt-2 max-w-4xl">Comece por estas etapas antes de mergulhar na lista completa. A ordem ajuda a reduzir retrabalho, evitar perdas e deixar o cleanup para o momento certo.</p>
        </div>
        <button type="button" class="atlas-section-toggle" data-guide-section-toggle="guideRoadmapBody" data-expanded-label="Ocultar roadmap" data-collapsed-label="Mostrar roadmap" aria-expanded="true" aria-controls="guideRoadmapBody"><span data-toggle-label>Ocultar roadmap</span><i class="fas fa-chevron-up" aria-hidden="true"></i></button>
      </div>
      <div id="guideRoadmapBody" data-guide-section-content>
        ${renderGuideRoadmapTimelineHtml(roadmapStages)}
      </div>
    </section>`;
}

function renderGuideRiskAlertsPanelHtml(game = {}, viewModel = {}) {
  const alerts = typeof sharedGuideViewModel.buildGuideRiskAlerts === 'function'
    ? sharedGuideViewModel.buildGuideRiskAlerts(game, viewModel)
    : [];
  const beforeItems = Array.isArray(viewModel.beforeStartItems) && viewModel.beforeStartItems.length
    ? viewModel.beforeStartItems
    : (typeof sharedGuideViewModel.buildGuideBeforeStartItems === 'function' ? sharedGuideViewModel.buildGuideBeforeStartItems(game, viewModel) : []);
  if (!alerts.length && !beforeItems.length) return '';
  return `
    <section id="guideRiskSummaryPanel" class="atlas-panel atlas-panel--section atlas-guide-risk-summary p-5 md:p-6">
      <div class="atlas-section-head atlas-section-head--compact">
        <div>
          <div class="atlas-eyebrow">Leia antes de começar</div>
          <h2 class="text-xl md:text-2xl font-extrabold tracking-tight mt-2">Alertas que mudam a rota da platina</h2>
          <p class="text-white/58 mt-2 max-w-4xl">Confirme estes sinais antes da primeira sessão. Eles dizem se você deve priorizar roadmap, online, grind, NG+ ou cleanup antes de abrir a lista completa.</p>
        </div>
        <span class="atlas-tag atlas-tag--soft">${escapeHtml(String(beforeItems.length || alerts.length))} sinal(is)</span>
      </div>
      ${beforeItems.length ? `<div class="atlas-guide-before-grid">
        ${beforeItems.map(item => `
          <article class="atlas-guide-before-card atlas-guide-before-card--${escapeHtml(item.tone || 'neutral')}">
            <i class="fas ${escapeHtml(item.icon || 'fa-circle-info')}" aria-hidden="true"></i>
            <div>
              <span>${escapeHtml(item.label || 'Sinal')}</span>
              <strong>${escapeHtml(item.title || 'Revise antes de começar')}</strong>
              <p>${escapeHtml(item.detail || '')}</p>
            </div>
          </article>
        `).join('')}
      </div>` : ''}
      ${alerts.length ? `
      <div class="atlas-guide-risk-subhead">
        <span>Alertas detalhados</span>
      </div>
      <div class="atlas-guide-risk-grid">
        ${alerts.map(alert => `
          <article class="atlas-guide-risk-card atlas-guide-risk-card--${escapeHtml(alert.tone || 'neutral')}">
            <i class="fas ${escapeHtml(alert.icon || 'fa-circle-info')}" aria-hidden="true"></i>
            <div>
              <span>${escapeHtml(alert.label || 'Alerta')}</span>
              <strong>${escapeHtml(alert.title || 'Revise este ponto.')}</strong>
              <p>${escapeHtml(alert.detail || '')}</p>
            </div>
          </article>
        `).join('')}
      </div>
      ` : ''}
    </section>`;
}

function renderGuideDecisionStackHtml(game, viewModel) {
  const verdict = buildThirtySecondVerdict(game, viewModel);
  return `
    <section id="guideVerdictPanel" class="atlas-panel atlas-panel--primary atlas-editorial-band p-5 md:p-6">
      <div class="atlas-editorial-band__intro">
        <div>
          <div class="atlas-eyebrow">Veredito de 30 segundos</div>
          <h2>O custo da platina em leitura rápida</h2>
          <p>${escapeHtml(verdict.summary)}</p>
        </div>
        <button type="button" class="atlas-btn atlas-btn-primary atlas-btn-compact" data-guide-action="${escapeHtml(viewModel.nextActionModel?.focus === 'risks' ? 'risks' : 'trophies')}"><i class="fas ${escapeHtml(viewModel.nextActionModel?.focus === 'risks' ? 'fa-triangle-exclamation' : 'fa-list-check')}"></i> ${escapeHtml(viewModel.nextActionModel?.focus === 'risks' ? 'Ler alertas e roadmap' : 'Ir para checklist')}</button>
      </div>
      <div class="atlas-verdict-strip" aria-label="Resumo rápido da platina">
        ${verdict.cards.map(card => `<article class="atlas-verdict-strip__item ${escapeHtml(card.tone || '')}" title="${escapeHtml(card.detail || '')}"><span>${escapeHtml(card.label)}</span><strong>${escapeHtml(card.value)}</strong><p>${escapeHtml(card.detail)}</p></article>`).join('')}
      </div>
    </section>
    ${renderGuideRiskAlertsPanelHtml(game, viewModel)}
    ${renderGuideInternalNavHtml()}`;
}

function renderGuidePlatinumSummaryPanelHtml(game = {}, viewModel = {}) {
  const quickDecision = typeof sharedGuideViewModel.buildGuideQuickDecisionModel === 'function'
    ? sharedGuideViewModel.buildGuideQuickDecisionModel(game, viewModel)
    : null;
  const cards = quickDecision?.cards?.length
    ? quickDecision.cards
    : (typeof sharedGuideViewModel.buildGuideSummaryCards === 'function'
      ? sharedGuideViewModel.buildGuideSummaryCards(game, viewModel)
      : buildGuideHeroStats(game, viewModel));
  const decisionCards = cards.filter(card => ['missables', 'online', 'coop', 'dlc'].includes(card?.id)).slice(0, 4);
  const visibleCards = decisionCards.length ? decisionCards : cards.slice(0, 4);
  const firstAction = quickDecision?.firstAction || {
    label: 'Primeiro passo recomendado',
    title: viewModel.nextActionModel?.title || 'Comece pelo roadmap',
    detail: viewModel.nextActionModel?.detail || 'Abra o roadmap antes da checklist para entender a ordem da platina.',
    icon: 'fa-route',
    focus: 'roadmap'
  };
  return `
    <section id="guidePlatinumSummaryPanel" class="atlas-panel atlas-panel--section atlas-platinum-summary atlas-quick-decision p-5 md:p-6">
      <div class="atlas-section-head atlas-section-head--compact">
        <div>
          <div class="atlas-eyebrow">Decisão rápida</div>
          <h2 class="text-xl md:text-2xl font-extrabold tracking-tight mt-2">O que você precisa saber antes de começar essa platina</h2>
          <p class="text-white/58 mt-2 max-w-4xl">Tempo, dificuldade, perdíveis, online, coop, DLC e confiança editorial em uma leitura rápida.</p>
        </div>
      </div>
      <div class="atlas-platinum-summary__grid" aria-label="Resumo essencial da platina">
      ${visibleCards.map(card => `<article id="guideQuickCard-${escapeHtml(card.id || '')}" class="atlas-platinum-summary__card ${escapeHtml(card.tone || '')}" title="${escapeHtml(card.detail || '')}"><i class="fas ${escapeHtml(card.icon || 'fa-circle-info')}" aria-hidden="true"></i><div><span>${escapeHtml(card.label)}</span><strong>${escapeHtml(card.value)}</strong><p>${escapeHtml(card.detail || '')}</p></div></article>`).join('')}
      </div>
      <div class="atlas-quick-decision__actions">
        <article class="atlas-quick-decision-callout atlas-quick-decision-callout--action">
          <i class="fas ${escapeHtml(firstAction.icon || 'fa-route')}" aria-hidden="true"></i>
          <div>
            <span>${escapeHtml(firstAction.label || 'Primeiro passo recomendado')}</span>
            <strong>${escapeHtml(firstAction.title || 'Comece pelo roadmap')}</strong>
            <p>${escapeHtml(firstAction.detail || '')}</p>
            <button type="button" class="atlas-btn atlas-btn-primary atlas-btn-compact" data-guide-action="${escapeHtml(firstAction.focus || 'roadmap')}">Ir para este ponto</button>
          </div>
        </article>
      </div>
    </section>`;
}

function renderGuideShortcutsHtml(game = {}, viewModel = {}) {
  const items = typeof sharedGuideViewModel.buildGuideShortcutModel === 'function'
    ? sharedGuideViewModel.buildGuideShortcutModel(game, viewModel)
    : [];
  if (!items.length) return '';
  return `
    <nav id="guideShortcutPanel" class="atlas-guide-shortcuts atlas-panel atlas-panel--section" aria-label="Atalhos do guia">
      <div class="atlas-guide-shortcuts__head">
        <span class="atlas-eyebrow">Atalhos do guia</span>
        <p>Vá direto ao ponto sem reler a página inteira.</p>
      </div>
      <div class="atlas-guide-shortcuts__chips">
        ${items.map(item => `<a class="atlas-guide-shortcut" href="${escapeHtml(item.href)}" data-guide-action="${escapeHtml(item.action)}"><i class="fas ${escapeHtml(item.icon || 'fa-circle-info')}" aria-hidden="true"></i><span>${escapeHtml(item.label)}</span></a>`).join('')}
      </div>
    </nav>`;
}

function renderGuideStartContextPanelHtml(game = {}, viewModel = {}) {
  const model = typeof sharedGuideViewModel.buildGuideStartContextModel === 'function'
    ? sharedGuideViewModel.buildGuideStartContextModel(game, viewModel)
    : null;
  if (!model) return '';
  return `
    <section id="guideStartContextPanel" class="atlas-panel atlas-panel--section atlas-guide-start-context p-5 md:p-6">
      <div class="atlas-section-head atlas-section-head--compact">
        <div>
          <div class="atlas-eyebrow">${escapeHtml(model.title || 'Antes de começar')}</div>
          <h2 class="text-xl md:text-2xl font-extrabold tracking-tight mt-2">Plano geral antes do roadmap</h2>
          <p class="text-white/58 mt-2 max-w-4xl">${escapeHtml(model.detail || 'Use esta seção para entender o plano geral antes de seguir o roadmap.')}</p>
        </div>
      </div>
      <div class="atlas-guide-start-context__grid">
        ${(model.items || []).map(item => `
          <article class="atlas-guide-context-chip atlas-guide-context-chip--${escapeHtml(item.tone || 'neutral')}">
            <i class="fas ${escapeHtml(item.icon || 'fa-circle-info')}" aria-hidden="true"></i>
            <div>
              <span>${escapeHtml(item.label || 'Contexto')}</span>
              <p>${escapeHtml(item.text || '')}</p>
            </div>
          </article>
        `).join('')}
      </div>
    </section>`;
}

function renderGuideRiskAlertsPanelHtmlV2(game = {}, viewModel = {}) {
  const beforeItems = Array.isArray(viewModel.beforeStartItems) && viewModel.beforeStartItems.length
    ? viewModel.beforeStartItems
    : (typeof sharedGuideViewModel.buildGuideBeforeStartItems === 'function' ? sharedGuideViewModel.buildGuideBeforeStartItems(game, viewModel) : []);
  const items = beforeItems
    .filter(item => ['missable', 'online', 'coop', 'dlc'].includes(item?.id) && ['risk', 'warning'].includes(item?.tone))
    .slice(0, 4);
  if (!items.length) return '';
  return `
    <section id="guideRiskSummaryPanel" class="atlas-panel atlas-panel--section atlas-guide-risk-summary p-5 md:p-6">
      <div class="atlas-section-head atlas-section-head--compact">
        <div>
          <div class="atlas-eyebrow">Leia antes de começar</div>
          <h2 class="text-xl md:text-2xl font-extrabold tracking-tight mt-2">Alertas que mudam a rota da platina</h2>
          <p class="text-white/58 mt-2 max-w-4xl">No máximo cinco pontos de atenção antes do roadmap. Leia isso para evitar erro de ordem, DLC fora do escopo, coop esquecido ou cleanup mal planejado.</p>
        </div>
        <span class="atlas-tag atlas-tag--soft">${escapeHtml(String(items.length))} alerta(s)</span>
      </div>
      <div class="atlas-guide-before-grid">
        ${items.map(item => `
          <article class="atlas-guide-before-card atlas-guide-before-card--${escapeHtml(item.tone || 'neutral')}">
            <i class="fas ${escapeHtml(item.icon || 'fa-circle-info')}" aria-hidden="true"></i>
            <div>
              <span>${escapeHtml(item.label || 'Sinal')}</span>
              <strong>${escapeHtml(item.title || 'Revise antes de começar')}</strong>
              <p>${escapeHtml(item.detail || '')}</p>
            </div>
          </article>
        `).join('')}
      </div>
    </section>`;
}

function renderGuideLayerNavHtml() {
  const items = [
    { id: 'summary', icon: 'fa-bolt', label: 'Resumo', panel: 'summary' },
    { id: 'roadmap', icon: 'fa-route', label: 'Roadmap', panel: 'roadmap' },
    { id: 'checklist', icon: 'fa-list-check', label: 'Checklist', panel: 'checklist' },
    { id: 'details', icon: 'fa-circle-info', label: 'Detalhes', panel: 'details' }
  ];
  return `
    <nav id="guideLayerNav" class="atlas-guide-layer-nav" aria-label="Seções do guia">
      ${items.map((item, index) => `
        <button type="button" class="atlas-guide-layer-nav__button${index === 0 ? ' is-active' : ''}" data-guide-tab-button="${escapeHtml(item.id)}" data-guide-tab-target="${escapeHtml(item.panel)}" aria-pressed="${index === 0 ? 'true' : 'false'}">
          <i class="fas ${escapeHtml(item.icon)}" aria-hidden="true"></i>
          <span>${escapeHtml(item.label)}</span>
        </button>
      `).join('')}
    </nav>`;
}

function renderGuideSummaryPanelHtml(game = {}, viewModel = {}) {
  const nextAction = viewModel.nextActionModel || {};
  const normalizedSlug = String(game?.slug || '').trim().toLowerCase();
  const explicitEditorialParagraphs = Array.isArray(game?.editorial_summary)
    ? game.editorial_summary.map(paragraph => String(paragraph || '').trim()).filter(Boolean)
    : [];
  const editorialParagraphs = explicitEditorialParagraphs.length
    ? explicitEditorialParagraphs
    : normalizedSlug === 'resident-evil-requiem'
    ? REQUIEM_EDITORIAL_SUMMARY
    : normalizedSlug === 'hades'
    ? HADES_EDITORIAL_SUMMARY
    : normalizedSlug === 'ghost-of-tsushima'
    ? GHOST_EDITORIAL_SUMMARY
    : ['god-of-war', 'god-of-war-2018'].includes(normalizedSlug)
    ? GOD_OF_WAR_2018_EDITORIAL_SUMMARY
    : normalizedSlug === 'god-of-war-ragnarok'
    ? GOD_OF_WAR_RAGNAROK_EDITORIAL_SUMMARY
    : normalizedSlug === 'hades-ii'
    ? HADES2_EDITORIAL_SUMMARY
    : normalizedSlug === 'astro-bot'
    ? ASTRO_BOT_EDITORIAL_SUMMARY
    : normalizedSlug === 'pragmata'
    ? PRAGMATA_EDITORIAL_SUMMARY
    : normalizedSlug === 'saros'
    ? SAROS_EDITORIAL_SUMMARY
    : normalizedSlug === 'resident-evil-4-remake'
    ? RE4_REMAKE_EDITORIAL_SUMMARY
    : normalizedSlug === 'nioh-2'
    ? NIOH2_EDITORIAL_SUMMARY
    : normalizedSlug === 'nioh-3'
    ? NIOH3_EDITORIAL_SUMMARY
    : normalizedSlug === 'the-last-of-us-part-i'
    ? TLOU_PART_I_EDITORIAL_SUMMARY
    : normalizedSlug === 'the-last-of-us-part-ii'
    ? TLOU_PART_II_EDITORIAL_SUMMARY
    : normalizedSlug === 'elden-ring'
    ? [
        'Este guia de platina de Elden Ring foi pensado para quem quer completar a lista base sem depender apenas da lista crua de troféus. A rota prioriza finais, chefes com troféu, itens lendários e pontos que podem gerar retrabalho se você avançar sem planejamento.',
        'O maior cuidado está em Bolt of Gransax, que pode ficar indisponível após a mudança de Leyndell, nos finais mutuamente exclusivos por save e na quest da Fia para Lichdragon Fortissax. Com backup de save antes da decisão final, é possível reduzir bastante o número de runs; sem backup, será necessário planejar NG+ ou novas jogadas.',
        'Shadow of the Erdtree fica fora da platina base. Use primeiro o roadmap para organizar a rota e depois a checklist para acompanhar chefes, finais, lendários e cleanup.'
      ]
    : [];
  return `
    <section id="guideSummaryActions" class="atlas-panel atlas-panel--section atlas-guide-summary-actions p-5 md:p-6">
      <div>
        <div class="atlas-eyebrow">Plano rápido</div>
        <h2 class="text-xl md:text-2xl font-extrabold tracking-tight mt-2">Resumo da platina</h2>
        <p class="text-white/62 mt-2 max-w-3xl">${escapeHtml(nextAction.detail || 'Leia o resumo, abra o roadmap quando precisar da ordem completa e use a checklist para acompanhar progresso.')}</p>
        ${editorialParagraphs.length ? `<div class="atlas-guide-summary-editorial mt-4 space-y-3">${editorialParagraphs.map(paragraph => `<p class="text-white/72 max-w-4xl">${escapeHtml(paragraph)}</p>`).join('')}</div>` : ''}
      </div>
      <div class="atlas-guide-summary-actions__buttons">
        <button type="button" class="atlas-btn atlas-btn-primary" data-guide-action="roadmap"><i class="fas fa-route" aria-hidden="true"></i> Abrir roadmap</button>
        <button type="button" class="atlas-btn atlas-btn-secondary" data-guide-action="trophies"><i class="fas fa-list-check" aria-hidden="true"></i> Abrir checklist</button>
      </div>
    </section>`;
}

function renderGuideDecisionStackHtmlV2(game, viewModel) {
  return `
    ${renderGuideLayerNavHtml()}`;
}

function buildSsrGuideMarkup(game, relatedGames = []) {
  const viewModel = buildGuideViewModel(game, []);
  const header = renderGuideHeaderHtml(game, viewModel);
  const decisionStack = renderGuideDecisionStackHtmlV2(game, viewModel);
  const summary = renderGuideSummaryPanelHtml(game, viewModel);
  const roadmap = renderGuideRoadmapPanelHtml(viewModel);
  const sidebar = renderGuideSidebarHtml(game, viewModel);
  const trophyList = viewModel.trophies.length
    ? viewModel.trophies.map((trophy, index) => renderTrophyCardHtml(trophy, viewModel.completedIds, index, game)).join('')
    : '<div class="text-white/60">Nenhum troféu cadastrado.</div>';
  const editorialNotes = renderGuideEditorialNotesHtml(game, viewModel);
  const relatedOverview = renderGuideRelatedOverviewServer(game, relatedGames);

  return { header, decisionStack, summary, roadmap, sidebar, trophyList, editorialNotes, relatedOverview, viewModel };
}

function applyTemplateDefaults(template) {
  return template
    .replace(/__ANALYTICS_HEAD__/g, buildAnalyticsHeadHtml())
    .replace(/__ATLAS_APP_VERSION__/g, safeJsonForHtml(APP_VERSION))
    .replace(/__HOME_VIEW_CLASS__/g, '')
    .replace(/__CATALOG_VIEW_CLASS__/g, 'hidden')
    .replace(/__GUIDE_VIEW_CLASS__/g, 'hidden')
    .replace(/__GUIDE_CONTENT_CLASS__/g, 'hidden')
    .replace(/__GUIDE_PROGRESS_INITIAL__/g, '...')
    .replace(/__GUIDE_COUNTER_INITIAL__/g, 'Carregando checklist...')
    .replace(/__GUIDE_RESULTS_INITIAL__/g, 'Carregando checklist...')
    .replace(/__HOME_HERO_HEADING_TAG__/g, 'h1')
    .replace(/__CATALOG_HEADING_TAG__/g, 'h2')
    .replace(/__LIBRARY_HEADING_TAG__/g, 'h2')
    .replace(/__PROFILE_HEADING_TAG__/g, 'h2')
    .replace(/__CATALOG_BREADCRUMBS__/g, '')
    .replace(/__GUIDE_BREADCRUMBS__/g, '')
    .replace(/__GUIDE_COLLECTION_LINKS__/g, '')
    .replace(/__ROBOTS_META__/g, '')
    .replace(/__PAGE_OG_TYPE__/g, 'website')
    .replace(/__HAS_SSR_GAME__/g, 'false')
    .replace(/__SSR_GUIDE_HEADER__/g, '')
    .replace(/__SSR_GUIDE_DECISION_STACK__/g, '')
    .replace(/__SSR_GUIDE_SIDEBAR__/g, '')
    .replace(/__SSR_GUIDE_SUMMARY__/g, '')
    .replace(/__SSR_TROPHY_LIST__/g, '')
    .replace(/__SSR_GUIDE_ROADMAP__/g, '')
    .replace(/__SSR_GUIDE_EDITORIAL_NOTES__/g, '')
    .replace(/__GUIDE_RELATED_OVERVIEW__/g, '')
    .replace(/__CATALOG_TITLE__/g, 'Todos os jogos')
    .replace(/__CATALOG_SUMMARY__/g, '')
    .replace(/__CATALOG_HERO_TITLE__/g, 'Navegue sem depender da busca')
    .replace(/__CATALOG_HERO_DESCRIPTION__/g, 'Veja todos os jogos em uma lista filtrável com dificuldade, tempo estimado, troféus e acesso direto à página de guia.')
    .replace(/__CATALOG_COLLECTION_TITLE__/g, 'Coleção aberta')
    .replace(/__CATALOG_COLLECTION_DESCRIPTION__/g, 'Escolha uma faixa para entender melhor em que tipo de projeto você está entrando e clicar com mais segurança.')
    .replace(/__CATALOG_COLLECTION_REASON__/g, 'Use esta visão para comparar esforço, tempo e densidade do guia antes de escolher um jogo.')
    .replace(/__CATALOG_COLLECTION_CHECKLIST__/g, 'Abra a página do jogo para confirmar perdíveis, roadmap e se a lista combina com o seu momento.')
    .replace(/__CATALOG_SEO_INTRO_TITLE__/g, 'Pontos de entrada para escolher melhor')
    .replace(/__CATALOG_SEO_INTRO_BODY__/g, 'Esta coleção ajuda a comparar jogos antes do clique, com tempo, dificuldade, roadmap e riscos em primeiro plano.')
    .replace(/__CATALOG_RELATED_LINKS__/g, '')
    .replace(/__CATALOG_VERIFICATION_NOTICE__/g, '')
    .replace(/__CATALOG_SSR_LIST__/g, '')
    .replace(/__CATALOG_SSR_PAGINATION__/g, '')
    .replace(/__CATALOG_FINAL_CTA__/g, '')
    .replace(/__SEO_VIEW_CLASS__/g, 'hidden')
    .replace(/__SEO_PAGE_CONTENT__/g, '')
    .replace(/__HOME_CATALOG_PROOF__/g, formatHomeCatalogProof(0, 0, 0))
    .replace(/__HOME_INTENT_CARDS__/g, '')
    .replace(/__HOME_FEATURED_NOW__/g, '')
    .replace(/__HOME_RECENT_GUIDES__/g, '')
    .replace(/__HOME_UPDATED_GUIDES__/g, '')
    .replace(/__INITIAL_STATE_SCRIPT__/g, '<script>window.__INITIAL_STATE__ = null;</script>');
}

function prioritizeGuideViewHtml(html = '') {
  const homeStart = html.indexOf('<section id="view-home"');
  const catalogStart = html.indexOf('<section id="view-catalog"');
  const libraryStart = html.indexOf('<section id="view-library"');
  const guideStart = html.indexOf('<section id="view-guide"');
  const profileStart = html.indexOf('<section id="view-profile"');
  if ([homeStart, catalogStart, libraryStart, guideStart, profileStart].some(index => index < 0)) return html;
  if (!(homeStart < catalogStart && catalogStart < libraryStart && libraryStart < guideStart && guideStart < profileStart)) return html;

  const homeHtml = html.slice(homeStart, catalogStart);
  const catalogHtml = html.slice(catalogStart, libraryStart);
  const libraryHtml = html.slice(libraryStart, guideStart);
  const guideHtml = html.slice(guideStart, profileStart);
  return `${html.slice(0, homeStart)}${guideHtml}${homeHtml}${catalogHtml}${libraryHtml}${html.slice(profileStart)}`;
}

async function buildGamePageHtml(game, req) {
  const origin = getPublicOrigin(req);
  const normalizedSlug = String(game?.slug || '').trim().toLowerCase();
  const canonicalUrl = ['elden-ring', 'ghost-of-tsushima', 'god-of-war', 'god-of-war-2018', 'god-of-war-ragnarok', 'hades', 'hades-ii', 'astro-bot', 'pragmata', 'nioh-2', 'nioh-3', 'resident-evil-requiem', 'resident-evil-4-remake', 'saros', 'the-last-of-us-part-i', 'the-last-of-us-part-ii', 'subnautica'].includes(normalizedSlug)
    ? `https://atlasachievement.com.br/jogo/${normalizedSlug}`
    : buildPublicUrl(req, `/jogo/${game.slug}`);
  const relatedResponse = await gamesService.listGames({ page: 1, limit: 80, sort: 'recommended-desc' });
  const relatedPool = Array.isArray(relatedResponse?.items) ? relatedResponse.items : [];
  const relatedGames = buildRelatedGamesServer(game, relatedPool, 4);
  const ssrMarkup = buildSsrGuideMarkup(game, relatedGames);
  const viewModel = ssrMarkup.viewModel;
  const ssrTotal = Number(viewModel?.total || 0);
  const ssrProgressInitial = '0%';
  const ssrCounterInitial = ssrTotal > 0
    ? `0/${ssrTotal} concluídos`
    : 'Checklist ainda não disponível';
  const ssrResultsInitial = ssrTotal > 0
    ? `${ssrTotal} troféu(s) visível(is)`
    : 'Checklist ainda não disponível para este guia.';
  const statusBadge = viewModel.editorial?.statusBadge || getEditorialBadge(game);
  const title = buildGameSeoTitle(game);
  const description = buildGameSeoDescription(game);
  const image = resolveMetaImage(origin, game.image);
  const guideCollections = classifyGameCollections(game, game.trophies || []);
  const structuredData = safeJsonForHtml({
    '@context': 'https://schema.org',
    '@graph': [{
      '@type': 'VideoGame',
      name: game.name,
      image,
      description,
      genre: 'Achievement tracking',
      url: canonicalUrl,
      additionalProperty: [
        { '@type': 'PropertyValue', name: 'Status editorial', value: statusBadge.label },
        { '@type': 'PropertyValue', name: 'Cobertura', value: game.coverage_level || 'partial' },
        { '@type': 'PropertyValue', name: 'Verificado manualmente', value: game.is_verified ? 'sim' : 'não' }
      ]
    }, {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início', item: `${origin}/` },
        { '@type': 'ListItem', position: 2, name: 'Catálogo', item: `${origin}/catalogo` },
        { '@type': 'ListItem', position: 3, name: game.name, item: canonicalUrl }
      ]
    }, ...buildGuideFaqStructuredData(canonicalUrl, viewModel)]
  });

  return prioritizeGuideViewHtml(applyTemplateDefaults(publicIndexTemplate
    .replace(/__PAGE_TITLE__/g, escapeHtml(title))
    .replace(/__PAGE_DESCRIPTION__/g, escapeHtml(description))
    .replace(/__ROBOTS_META__/g, '')
    .replace(/__PAGE_OG_TYPE__/g, 'article')
    .replace(/__PAGE_CANONICAL__/g, escapeHtml(canonicalUrl))
    .replace(/__PAGE_OG_IMAGE__/g, escapeHtml(image))
    .replace(/__PAGE_JSON_LD__/g, structuredData)
    .replace(/__HOME_VIEW_CLASS__/g, 'hidden')
    .replace(/__HOME_HERO_HEADING_TAG__/g, 'h2')
    .replace(/__CATALOG_HEADING_TAG__/g, 'h2')
    .replace(/__GUIDE_VIEW_CLASS__/g, '')
    .replace(/__GUIDE_BREADCRUMBS__/g, buildBreadcrumbsHtml([{ label: 'Início', href: '/' }, { label: 'Catálogo', href: '/catalogo' }, { label: game.name }]))
    .replace(/__GUIDE_COLLECTION_LINKS__/g, guideCollections.collectionLinks.map(item => `<a href="${escapeHtml(item.path)}" class="atlas-card atlas-card--minimal atlas-related-collection"><div class="atlas-card__body"><strong class="atlas-card__title">${escapeHtml(item.label)}</strong><span class="atlas-card__reason">${escapeHtml(item.reason)}</span><span class="atlas-card__link">Abrir coleção</span></div></a>`).join(''))
    .replace(/__GUIDE_CONTENT_CLASS__/g, '')
    .replace(/__GUIDE_PROGRESS_INITIAL__/g, escapeHtml(ssrProgressInitial))
    .replace(/__GUIDE_COUNTER_INITIAL__/g, escapeHtml(ssrCounterInitial))
    .replace(/__GUIDE_RESULTS_INITIAL__/g, escapeHtml(ssrResultsInitial))
    .replace(/__HAS_SSR_GAME__/g, 'true')
    .replace(/__SSR_GUIDE_HEADER__/g, ssrMarkup.header)
    .replace(/__SSR_GUIDE_DECISION_STACK__/g, ssrMarkup.decisionStack)
    .replace(/__SSR_GUIDE_SIDEBAR__/g, ssrMarkup.sidebar)
    .replace(/__SSR_GUIDE_SUMMARY__/g, ssrMarkup.summary)
    .replace(/__SSR_TROPHY_LIST__/g, ssrMarkup.trophyList)
    .replace(/__SSR_GUIDE_ROADMAP__/g, ssrMarkup.roadmap)
    .replace(/__SSR_GUIDE_EDITORIAL_NOTES__/g, ssrMarkup.editorialNotes)
    .replace(/__GUIDE_RELATED_OVERVIEW__/g, ssrMarkup.relatedOverview)
    .replace(/__INITIAL_STATE_SCRIPT__/g, buildInitialStateScript({ page: 'guide', game: sanitizePublicGuideInitialStateGame(game) }))));
}

async function buildDefaultPageHtml(req) {
  const origin = getPublicOrigin(req);
  const games = await listAllHomeGames();
  const byRecent = [...games].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  const byUpdated = [...games].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  const totalTrophies = games.reduce((sum, game) => sum + getHomeTotal(game), 0);
  const totalRoadmaps = games.reduce((sum, game) => sum + getHomeRoadmapCount(game), 0);

  return applyTemplateDefaults(publicIndexTemplate
    .replace(/__PAGE_TITLE__/g, HOME_SEO_TITLE)
    .replace(/__PAGE_DESCRIPTION__/g, HOME_SEO_DESCRIPTION)
    .replace(/__ROBOTS_META__/g, '')
    .replace(/__PAGE_OG_TYPE__/g, 'website')
    .replace(/__PAGE_CANONICAL__/g, buildPublicUrl(req, '/'))
    .replace(/__PAGE_OG_IMAGE__/g, resolveMetaImage(origin))
    .replace(/__PAGE_JSON_LD__/g, safeJsonForHtml({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'AtlasAchievement',
      url: buildPublicUrl(req, '/'),
      description: HOME_SEO_DESCRIPTION
    }))
    .replace(/__HOME_CATALOG_PROOF__/g, formatHomeCatalogProof(games.length, totalTrophies, totalRoadmaps))
    .replace(/__HOME_INTENT_CARDS__/g, renderHomeIntentCardsHtml(games))
    .replace(/__HOME_FEATURED_NOW__/g, renderHomeFeaturedGameHtml(games))
    .replace(/__HOME_RECENT_GUIDES__/g, renderHomeDiscoveryGuidesHtml(byRecent))
    .replace(/__HOME_UPDATED_GUIDES__/g, renderHomeEditorialHistoryHtml(byUpdated))
    .replace(/__INITIAL_STATE_SCRIPT__/g, buildInitialStateScript({ page: 'home' })));
}

async function buildStaticPublicPageHtml(req, pageConfig = {}) {
  const origin = getPublicOrigin(req);
  const pathName = pageConfig.path || '/';
  const canonicalUrl = buildPublicUrl(req, pathName);
  const title = pageConfig.title || 'AtlasAchievement';
  const description = pageConfig.description || 'AtlasAchievement';
  const activeView = pageConfig.view || 'home';
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    url: canonicalUrl,
    description
  };

  let html = applyTemplateDefaults(publicIndexTemplate
    .replace(/__PAGE_TITLE__/g, escapeHtml(title))
    .replace(/__PAGE_DESCRIPTION__/g, escapeHtml(description))
    .replace(/__ROBOTS_META__/g, pageConfig.robotsMeta || '<meta name="robots" content="noindex,follow">')
    .replace(/__PAGE_OG_TYPE__/g, 'website')
    .replace(/__PAGE_CANONICAL__/g, escapeHtml(canonicalUrl))
    .replace(/__PAGE_OG_IMAGE__/g, resolveMetaImage(origin))
    .replace(/__PAGE_JSON_LD__/g, safeJsonForHtml(structuredData))
    .replace(/__HOME_VIEW_CLASS__/g, activeView === 'home' ? '' : 'hidden')
    .replace(/__HOME_HERO_HEADING_TAG__/g, activeView === 'home' ? 'h1' : 'h2')
    .replace(/__LIBRARY_HEADING_TAG__/g, activeView === 'library' ? 'h1' : 'h2')
    .replace(/__PROFILE_HEADING_TAG__/g, activeView === 'profile' ? 'h1' : 'h2')
    .replace(/__INITIAL_STATE_SCRIPT__/g, buildInitialStateScript({ page: activeView })));

  if (activeView === 'library') {
    html = html.replace(
      'id="view-library" class="atlas-view-shell hidden space-y-4 pt-2"',
      'id="view-library" class="atlas-view-shell space-y-4 pt-2"'
    );
  }

  if (activeView === 'profile') {
    html = html.replace(
      'id="view-profile" class="atlas-view-shell hidden space-y-5 pt-2"',
      'id="view-profile" class="atlas-view-shell space-y-5 pt-2"'
    );
  }

  return html;
}

function buildStartHereStructuredData(origin, canonicalUrl) {
  return {
    '@context': 'https://schema.org',
    '@graph': [{
      '@type': 'WebPage',
      name: 'Comece sua jornada nas platinas',
      url: canonicalUrl,
      description: 'Aprenda como começar a platinar jogos com guias em português, roadmap, checklist, troféus perdíveis, online obrigatório e recomendações para iniciantes.'
    }, {
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'O que é platina?', acceptedAnswer: { '@type': 'Answer', text: 'Platina é o troféu de conclusão que normalmente aparece quando todos os troféus principais de um jogo no PlayStation foram conquistados.' } },
        { '@type': 'Question', name: 'O que é roadmap?', acceptedAnswer: { '@type': 'Answer', text: 'Roadmap é a ordem recomendada para jogar, limpar objetivos e evitar retrabalho durante a busca pela platina.' } },
        { '@type': 'Question', name: 'O que é troféu perdível?', acceptedAnswer: { '@type': 'Answer', text: 'É um troféu que pode ficar indisponível se você avançar uma história, perder uma janela ou tomar uma decisão sem planejamento.' } }
      ]
    }, {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início', item: `${origin}/` },
        { '@type': 'ListItem', position: 2, name: 'Comece por aqui', item: canonicalUrl }
      ]
    }]
  };
}

function renderStartHerePageContent() {
  const blocks = [
    ['O que é platina', 'No PlayStation, a platina costuma ser o troféu final de uma lista principal. Ela indica que você concluiu todos os troféus exigidos daquela lista base.'],
    ['Como escolher sua primeira platina', 'Prefira um jogo que você realmente queira jogar, com dificuldade baixa, tempo estimado claro, pouco risco de perdíveis e um roadmap fácil de seguir.'],
    ['O que é roadmap', 'Roadmap é a rota sugerida do guia: o que fazer primeiro, quando limpar coletáveis, quando cuidar de troféus sensíveis e quando partir para o cleanup.'],
    ['O que é checklist', 'Checklist é a lista marcável de troféus. No AtlasAchievement, ele ajuda a acompanhar o que já foi feito e o que ainda falta no guia.'],
    ['O que são troféus perdíveis', 'Perdíveis são troféus que podem exigir nova run, reload ou capítulo específico se você avançar sem cumprir uma condição. Sempre leia esses avisos antes de começar.'],
    ['O que é troféu online', 'Troféu online depende de servidor, multiplayer, PSN, PS+ ou interação conectada. Quando for obrigatório, ele muda a logística da platina.'],
    ['O que é coop obrigatório', 'Coop obrigatório significa que a platina precisa de outro jogador em algum momento. Pode ser local ou online, conforme o guia indicar.'],
    ['O que é DLC', 'DLC é conteúdo extra. Alguns jogos têm listas separadas, mas a platina normalmente depende da lista base; confira o escopo do guia antes de assumir.']
  ];

  return `
    <section class="atlas-panel atlas-panel--primary atlas-start-here-hero">
      ${buildBreadcrumbsHtml([{ label: 'Início', href: '/' }, { label: 'Comece por aqui' }])}
      <div class="atlas-eyebrow mt-4">Guia inicial</div>
      <h1>Comece sua jornada nas platinas</h1>
      <p>Entenda os termos mais importantes antes de escolher a primeira platina e use os guias do AtlasAchievement para comparar tempo, dificuldade, roadmap, checklist, online e perdíveis.</p>
    </section>
    <section class="atlas-start-here-grid" aria-label="Conceitos para começar a platinar">
      ${blocks.map(([title, body]) => `
        <article class="atlas-panel atlas-panel--support atlas-start-here-block">
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(body)}</p>
        </article>`).join('')}
    </section>
    <section class="atlas-panel atlas-panel--support atlas-start-here-block">
      <h2>Como usar um guia do AtlasAchievement</h2>
      <ol class="atlas-start-here-steps">
        <li><span>1</span><p>Abra o resumo do jogo e compare dificuldade, tempo estimado, online, coop, DLC e perdíveis.</p></li>
        <li><span>2</span><p>Leia o roadmap antes de jogar para entender a ordem ideal e os pontos de atenção.</p></li>
        <li><span>3</span><p>Use o checklist para marcar troféus concluídos e evitar perder o controle do cleanup.</p></li>
        <li><span>4</span><p>Quando houver alerta de perdível ou online, confirme o detalhe no guia antes de avançar.</p></li>
      </ol>
    </section>
    <section class="atlas-panel atlas-panel--flat atlas-start-here-cta">
      <div>
        <span class="atlas-section-kicker">Próximo passo</span>
        <p class="text-white/65 mt-2">Explore o catálogo completo e escolha um guia que combine com seu tempo e experiência.</p>
      </div>
      <a href="/catalogo" class="atlas-btn atlas-btn-primary"><i class="fas fa-compass"></i> Ver catálogo</a>
    </section>`;
}

async function buildStartHerePageHtml(req) {
  const origin = getPublicOrigin(req);
  const canonicalUrl = buildPublicUrl(req, '/comece-aqui');
  return applyTemplateDefaults(publicIndexTemplate
    .replace(/__PAGE_TITLE__/g, 'Comece por aqui | AtlasAchievement')
    .replace(/__PAGE_DESCRIPTION__/g, 'Aprenda como começar a platinar jogos com guias em português, roadmap, checklist, troféus perdíveis, online obrigatório e recomendações para iniciantes.')
    .replace(/__ROBOTS_META__/g, '')
    .replace(/__PAGE_OG_TYPE__/g, 'website')
    .replace(/__PAGE_CANONICAL__/g, escapeHtml(canonicalUrl))
    .replace(/__PAGE_OG_IMAGE__/g, resolveMetaImage(origin))
    .replace(/__PAGE_JSON_LD__/g, safeJsonForHtml(buildStartHereStructuredData(origin, canonicalUrl)))
    .replace(/__HOME_VIEW_CLASS__/g, 'hidden')
    .replace(/__HOME_HERO_HEADING_TAG__/g, 'h2')
    .replace(/__SEO_VIEW_CLASS__/g, '')
    .replace(/__SEO_PAGE_CONTENT__/g, renderStartHerePageContent())
    .replace(/__INITIAL_STATE_SCRIPT__/g, buildInitialStateScript({ page: 'seo', path: '/comece-aqui' })));
}

function renderOrganicListNotice(items = []) {
  if (items.length >= 6) return '';
  return '<div class="atlas-seo-list-note"><strong>Ainda estamos expandindo esta lista.</strong> Veja também o catálogo completo.</div>';
}

function renderOrganicListFinalCta() {
  return `
    <section class="atlas-seo-final-cta">
      <p>Quer comparar com todos os jogos publicados, incluindo listas longas, online, coop e guias em revisão?</p>
      <a href="/catalogo" class="atlas-btn atlas-btn-primary"><i class="fas fa-compass"></i> Ver catálogo completo</a>
    </section>`;
}

async function buildOrganicListPageHtml(req, config) {
  const origin = getPublicOrigin(req);
  const canonicalUrl = buildPublicUrl(req, config.path);
  const allItems = await listAllHomeGames();
  const items = allItems
    .filter(game => game?.slug && config.matches(game))
    .sort(config.sort || compareOrganicByDifficultyThenTime);
  const structuredData = buildCatalogStructuredData(origin, canonicalUrl, {
    name: config.name,
    description: config.description
  }, items, items.length);

  return applyTemplateDefaults(publicIndexTemplate
    .replace(/__PAGE_TITLE__/g, escapeHtml(config.title))
    .replace(/__PAGE_DESCRIPTION__/g, escapeHtml(config.description))
    .replace(/__ROBOTS_META__/g, '')
    .replace(/__PAGE_OG_TYPE__/g, 'website')
    .replace(/__PAGE_CANONICAL__/g, escapeHtml(canonicalUrl))
    .replace(/__PAGE_OG_IMAGE__/g, resolveMetaImage(origin))
    .replace(/__PAGE_JSON_LD__/g, safeJsonForHtml(structuredData))
    .replace(/__HOME_VIEW_CLASS__/g, 'hidden')
    .replace(/__HOME_HERO_HEADING_TAG__/g, 'h2')
    .replace(/__CATALOG_VIEW_CLASS__/g, 'atlas-seo-list')
    .replace(/__CATALOG_HEADING_TAG__/g, 'h1')
    .replace(/__CATALOG_TITLE__/g, escapeHtml(config.heroTitle))
    .replace(/__CATALOG_BREADCRUMBS__/g, buildBreadcrumbsHtml([{ label: 'Início', href: '/' }, { label: config.name }]))
    .replace(/__CATALOG_SUMMARY__/g, escapeHtml(`${formatCatalogCount(items.length)} nesta lista`))
    .replace(/__CATALOG_HERO_DESCRIPTION__/g, escapeHtml(config.heroDescription))
    .replace(/__CATALOG_COLLECTION_TITLE__/g, escapeHtml(config.collectionTitle))
    .replace(/__CATALOG_COLLECTION_DESCRIPTION__/g, escapeHtml(config.collectionDescription))
    .replace(/__CATALOG_COLLECTION_REASON__/g, escapeHtml(config.reason))
    .replace(/__CATALOG_COLLECTION_CHECKLIST__/g, escapeHtml(config.checklist))
    .replace(/__CATALOG_SEO_INTRO_TITLE__/g, escapeHtml(config.introTitle))
    .replace(/__CATALOG_SEO_INTRO_BODY__/g, escapeHtml(config.introBody))
    .replace(/__CATALOG_RELATED_LINKS__/g, [
      ['Comece por aqui', '/comece-aqui'],
      ['Catálogo completo', '/catalogo'],
      ['Platinas fáceis', '/platinas-faceis'],
      ['Platinas curtas', '/platinas-curtas'],
      ['Sem online', '/platinas-sem-online'],
      ['Sem perdíveis', '/platinas-sem-perdiveis']
    ]
      .filter(([, pathName]) => pathName !== config.path)
      .map(([label, pathName]) => `<a href="${escapeHtml(pathName)}" class="atlas-related-pill"><span>${escapeHtml(label)}</span><small>SEO</small></a>`)
      .join(''))
    .replace(/__CATALOG_VERIFICATION_NOTICE__/g, renderCatalogVerificationNotice(items))
    .replace(/__CATALOG_SSR_LIST__/g, `${renderOrganicListNotice(items)}${renderCatalogSeoCards(items)}`)
    .replace(/__CATALOG_SSR_PAGINATION__/g, renderCatalogPaginationHtml({ total: items.length, totalPages: 1, page: 1 }))
    .replace(/__CATALOG_FINAL_CTA__/g, renderOrganicListFinalCta())
    .replace(/__INITIAL_STATE_SCRIPT__/g, buildInitialStateScript({
      page: 'seo-list',
      path: config.path,
      catalog: { pagination: { total: items.length, totalPages: 1, page: 1 } }
    })));
}

function getCatalogFacetCount(facetConfigOrId, facetCounts = {}) {
  return sharedCatalogModel.getCatalogFacetCount(facetConfigOrId, facetCounts);
}

function formatCatalogCount(count) {
  return sharedCatalogModel.formatCatalogCount(count);
}

function isCatalogUnverifiedBadge(statusBadge = {}) {
  if (statusBadge.status && statusBadge.status !== 'verified') return true;
  return (statusBadge.badge || statusBadge.tone) === 'unverified'
    || /verifica/i.test(String(statusBadge.label || ''));
}

function getCatalogStatusBadge(statusBadge = {}) {
  if (statusBadge.status) return statusBadge;
  if (isCatalogUnverifiedBadge(statusBadge)) {
    return { ...statusBadge, label: 'Em verificação', badge: 'unverified', tone: 'unverified' };
  }
  return statusBadge;
}

function renderCatalogVerificationNotice(items = []) {
  const count = (Array.isArray(items) ? items : []).reduce((total, game) => {
    const statusBadge = sharedCardModel.buildStandardGameCardModel(game).statusBadge;
    return total + (isCatalogUnverifiedBadge(statusBadge) ? 1 : 0);
  }, 0);
  return count > 1
    ? `<i class="fas fa-circle-info" aria-hidden="true"></i><span>${escapeHtml(`${count} guias com dados em verificação`)}</span>`
    : '';
}

function getCatalogRelatedFacets(facetConfig, facetCounts = {}, options = {}) {
  return sharedCatalogModel.getRelatedCatalogFacets(facetConfig, facetCounts, options);
}

function renderCatalogEmptyState(facetConfig, facetCounts = {}) {
  const nearby = getCatalogRelatedFacets(facetConfig, facetCounts, { includeEmpty: false }).slice(0, 4);
  const fallbackLinks = nearby.length
    ? nearby
    : [{ path: '/catalogo', name: 'Catálogo completo', count: getCatalogFacetCount('all', facetCounts) }];

  return `
    <article class="atlas-panel atlas-panel--plain p-5 md:p-6 md:col-span-2 xl:col-span-3">
      <span class="atlas-section-kicker">Coleção em expansão</span>
      <h3 class="text-xl font-extrabold tracking-tight mt-2">Ainda não há jogos nesta faixa</h3>
      <p class="text-white/65 mt-3">Nenhum guia publicado cumpre exatamente este filtro hoje.</p>
      <div class="mt-5">
        <div class="text-[11px] uppercase tracking-[0.18em] text-white/40 mb-3">Coleções próximas com jogos disponíveis</div>
        <div class="flex flex-wrap gap-3">
          ${fallbackLinks.map(item => `<a href="${escapeHtml(item.path)}" class="atlas-chip">${escapeHtml(item.name)} • ${escapeHtml(formatCatalogCount(item.count))}</a>`).join('')}
        </div>
      </div>
    </article>`;
}

function getCatalogCardImageSource(game = {}, model = {}) {
  const candidates = [
    game?.catalogImage,
    game?.catalog_image,
    game?.cardImage,
    game?.cover_image,
    model?.coverImage,
    game?.image,
    model?.bannerImage,
    model?.image
  ];
  return candidates
    .map(value => String(value || '').trim())
    .find(value => value && !sharedCardModel.isPlaceholderGameImage(value)) || '';
}

function renderCatalogCardImageHtml(game = {}, model = {}, source = '') {
  const name = model.name || game?.name || 'Jogo';
  const fallbackClass = source ? '' : ' catalog-card__media--fallback-visible';
  const image = source
    ? `<img src="${escapeHtml(source)}" alt="${escapeHtml(name)}" class="catalog-card__image" loading="lazy" decoding="async" width="600" height="338" sizes="(min-width: 1180px) 31vw, (min-width: 720px) 46vw, 100vw" onerror="this.hidden=true;this.parentElement.classList.add('catalog-card__media--fallback-visible');var card=this.closest('.catalog-card');if(card)card.classList.add('catalog-card--image-fallback');">`
    : '';
  return `
        <div class="catalog-card__media${fallbackClass}">
          <span class="catalog-card__fallback" aria-hidden="true">${escapeHtml(name)}</span>
          ${image}
        </div>`;
}

function renderCatalogSeoCards(items = [], facetConfig = catalogFacetPageMap.all, facetCounts = {}) {
  if (!items.length) return renderCatalogEmptyState(facetConfig, facetCounts);

  return `${items.map(game => {
    const model = sharedCardModel.buildStandardGameCardModel(game);
    const name = escapeHtml(model.name);
    const slug = escapeHtml(model.slug);
    const difficulty = escapeHtml(String(model.difficulty ?? '—'));
    const time = escapeHtml(model.time);
    const trophyCount = model.trophies;
    const statusBadge = getCatalogStatusBadge(model.statusBadge);
    const imageSource = getCatalogCardImageSource(game, model);
    const decision = typeof sharedCatalogModel.getCatalogDecisionSignals === 'function'
      ? sharedCatalogModel.getCatalogDecisionSignals(game)
      : { signals: [] };
    const signalHtml = (decision.signals || []).slice(0, 5).map(signal => `
            <span class="catalog-card__signal catalog-card__signal--${escapeHtml(signal.tone || 'neutral')}" title="${escapeHtml(signal.label)}"><i class="fas ${escapeHtml(signal.icon || 'fa-circle-info')}" aria-hidden="true"></i>${escapeHtml(signal.label)}</span>`).join('');
    return `
      <article class="catalog-card${imageSource ? '' : ' catalog-card--image-fallback'}" data-game-slug="${slug}" data-difficulty-tone="${escapeHtml(model.difficultyTone)}" data-risk="${model.hasRisk ? 'missable' : 'none'}" itemscope itemtype="https://schema.org/VideoGame">
        ${renderCatalogCardImageHtml(game, model, imageSource)}
        <div class="catalog-card__body">
          <div class="catalog-card__badges">
            <span class="catalog-card__status atlas-badge atlas-badge--${escapeHtml(statusBadge.badge || statusBadge.tone || 'partial')}">${escapeHtml(statusBadge.label)}</span>
            ${model.hasRisk ? '<span class="atlas-badge atlas-badge--risk">Perdíveis</span>' : ''}
          </div>
          <h3 class="catalog-card__title" itemprop="name">${name}</h3>
          <meta itemprop="url" content="/jogo/${slug}">
          <div class="catalog-card__meta">
            <span class="atlas-meta-signal ${escapeHtml(model.difficultyClass)}"><i class="fas fa-gauge-high"></i>${difficulty}/10</span>
            <span class="atlas-meta-signal atlas-meta-signal--time"><i class="fas fa-clock"></i>${time}</span>
            <span class="atlas-meta-signal atlas-meta-signal--trophy"><i class="fas fa-trophy"></i>${escapeHtml(String(trophyCount))} troféus</span>
          </div>
          <div class="catalog-card__signals" aria-label="Sinais para decidir a platina">
            ${signalHtml}
          </div>
          <div class="catalog-card__actions">
            <a href="/jogo/${slug}" class="atlas-btn atlas-btn-primary atlas-btn-compact" data-open-guide-card="${slug}">Abrir guia</a>
          </div>
        </div>
      </article>`;
  }).join('')}`;
}

function renderCatalogPaginationHtml(pagination = {}) {
  const page = Number(pagination.page || 1);
  const totalPages = Number(pagination.totalPages || 1);
  const total = Number(pagination.total || 0);
  if (!total || totalPages <= 1) {
    return total ? `<div class="atlas-pagination-summary">${escapeHtml(String(total))} jogos</div>` : '';
  }

  const windowStart = Math.max(1, page - 2);
  const windowEnd = Math.min(totalPages, page + 2);
  const pages = [];
  for (let value = windowStart; value <= windowEnd; value += 1) pages.push(value);

  return `
      <div class="atlas-pagination-summary">${escapeHtml(`${total} jogos · página ${page} de ${totalPages}`)}</div>
      <button type="button" class="atlas-btn atlas-btn-secondary" data-page-target="catalog" data-page-value="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Anterior</button>
      ${pages.map(value => `<button type="button" class="atlas-pill ${value === page ? 'atlas-pill-active' : ''}" data-page-target="catalog" data-page-value="${value}">${value}</button>`).join('')}
      <button type="button" class="atlas-btn atlas-btn-secondary" data-page-target="catalog" data-page-value="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Próxima</button>`;
}

function renderCatalogRelatedLinks(facetConfig, facetCounts = {}) {
  const related = getCatalogRelatedFacets(facetConfig, facetCounts, { includeEmpty: true });
  if (!related.length) return '';
  return related
    .map(item => `<a href="${escapeHtml(item.path)}" class="atlas-related-pill"><span>${escapeHtml(item.name)}</span><small>${escapeHtml(item.count ? formatCatalogCount(item.count) : 'em expansão')}</small></a>`)
    .join('');
}

function buildCatalogStructuredData(origin, canonicalUrl, facetConfig, items = [], total = items.length) {
  return {
    '@context': 'https://schema.org',
    '@graph': [{
      '@type': 'CollectionPage',
      name: facetConfig?.name || 'Catálogo de jogos',
      url: canonicalUrl,
      description: facetConfig?.description || 'Coleção de jogos com guias, troféus, tempo estimado e filtros por intenção.',
      mainEntity: {
        '@type': 'ItemList',
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: items.length,
        itemListElement: items.map((game, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: `${origin}/jogo/${game.slug || ''}`,
          name: game.name || 'Jogo'
        }))
      }
    }, {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início', item: `${origin}/` },
        { '@type': 'ListItem', position: 2, name: 'Catálogo', item: `${origin}/catalogo` },
        { '@type': 'ListItem', position: 3, name: facetConfig?.name || 'Catálogo de jogos', item: canonicalUrl }
      ]
    }]
  };
}


function buildBreadcrumbsHtml(items = []) {
  return `
    <nav class="atlas-breadcrumbs" aria-label="Breadcrumb">
      ${items.map((item, index) => {
        const isLast = index === items.length - 1;
        const label = escapeHtml(item?.label || 'Item');
        if (isLast || !item?.href) {
          return `<span class="atlas-breadcrumbs__item" aria-current="page">${label}</span>`;
        }
        return `<a href="${escapeHtml(item.href)}" class="atlas-breadcrumbs__item">${label}</a>`;
      }).join('<span class="atlas-breadcrumbs__sep" aria-hidden="true">/</span>')}
    </nav>`;
}

function classifyGameCollections(game = {}, trophies = []) {
  return sharedCatalogModel.classifyGameCollections(game, trophies);
}


function buildEditorialCollectionItems(collectionSlug, items = []) {
  return sharedCatalogModel.buildEditorialCollectionItems(collectionSlug, items);
}

function buildEditorialCollectionStructuredData(origin, canonicalUrl, config, items = []) {
  return {
    '@context': 'https://schema.org',
    '@graph': [{
      '@type': 'CollectionPage',
      name: config?.name || 'Coleção editorial',
      url: canonicalUrl,
      description: config?.description || 'Seleção editorial de jogos e guias.',
      mainEntity: {
        '@type': 'ItemList',
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: items.length,
        itemListElement: items.map((game, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: `${origin}/jogo/${game.slug || ''}`,
          name: game.name || 'Jogo'
        }))
      }
    }, {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início', item: `${origin}/` },
        { '@type': 'ListItem', position: 2, name: 'Coleções', item: `${origin}/catalogo` },
        { '@type': 'ListItem', position: 3, name: config?.name || 'Coleção editorial', item: canonicalUrl }
      ]
    }]
  };
}

async function buildEditorialCollectionPageHtml(req, collectionSlug) {
  const config = editorialCollectionPageMap[collectionSlug];
  const origin = getPublicOrigin(req);
  const canonicalUrl = buildPublicUrl(req, config.path);
  const response = await gamesService.listGames({ facet: 'all', sort: 'recommended-desc', page: 1, limit: 100 });
  const allItems = Array.isArray(response?.items) ? response.items : [];
  const items = buildEditorialCollectionItems(collectionSlug, allItems);
  const structuredData = buildEditorialCollectionStructuredData(origin, canonicalUrl, config, items);
  const relatedLinks = Object.entries(editorialCollectionPageMap)
    .filter(([slug]) => slug !== collectionSlug)
    .map(([, item]) => `<a href="${escapeHtml(item.path)}" class="atlas-related-pill"><span>${escapeHtml(item.name)}</span><small>Coleção editorial</small></a>`)
    .join('');
  const introBody = `${config.introBody} Use os cards abaixo para comparar apenas jogos que se encaixam nesta seleção, com tempo, dificuldade, roadmap e risco visíveis antes do clique.`;

  return applyTemplateDefaults(publicIndexTemplate
    .replace(/__PAGE_TITLE__/g, escapeHtml(config.title))
    .replace(/__PAGE_DESCRIPTION__/g, escapeHtml(config.description))
    .replace(/__PAGE_OG_TYPE__/g, 'website')
    .replace(/__PAGE_CANONICAL__/g, escapeHtml(canonicalUrl))
    .replace(/__PAGE_OG_IMAGE__/g, resolveMetaImage(origin))
    .replace(/__PAGE_JSON_LD__/g, safeJsonForHtml(structuredData))
    .replace(/__HOME_VIEW_CLASS__/g, 'hidden')
    .replace(/__HOME_HERO_HEADING_TAG__/g, 'h2')
    .replace(/__CATALOG_VIEW_CLASS__/g, '')
    .replace(/__CATALOG_HEADING_TAG__/g, 'h1')
    .replace(/__CATALOG_TITLE__/g, escapeHtml(config.name))
    .replace(/__CATALOG_BREADCRUMBS__/g, buildBreadcrumbsHtml([{ label: 'Início', href: '/' }, { label: 'Catálogo', href: '/catalogo' }, { label: config.name }]))
    .replace(/__CATALOG_SUMMARY__/g, escapeHtml(`${formatCatalogCount(items.length)} nesta coleção editorial · página 1 de 1`))
    .replace(/__CATALOG_HERO_TITLE__/g, escapeHtml(config.heroTitle))
    .replace(/__CATALOG_HERO_DESCRIPTION__/g, escapeHtml(config.heroDescription))
    .replace(/__CATALOG_COLLECTION_TITLE__/g, escapeHtml(config.collectionTitle))
    .replace(/__CATALOG_COLLECTION_DESCRIPTION__/g, escapeHtml(config.collectionDescription))
    .replace(/__CATALOG_COLLECTION_REASON__/g, escapeHtml(config.reason))
    .replace(/__CATALOG_COLLECTION_CHECKLIST__/g, escapeHtml(config.checklist))
    .replace(/__CATALOG_SEO_INTRO_TITLE__/g, escapeHtml(config.introTitle))
    .replace(/__CATALOG_SEO_INTRO_BODY__/g, escapeHtml(introBody))
    .replace(/__CATALOG_RELATED_LINKS__/g, relatedLinks)
    .replace(/__CATALOG_VERIFICATION_NOTICE__/g, renderCatalogVerificationNotice(items))
    .replace(/__CATALOG_SSR_LIST__/g, renderCatalogSeoCards(items))
    .replace(/__CATALOG_SSR_PAGINATION__/g, renderCatalogPaginationHtml({ total: items.length, totalPages: 1, page: 1 }))
    .replace(/__INITIAL_STATE_SCRIPT__/g, buildInitialStateScript({ page: 'catalog', facet: 'all', catalog: { pagination: { total: items.length, totalPages: 1, page: 1 } } })));
}

async function buildCatalogPageHtml(req, facetSlug = null) {
  const origin = getPublicOrigin(req);
  const facetConfig = facetSlug ? catalogFacetPageMap[facetSlug] : catalogFacetPageMap.all;
  const canonicalPath = facetConfig?.path || '/catalogo';
  const canonicalUrl = buildPublicUrl(req, canonicalPath);
  const title = facetConfig?.title || 'Catálogo de guias de troféus e platinas | AtlasAchievement';
  const description = facetConfig?.description || 'Explore guias de jogos com troféus, dificuldade, tempo estimado, roadmap de platina e checklist.';
  const facetCounts = await gamesService.getCatalogFacetCounts();
  const requestedPage = Math.max(Number(req.query?.page || 1) || 1, 1);
  const catalogResponse = await gamesService.listGames({ facet: facetConfig?.serviceFacet || 'all', sort: 'recommended-desc', page: requestedPage, limit: PUBLIC_CATALOG_PAGE_SIZE });
  const items = Array.isArray(catalogResponse?.items) ? catalogResponse.items : [];
  const total = getCatalogFacetCount(facetConfig, facetCounts) || Number(catalogResponse?.pagination?.total || items.length || 0);
  const isEmptyCollection = facetConfig?.serviceFacet !== 'all' && total === 0;
  const structuredData = buildCatalogStructuredData(origin, canonicalUrl, facetConfig, items, total);
  catalogResponse.facetCounts = facetCounts;
  const page = Number(catalogResponse?.pagination?.page || 1);
  const totalPages = Number(catalogResponse?.pagination?.totalPages || 1);
  const catalogSummary = `${formatCatalogCount(total)} nesta coleção · página ${page} de ${totalPages}`;
  const catalogHeroDescription = `${facetConfig?.heroDescription || 'Veja todos os jogos em uma lista filtrável com dificuldade, tempo estimado, troféus e acesso direto à página de guia.'} ${isEmptyCollection ? 'Ainda não há jogos publicados nesta faixa.' : `${formatCatalogCount(total)} nesta faixa agora.`}`;
  const catalogRelatedLinks = renderCatalogRelatedLinks(facetConfig, facetCounts);
  const catalogSsrList = renderCatalogSeoCards(items, facetConfig, facetCounts);
  const catalogVerificationNotice = renderCatalogVerificationNotice(items);
  const robotsMeta = isEmptyCollection ? '<meta name="robots" content="noindex,follow">' : '';

  return applyTemplateDefaults(publicIndexTemplate
    .replace(/__PAGE_TITLE__/g, escapeHtml(title))
    .replace(/__PAGE_DESCRIPTION__/g, escapeHtml(description))
    .replace(/__ROBOTS_META__/g, robotsMeta)
    .replace(/__PAGE_OG_TYPE__/g, 'website')
    .replace(/__PAGE_CANONICAL__/g, escapeHtml(canonicalUrl))
    .replace(/__PAGE_OG_IMAGE__/g, resolveMetaImage(origin))
    .replace(/__PAGE_JSON_LD__/g, safeJsonForHtml(structuredData))
    .replace(/__HOME_VIEW_CLASS__/g, 'hidden')
    .replace(/__HOME_HERO_HEADING_TAG__/g, 'h2')
    .replace(/__CATALOG_VIEW_CLASS__/g, '')
    .replace(/__CATALOG_HEADING_TAG__/g, 'h1')
    .replace(/__CATALOG_SUMMARY__/g, escapeHtml(catalogSummary))
    .replace(/__CATALOG_HERO_DESCRIPTION__/g, escapeHtml(catalogHeroDescription))
    .replace(/__CATALOG_RELATED_LINKS__/g, catalogRelatedLinks)
    .replace(/__CATALOG_VERIFICATION_NOTICE__/g, catalogVerificationNotice)
    .replace(/__CATALOG_SSR_LIST__/g, catalogSsrList)
    .replace(/__CATALOG_SSR_PAGINATION__/g, renderCatalogPaginationHtml(catalogResponse.pagination))
    .replace(/__CATALOG_TITLE__/g, escapeHtml(facetConfig?.name || 'Catálogo de jogos'))
    .replace(/__CATALOG_BREADCRUMBS__/g, buildBreadcrumbsHtml([{ label: 'Início', href: '/' }, { label: 'Catálogo', href: '/catalogo' }, { label: facetConfig?.name || 'Catálogo de jogos' }]))
    .replace(/__CATALOG_HERO_TITLE__/g, escapeHtml(facetConfig?.heroTitle || 'Navegue sem depender da busca'))
    .replace(/__CATALOG_COLLECTION_TITLE__/g, escapeHtml(facetConfig?.collectionTitle || 'Coleção aberta'))
    .replace(/__CATALOG_COLLECTION_DESCRIPTION__/g, escapeHtml(facetConfig?.collectionDescription || 'Escolha uma faixa para entender melhor em que tipo de projeto você está entrando e clicar com mais segurança.'))
    .replace(/__CATALOG_COLLECTION_REASON__/g, escapeHtml(facetConfig?.reason || 'Use esta visão para comparar esforço, tempo e densidade do guia antes de escolher um jogo.'))
    .replace(/__CATALOG_COLLECTION_CHECKLIST__/g, escapeHtml(facetConfig?.checklist || 'Abra a página do jogo para confirmar perdíveis, roadmap e se a lista combina com o seu momento.'))
    .replace(/__CATALOG_SEO_INTRO_TITLE__/g, escapeHtml(facetConfig?.introTitle || 'Pontos de entrada para escolher melhor'))
    .replace(/__CATALOG_SEO_INTRO_BODY__/g, escapeHtml(facetConfig?.introBody || 'Esta coleção ajuda a comparar jogos antes do clique, com tempo, dificuldade, roadmap e riscos em primeiro plano.'))
    .replace(/__INITIAL_STATE_SCRIPT__/g, buildInitialStateScript({
      page: 'catalog',
      facet: facetConfig?.serviceFacet || 'all',
      catalog: { pagination: catalogResponse.pagination, facetCounts }
    })));
}

fs.mkdirSync(env.uploadDir, { recursive: true });

if (env.isProduction) {
  app.set('trust proxy', 1);
}

const allowedOrigins = new Set(env.corsAllowedOrigins);
if (env.appUrl) {
  allowedOrigins.add(env.appUrl);
}
if (env.canonicalOrigin) {
  allowedOrigins.add(env.canonicalOrigin);
}

app.use(requestContext);
app.use(securityHeaders);
app.use((req, res, next) => {
  const origin = req.get('origin');
  if (!origin) return next();

  if (allowedOrigins.size === 0) {
    return next();
  }

  if (allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token, X-Requested-With, X-Atlas-Auth-Scope');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT,PATCH,DELETE');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  }

  if (req.method === 'OPTIONS') return res.sendStatus(403);
  return next();
});
app.use(express.json({ limit: '1mb' }));
const sessionMaxAgeMs = 1000 * 60 * 60 * env.sessionMaxAgeHours;
const sessionStore = new SqliteSessionStore({
  ttlMs: sessionMaxAgeMs,
  cleanupIntervalMs: 1000 * 60 * env.sessionCleanupIntervalMinutes
});
app.locals.sessionStore = sessionStore;

app.use(session({
  name: 'mtg.sid',
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProduction,
    maxAge: sessionMaxAgeMs
  }
}));

app.use(issueCsrfToken);
app.use('/uploads', express.static(env.uploadDir, {
  fallthrough: false,
  etag: true,
  maxAge: 0,
  setHeaders: setPublicStaticCacheHeaders
}));
app.use('/shared', express.static(path.join(__dirname, 'shared'), {
  index: false,
  etag: true,
  maxAge: 0,
  setHeaders: setPublicStaticCacheHeaders
}));
app.get(['/admin', '/admin.html'], sendAdminPage);
app.get(['/service-worker.js', '/sw.js'], (req, res) => {
  setNoStoreHeaders(res);
  res.type('application/javascript').send(`
self.addEventListener('install', event => {
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(
    self.registration.unregister()
      .then(() => self.clients.matchAll())
      .then(clients => Promise.all(clients.map(client => client.navigate(client.url))))
  );
});
`);
});
app.use(express.static(path.join(__dirname, '../public'), {
  index: false,
  etag: true,
  maxAge: 0,
  setHeaders: setPublicStaticCacheHeaders
}));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: env.nodeEnv,
    sessionStore: 'sqlite',
    sessionMaxAgeHours: env.sessionMaxAgeHours
  });
});

app.get('/version', (req, res) => {
  setNoStoreHeaders(res);
  res.json({
    version: APP_VERSION,
    packageVersion: packageJson.version || '',
    environment: env.nodeEnv
  });
});

app.get('/favicon.ico', (req, res) => {
  setNoCacheHeaders(res);
  res.redirect(302, '/favicon.png');
});

app.get('/robots.txt', (req, res) => {
  const sitemapUrl = buildPublicUrl(req, '/sitemap.xml');
  res.type('text/plain').send([
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /api/',
    'Disallow: /biblioteca',
    'Disallow: /perfil',
    `Sitemap: ${sitemapUrl}`,
    ''
  ].join('\n'));
});

app.get('/sitemap.xml', async (req, res, next) => {
  try {
    const allGames = [];
    let page = 1;
    let totalPages = 1;

    do {
      const response = await gamesService.listGames({ page, limit: 100, sort: 'updated-desc' });
      allGames.push(...(response.items || []));
      totalPages = Number(response.pagination?.totalPages || 1);
      page += 1;
    } while (page <= totalPages);

    const facetCounts = await gamesService.getCatalogFacetCounts();
    const facetUrls = Object.entries(catalogFacetPageMap)
      .filter(([facetSlug]) => facetSlug !== 'all')
      .filter(([, facet]) => getCatalogFacetCount(facet, facetCounts) > 0)
      .map(([, facet]) => ({
        loc: buildPublicUrl(req, facet.path),
        lastmod: new Date().toISOString()
      }));
    const editorialUrls = Object.values(editorialCollectionPageMap)
      .map(item => ({ loc: buildPublicUrl(req, item.path), lastmod: new Date().toISOString() }));
    const organicSeoUrls = [
      '/comece-aqui',
      ...Object.values(organicSeoListPageMap).map(item => item.path)
    ].map(pathName => ({ loc: buildPublicUrl(req, pathName), lastmod: new Date().toISOString() }));

    const urls = [
      { loc: buildPublicUrl(req, '/'), lastmod: new Date().toISOString() },
      { loc: buildPublicUrl(req, '/catalogo'), lastmod: new Date().toISOString() },
      ...facetUrls,
      ...editorialUrls,
      ...organicSeoUrls,
      ...allGames.map(game => ({
        loc: buildPublicUrl(req, `/jogo/${game.slug}`),
        lastmod: game.updated_at || game.created_at || new Date().toISOString()
      }))
    ];
    const uniqueUrls = Array.from(new Map(urls.map(item => [item.loc, item])).values());

    res.type('application/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${uniqueUrls.map(item => `  <url><loc>${escapeXml(item.loc)}</loc><lastmod>${escapeXml(new Date(item.lastmod).toISOString())}</lastmod></url>`).join('\n')}\n</urlset>`);
  } catch (error) {
    next(error);
  }
});

app.use('/api/auth/login', loginRateLimit);
app.use('/api/auth/register', registerRateLimit);
app.use('/api/auth', authRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/feedback', requireCsrf, feedbackRoutes);
app.use('/api/me', requireCsrf, meRoutes);
app.use('/api/uploads', requireCsrf, uploadsRoutes);
app.use('/api/games', requireCsrf, gamesRoutes);

app.get('/comece-aqui', setHtmlRouteCacheHeaders, async (req, res, next) => {
  try {
    res.send(await buildStartHerePageHtml(req));
  } catch (error) {
    next(error);
  }
});

Object.values(organicSeoListPageMap).forEach(config => {
  app.get(config.path, setHtmlRouteCacheHeaders, async (req, res, next) => {
    try {
      res.send(await buildOrganicListPageHtml(req, config));
    } catch (error) {
      next(error);
    }
  });
});

app.get('/catalogo', setHtmlRouteCacheHeaders, async (req, res, next) => {
  try {
    res.send(await buildCatalogPageHtml(req));
  } catch (error) {
    next(error);
  }
});

app.get('/catalogo/:facetSlug', setHtmlRouteCacheHeaders, async (req, res, next) => {
  const { facetSlug } = req.params;
  if (!catalogFacetPageMap[facetSlug]) {
    return next();
  }

  try {
    return res.send(await buildCatalogPageHtml(req, facetSlug));
  } catch (error) {
    return next(error);
  }
});


app.get('/colecoes/:collectionSlug', setHtmlRouteCacheHeaders, async (req, res, next) => {
  const { collectionSlug } = req.params;
  if (!editorialCollectionPageMap[collectionSlug]) {
    return next();
  }

  try {
    return res.send(await buildEditorialCollectionPageHtml(req, collectionSlug));
  } catch (error) {
    return next(error);
  }
});

app.get('/jogo/:slug', setHtmlRouteCacheHeaders, async (req, res, next) => {
  try {
    const game = await gamesService.getGameBySlug(req.params.slug);

    if (game.redirect_required && game.canonical_slug && game.canonical_slug !== req.params.slug) {
      return res.redirect(301, `/jogo/${game.canonical_slug}`);
    }

    res.send(await buildGamePageHtml(game, req));
  } catch (error) {
    next(error);
  }
});

app.get('/biblioteca', setHtmlRouteCacheHeaders, async (req, res, next) => {
  try {
    res.setHeader('X-Robots-Tag', 'noindex, follow');
    res.send(await buildStaticPublicPageHtml(req, {
      view: 'library',
      path: '/biblioteca',
      title: 'Biblioteca - AtlasAchievement',
      description: 'Acompanhe jogos salvos, progresso de troféus e próximos passos na sua biblioteca do AtlasAchievement sem expor dados do usuário.'
    }));
  } catch (error) {
    next(error);
  }
});

app.get('/perfil', setHtmlRouteCacheHeaders, async (req, res, next) => {
  try {
    res.setHeader('X-Robots-Tag', 'noindex, follow');
    res.send(await buildStaticPublicPageHtml(req, {
      view: 'profile',
      path: '/perfil',
      title: 'Perfil - AtlasAchievement',
      description: 'Veja e edite seu perfil público no AtlasAchievement sem expor dados sensíveis no HTML inicial.'
    }));
  } catch (error) {
    next(error);
  }
});

app.get('/', setHtmlRouteCacheHeaders, async (req, res, next) => {
  try {
    res.send(await buildDefaultPageHtml(req));
  } catch (error) {
    next(error);
  }
});

app.get('*', (req, res, next) => {
  next(new AppError('A página que você tentou abrir não existe ou foi movida.', 404, null, 'PAGE_NOT_FOUND'));
});

app.use((error, req, res, next) => {
  if (req.path === '/api/auth/login' && error?.statusCode === 401) {
    registerFailedLoginAttempt(req);
  }

  next(error);
});

app.use(errorHandler);

module.exports = app;
