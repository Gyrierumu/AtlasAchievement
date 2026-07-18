# Relatório factual — Resident Evil 5 — Fase 2

Data da conclusão: **18/07/2026**

Escopo: somente a Fase 2 do guia de Resident Evil 5. A Fase 1 foi preservada.

## 1. Diagnóstico antes das alterações

- O seed continha 36 FAQs, mas o renderer SSR limitava a saída pública de Resident Evil 5 a 19.
- O cliente possuía um segundo limite fixo de 19. Durante a auditoria, uma correção apenas no servidor produziu 36 FAQs no SSR e no JSON-LD, mas a hidratação voltou a reduzir o DOM a 19. Isso confirmou que havia duas causas independentes.
- O seed continha 12 `attentionPoints`, enquanto `attention_count` era calculado a partir da soma de troféus marcados como perdíveis e spoilers. Para RE5, essa métrica retornava 6 e não representava o bloco editorial público.
- As 30 localizações de BSAA, 18 Score Stars, 3 Agitator Majini e alguns tesouros críticos ainda dependiam demais dos vídeos.
- Não havia um compêndio único e executável de chefes, minibosses e encontros críticos.
- O snapshot preservava FAQs e DLCs, mas o exportador ainda não transportava o novo compêndio, a auditoria de vídeos nem a configuração de paridade.

## 2. Causa raiz e correção de paridade

A causa não era falta de dados: eram regras de apresentação e contagem divergentes.

1. O renderer SSR em `src/app.js` cortava a FAQ com um limite por slug.
2. O renderer hidratado em `public/js/ui-guide.js` aplicava outro limite por slug e substituía o HTML SSR.
3. `src/services/games.service.js` calculava `attention_count` com sinais de troféus, não com os 12 pontos editoriais efetivamente exibidos.

A correção criou no próprio guia a configuração:

```js
editorialDisplay: {
  faqMode: 'all',
  attentionMode: 'editorial'
}
```

SSR, hidratação e serviço de API agora leem a mesma decisão editorial. Os outros jogos mantêm os limites e comportamentos anteriores. Não foram espalhados números 36 ou 12 pelos renderers.

Resultado validado:

| Superfície | FAQs | Pontos de atenção |
|---|---:|---:|
| Seed | 36 | 12 |
| Snapshot | 36 | 12 |
| API | 36 | 12 |
| `attention_count` | — | 12 |
| SSR | 36 | 12 |
| DOM após hidratação | 36 | 12 |
| FAQ JSON-LD | 36 | — |

Também foram confirmados IDs únicos, ausência de anchors quebrados e nenhuma entrada removida após a hidratação.

## 3. Inventário de chefes e encontros críticos

O compêndio possui 22 entradas. Inimigos comuns não foram promovidos a chefes; horda, miniboss e encontro crítico aparecem identificados como tais.

