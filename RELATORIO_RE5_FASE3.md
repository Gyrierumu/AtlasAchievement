# Relatório — Resident Evil 5 — Fase 3

Data da execução: 18/07/2026

Escopo: camada visual instrucional original, factual, acessível e leve do guia de Resident Evil 5.

## 1. Pré-condições verificadas

O arquivo `RELATORIO_RE5_FASE2.md` foi lido integralmente antes das alterações. As validações essenciais da Fase 2 foram executadas e aprovadas:

- 51 troféus da base + 20 troféus de DLC = 71 nomes únicos;
- 36 FAQs na fonte, snapshot, API e SSR;
- 12 pontos de atenção na fonte, snapshot, API e SSR;
- 18 Score Stars e 3 Agitator Majini com descrições operacionais autossuficientes;
- compêndio com 22 chefes, minibosses e encontros críticos;
- seed e snapshot em paridade;
- `npm run test:data -- resident-evil-5`: aprovado;
- `npm run test:guide -- resident-evil-5`: aprovado antes da implementação.

Não foi identificado bloqueio para iniciar a Fase 3.

## 2. Inventário de visuais recomendados pela Fase 2

O inventário da Fase 2 foi confrontado com o guia publicado:

1. rota única das 18 Score Stars de Lost in Nightmares;
2. rota, gatilhos e pontos sem retorno dos 3 Agitator Majini de Desperate Escape;
3. apoio para BSAA Emblems de leitura espacial difícil, com prioridade para o #29 de Chapter 6-1;
4. apoio para tesouros de gatilho/localização difícil, com prioridade para Heart of Africa;
5. mecânicas de chefes ou encontros críticos que exigem sequência e divisão de funções;
6. fluxo de Infinite Ammo;
7. matriz ou fluxo de boosting de Versus.

## 3. Critério de priorização

Foram priorizados problemas que o texto sozinho ainda obrigava o jogador a imaginar espacialmente ou ordenar mentalmente. Cada visual aprovado responde diretamente a pelo menos uma pergunta operacional: onde está, em que ordem fazer, qual evento dispara o objetivo, qual é o ponto sem retorno ou como dividir funções.

Também foram aplicados estes limites:

- agrupar uma sequência completa em vez de criar uma imagem por item;
- não repetir listas que já são claras em texto;
- não simular mapas oficiais ou screenshots;
- não criar mídia sem ganho material de compreensão;
- manter apenas cinco assets pequenos e locais.

## 4. Visuais implementados e finalidade

| ID estável | Posição editorial | Finalidade |
|---|---|---|
| `re5-visual-score-stars-route` | Lost in Nightmares, checklist `re5-score-stars` | Organiza as 18 Score Stars em três zonas e evidencia a ordem única e o ponto de conferência 18/18 antes de Wesker. |
| `re5-visual-agitator-triggers` | Desperate Escape, checklist `re5-agitators` | Mostra gatilhos, cutscenes, kills obrigatórias e pontos de não retorno dos três Agitators na mesma run. |
| `re5-visual-bsaa-29-container` | Extras da Platina, BSAA Emblems | Explica posição do jogador, arco do explosivo e contêiner aberto do Emblem #29 em 6-1. |
| `re5-visual-heart-of-africa` | Extras da Platina, Tesouros | Separa o gatilho de dano em Wesker da coleta entre as escadarias durante Jill. |
| `re5-visual-wesker-volcano` | Compêndio de chefes e encontros críticos | Resume a separação da dupla, proteção de Sheva, pedra, reunião, núcleo e QTE final. |

Todos exibem a declaração: “Diagrama esquemático — não representa escala.”

## 5. Visuais rejeitados e motivo

- Infinite Ammo: rejeitado nesta fase porque o fluxo textual já separa compra da arma, upgrade, Exchange Points e ativação em Special Settings. Um diagrama repetiria a mesma sequência sem reduzir dúvida espacial.
- Boosting de Versus: rejeitado porque o roadmap de três sessões, a indicação de jogadores e os requisitos por modo já são operacionais. Uma matriz acrescentaria densidade visual sem substituir coordenação humana.
- Um visual para cada um dos 30 BSAA Emblems, 50 tesouros, 18 Score Stars ou 22 encontros: rejeitado por repetição, peso e manutenção. Score Stars foram agrupadas; apenas os casos espaciais de maior risco receberam módulo próprio.
- Screenshots, mapas de terceiros e thumbnails: rejeitados por direitos autorais, proveniência e por não haver capturas próprias autorizadas no repositório.
- Imagens geradas por IA: não utilizadas.

## 6. Assets criados, tamanho e proveniência

