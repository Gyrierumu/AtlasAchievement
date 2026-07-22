# Relatório — Resident Evil 5 — Fase 3

Data da execução: 18/07/2026

Escopo: microcorreção factual e responsiva da camada visual instrucional de Resident Evil 5. Nenhum componente global, posicionamento editorial ou dado de outro jogo foi alterado.

## 1. Resultado

As duas pendências foram corrigidas:

- o diagrama dos Agitator Majini não associa mais o terceiro alvo a uma quantidade garantida de kills;
- Score Stars agora distingue inequivocamente as duas crests dos shards posteriores;
- os dois diagramas prioritários ganharam uma representação semântica específica para telas estreitas, com texto real a 16 CSS px em 360 e 390 px;
- os SVGs originais continuam sendo usados em desktop e tablet;
- os cinco posicionamentos, IDs públicos, anchors, `figure`/`figcaption`, lazy loading e dimensões explícitas foram preservados.

## 2. Comparativo antes/depois

| Superfície | Antes | Depois |
|---|---|---|
| Agitator #2 | Quantidade exata de duplas antes da cena. | “Use as rocket turrets e continue eliminando as duplas até disparar a cutscene.” |
| Agitator #3 | Gatilho apresentado como “após 4 kills” ou, em algumas superfícies, “após 3”. | Rota operacional: chegar rapidamente à Landing Pad, eliminar minibosses, priorizar o vermelho perto de 1:40, continuar as kills, procurar o Agitator perto de 0:30 com dois Big Man Majini e matá-lo antes de zero. A disposição pode variar e os tempos são referências práticas. |
| Score Star #17 | Texto suscetível a confundir crests e fragmentos. | #17 fica na sexta alcova gradeada depois do baú da Silver Crest. Silver Crest e Gold Crest são duas crests e abrem o portão; os shards pertencem ao labirinto posterior e exigem 1/3/4/4 em Amateur/Normal/Veteran/Professional. |
| Mobile | SVG desktop de 640 px reduzido dentro de um card estreito. | Versão HTML semântica vertical, sem reduzir o texto junto com o desenho; 16 CSS px em 360 e 390 px. |

As correções factuais foram aplicadas no SVG, `alt`, legenda, fallback, dados editoriais, seed/snapshot e testes.

## 3. Solução responsiva

Os visuais `re5-visual-score-stars-route` e `re5-visual-agitator-triggers` usam:

- SVG original entre 768 e 1280 px;
- blocos HTML semânticos com títulos e listas abaixo de 520 px;
- texto essencial de 16 CSS px no mobile;
- ausência de rolagem horizontal;
- dimensões intrínsecas de 640 px nos SVGs para reservar espaço;
- `loading="lazy"` e `decoding="async"` preservados;
- CSS limitado ao guia de Resident Evil 5;
- `prefers-reduced-motion` respeitado;
- nenhuma biblioteca, referência externa, `foreignObject` ou script nos assets.

Os outros três módulos visuais não receberam variante nova.

## 4. Assets

Todos os assets são SVGs locais e originais do projeto.

| Asset | Tamanho |
|---|---:|
| `score-stars-route.svg` | 9.239 bytes |
| `agitator-triggers.svg` | 6.805 bytes |
| `bsaa-29-container.svg` | 3.335 bytes |
| `heart-of-africa-arena.svg` | 3.709 bytes |
| `wesker-volcano-flow.svg` | 5.272 bytes |
| **Total** | **28.360 bytes (27,70 KiB)** |

Os dois assets corrigidos totalizam 16.044 bytes. Todos mantêm `viewBox`, largura, altura, `title` e `desc`.

## 5. Acessibilidade, estrutura e regressão

Validado em SSR e DOM hidratado:

- cinco figuras;
- cinco IDs públicos únicos;
- referências `aria-labelledby` e `aria-describedby` válidas;
- links relacionados acessíveis por teclado;
- estrutura `figure`/`figcaption` preservada;
- nenhum ID duplicado no documento;
- nenhum asset com `script`, `foreignObject`, bitmap ou referência externa;
- nenhum 404, erro de console, exceção JavaScript ou falha de rede;
- Resident Evil 6 continua com zero módulos instrucionais.

As regressões impedem o retorno de:

- “após 4 kills”;
- “após 3” como gatilho do terceiro Agitator;
- garantia de duas duplas no segundo Agitator;
- “quatro crests” na Score Star #17;
- confusão entre Silver/Gold Crests e os shards do labirinto.

Também permanecem protegidas as contagens de 71 troféus, 36 FAQs, 12 pontos de atenção, 22 encontros, 18 Score Stars, 3 Agitator Majini e os cinco visuais.

## 6. QA responsiva

| Viewport | Figuras DOM | IDs únicos | Overflow | Texto prioritário |
|---:|---:|---:|---|---|
| 360 px | 5 | 5 | não | variante mobile, mínimo 16 px |
| 390 px | 5 | 5 | não | variante mobile, mínimo 16 px |
| 768 px | 5 | 5 | não | SVG, mínimo calculado 14,28 px |
| 1280 px | 5 | 5 | não | SVG, mínimo calculado 16 px |

O runner `scripts/qa-re5-phase3.js` transforma essas condições em assertions e falha se houver regressão. O conector integrado do navegador não iniciou por ausência de `sandboxPolicy` no ambiente; a auditoria foi concluída no Edge isolado via CDP, com cliques reais, inspeção de DOM, console, rede e screenshots.

## 7. Screenshots

Foram produzidas oito capturas, cobrindo os dois diagramas prioritários nos quatro viewports:

| Viewport | Score Stars | Agitator Majini |
|---:|---|---|
| 360 px | [360-score-stars.png](artifacts/re5-phase3/360-score-stars.png) | [360-agitators.png](artifacts/re5-phase3/360-agitators.png) |
| 390 px | [390-score-stars.png](artifacts/re5-phase3/390-score-stars.png) | [390-agitators.png](artifacts/re5-phase3/390-agitators.png) |
| 768 px | [768-score-stars.png](artifacts/re5-phase3/768-score-stars.png) | [768-agitators.png](artifacts/re5-phase3/768-agitators.png) |
| 1280 px | [1280-score-stars.png](artifacts/re5-phase3/1280-score-stars.png) | [1280-agitators.png](artifacts/re5-phase3/1280-agitators.png) |

As capturas foram inspecionadas quanto a legibilidade, alinhamento, corte, sobreposição e overflow. Os dados estruturados estão em `artifacts/re5-phase3/qa-results.json`.

## 8. Arquivos alterados nesta microcorreção

Implementação, dados e testes:

- `src/data/sampleGames.js`
- `data/guides/resident-evil-5.json`
- `src/app.js`
- `public/js/ui-guide.js`
- `public/css/guide.css`
- `scripts/test-layers.js`
- `scripts/qa-re5-phase3.js`

Assets, evidências e documentação:

- `public/assets/guides/resident-evil-5/score-stars-route.svg`
- `public/assets/guides/resident-evil-5/agitator-triggers.svg`
- `artifacts/re5-phase3/qa-results.json`
- oito screenshots listados na seção 7;
- `RELATORIO_RE5_FASE3.md`.

As alterações preexistentes da Fase 2 e `RELATORIO_RE5_FASE2.md` foram preservadas.

## 9. Fontes factuais

- especificação factual fornecida para esta microcorreção;
- dados editoriais auditados da Fase 2 em `src/data/sampleGames.js`;
- `RELATORIO_RE5_FASE2.md`;
- paridade conferida no snapshot `data/guides/resident-evil-5.json`.

Os tempos de 1:40 e 0:30 são apresentados como referências práticas, não como gatilhos oficiais garantidos.

## 10. Testes executados

| Validação | Resultado |
|---|---|
| Busca pelas expressões factualmente incorretas nas superfícies publicadas | aprovado, zero ocorrências |
| `node scripts/qa-re5-phase3.js` | aprovado em 360, 390, 768 e 1280 px |
| `npm run test:guide -- resident-evil-5` | aprovado |
| `npm run build` | aprovado |
| `git diff --check` | aprovado |

O build aprovou dados de 105 jogos, 105 roadmaps e cache. O ambiente usou Node 24.14.1; o projeto recomenda Node 20.x. A suíte do guia emitiu apenas o aviso de depreciação preexistente de `url.parse()`.

Nenhum commit e nenhum deploy foram realizados.