| # | Capítulo/DLC | Encontro | Classificação | Relação operacional |
|---:|---|---|---|---|
| 1 | 1-1 | Executioner Majini e cerco da Assembleia | Encontro crítico; miniboss opcional | Sobrevivência do cerco e Topaz (Marquise) |
| 2 | 1-2 | Uroboros | Chefe obrigatório | Fornalha, cilindros e conclusão do capítulo |
| 3 | 2-1 | Chainsaw Majini | Miniboss obrigatório | Port Key/Partner Action |
| 4 | 2-2 | Popokarimu | Chefe obrigatório | Minas explosivas e abertura do abdômen |
| 5 | 2-3 | Ndesu | Chefe obrigatório em veículo | Turrets, QTEs e ponto crítico do Professional |
| 6 | 3-1 | Dois Giant Majini na vila | Encontro crítico com minibosses | Vila após as quatro slates |
| 7 | 3-3 | Irving mutado | Chefe obrigatório | Tentáculos, boca e torreta traseira |
| 8 | 4-1 | Popokarimu opcional | Chefe opcional/tesouro | Soul Gem; não fugir pela saída |
| 9 | 5-1 | Horda de Licker Beta | Encontro crítico | Heart Stopper, Lion Heart e porta cooperativa |
| 10 | 5-1 | U-8 | Chefe obrigatório | Placas das pernas, boca e granadas |
| 11 | 5-2 | Reaper | Miniboss/encontro crítico | Pontos brancos, Power Stone e instant kill |
| 12 | 5-2 | Uroboros Mkono | Chefe obrigatório | Flamethrower e núcleos expostos |
| 13 | 5-3 | Wesker cronometrado | Chefe obrigatório/objetivo opcional | Bad Blood e gatilho de Heart of Africa |
| 14 | 5-3 | Jill e dispositivo no peito | Chefe obrigatório; resgate | Masters of Removing |
| 15 | 6-2 | Uroboros Aheri | Chefe obrigatório | Satellite Laser Targeting Device |
| 16 | 6-3 | Engine Room | Encontro crítico obrigatório | Reapers, Gatling Gun Majini e portões |
| 17 | 6-3 | Wesker no hangar | Chefe obrigatório | Escuridão, foguetes e injeção |
| 18 | 6-3 | Wesker no vulcão | Chefe final obrigatório | Separação da dupla, QTEs e núcleo |
| 19 | Lost in Nightmares | Guardians of Insanity | Minibosses da DLC | Quatro crests e Night Terrors |
| 20 | Lost in Nightmares | Wesker final | Encontro crítico da DLC | Sobrevivência e Kung Fu Fighting |
| 21 | Desperate Escape | Três Agitator Majini | Minibosses opcionais de troféu | Shoot the Messenger |
| 22 | Desperate Escape | Landing Pad | Encontro crítico final da DLC | Cronômetro, bosses variáveis e terceiro Agitator |

Cada entrada pública documenta área, obrigatoriedade, preparação, mecânica, fraqueza, QTE/ataques fatais, solo com IA, coop humano, Professional, checkpoint/recuperação e troféu ou tesouro relacionado.

## 4. Tabela das 18 Score Stars

Todas devem ser destruídas na mesma jogada de Lost in Nightmares. O texto público inclui posição/câmera, ação, ponto sem retorno e recuperação.

| # | Área | Landmark inequívoco | Timestamp |
|---:|---|---|---:|
| 1 | Main Hall | Lanterna sob a escadaria principal | 00:06 |
| 2 | Main Hall, 2º andar | Acima das portas de entrada, vistas de dentro | 00:17 |
| 3 | Main Hall, 2º andar | Parte alta/traseira do lustre central | 00:30 |
| 4 | Corredor do 2º andar | Gabinete com pratos no fim do corredor | 00:45 |
| 5 | Dining Room | Parede sudoeste da galeria, à esquerda do relógio | 00:54 |
| 6 | Dining Room | Dentro do relógio de pêndulo | 01:10 |
| 7 | Restroom | Acima do mictório no banheiro sob a escada | 01:30 |
| 8 | Storage room | Gaiola coberta ao lado do heat-sensitive paper | 01:44 |
| 9 | Corredor da armadilha | Teto do corredor gradeado com espinhos | 02:17 |
| 10 | Sala do teto de espinhos | Acima do cofre de parede; pegar antes de o teto baixar | 02:30 |
| 11 | Entrada da prisão | À esquerda, acima das prateleiras após crank e queda | 02:41 |
| 12 | Primeiro corredor de celas | Quinta cela à direita, sob a mão do cadáver | 02:54 |
| 13 | Corredor após o Guardian | Parede alta sobre a passagem | 03:05 |
| 14 | Base da primeira escada | Cela fechada sob a escada, parede esquerda | 03:16 |
| 15 | Segundo andar | Primeira cela à direita após subir | 03:26 |
| 16 | Retorno ao piso inferior | Prateleira baixa depois da descida | 03:37 |
| 17 | Área da Silver Crest | Sexta alcova gradeada após o baú | 03:51 |
| 18 | Library | Parede alta ao fundo antes de Wesker | 04:06 |

## 5. Tabela dos 3 Agitator Majini

Os três precisam morrer na mesma jogada de Desperate Escape.