Todos os assets são SVGs originais do AtlasAchievement, produzidos no projeto em 18/07/2026 a partir do conteúdo factual aprovado na Fase 2. Nenhum contém bitmap incorporado, script, `foreignObject`, hotlink ou recurso externo.

| Asset | Tamanho |
|---|---:|
| `score-stars-route.svg` | 9.043 bytes |
| `agitator-triggers.svg` | 6.636 bytes |
| `bsaa-29-container.svg` | 3.335 bytes |
| `heart-of-africa-arena.svg` | 3.709 bytes |
| `wesker-volcano-flow.svg` | 5.272 bytes |
| **Total** | **27.995 bytes (27,34 KiB)** |

Cada SVG possui `viewBox`, largura, altura, `title` e `desc`. Números, formas, setas e rótulos complementam as cores.

## 7. Alternativas textuais

Cada módulo oferece três camadas textuais:

1. `alt` objetivo no elemento `img`;
2. `figcaption` com resumo e aviso de natureza esquemática;
3. bloco visível “Alternativa textual”, com pelo menos três instruções operacionais.

O fallback não depende de o SVG carregar e preserva ordem, gatilho, ação e ponto sem retorno. O módulo também inclui link descritivo para o item, checklist ou estratégia detalhada relacionada.

## 8. Alterações de renderer e CSS

- Adicionada a coleção data-driven `instructionalVisuals` exclusivamente ao seed de RE5.
- O snapshot exportado e a API agora transportam a mesma coleção.
- O SSR usa `renderGuideInstructionalVisualsHtml`; o cliente usa o equivalente `renderGuideInstructionalVisuals`.
- Os placements `category:*` e `dlc:*` colocam cada visual junto da instrução relacionada, sem galeria isolada.
- A origem é restrita a `/assets/guides/resident-evil-5/*.svg`.
- A marcação usa `figure`, `figcaption`, `aria-labelledby`, `aria-describedby`, dimensões intrínsecas, `loading="lazy"` e `decoding="async"`.
- O CSS foi limitado a `#view-guide.atlas-guide--resident-evil-5 .atlas-instructional-visual*`.
- Não foram alterados cabeçalho, abas, cards globais, checklist, capa, anúncios, identidade visual ou tipografia global.
- Não foi adicionada dependência externa.

## 9. Resultados de acessibilidade e responsividade

Auditoria real após hidratação:

| Largura | Visuais | IDs únicos | Overflow horizontal | Links por teclado | Reduced motion |
|---:|---:|---:|---|---|---|
| 360 px | 5 | 5 | não | aprovado | aprovado |
| 390 px | 5 | 5 | não | aprovado | aprovado |
| 768 px | 5 | 5 | não | aprovado | aprovado |
| 1280 px | 5 | 5 | não | aprovado | aprovado |

Resultados adicionais:

- SSR: 5 módulos;
- API: 5 módulos;
- DOM hidratado: 5 módulos, sem duplicação;
- IDs duplicados no documento: 0;
- imagens carregadas com largura natural de 640 px;
- `alt`, dimensões e links internos presentes;
- âncoras relacionadas existentes;
- console: 0 erros;
- exceções JavaScript: 0;
- falhas de rede: 0;
- violações de CSP: 0;
- ordem de leitura preservada;
- nenhum carrossel, animação ou interação complexa adicionada.

O conector integrado do navegador não iniciou por ausência de `sandboxPolicy` no ambiente. A QA foi concluída no Edge headless isolado via CDP, com os mesmos breakpoints, cliques reais nas abas/accordions, inspeção de DOM, console, rede e screenshots.

## 10. Screenshots de QA

Cada módulo foi capturado em 390 px e 1280 px:

| Módulo | 390 px | 1280 px |
|---|---|---|
| Score Stars | [390-score-stars.png](artifacts/re5-phase3/390-score-stars.png) | [1280-score-stars.png](artifacts/re5-phase3/1280-score-stars.png) |
| Agitator Majini | [390-agitators.png](artifacts/re5-phase3/390-agitators.png) | [1280-agitators.png](artifacts/re5-phase3/1280-agitators.png) |
| BSAA Emblem #29 | [390-bsaa-29.png](artifacts/re5-phase3/390-bsaa-29.png) | [1280-bsaa-29.png](artifacts/re5-phase3/1280-bsaa-29.png) |
| Heart of Africa | [390-heart-of-africa.png](artifacts/re5-phase3/390-heart-of-africa.png) | [1280-heart-of-africa.png](artifacts/re5-phase3/1280-heart-of-africa.png) |
| Wesker no vulcão | [390-wesker-volcano.png](artifacts/re5-phase3/390-wesker-volcano.png) | [1280-wesker-volcano.png](artifacts/re5-phase3/1280-wesker-volcano.png) |

