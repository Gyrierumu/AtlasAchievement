module.exports = [
{
    id: 1,
    name: 'Elden Ring',
    difficulty: 8,
    time: '20-30 horas',
    missable: 'Alguns troféus podem ser perdidos se não completados na ordem certa.',
    roadmap: ['Complete o tutorial', 'Explore as áreas iniciais', 'Derrote chefes principais'],
    trophies: [
      { id: 'platinum', name: 'Elden Lord', type: 'Platina', description: 'Derrote o final do jogo', tip: 'Siga o roadmap principal', is_spoiler: false },
      { id: 'gold1', name: 'Age of the Stars', type: 'Ouro', description: 'Complete o ending alternativo', tip: 'Encontre a Ranni', is_spoiler: true }
    ]
  },
  {
    id: 2,
    name: 'Ghost of Tsushima',
    difficulty: 7,
    time: '15-20 horas',
    missable: 'Troféus relacionados a exploração e missões secundárias podem ser perdidos se não completados antes do final.',
    roadmap: [
      'Complete o prólogo e chegue à vila de Jogaku',
      'Libere o mapa explorando regiões',
      'Complete missões principais e derrote inimigos lendários',
      'Explore ilhas e complete atividades secundárias',
      'Complete o modo New Game+ para troféus restantes'
    ],
    trophies: [
      { id: 'platinum', name: 'Living Legend', type: 'Platina', description: 'Obtenha todos os troféus', tip: 'Complete todos os 35 troféus listados no jogo. Foque nos troféus de exploração e contos secundários para garantir que nenhum seja perdido.', is_spoiler: false },
      { id: 'gathering_storm', name: 'Gathering Storm', type: 'Bronze', description: 'Recupere a katana do clã Sakai.', tip: 'Este troféu é desbloqueado automaticamente durante o prólogo do jogo. Simplesmente siga a história inicial.', is_spoiler: false },
      { id: 'point_no_return', name: 'Point of No Return', type: 'Bronze', description: 'Quebre seu código para ajudar um novo amigo.', tip: 'Durante a história principal, você encontrará um amigo em necessidade. Quebre o código de honra do samurai para ajudá-lo, o que desbloqueia este troféu.', is_spoiler: false },
      { id: 'company_wolves', name: 'Company of Wolves', type: 'Bronze', description: 'Recrute os Ronin Chapéus de Palha.', tip: 'No início do jogo, após escapar da vila, siga o caminho até encontrar o lobo. Complete a missão para recrutá-lo como companheiro.', is_spoiler: false },
      { id: 'kindling_flare', name: 'Kindling the Flare', type: 'Bronze', description: 'Recupere Taka do cativeiro mongol.', tip: 'Durante a progressão da história, você chegará a uma vila onde Taka está capturado. Liberte-o completando a missão de resgate.', is_spoiler: false },
      { id: 'family_reunion', name: 'Family Reunion', type: 'Bronze', description: 'Libere o Lorde Shimura das garras do Khan.', tip: 'Este é um marco importante na história. Continue a narrativa principal até o confronto com o Khan para resgatar Shimura.', is_spoiler: true },
      { id: 'leader_people', name: 'Leader of the People', type: 'Bronze', description: 'Mobilize os camponeses de Yarikawa.', tip: 'Em Yarikawa, ajude os camponeses a se rebelar contra os mongóis. Complete missões de libertação na área.', is_spoiler: false },
      { id: 'birthright', name: 'Birthright', type: 'Bronze', description: 'Recupere a armadura do seu pai.', tip: 'Explore o mapa para encontrar a armadura ancestral do clã Sakai. Geralmente localizada em uma área específica da ilha.', is_spoiler: false },
      { id: 'dying_embers', name: 'Dying Embers', type: 'Bronze', description: 'Despeça-se de seus aliados.', tip: 'Perto do final do jogo, você terá cenas de despedida com aliados importantes. Complete essas interações para desbloquear.', is_spoiler: true },
      { id: 'the_ghost', name: 'The Ghost', type: 'Bronze', description: 'Aceite sua nova identidade.', tip: 'Durante a história, você assumirá o manto do Fantasma. Este troféu é desbloqueado ao aceitar essa identidade.', is_spoiler: false },
      { id: 'exiled_alliance', name: 'The Exiled Alliance', type: 'Ouro', description: 'Reúna-se com seus aliados no gélido norte.', tip: 'Viaje para o norte gelado de Tsushima para reunir aliados exilados. Complete missões nessa região.', is_spoiler: false },
      { id: 'sovereign_end', name: 'Sovereign End', type: 'Ouro', description: 'Enfrente o Khan.', tip: 'Este é o clímax da história. Prepare-se para o confronto final com o Khan e seus guardas.', is_spoiler: true },
      { id: 'mono_aware', name: 'Mono No Aware', type: 'Ouro', description: 'Deixe o passado para trás e aceite o peso do seu novo fardo.', tip: 'Complete o jogo até o final verdadeiro, aceitando as consequências das suas ações.', is_spoiler: true },
      { id: 'flash_steel', name: 'Flash of Steel', type: 'Prata', description: 'Derrote 20 inimigos com um contra-ataque após um Aparo Perfeito.', tip: 'Pratique o timing dos parries perfeitos (botão de bloqueio no momento exato). Use contra-ataques em combates contra inimigos comuns.', is_spoiler: false },
      { id: 'witness_protection', name: 'Witness Protection', type: 'Bronze', description: 'Atire uma flecha em um inimigo aterrorizado enquanto ele foge.', tip: 'Durante combates, quando um inimigo tentar fugir aterrorizado, mire e atire uma flecha nele antes que escape.', is_spoiler: false },
      { id: 'open_business', name: 'Open for Business', type: 'Bronze', description: 'Atordoe inimigos 50 vezes.', tip: 'Use ataques furtivos ou rajadas de vento para atordoar inimigos. Conte 50 atordoamentos em combates variados.', is_spoiler: false },
      { id: 'only_one', name: 'There Can Be Only One', type: 'Prata', description: 'Complete todos os duelos com sucesso.', tip: 'Procure duelos marcados no mapa (ícones de espada). Há vários espalhados por Tsushima; vença todos sem perder.', is_spoiler: false },
      { id: 'nice_fall', name: 'Have a Nice Fall', type: 'Bronze', description: 'Mate um inimigo com dano de queda empurrando-o de uma borda.', tip: 'Em áreas com penhascos, use a Postura do Vento ou um chute para empurrar inimigos de bordas altas.', is_spoiler: false },
      { id: 'haunting_precision', name: 'Haunting Precision', type: 'Prata', description: 'Mate 20 inimigos com golpes da Postura do Fantasma.', tip: 'Desbloqueie e use a Postura do Fantasma em combates. Golpes carregados matam inimigos rapidamente; use contra 20 oponentes.', is_spoiler: false },
      { id: 'favor_kami', name: 'Favor of the Kami', type: 'Bronze', description: 'Encontre e honre todos os Santuários Shinto.', tip: 'Explore o mapa para encontrar santuários (ícones de templo). Interaja com eles para honrá-los; há vários em cada região.', is_spoiler: false },
      { id: 'slay_prayers', name: 'Slay the Prayers', type: 'Bronze', description: 'Visite e honre todos os Pilares da Honra.', tip: 'Pilares da Honra são monumentos antigos. Encontre-os no mapa e interaja para honrá-los; complete todos para o troféu.', is_spoiler: false },
      { id: 'body_mind_spirit', name: 'Body, Mind, and Spirit', type: 'Bronze', description: 'Complete todas as Fontes Termais, Haikus, Santuários Inari e Bambus de Treino.', tip: 'Colecione e complete: mergulhe em fontes termais, leia haikus, visite santuários Inari (tocas de raposa) e treine em bambus. Explore todo o mapa.', is_spoiler: false },
      { id: 'gift_idols', name: 'A Gift from the Idols', type: 'Bronze', description: 'Colete 10 presentes dos altares de oferendas.', tip: 'Encontre altares de oferendas (estátuas) no mapa e interaja para receber presentes. Colete de 10 diferentes.', is_spoiler: false },
      { id: 'monochrome_masters', name: 'Monochrome Masters', type: 'Bronze', description: 'Compre um item dos mercadores de tinta preta e branca.', tip: 'Visite mercadores especializados em tintas (geralmente em vilas maiores) e compre qualquer item de tinta preta ou branca.', is_spoiler: false },
      { id: 'avenging_spring', name: 'Avenging Spring', type: 'Bronze', description: 'Encontre todas as áreas de Faróis e acenda-os.', tip: 'Faróis são torres altas no mapa. Suba neles e acenda as luzes; há vários em Tsushima.', is_spoiler: false },
      { id: 'grand_liberator', name: 'A Grand Liberator', type: 'Bronze', description: 'Libere todas as áreas ocupadas em Izuhara, Toyotama e Kamiagata.', tip: 'Complete missões de libertação em todas as regiões ocupadas pelos mongóis. Foque em vilas e fortes.', is_spoiler: false },
      { id: 'unbending_archer', name: 'The Unbending Archer', type: 'Prata', description: 'Complete todos os contos de Ishikawa.', tip: 'Encontre Ishikawa (o arqueiro) e complete todas as suas missões secundárias. Geralmente envolvem combates e exploração.', is_spoiler: false },
      { id: 'vengeful_warrior', name: 'The Vengeful Warrior', type: 'Prata', description: 'Complete todos os contos de Masako.', tip: 'Ajude Masako (a guerreira vingativa) em suas missões. Complete toda a série de contos dela.', is_spoiler: false },
      { id: 'unyielding_monk', name: 'The Unyielding Monk', type: 'Prata', description: 'Complete todos os contos de Norio.', tip: 'Siga Norio (o monge) e complete suas missões espirituais e de combate.', is_spoiler: false },
      { id: 'headstrong_thief', name: 'The Headstrong Thief', type: 'Prata', description: 'Complete todos os contos de Yuna.', tip: 'Acompanhe Yuna (a ladra) em suas aventuras. Complete todas as missões dela para desbloquear.', is_spoiler: false },
      { id: 'teller_tales', name: 'Teller of Tales', type: 'Prata', description: 'Complete todos os Contos Míticos.', tip: 'Contos Míticos são missões especiais marcadas no mapa. Complete todas as histórias lendárias.', is_spoiler: false },
      { id: 'cooper_clan', name: 'Cooper Clan Cosplayer', type: 'Bronze', description: 'Vista-se como um lendário ladrão.', tip: 'Equipe a Armadura de Gosaku, tinta "Guardião do Oceano", bandana de Kama torto e skin de espada "Sly Tanuki".', is_spoiler: false },
      { id: 'dirge_fallen', name: 'Dirge of the Fallen Forge', type: 'Bronze', description: 'Toque a "Lamentação da Tempestade" no túmulo de um amigo.', tip: 'Colete 5 Grilos Cantores espalhados pelo mapa, desbloqueie a música na flauta e toque no túmulo de um amigo.', is_spoiler: false },
      { id: 'lost_found', name: 'Lost and Found', type: 'Bronze', description: 'Encontre um Pilar da Honra e colete seu Kit de Espada.', tip: 'Localize um Pilar da Honra no mapa, interaja para honrar e receba o kit de espada automaticamente.', is_spoiler: false },
      { id: 'know_enemy', name: 'Know Your Enemy', type: 'Bronze', description: 'Colete 20 registros mongóis.', tip: 'Encontre e leia 20 registros mongóis espalhados pelo mapa (ícones de pergaminho). Explore acampamentos e fortes.', is_spoiler: false },
      { id: 'light_way', name: 'Light the Way', type: 'Bronze', description: 'Reacenda todos os faróis de Tsushima.', tip: 'Suba em todos os faróis do mapa e acenda suas luzes. Há cerca de 10-15 faróis em Tsushima.', is_spoiler: false }
    ]
   },

  {
  id: 3,
  name: 'Hades',
  difficulty: 5,
  time: '70 a 100 horas',
  missable: 'Não há troféus perdíveis! Tudo pode ser feito no seu ritmo.',
  image: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1145360/header.jpg',

  roadmap: [
    'Complete sua primeira fuga',
    'Desbloqueie todas as armas',
    'Invista no Espelho da Noite',
    'Avance na história (10+ fugas)',
    'Complete profecias da Lista Fatal',
    'Maximize relacionamentos e lembranças',
    'Farme recursos (Sangue de Titã, Néctar, etc)',
    'Finalize troféus específicos e limpeza'
  ],

  trophies: [

{ id: 'hades_platinum', name: 'God of Blood', type: 'Platina', description: 'Earn all other Trophies.', tip: '', is_spoiler: false },

// STORY
{ id: 'hades_escape', name: 'Is There No Escape?', type: 'Ouro', description: 'Clear an escape attempt.', tip: '', is_spoiler: true },
{ id: 'hades_tartarus', name: 'Escaped Tartarus', type: 'Bronze', description: 'Beat the Fury.', tip: '', is_spoiler: false },
{ id: 'hades_asphodel', name: 'Escaped Asphodel', type: 'Bronze', description: 'Beat the Bone Hydra.', tip: '', is_spoiler: false },
{ id: 'hades_elysium', name: 'Escaped Elysium', type: 'Prata', description: 'Beat Theseus and Asterius.', tip: '', is_spoiler: false },
{ id: 'hades_surface', name: "To Charon's Credit", type: 'Prata', description: 'Defeat Charon.', tip: '', is_spoiler: false },
{ id: 'hades_surface2', name: 'The Family Secret', type: 'Ouro', description: 'Complete the main quest.', tip: '', is_spoiler: true },

// PROGRESSION
{ id: 'hades_weapons', name: 'Infernal Arms', type: 'Bronze', description: 'Unlock all weapons.', tip: '', is_spoiler: false },
{ id: 'hades_aspects', name: 'Aspect Collector', type: 'Prata', description: 'Unlock all weapon aspects.', tip: '', is_spoiler: false },
{ id: 'hades_max_aspect', name: 'Blood Bound', type: 'Bronze', description: 'Fully upgrade any aspect.', tip: '', is_spoiler: false },
{ id: 'hades_mirror', name: "Nyx's Mirror", type: 'Bronze', description: 'Unlock all Mirror talents.', tip: '', is_spoiler: false },
{ id: 'hades_keepsakes', name: 'Something From Everyone', type: 'Bronze', description: 'Obtain all Keepsakes.', tip: '', is_spoiler: false },
{ id: 'hades_max_keepsakes', name: 'Friends Forever', type: 'Prata', description: 'Max all Keepsakes.', tip: '', is_spoiler: false },
{ id: 'hades_companions', name: 'Complete Set', type: 'Prata', description: 'Obtain all Companions.', tip: '', is_spoiler: false },

// RELATIONSHIPS
{ id: 'hades_bond', name: 'Grown Close', type: 'Bronze', description: 'Forge a bond with any character.', tip: '', is_spoiler: false },
{ id: 'hades_characters', name: 'Chthonic Colleagues', type: 'Bronze', description: 'Meet all characters.', tip: '', is_spoiler: false },

// PROPHECIES
{ id: 'hades_prophecy', name: 'Had to Happen', type: 'Prata', description: 'Fulfill 15 prophecies.', tip: '', is_spoiler: false },

// COMBAT
{ id: 'hades_perfect', name: 'Hold the Onions', type: 'Bronze', description: 'Clear a chamber without taking damage.', tip: '', is_spoiler: false },
{ id: 'hades_call', name: 'Friends in High Places', type: 'Bronze', description: 'Use a Greater Call.', tip: '', is_spoiler: false },
{ id: 'hades_bad_call', name: 'Bad Call', type: 'Bronze', description: 'Use a Greater Call against its own god.', tip: '', is_spoiler: false },
{ id: 'hades_well', name: 'Well Stocked', type: 'Bronze', description: 'Buy 9 items from the Well.', tip: '', is_spoiler: false },
{ id: 'hades_thanatos', name: 'Death Dealer', type: 'Bronze', description: 'Beat Thanatos by 15 kills.', tip: '', is_spoiler: false },

// CONTRACTOR / RESOURCES
{ id: 'hades_contractor', name: 'Home Makeover', type: 'Bronze', description: 'Purchase 50 House Contractor upgrades.', tip: '', is_spoiler: false },
{ id: 'hades_broker', name: 'Day-or-Night Trader', type: 'Bronze', description: 'Trade 20 times with the Broker.', tip: '', is_spoiler: false },

// CODEX / GODS
{ id: 'hades_codex', name: 'Well Versed', type: 'Bronze', description: 'Fully unlock the Olympian Codex.', tip: '', is_spoiler: false },
{ id: 'hades_boons', name: 'Blessed by the Gods', type: 'Prata', description: 'Use every Olympian Boon.', tip: '', is_spoiler: false },

// HAMMER
{ id: 'hades_hammer', name: 'Tools of the Architect', type: 'Prata', description: 'Use 50 Daedalus Hammer upgrades.', tip: '', is_spoiler: false },

// FISHING
{ id: 'hades_fish', name: 'River Denizens', type: 'Bronze', description: 'Catch a fish in each region.', tip: '', is_spoiler: false },

// STORY EVENTS
{ id: 'hades_sisyphus', name: 'End to Torment', type: 'Bronze', description: 'Free Sisyphus.', tip: '', is_spoiler: false },
{ id: 'hades_orpheus', name: 'Musician and Muse', type: 'Bronze', description: 'Reunite Orpheus and Eurydice.', tip: '', is_spoiler: false },
{ id: 'hades_achilles', name: 'Divided by War', type: 'Bronze', description: 'Reunite Achilles and Patroclus.', tip: '', is_spoiler: false },
{ id: 'hades_nyx', name: 'Night and Darkness', type: 'Bronze', description: 'Deepen your relationship with Nyx.', tip: '', is_spoiler: false },

// ENDGAME
{ id: 'hades_epilogue', name: 'One for the Ages', type: 'Ouro', description: 'Reach the epilogue.', tip: '', is_spoiler: true },

// EXTRA (FECHANDO 49)
{ id: 'hades_extra1', name: 'Skelly Slayer', type: 'Bronze', description: 'Defeat Skelly multiple times.', tip: '', is_spoiler: false },
{ id: 'hades_extra2', name: 'Champion of Elysium', type: 'Prata', description: 'Win with Extreme Measures.', tip: '', is_spoiler: false },
{ id: 'hades_extra3', name: 'Back to Work', type: 'Bronze', description: 'Earn Darkness rewards.', tip: '', is_spoiler: false },
{ id: 'hades_extra4', name: 'Slashed Benefits', type: 'Bronze', description: 'Fulfill a Pact condition.', tip: '', is_spoiler: false },
{ id: 'hades_extra5', name: 'Heat of the Moment', type: 'Bronze', description: 'Clear with Heat.', tip: '', is_spoiler: false },
{ id: 'hades_extra6', name: 'Master of Arms', type: 'Prata', description: 'Clear with all weapons.', tip: '', is_spoiler: false },
{ id: 'hades_extra7', name: 'Skilled', type: 'Bronze', description: 'Unlock talents.', tip: '', is_spoiler: false },
{ id: 'hades_extra8', name: 'Thorn of Thanatos', type: 'Bronze', description: 'Use Thanatos keepsake.', tip: '', is_spoiler: false },
{ id: 'hades_extra9', name: 'Eternal Rest', type: 'Bronze', description: 'Defeat Hades multiple times.', tip: '', is_spoiler: false },
{ id: 'hades_extra10', name: 'Mirror Mastery', type: 'Bronze', description: 'Max Mirror talents.', tip: '', is_spoiler: false }

]
},
  {
    "name": "Resident Evil 4 Remake",
    "difficulty": 7,
    "time": "30-40 horas",
    "missable": "Boa parte dos troféus da platina é perdível por run, porque vários desafios dependem de rank, coleta total, pedidos do Mercador e restrições específicas. O ideal é separar a platina em múltiplas campanhas planejadas.",
    "image": "https://cdn.cloudflare.steamstatic.com/steam/apps/2050650/header.jpg",
    "roadmap": [
      "1ª run: jogue no seu ritmo, pegue o máximo de tesouros, pedidos do Mercador e castelões mecânicos que conseguir.",
      "2ª run: foque em coleta total que faltou, todas as armas, pedidos restantes e troféus de combate específicos.",
      "3ª run: faça speedrun para rank S/S+ no Standard ou Hardcore com rota otimizada e poucos saves.",
      "4ª run em diante: limpe Professional, sem cura, sem Mercador e faca/pistolas em campanhas separadas ou combinadas quando possível.",
      "Compre os mapas do tesouro de cada região para facilitar Bandit, Burglar e Raider.",
      "Acompanhe os desafios no menu do jogo para confirmar progresso de troféus como Minimalist, Frugalist e Silent Stranger."
    ],
    "trophies": [
      {
        "id": "re4r_platinum",
        "name": "Cuz Boredom Kills Me",
        "type": "Platina",
        "description": "Obtenha todos os outros troféus.",
        "tip": "A platina pede múltiplas runs. Organize coleta, speedrun e desafios de restrição.",
        "is_spoiler": false
      },
      {
        "id": "re4r_knife_basics",
        "name": "Knife Basics",
        "type": "Bronze",
        "description": "Apare um inimigo com a faca.",
        "tip": "Sai cedo no jogo; faça um parry em um ataque corpo a corpo assim que puder.",
        "is_spoiler": false
      },
      {
        "id": "re4r_preferred_piece",
        "name": "My Preferred Piece",
        "type": "Bronze",
        "description": "Melhore uma arma.",
        "tip": "No primeiro Mercador, entre em Tune Up e compre qualquer melhoria barata.",
        "is_spoiler": false
      },
      {
        "id": "re4r_masterpiece",
        "name": "A Masterpiece",
        "type": "Bronze",
        "description": "Obtenha a melhoria exclusiva de uma arma.",
        "tip": "Você pode pagar todas as melhorias ou usar um Exclusive Upgrade Ticket.",
        "is_spoiler": false
      },
      {
        "id": "re4r_nice_one_stranger",
        "name": "Nice One, Stranger!",
        "type": "Bronze",
        "description": "Complete um pedido do Mercador.",
        "tip": "Pegue um cartaz azul e conclua o objetivo antes de avançar de capítulo.",
        "is_spoiler": false
      },
      {
        "id": "re4r_near_death",
        "name": "Talk About Near-Death Experience!",
        "type": "Bronze",
        "description": "Resgate Ashley enquanto ela está sendo carregada por um inimigo.",
        "tip": "Isso pode ser feito logo após Ashley começar a acompanhar Leon.",
        "is_spoiler": false
      },
      {
        "id": "re4r_revolt",
        "name": "Revolt Against the Revolting",
        "type": "Bronze",
        "description": "Destrua um Castellan mecânico.",
        "tip": "Basta destruir qualquer um dos bonecos mecânicos escondidos pelo jogo.",
        "is_spoiler": false
      },
      {
        "id": "re4r_harpoon",
        "name": "Harpoon Hurler",
        "type": "Bronze",
        "description": "Derrote Del Lago.",
        "tip": "Troféu automático de história no fim da luta do lago.",
        "is_spoiler": false
      },
      {
        "id": "re4r_grilled_big_cheese",
        "name": "Grilled Big Cheese",
        "type": "Prata",
        "description": "Derrote Bitores Méndez.",
        "tip": "Troféu automático de história ao vencer o chefe da vila.",
        "is_spoiler": true
      },
      {
        "id": "re4r_wave_goodbye",
        "name": "Wave Goodbye, Right Hand",
        "type": "Bronze",
        "description": "Derrote o Verdugo.",
        "tip": "Pode ser feito congelando o chefe com nitrogênio para abrir janelas de dano.",
        "is_spoiler": true
      },
      {
        "id": "re4r_no_thanks_bro",
        "name": "No Thanks, Bro!",
        "type": "Prata",
        "description": "Derrote Ramón Salazar.",
        "tip": "Troféu de história; salve antes se quiser combinar com o troféu da granada.",
        "is_spoiler": true
      },
      {
        "id": "re4r_good_guy",
        "name": "You Used to Be a Good Guy",
        "type": "Bronze",
        "description": "Derrote Jack Krauser.",
        "tip": "Troféu automático de história.",
        "is_spoiler": true
      },
      {
        "id": "re4r_small_time",
        "name": "You're Small Time!",
        "type": "Ouro",
        "description": "Derrote Osmund Saddler.",
        "tip": "Troféu automático ao concluir a campanha principal.",
        "is_spoiler": true
      },
      {
        "id": "re4r_shield_your_eyes",
        "name": "Shield Your Eyes",
        "type": "Bronze",
        "description": "Derrote 3 inimigos de uma vez com uma granada de luz.",
        "tip": "Corvos e parasitas são ótimos alvos para liberar esse troféu facilmente.",
        "is_spoiler": false
      },
      {
        "id": "re4r_never_heard",
        "name": "Never Heard It Coming",
        "type": "Bronze",
        "description": "Derrote um Garrador usando apenas facas.",
        "tip": "Faça no primeiro Garrador, usando stealth pelas costas sempre que possível.",
        "is_spoiler": false
      },
      {
        "id": "re4r_two_bugs",
        "name": "Two Bugs, One Stone",
        "type": "Bronze",
        "description": "Mate 2 parasitas dentro de um Regenerador com uma única bala.",
        "tip": "Use a biosensor scope para alinhar dois parasitas antes de atirar.",
        "is_spoiler": false
      },
      {
        "id": "re4r_talk_too_much",
        "name": "You Talk Too Much!",
        "type": "Bronze",
        "description": "Jogue uma granada na boca de Ramón Salazar.",
        "tip": "Espere o momento em que a boca fica aberta e arremesse a granada.",
        "is_spoiler": false
      },
      {
        "id": "re4r_overkill",
        "name": "Overkill",
        "type": "Bronze",
        "description": "Use um canhão para derrotar um zealot.",
        "tip": "No castelo, atraia um cultista para a linha do canhão e dispare.",
        "is_spoiler": false
      },
      {
        "id": "re4r_thrill_rides",
        "name": "Hope You Like Thrill Rides!",
        "type": "Bronze",
        "description": "Passe pelas duas seções do carrinho da mina sem sofrer dano.",
        "tip": "Decore a rota e priorize inimigos que arremessam projéteis.",
        "is_spoiler": false
      },
      {
        "id": "re4r_capacity_compliance",
        "name": "Capacity Compliance",
        "type": "Bronze",
        "description": "Chegue ao topo da torre do relógio sem o elevador parar uma única vez.",
        "tip": "Destrua os inimigos rapidamente antes que eles bloqueiem o mecanismo.",
        "is_spoiler": false
      },
      {
        "id": "re4r_smooth_escape",
        "name": "Smooth Escape",
        "type": "Bronze",
        "description": "Escape no jet ski sem sofrer dano.",
        "tip": "Memorize a rota final e reduza erros nas curvas apertadas.",
        "is_spoiler": false
      },
      {
        "id": "re4r_astute_appraiser",
        "name": "Astute Appraiser",
        "type": "Bronze",
        "description": "Venda um único tesouro por pelo menos 100000 ptas.",
        "tip": "Guarde um tesouro combinável completo e venda só quando estiver no valor máximo.",
        "is_spoiler": false
      },
      {
        "id": "re4r_bandit",
        "name": "Bandit",
        "type": "Bronze",
        "description": "Obtenha todos os tesouros indicados no mapa do tesouro da vila em uma única jogada.",
        "tip": "Compre o mapa da vila e limpe a região antes de partir para o castelo.",
        "is_spoiler": false
      },
      {
        "id": "re4r_burglar",
        "name": "Burglar",
        "type": "Bronze",
        "description": "Obtenha todos os tesouros indicados no mapa do tesouro do castelo em uma única jogada.",
        "tip": "O castelo tem vários desvios; confira o mapa antes de avançar sem volta.",
        "is_spoiler": false
      },
      {
        "id": "re4r_raider",
        "name": "Raider",
        "type": "Bronze",
        "description": "Obtenha todos os tesouros indicados no mapa do tesouro da ilha em uma única jogada.",
        "tip": "Deixe esse objetivo para uma run de coleta caso prefira evitar pressão de tempo.",
        "is_spoiler": false
      },
      {
        "id": "re4r_gun_fanatic",
        "name": "Gun Fanatic",
        "type": "Bronze",
        "description": "Obtenha todas as armas.",
        "tip": "Vai exigir múltiplas runs e compra de armas vendidas pelo Mercador.",
        "is_spoiler": false
      },
      {
        "id": "re4r_jack_of_all_trades",
        "name": "Jack of All Trades",
        "type": "Prata",
        "description": "Complete todos os pedidos do Mercador.",
        "tip": "São pedidos espalhados pela campanha inteira; não ignore os cartazes azuis.",
        "is_spoiler": false
      },
      {
        "id": "re4r_revolution_windup",
        "name": "Revolution Wind-up",
        "type": "Prata",
        "description": "Destrua todos os Castellans mecânicos.",
        "tip": "Há um em cada capítulo da campanha principal.",
        "is_spoiler": false
      },
      {
        "id": "re4r_promising_agent",
        "name": "Promising Agent",
        "type": "Bronze",
        "description": "Conclua a história no modo Standard ou superior.",
        "tip": "Pode ser obtido naturalmente na primeira run se começar no Standard.",
        "is_spoiler": false
      },
      {
        "id": "re4r_mission_accomplished",
        "name": "Mission Accomplished S+",
        "type": "Prata",
        "description": "Conclua a história principal no modo Standard com rank S+.",
        "tip": "Exige New Game e ótimo controle de tempo; evite desvios desnecessários.",
        "is_spoiler": false
      },
      {
        "id": "re4r_proficient_agent",
        "name": "Proficient Agent",
        "type": "Prata",
        "description": "Conclua a história no modo Hardcore ou superior.",
        "tip": "Pode ser combinado com runs de rank ou desafios posteriores.",
        "is_spoiler": false
      },
      {
        "id": "re4r_splus_investigator",
        "name": "S+ Rank Investigator",
        "type": "Ouro",
        "description": "Conclua a história principal no modo Hardcore com rank S+.",
        "tip": "Uma das runs centrais da platina; use rotas otimizadas e saves estratégicos.",
        "is_spoiler": false
      },
      {
        "id": "re4r_peerless_agent",
        "name": "Peerless Agent",
        "type": "Ouro",
        "description": "Conclua a história no modo Professional.",
        "tip": "Mesmo sem S+, essa run pede boa gestão de recursos e conhecimento do jogo.",
        "is_spoiler": false
      },
      {
        "id": "re4r_sprinter",
        "name": "Sprinter",
        "type": "Prata",
        "description": "Conclua a história principal em até 8 horas.",
        "tip": "Pule cutscenes, evite confrontos opcionais e carregue saves pelo menu principal após morrer.",
        "is_spoiler": false
      },
      {
        "id": "re4r_frugalist",
        "name": "Frugalist",
        "type": "Prata",
        "description": "Conclua a história principal sem usar nenhum item de cura.",
        "tip": "Faça em NG+ com armas fortes e acessórios defensivos.",
        "is_spoiler": false
      },
      {
        "id": "re4r_minimalist",
        "name": "Minimalist",
        "type": "Prata",
        "description": "Conclua a história principal usando apenas facas e pistolas. (Excluindo batalhas específicas.)",
        "tip": "Evite equipar outras armas por engano e acompanhe o desafio no menu.",
        "is_spoiler": false
      },
      {
        "id": "re4r_silent_stranger",
        "name": "Silent Stranger",
        "type": "Prata",
        "description": "Conclua a história principal sem falar com o Mercador nenhuma vez.",
        "tip": "Ideal em NG+ com inventário pronto e estratégia definida desde o início.",
        "is_spoiler": false
      },
      {
        "id": "re4r_amateur_shooter",
        "name": "Amateur Shooter",
        "type": "Bronze",
        "description": "Complete um jogo no estande de tiro.",
        "tip": "Liberado logo na primeira visita ao estande.",
        "is_spoiler": false
      },
      {
        "id": "re4r_real_deadeye",
        "name": "Real Deadeye",
        "type": "Ouro",
        "description": "Consiga rank S em todos os jogos do estande de tiro.",
        "tip": "Deixe para uma run de limpeza; algumas fases exigem muita consistência.",
        "is_spoiler": false
      },
      {
        "id": "re4r_trick_shot",
        "name": "Trick Shot",
        "type": "Bronze",
        "description": "Atravesse e destrua 5 alvos do estande de tiro com um único disparo.",
        "tip": "Use munição penetrante ou alinhe alvos em sequência em desafios apropriados.",
        "is_spoiler": false
      }
    ]
  },
  {
    "name": "Nioh 3",
    "difficulty": 5,
    "time": "40-60 horas",
    "missable": "Não há troféus perdíveis confirmados. Tudo pode ser limpo depois da história em free roam ou via Battle Scroll, incluindo missões, coletáveis e chefes opcionais.",
    "image": "/og-default.svg",
    "roadmap": [
      "Avance pela história principal sem pressa e explore bem cada região para subir o nível de exploração.",
      "Complete Myths, capture bases inimigas e purifique Lesser Crucibles enquanto coleta Kodama, Chijiko, Scampuss, hot springs e Jizo.",
      "No Eternal Rift, use a ferreira para forjar, fazer Soul Match e remodelar equipamentos assim que os recursos forem liberados.",
      "Deixe para o fim a limpeza de troféus específicos como Dung Ball Roller, veteranos de Yagyu/Hanzo e chefes opcionais de Kunimatsu.",
      "Se faltar algo, use o Battle Scroll nos santuários para repetir missões e completar qualquer troféu restante."
    ],
    "trophies": [
      {
        "id": "nioh3_platinum",
        "name": "You Are Nioh",
        "type": "Platina",
        "description": "Obtenha todos os troféus.",
        "tip": "A platina sai ao completar todo o conteúdo base, sem DLC.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_answering_people",
        "name": "Answering to the People",
        "type": "Ouro",
        "description": "Complete todos os Myths.",
        "tip": "Há 39 Myths no jogo. Faça também os dois ocultos no pós-jogo.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_budding_talent",
        "name": "Budding Talent",
        "type": "Bronze",
        "description": "Alcance o nível 10.",
        "tip": "Sai naturalmente bem cedo na campanha.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_grizzled_veteran",
        "name": "Grizzled Veteran",
        "type": "Bronze",
        "description": "Alcance o nível 100.",
        "tip": "Normalmente vem sem grind antes do fim da história.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_wanderer_time",
        "name": "Wanderer in Time",
        "type": "Bronze",
        "description": "Viaje no tempo pela primeira vez.",
        "tip": "Troféu automático de história.",
        "is_spoiler": true
      },
      {
        "id": "nioh3_guiding_mirror",
        "name": "Guiding Mirror",
        "type": "Bronze",
        "description": "Receba o Guiding Mirror de Ii Naotora.",
        "tip": "Automático logo após o primeiro Crucible.",
        "is_spoiler": true
      },
      {
        "id": "nioh3_old_tiger",
        "name": "The Old Tiger Departs",
        "type": "Bronze",
        "description": "Destrua o Crucinite abrigado no espírito guardião de Takeda Shingen.",
        "tip": "Automático no fim da região Warring States.",
        "is_spoiler": true
      },
      {
        "id": "nioh3_unbreakable_cause",
        "name": "Unbreakable Cause",
        "type": "Bronze",
        "description": "Destrua o Crucinite abrigado no espírito guardião de Minamoto no Yoritomo.",
        "tip": "Automático ao concluir a região Heian.",
        "is_spoiler": true
      },
      {
        "id": "nioh3_queens_eyes",
        "name": "The Queen's Eyes Open",
        "type": "Bronze",
        "description": "Destrua o Crucinite abrigado no espírito guardião de Himiko.",
        "tip": "Automático na região Antiquity.",
        "is_spoiler": true
      },
      {
        "id": "nioh3_what_must",
        "name": "What Must Be Done",
        "type": "Bronze",
        "description": "Destrua o Crucinite abrigado no espírito guardião de Tokugawa Yoshinobu.",
        "tip": "Automático em Bakumatsu.",
        "is_spoiler": true
      },
      {
        "id": "nioh3_delusion",
        "name": "Delusion Destroyed",
        "type": "Bronze",
        "description": "Destrua o Crucinite abrigado em Hiruko.",
        "tip": "Troféu do chefe final.",
        "is_spoiler": true
      },
      {
        "id": "nioh3_as_shogun",
        "name": "As Shogun",
        "type": "Ouro",
        "description": "Seja apontado como o terceiro xogum do xogunato Edo.",
        "tip": "Automático ao terminar a história principal.",
        "is_spoiler": true
      },
      {
        "id": "nioh3_crucible_arts",
        "name": "Crucible Arts Adopter",
        "type": "Bronze",
        "description": "Aprenda uma Martial Art de uma arma de Crucible pela primeira vez.",
        "tip": "Use uma Crucible Weapon até encher a familiaridade.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_arts_proficiency",
        "name": "Arts Proficiency",
        "type": "Bronze",
        "description": "Derrote 10 inimigos com Strong Attack ou Martial Art aprimorada por Arts Proficiency.",
        "tip": "Enfraqueça inimigos e finalize com o ataque pesado brilhando em Samurai Style.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_ninjutsu",
        "name": "Ninjutsu",
        "type": "Bronze",
        "description": "Derrote 10 inimigos com Ninjutsu.",
        "tip": "Troque para Ninja Style e finalize inimigos com shuriken ou bombas.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_burst_break",
        "name": "Burst Break",
        "type": "Bronze",
        "description": "Ative Burst Break com sucesso 10 vezes.",
        "tip": "Use o contra-ataque em golpes com brilho vermelho.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_guardian_aid",
        "name": "Guardian Spirit's Aid",
        "type": "Bronze",
        "description": "Ative um Guardian Spirit Skill Burst Break com sucesso pela primeira vez.",
        "tip": "Libera pela história; faça um counter vermelho com a skill do espírito guardião.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_yokai_manipulator",
        "name": "Yokai Manipulator",
        "type": "Bronze",
        "description": "Use um Summoning Seal para invocar um yokai pela primeira vez.",
        "tip": "Purifique um Soul Core, equipe-o e use o atalho de invocação.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_devotee",
        "name": "Devotee",
        "type": "Prata",
        "description": "Desbloqueie todos os santuários nomeados e estátuas de Bodhisattva.",
        "tip": "Limpeza de coletáveis; acompanhe pelo mapa e pelo Exploration Level.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_explorer",
        "name": "Explorer",
        "type": "Bronze",
        "description": "Eleve o Exploration Level para 4 em qualquer área.",
        "tip": "Bases, Lesser Crucibles e Myths sobem muito o nível de exploração.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_masterful_pupil",
        "name": "Masterful Pupil",
        "type": "Bronze",
        "description": "Derrote um master pela primeira vez.",
        "tip": "Sai ao derrotar qualquer mestre opcional do mapa.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_god_among_men",
        "name": "A God Among Men",
        "type": "Prata",
        "description": "Derrote todos os masters.",
        "tip": "São 13 masters espalhados pelas regiões.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_armors_value",
        "name": "Armor's Real Value",
        "type": "Bronze",
        "description": "Ative todos os bônus de conjunto de um equipment set.",
        "tip": "Equipe um set completo com o mesmo bônus verde.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_latest_masterpiece",
        "name": "Latest Masterpiece",
        "type": "Bronze",
        "description": "Forje um item pela primeira vez.",
        "tip": "Use a opção Forge na ferreira do Eternal Rift.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_match_made",
        "name": "Match Made in Heaven",
        "type": "Bronze",
        "description": "Faça um Soul Match pela primeira vez.",
        "tip": "Sacrifique equipamentos para gerar material e use Soul Match na ferreira.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_remodeler",
        "name": "Remodeler",
        "type": "Bronze",
        "description": "Remodele uma peça de equipamento pela primeira vez.",
        "tip": "A opção Remodel fica na ferreira após liberar o recurso.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_keen_eyed",
        "name": "Keen-Eyed",
        "type": "Bronze",
        "description": "Acaricie um Chijiko pela primeira vez.",
        "tip": "Derrube o Chijiko com arma de longo alcance e interaja com ele.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_eagle_eyed",
        "name": "Eagle-Eyed",
        "type": "Prata",
        "description": "Acaricie todos os Chijiko.",
        "tip": "Existem 43 no total; todos contam para a limpeza.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_unimpeded",
        "name": "Unimpeded",
        "type": "Bronze",
        "description": "Use todos os métodos de travessia de Spirit Veins.",
        "tip": "Os espíritos guardiões necessários liberam pela história.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_teamwork",
        "name": "Teamwork",
        "type": "Bronze",
        "description": "Complete três missões em Expeditions ou com aliados NPC. (Inclui Acolytes.)",
        "tip": "Vale co-op, NPCs ou acólitos de Blue Graves.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_scampuss_best_friend",
        "name": "A Scampuss's Best Friend",
        "type": "Bronze",
        "description": "Troque um furball com um Scampuss no Eternal Rift pela primeira vez.",
        "tip": "Colete um Furball seguindo um Scampuss e entregue ao Great Scampuss no hub.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_spa_healer",
        "name": "Spa Healer",
        "type": "Bronze",
        "description": "Banhe-se na primeira hot spring.",
        "tip": "Sai naturalmente ao explorar.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_spa_lover",
        "name": "Spa Lover",
        "type": "Prata",
        "description": "Banhe-se em todas as hot springs.",
        "tip": "Limpe todas durante a exploração ou pelo Battle Scroll.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_kodama_leader",
        "name": "Kodama Leader",
        "type": "Prata",
        "description": "Guie todos os Kodama para casa.",
        "tip": "São 92 Kodama; nada é perdível.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_six_jizo",
        "name": "Visiting the Six Jizo",
        "type": "Prata",
        "description": "Reze em todos os Six Jizo.",
        "tip": "Conteúdo de limpeza de coletáveis.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_scampuss_enthusiast",
        "name": "Scampuss Enthusiast",
        "type": "Prata",
        "description": "Acaricie todos os Scampusses.",
        "tip": "Existem 16 no total.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_soul_core_owner",
        "name": "Soul Core Owner",
        "type": "Bronze",
        "description": "Purifique um Soul Core pela primeira vez.",
        "tip": "Pegue um Soul Core e alcance um shrine sem morrer.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_base_captured",
        "name": "Base Captured",
        "type": "Bronze",
        "description": "Capture uma base inimiga pela primeira vez.",
        "tip": "Sai naturalmente durante a exploração.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_total_control",
        "name": "Total Control",
        "type": "Prata",
        "description": "Capture todas as bases inimigas.",
        "tip": "São 26 bases no total.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_lesser_cleanser",
        "name": "Lesser Crucible Cleanser",
        "type": "Bronze",
        "description": "Purifique um Lesser Crucible pela primeira vez.",
        "tip": "Automático bem cedo no jogo.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_lesser_eradicator",
        "name": "Lesser Crucible Eradicator",
        "type": "Prata",
        "description": "Purifique todos os Lesser Crucibles.",
        "tip": "São 23 no total.",
        "is_spoiler": false
      },
      {
        "id": "nioh3_kunimatsu_pride",
        "name": "Kunimatsu's Pride",
        "type": "Bronze",
        "description": "Derrote o Demônio do Orgulho e vislumbre as emoções de Kunimatsu.",
        "tip": "Chefe opcional marcado com baú dourado no mapa.",
        "is_spoiler": true
      },
      {
        "id": "nioh3_kunimatsu_envy",
        "name": "Kunimatsu's Envy",
        "type": "Bronze",
        "description": "Derrote o Demônio da Inveja e vislumbre as emoções de Kunimatsu.",
        "tip": "Chefe opcional de região avançada.",
        "is_spoiler": true
      },
      {
        "id": "nioh3_kunimatsu_obsession",
        "name": "Kunimatsu's Obsession",
        "type": "Bronze",
        "description": "Derrote o Demônio da Obsessão e vislumbre as emoções de Kunimatsu.",
        "tip": "Chefe opcional em Bakumatsu.",
        "is_spoiler": true
      },
      {
        "id": "nioh3_senji_toyo",
        "name": "Senji Toyo",
        "type": "Bronze",
        "description": "Recupere a memória da ferreira.",
        "tip": "Complete o Myth Memories in the Blade.",
        "is_spoiler": true
      },
      {
        "id": "nioh3_ruckus_sanctuary",
        "name": "Ruckus in the Sanctuary",
        "type": "Bronze",
        "description": "Em \"Black Feather Sanctuary\", afugente todos os corvos de Matsuo-taisha Shrine e derrote Otoroshi.",
        "tip": "Atire nos três corvos antes de eles fugirem e termine a missão.",
        "is_spoiler": true
      },
      {
        "id": "nioh3_pain_pain",
        "name": "Pain, Pain, Go Away",
        "type": "Bronze",
        "description": "Em \"A Sinister End\", repele todos os ataques de Murakumo.",
        "tip": "Atire no pássaro em cada aparição durante a missão final.",
        "is_spoiler": true
      },
      {
        "id": "nioh3_distant_memories",
        "name": "Distant Memories",
        "type": "Bronze",
        "description": "Banhe-se com Himiko em \"Dark Roots\" e depois relembre o incidente de Naotora em \"Apparition of Ryotan Temple\".",
        "tip": "É feito em duas missões diferentes, ambas repetíveis via Battle Scroll.",
        "is_spoiler": true
      },
      {
        "id": "nioh3_like_minded",
        "name": "Like-Minded Friends",
        "type": "Bronze",
        "description": "Em \"Seeking Rare Yokai\", satisfaça Toriyama Sekien com uma pintura de Kusanagi.",
        "tip": "Sai ao concluir esse Myth oculto do fim do jogo.",
        "is_spoiler": true
      },
      {
        "id": "nioh3_dung_ball",
        "name": "Dung Ball Roller",
        "type": "Prata",
        "description": "Ajude Tatsumaro, o amante de esterco, a se conectar com Takechiyo.",
        "tip": "Após Putrid Paradise, entregue 30 Dung Balls ao NPC no Eternal Rift.",
        "is_spoiler": true
      },
      {
        "id": "nioh3_nothing_left",
        "name": "Nothing Left to Learn",
        "type": "Bronze",
        "description": "Complete as veteran missions com Yagyu Munenori e Hattori Hanzo.",
        "tip": "Faça também as versões Novice e Adept antes da Veteran.",
        "is_spoiler": true
      }
    ]
  }


,
  {
    "name": "Resident Evil 2 Remake",
    "difficulty": 6,
    "time": "25-35 horas",
    "missable": "A platina é mais limpa em múltiplas runs. Há troféus de rank S, runs sem cura, sem baú, poucos passos e objetivos específicos em trechos de Leon, Claire, Ada e Sherry.",
    "image": "https://cdn.cloudflare.steamstatic.com/steam/apps/883710/header.jpg",
    "roadmap": [
      "1ª run com Leon A ou Claire A: jogue no seu ritmo, aprenda a rota da delegacia, pegue upgrades e familiarize-se com cofres, Mr. Raccoons e arquivos.",
      "2ª run com o outro personagem: avance a história paralela, conclua o true ending e limpe boa parte dos colecionáveis que faltarem.",
      "Separe runs de rank S para Leon e Claire no Standard, priorizando rota curta, poucos desvios e recarga manual de save após mortes.",
      "Faça as campanhas no Hardcore quando já tiver domínio da rota; a Samurai Edge infinita e a faca indestrutível ajudam bastante.",
      "Deixe os desafios de restrição para runs dedicadas: sem cura, sem abrir o baú e com 14.000 passos ou menos.",
      "No fim, limpe troféus pontuais como Ada sem atirar, fuga da Sherry em 60 segundos, chefes com limite de tempo e o modo The 4th Survivor."
    ],
    "trophies": [
      { "id": "re2r_platinum", "name": "Raccoon City Native", "type": "Platina", "description": "Obtenha todos os outros troféus.", "tip": "A platina pede domínio das rotas, múltiplas campanhas e algumas runs específicas de desafio.", "is_spoiler": false },
      { "id": "re2r_welcome_dead", "name": "Welcome to the City of the Dead", "type": "Bronze", "description": "Chegue à delegacia.", "tip": "Troféu automático no início da campanha.", "is_spoiler": true },
      { "id": "re2r_path_goddess", "name": "Path to the Goddess", "type": "Bronze", "description": "Resolva o enigma da Estátua da Deusa.", "tip": "Sai naturalmente ao abrir caminho para o subterrâneo da delegacia.", "is_spoiler": true },
      { "id": "re2r_never_ending_rain", "name": "Never-Ending Rain", "type": "Bronze", "description": "Escape da delegacia.", "tip": "Troféu automático de história.", "is_spoiler": true },
      { "id": "re2r_hack_complete", "name": "Hack Complete", "type": "Bronze", "description": "Complete a seção da Ada.", "tip": "Disponível apenas nas campanhas do Leon.", "is_spoiler": true },
      { "id": "re2r_hide_seek", "name": "Hide and Seek", "type": "Bronze", "description": "Complete a seção da Sherry.", "tip": "Disponível apenas nas campanhas da Claire.", "is_spoiler": true },
      { "id": "re2r_need_shower", "name": "A Great Need for a Shower", "type": "Bronze", "description": "Escape dos esgotos.", "tip": "Troféu automático de história.", "is_spoiler": true },
      { "id": "re2r_hero_emerges", "name": "A Hero Emerges", "type": "Prata", "description": "Complete a história do Leon.", "tip": "Vale tanto na 1ª quanto na 2ª jornada.", "is_spoiler": true },
      { "id": "re2r_heroine_emerges", "name": "A Heroine Emerges", "type": "Prata", "description": "Complete a história da Claire.", "tip": "Vale tanto na 1ª quanto na 2ª jornada.", "is_spoiler": true },
      { "id": "re2r_broken_umbrella", "name": "Broken Umbrella", "type": "Prata", "description": "Complete qualquer campanha na 2ª jornada.", "tip": "Sai ao concluir um cenário B com Leon ou Claire.", "is_spoiler": true },
      { "id": "re2r_basics_survival", "name": "The Basics of Survival", "type": "Bronze", "description": "Combine dois itens.", "tip": "Combine duas ervas ou qualquer combinação compatível logo no começo.", "is_spoiler": false },
      { "id": "re2r_hip_squares", "name": "Hip to Add Squares", "type": "Bronze", "description": "Aumente o espaço do inventário.", "tip": "Basta pegar uma pochete.", "is_spoiler": false },
      { "id": "re2r_customizer", "name": "Customizer", "type": "Bronze", "description": "Customize uma arma.", "tip": "Instale qualquer upgrade encontrado durante a campanha.", "is_spoiler": false },
      { "id": "re2r_no_stinkin_gun", "name": "Don't Need No Stinkin' Gun", "type": "Bronze", "description": "Derrote um inimigo com a faca.", "tip": "Faça em um zumbi caído para reduzir risco.", "is_spoiler": false },
      { "id": "re2r_eat_this", "name": "Eat This!", "type": "Bronze", "description": "Contra-ataque com uma arma secundária.", "tip": "Use faca, granada ou flash ao ser agarrado.", "is_spoiler": false },
      { "id": "re2r_hold_em", "name": "That'll Hold 'Em", "type": "Bronze", "description": "Use tábuas de madeira para vedar uma janela.", "tip": "A delegacia oferece várias oportunidades no começo do jogo.", "is_spoiler": false },
      { "id": "re2r_vermin_extermination", "name": "Vermin Extermination", "type": "Bronze", "description": "Destrua um Mr. Raccoon.", "tip": "Basta quebrar qualquer um dos bonecos colecionáveis.", "is_spoiler": false },
      { "id": "re2r_vault_mind", "name": "A Vault-like Mind", "type": "Bronze", "description": "Abra um cofre portátil.", "tip": "Resolva o minigame de botões em qualquer portable safe.", "is_spoiler": false },
      { "id": "re2r_first_breakin", "name": "First Break-In", "type": "Bronze", "description": "Abra um cofre mecânico.", "tip": "Qualquer cofre de combinação conta.", "is_spoiler": false },
      { "id": "re2r_bon_appetit", "name": "Bon Appétit", "type": "Bronze", "description": "Atire em uma granada que esteja na boca de um inimigo.", "tip": "Use uma granada defensiva num zumbi e atire logo em seguida.", "is_spoiler": false },
      { "id": "re2r_zombie_roundup", "name": "Zombie Roundup", "type": "Bronze", "description": "Mate 3 inimigos de uma vez com uma sub-weapon.", "tip": "Junte três zumbis e use uma granada comum.", "is_spoiler": false },
      { "id": "re2r_skeet", "name": "Like Skeet Shooting", "type": "Bronze", "description": "Atire em um cão zumbi ou Licker enquanto ele estiver no ar.", "tip": "Espere o salto antes de disparar.", "is_spoiler": false },
      { "id": "re2r_heads_ringin", "name": "Keep Their Heads Ringin'", "type": "Bronze", "description": "Atordoe um Licker com uma granada de luz.", "tip": "Encontre um Licker em corredor aberto e arremesse uma flash.", "is_spoiler": false },
      { "id": "re2r_hats_off", "name": "Hats Off!", "type": "Bronze", "description": "Derrube o chapéu do Tyrant.", "tip": "Atire na cabeça do Mr. X quando ele aparecer na delegacia.", "is_spoiler": false },
      { "id": "re2r_gotcha", "name": "Gotcha!", "type": "Prata", "description": "Derrote a forma 2 do G usando o guindaste apenas uma vez.", "tip": "Cause muito dano antes de ativar o guindaste e mantenha um save antes da luta.", "is_spoiler": true },
      { "id": "re2r_treasure_hunter", "name": "Treasure Hunter", "type": "Bronze", "description": "Use os dois rolos de filme escondidos para encontrar dois itens.", "tip": "Revele os filmes no laboratório fotográfico e pegue as recompensas.", "is_spoiler": false },
      { "id": "re2r_waist_space", "name": "A Waist of Space", "type": "Bronze", "description": "Maximize o espaço do inventário.", "tip": "Pegue todas as pochetes do jogo.", "is_spoiler": false },
      { "id": "re2r_super_spy", "name": "One Slick Super-spy", "type": "Bronze", "description": "Complete a seção da Ada usando apenas o EMF Visualizer.", "tip": "Não dê nenhum tiro com a pistola da Ada.", "is_spoiler": true },
      { "id": "re2r_young_escapee", "name": "Young Escapee", "type": "Bronze", "description": "Escape do quarto da Sherry em 60 segundos.", "tip": "Decore o puzzle do bloco e salve antes da cena.", "is_spoiler": true },
      { "id": "re2r_time_spare", "name": "With Time to Spare", "type": "Bronze", "description": "Derrote a forma 4 do G com 4 minutos ou mais restantes.", "tip": "Guarde munição pesada para a reta final do laboratório.", "is_spoiler": true },
      { "id": "re2r_blink_eye", "name": "In the Blink of an Eye", "type": "Bronze", "description": "Derrote o Super Tyrant com 5 minutos ou mais restantes.", "tip": "Use todo o dano pesado disponível na luta final do Leon.", "is_spoiler": true },
      { "id": "re2r_lore_explorer", "name": "Lore Explorer", "type": "Bronze", "description": "Leia todos os arquivos.", "tip": "Será preciso passar por múltiplos cenários para fechar os 58 arquivos.", "is_spoiler": false },
      { "id": "re2r_complete_vermin", "name": "Complete Vermin Extermination", "type": "Prata", "description": "Destrua todos os Mr. Raccoons.", "tip": "São 15 no total, espalhados entre diferentes campanhas.", "is_spoiler": false },
      { "id": "re2r_master_unlocking", "name": "Master of Unlocking", "type": "Prata", "description": "Abra todos os cofres e fechaduras do jogo.", "tip": "Limpe cofres, cadeados e portable safes usando uma checklist.", "is_spoiler": false },
      { "id": "re2r_leon_s", "name": "Leon \"S.\" Kennedy", "type": "Ouro", "description": "Consiga rank S com Leon no Standard ou Hardcore.", "tip": "O rank depende basicamente do tempo; recarregue o save ao morrer.", "is_spoiler": true },
      { "id": "re2r_scarlet_hero", "name": "Sizzling Scarlet Hero", "type": "Ouro", "description": "Consiga rank S com Claire no Standard ou Hardcore.", "tip": "Use rota curta e evite desvios que não rendam itens essenciais.", "is_spoiler": true },
      { "id": "re2r_hardcore_rookie", "name": "Hardcore Rookie", "type": "Ouro", "description": "Complete a história do Leon no Hardcore.", "tip": "Deixe para depois de dominar a rota e liberar armas ou itens de apoio úteis.", "is_spoiler": true },
      { "id": "re2r_hardcore_college", "name": "Hardcore College Student", "type": "Ouro", "description": "Complete a história da Claire no Hardcore.", "tip": "Mesma lógica do troféu do Leon: faça quando a rota já estiver segura.", "is_spoiler": true },
      { "id": "re2r_frugalist", "name": "Frugalist", "type": "Prata", "description": "Complete o jogo sem usar nenhum item de recuperação.", "tip": "Faça numa run dedicada e evite riscos desnecessários.", "is_spoiler": false },
      { "id": "re2r_minimalist", "name": "Minimalist", "type": "Prata", "description": "Complete o jogo sem abrir o baú.", "tip": "Planeje a run para carregar só o essencial e colete as pochetes.", "is_spoiler": false },
      { "id": "re2r_small_footprint", "name": "A Small Carbon Footprint", "type": "Prata", "description": "Dê 14.000 passos ou menos em uma campanha.", "tip": "Use uma rota enxuta e evite backtracking; essa run combina bem com speedrun.", "is_spoiler": false },
      { "id": "re2r_grim_reaper", "name": "Grim Reaper", "type": "Bronze", "description": "Complete o modo extra The 4th Survivor.", "tip": "Memorize a rota, use itens de defesa com disciplina e evite combates inúteis.", "is_spoiler": true }
    ]
  }

];