| # | Área | Gatilho confirmado | Ponto crítico/recuperação |
|---:|---|---|---|
| 1 | Transportation Area 1 | Eliminar cinco grupos; não pegar a key antes da terceira onda; usar a key e fazer Assist Jump na broken ladder | Cutscene confirma o spawn. É sensível a avanço/onda viva; se falhar, reiniciar a DLC |
| 2 | Communication Facility | Após destrancar o portão norte, limpar a área, permanecer nas duas rocket turrets e matar as duplas seguintes | Cutscene mostra o alvo; usar rocket e não atravessar a saída cedo |
| 3 | Landing Pad | Matar rapidamente os bosses do elevador durante os cinco minutos; gatilho usual após quatro, com rotas mostrando após três | Matar antes de o cronômetro zerar; falha exige nova run completa |

Não foram criados timestamps individuais para os Agitators, pois o vídeo não publica capítulos verificáveis.

## 6. Auditoria dos cinco usos de vídeo

Os cinco rótulos editoriais correspondem a quatro vídeos únicos. Em 18/07/2026, os quatro endpoints oEmbed responderam HTTP 200 e retornaram títulos coerentes.

| Uso editorial | URL/ID | Duração | Compatibilidade | Timestamp |
|---|---|---:|---|---|
| 30 BSAA Emblems | `qG94-12Nznk` | 09:19 | Autor declara PS3, PS4/PS5, Xbox, PC e Switch | 30 capítulos do autor convertidos em links individuais |
| BSAA Emblem #29 | `qG94-12Nznk&t=520s` | 09:19 | Mesmo guia; posição compatível com PS4/Remaster | 08:40 confirmado |
| Heart of Africa | `XKfQyYb_hBY` | 01:11 | Objetivo e gatilho compatíveis com PS4/Remaster | Vídeo dedicado; sem capítulos, nenhum timestamp extra inventado |
| 18 Score Stars | `4KAJ6zfUNxc` | 04:31 | Autor declara PS3, PS4/PS5, Xbox, PC e Switch | 18 capítulos do autor convertidos em links individuais |
| 3 Agitator Majini | `Zxx5PkPYeuU` | 06:10 | Título/descrição identificam PS4 | Sem capítulos publicados; nenhum timestamp individual inventado |

URLs:

- https://www.youtube.com/watch?v=qG94-12Nznk
- https://www.youtube.com/watch?v=qG94-12Nznk&t=520s
- https://www.youtube.com/watch?v=XKfQyYb_hBY
- https://www.youtube.com/watch?v=4KAJ6zfUNxc
- https://www.youtube.com/watch?v=Zxx5PkPYeuU

## 7. Fontes utilizadas

Fontes primárias e de plataforma:

- Manual oficial da Capcom: https://static.capcom.com/manuals/re5/RE5_PS4_DMNL_EN.pdf
- Lista PS4, 71 troféus: https://www.playstationtrophies.org/game/resident-evil-5-ps4/trophies/
- Guia e roadmap PS4: https://www.playstationtrophies.org/game/resident-evil-5-ps4/guide/

Fontes operacionais confrontadas:

- Estratégias de chefes: https://www.relyonhorror.com/in-depth/resident-evil-in-depth/resident-evil-5-in-depth/resident-evil-5-boss-strategies/
- Lost in Nightmares: https://gamefaqs.gamespot.com/ps3/989571-resident-evil-5-lost-in-nightmares/faqs/59192
- Desperate Escape: https://gamefaqs.gamespot.com/ps3/991006-resident-evil-5-desperate-escape/faqs/59292
- Treasure Guide PS4: https://gamefaqs.gamespot.com/ps4/187184-resident-evil-5/faqs/55995
- Segunda fonte para Soul Gem/Heart of Africa: https://gamefaqs.gamespot.com/xbox360/929197-resident-evil-5/faqs/56182
- Índice de BSAA Emblems: https://residentevil.fandom.com/wiki/BSAA_Emblem
- Rota ilustrada de BSAA usada somente para confronto de ordem/landmarks: https://www.gamesradar.com/resident-evil-5-bsaa-emblem-guide/
- Os quatro vídeos listados na seção anterior.

O texto publicado foi redigido originalmente. Divergências não confirmadas foram tratadas como limitação ou variação, não como certeza.

## 8. Arquivos alterados