As dez capturas foram inspecionadas quanto a legibilidade, alinhamento, espaçamento, contraste, corte, sobreposição, overflow e proximidade da instrução. Os resultados estruturados estão em `artifacts/re5-phase3/qa-results.json`.

## 11. Impacto de performance

- 27.995 bytes de assets instrucionais, aproximadamente 5,47% da meta máxima de 500 KiB.
- SVGs simples, sem filtros, sombras vetoriais complexas, bitmap ou biblioteca de diagramas.
- Carregamento lazy e decodificação assíncrona.
- Dimensões reservadas para reduzir layout shift.
- Assets aparecem dentro de abas e accordions editoriais, não acima da dobra.
- Capa e LCP não foram alterados.
- Os PNGs em `artifacts/` são evidências de QA e não são carregados pela página pública.

## 12. Arquivos alterados

Implementação e dados:

- `src/data/sampleGames.js`
- `src/services/games.service.js`
- `src/app.js`
- `public/js/ui-guide.js`
- `public/css/guide.css`
- `scripts/export-data.js`
- `scripts/test-layers.js`
- `scripts/qa-re5-phase3.js`
- `data/guides/resident-evil-5.json`

Assets e evidências:

- `public/assets/guides/resident-evil-5/score-stars-route.svg`
- `public/assets/guides/resident-evil-5/agitator-triggers.svg`
- `public/assets/guides/resident-evil-5/bsaa-29-container.svg`
- `public/assets/guides/resident-evil-5/heart-of-africa-arena.svg`
- `public/assets/guides/resident-evil-5/wesker-volcano-flow.svg`
- `artifacts/re5-phase3/qa-results.json`
- dez screenshots listados na seção 10;
- `RELATORIO_RE5_FASE3.md`.

As alterações preexistentes da Fase 2 e `RELATORIO_RE5_FASE2.md` foram preservados.

## 13. Testes executados

- `npm run test:data -- resident-evil-5`: aprovado, 105 jogos.
- `npm run test:guide -- resident-evil-5`: aprovado antes e depois da implementação.
- `npm run build`: aprovado.
- `npm run test:quick`, chamado pelo build: dados, roadmaps e cache aprovados.
- `node --check` nos renderers, dados, serviços, exportador, testes e script de QA: aprovado.
- `node scripts/qa-re5-phase3.js`: aprovado.
- `git diff --check`: aprovado.

Avisos não bloqueantes já existentes:

- runtime recomenda Node 20.x; a execução usou Node 24.14.1;
- depreciação de `url.parse()` emitida pela stack existente durante `test:guide`.

## 14. Confirmação de que nenhum outro jogo foi alterado

- Jogos sem `instructionalVisuals` continuam retornando string vazia no renderer compartilhado.
- O SSR de Resident Evil 6 foi verificado e apresentou 0 módulos instrucionais.
- O exportador só inclui `instructionalVisuals` no bloco de extras de seed aplicável ao RE5.
- As alterações de timestamp produzidas pelo export em outros 104 snapshots foram removidas; somente `data/guides/resident-evil-5.json` permaneceu alterado.
- O build validou os 105 jogos.
- Nenhum dado editorial, asset ou CSS global foi aplicado automaticamente a outro jogo.

## 15. Capturas reais ainda a produzir pelo proprietário

Nenhuma captura real é necessária para compreender ou operar os cinco módulos atuais. Caso o proprietário queira acrescentar confirmação fotográfica futura, as capturas devem ser próprias/autorizadas e seguir estas especificações:

1. **BSAA Emblem #29:** Chapter 6-1, Ship Deck, imediatamente após a primeira Partner Action; câmera no jogador ainda sobre a plataforma, com o contêiner aberto à esquerda inteiro no quadro. Produzir uma captura antes e outra no momento da explosão, anotando plataforma, arco do explosivo e interior do contêiner.
2. **Heart of Africa:** Chapter 5-3, fase de Jill após causar dano suficiente a Wesker; câmera elevada a partir do piso central, mostrando simultaneamente as duas escadarias e o brilho do tesouro entre elas. Anotar o tesouro e o aviso “colete antes de encerrar Jill”.
3. **Score Star #10 e #18:** Lost in Nightmares; #10 com o cofre e o teto de espinhos no mesmo quadro, #18 com a Library e a parede alta ao fundo. Anotar o número, a direção da câmera e o ponto sem retorno.
4. **Agitator #3:** Desperate Escape, Landing Pad; registrar a saída do Agitator após a cutscene e o cronômetro visível, sem usar frame de vídeo de terceiros. Anotar elevador, Agitator e limite 0:00.

Essas capturas são opcionais, não foram inventadas nem substituídas por IA, e não devem ser adicionadas sem comprovação de autoria/licença.

Nenhum commit e nenhum deploy foram realizados.