- `src/data/sampleGames.js`: compêndio, localizações, timestamps, auditoria e metadados.
- `data/guides/resident-evil-5.json`: snapshot sincronizado.
- `src/app.js`: SSR orientado por `editorialDisplay` e renderização dos campos operacionais.
- `public/js/ui-guide.js`: hidratação orientada pela mesma configuração.
- `src/services/games.service.js`: paridade da API e de `attention_count`.
- `scripts/export-data.js`: preservação data-driven dos novos blocos no snapshot.
- `scripts/test-layers.js`: contratos específicos da Fase 2.
- `RELATORIO_RE5_FASE2.md`: este relatório.

## 9. Comparativo antes/depois

| Item | Antes | Depois |
|---|---:|---:|
| Compêndio operacional | Ausente | 22 encontros estruturados |
| BSAA autossuficientes | Parcial | 30/30 com área, landmark, ângulo, ação e recuperação |
| Timestamps BSAA | #29 apenas | 30/30 |
| Score Stars estruturadas | Lista dependente de vídeo | 18/18 autossuficientes + timestamps |
| Agitator Majini | Instrução resumida | 3/3 com gatilho, risco e recuperação |
| Tesouros críticos | Ambíguos em pontos específicos | Entradas críticas revisadas; as demais foram preservadas |
| FAQs públicas | 19 | 36 |
| FAQ após hidratação | 19 | 36 |
| Pontos de atenção no dado | 12 | 12 |
| `attention_count` | 6 | 12 |
| Pontos no SSR/DOM | Divergentes da contagem | 12/12 |
| FAQ JSON-LD | Parcial | 36 |
| Data da revisão | 03/06/2026 | 18/07/2026 |

## 10. Resultados dos testes

- `npm run test:data -- resident-evil-5`: **passou** — 105 jogos.
- `npm run test:guide -- resident-evil-5`: **passou**.
- `npm run build`: **passou**.
  - `test:data`: passou — 105 jogos.
  - `test:roadmap`: passou — 105 roadmaps.
  - `test:cache`: passou.
  - Aviso não bloqueante: projeto recomenda Node 20; ambiente executou Node 24.14.1.
- `git diff --check`: **passou**; somente avisos informativos de conversão LF/CRLF.
- Auditoria oEmbed dos quatro vídeos únicos: **4/4 HTTP 200**, títulos coerentes.
- Navegador Edge headless, DOM hidratado:
  - 36 FAQs;
  - 12 pontos de atenção;
  - API 36 FAQs, 12 pontos e `attention_count = 12`;
  - FAQ JSON-LD com 36 entidades;
  - nenhum ID duplicado;
  - seis abas visíveis, clicadas e com o painel correspondente visível.
- Contratos automáticos:
  - 51 troféus base únicos;
  - 20 DLC únicos;
  - 71 nomes únicos;
  - 16 capítulos;
  - 30 BSAA Emblems;
  - 50 tesouros;
  - 18 Score Stars;
  - 3 Agitator Majini;
  - 22 encontros no compêndio;
  - cinco usos de vídeo/quatro IDs auditados;
  - paridade dos blocos editoriais entre seed e snapshot.

## 11. Confirmação de escopo

- Nenhum arquivo CSS foi alterado.
- Nenhum componente, cabeçalho, cor, card ou layout foi redesenhado.
- Nenhuma imagem, screenshot, mapa ou incorporação de vídeo foi adicionada.
- Nenhum dado editorial de outro jogo foi alterado.
- Nenhum conteúdo correto da Fase 1 foi removido.
- Nenhum commit ou deploy foi criado.

## 12. Visuais recomendados para uma fase futura

Prioridade sugerida, sem implementação nesta fase:

1. **Diagrama do BSAA #29 (6-1):** plataforma, container aberto, arco do explosivo e ponto sem retorno.
2. **Mapa da armadilha de Score Stars #9 e #10:** corredor gradeado, cofre e teto de espinhos antes/depois do gatilho.
3. **Fluxograma do Agitator #1:** cinco grupos, momento seguro para pegar a key, Assist Jump e condição de reinício.
4. **Planta da Monarch Room:** posição do Heart of Africa, limite da luta cronometrada e transição para Jill.
5. **Diagrama do final de Wesker no vulcão:** separação solo/coop, Partner Action, QTEs e núcleo exposto.
6. **Mapa compacto do Landing Pad:** elevador, escadas, rota de kite, turrets/recursos e spawn do terceiro Agitator.
