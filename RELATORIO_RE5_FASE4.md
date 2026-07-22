# Relatório — Resident Evil 5 — Fase 4

Data da revisão substancial: **18/07/2026**

Escopo público: `https://atlasachievement.com.br/jogo/resident-evil-5`

## Resultado

A Fase 4 foi implementada somente no guia de Resident Evil 5. O guia agora publica autoria editorial honesta, escopo de versão, data semântica de revisão, metodologia, fontes, limitações, histórico, imagem social local e um grafo JSON-LD coerente entre SSR e hidratação.

As correções da Fase 3 estavam presentes e foram preservadas:

- o terceiro Agitator não usa três ou quatro kills como gatilho garantido;
- as variantes móveis dos diagramas continuam legíveis em 360 e 390 px;
- Silver/Gold Crests continuam separadas dos shards posteriores;
- Guardians continuam com exigência de shards por dificuldade.

As contagens de regressão permaneceram:

- 51 troféus base;
- 20 troféus de DLC;
- 71 nomes únicos;
- 36 FAQs;
- 12 pontos de atenção;
- 22 encontros no compêndio;
- 5 figuras instrucionais;
- 6 abas.

Não existe `RELATORIO_RE5_FASE0.md` no workspace. Para não inventar histórico, a auditoria prévia usou a especificação original anexada da Fase 0 e os relatórios versionados das Fases 1, 2 e 3.

## Diagnóstico antes/depois

| Superfície | Antes | Depois |
|---|---|---|
| Meta description | Dizia incorretamente que as DLCs não eram obrigatórias para o 100% | Separa 51 troféus base da platina e 20 troféus de DLC do 100% |
| Autoria | Badge genérico sem responsável ou escopo | Equipe Editorial AtlasAchievement, PS4/Remaster, data real e link de metodologia |
| Fontes | Não havia seção pública rastreável | Seção SSR/hidratada com verificação, seis fontes, limitações e histórico |
| JSON-LD | `TechArticle` com `datePublished` não comprovada e sem IDs estáveis completos | `Article`, `VideoGame`, `Organization`, `BreadcrumbList`, `FAQPage` e `WebPage` relacionados por IDs estáveis |
| Imagem social | Hotlink externo de 460 × 215 | Composição tipográfica local de 1200 × 630 |
| Sitemap do RE5 | Usava `updated_at` técnico | Usa a revisão editorial fixa de 18/07/2026 |
| Hidratação | Restaurava description, imagem e grafo antigos | Preserva os mesmos dados do SSR |

## Meta tags finais

```text
title:
Resident Evil 5 — Guia de Platina PS4 + DLCs | AtlasAchievement

description / og:description / twitter:description:
Guia de platina de Resident Evil 5 no PS4: 51 troféus base formam a platina, com roadmap, BSAA e Professional; 20 troféus de DLC são só para o 100%.

canonical:
https://atlasachievement.com.br/jogo/resident-evil-5

og:locale:
pt_BR

og:image / twitter:image:
https://atlasachievement.com.br/assets/guides/resident-evil-5/resident-evil-5-social.png
```

A descrição possui 148 caracteres. SSR e DOM hidratado usam o mesmo texto. Há uma canonical e um H1:

`Resident Evil 5 — Guia de platina e troféus`

## Autoria e política de datas

Autoria adotada: **Equipe Editorial AtlasAchievement**, com link para `/sobre`.

Justificativa: o projeto não possui um autor individual real e publicamente identificável para este guia. A autoria por organização evita inventar pessoa, certificação, hands-on, platina concluída ou teste de servidores.

Texto público:

> Conteúdo pesquisado e revisado pela Equipe Editorial AtlasAchievement para a versão PS4/Remaster.

A data pública é:

```html
<time datetime="2026-07-18">Revisado em 18/07/2026</time>
```

O `Article.dateModified`, o `<time>`, o dado editorial e o `lastmod` do RE5 usam a mesma revisão substancial. `datePublished` foi omitida porque não há data original comprovável. A data não é recalculada no build.

## Fontes públicas

Foram publicadas somente fontes usadas na reconciliação editorial:

1. [Capcom — manual oficial de Resident Evil 5 para PS4](https://static.capcom.com/manuals/re5/RE5_PS4_DMNL_EN.pdf) — versão, controles e modos.
2. [PlayStationTrophies — lista de troféus](https://www.playstationtrophies.org/game/resident-evil-5/trophies/) — lista base, DLCs, platina e 100%.
3. [PlayStationTrophies — guia de troféus](https://www.playstationtrophies.org/game/resident-evil-5/guide/) — contraprova de requisitos e roadmap.
4. [GameFAQs — trophies da versão PlayStation 4](https://gamefaqs.gamespot.com/ps4/184856-resident-evil-5/trophies) — conferência independente da lista PS4.
5. [GameFAQs — Lost in Nightmares FAQ](https://gamefaqs.gamespot.com/ps4/184856-resident-evil-5/faqs/59192) — Score Stars, Guardians e Night Terrors.
6. [GameFAQs — Desperate Escape FAQ](https://gamefaqs.gamespot.com/ps4/184856-resident-evil-5/faqs/59292) — Agitator Majini e The Great Escape.

Os links têm texto descritivo, `target="_blank"` e `rel="noopener noreferrer"`, sem `nofollow`.

Na auditoria HTTP automatizada, o manual da Capcom respondeu 200. PlayStationTrophies e GameFAQs responderam 403 aos requests automatizados, com URL final HTTPS preservada; nenhum link respondeu 404, 5xx ou redirecionamento quebrado. O 403 foi tratado como proteção anti-bot, não como disponibilidade pública garantida.

## Limitações publicadas

A seção declara explicitamente:

- 80.000 pontos nas rotas de rank S são uma meta prática, não um limiar oficial da Capcom;
- Versus está “aparentemente disponível”;
- atividade recente não garante matchmaking público;
- disponibilidade futura de servidores e recursos online não é prometida;
- diferenças de versões antigas não substituem os requisitos de PS4/Remaster.

O histórico público usa somente 18/07/2026, data comprovada pelos trabalhos versionados disponíveis. Nenhuma data anterior foi inventada.

## JSON-LD final

O `@graph` contém:

| Nó | ID/função |
|---|---|
| `WebPage` | canonical; aponta para `#article` |
| `Article` | `canonical#article`; autor, publisher, imagem, `dateModified`, `about` e `isAccessibleForFree` |
| `VideoGame` | `canonical#game`; nome, descrição, imagem, URL e `gamePlatform: PlayStation 4` |
| `Organization` | `https://atlasachievement.com.br/#organization`; publisher e logo local |
| `BreadcrumbList` | `canonical#breadcrumbs`; Início, Catálogo e RE5 |
| `FAQPage` | `canonical#faq`; as mesmas 36 perguntas públicas |

O autor estruturado é uma `Organization` chamada `Equipe Editorial AtlasAchievement`, igual ao texto visível. Os IDs dos nós principais são únicos; referências por `@id` são reutilizadas intencionalmente.

Não foram adicionados `Review`, `AggregateRating`, `Product`, `SoftwareApplication`, `HowTo`, notas ou contadores inventados. `TechArticle` foi removido e `datePublished` não existe.

Não há promessa de rich result de FAQ; a marcação foi mantida por coerência semântica.

## Imagem social

Arquivos:

- `resident-evil-5-social.png`: **1200 × 630**, **246.614 bytes**;
- `resident-evil-5-social.svg`: fonte vetorial local, **4.015 bytes**;
- total dos dois assets: **250.629 bytes**.

A composição é tipográfica, usa a identidade visual do AtlasAchievement, não contém screenshot, mapa, gameplay ou referência externa. O PNG é usado por Open Graph, Twitter Card e `Article.image`; largura, altura e alt são explícitos.

## Indexação, robots, canonical e sitemap

- rota pública: HTTP 200;
- canonical exata de produção: confirmada;
- query `?utm_source=phase4-qa`: não altera canonical;
- `noindex`: ausente;
- `robots.txt`: `Allow: /` e sem bloqueio de `/jogo/`;
- `robots.txt`: aponta para `/sitemap.xml`;
- sitemap: contém o RE5;
- `lastmod` do RE5: `2026-07-18T00:00:00.000Z`, derivado da data editorial fixa.

Limitação preexistente documentada: home, catálogo, facetas, coleções, páginas institucionais e listas SEO ainda recebem `new Date()` no gerador de sitemap. Isso pode atualizar `lastmod` sem mudança editorial nessas páginas. A Fase 4 não alterou essa política global; somente o RE5 passou a usar `last_reviewed_at`. Outros jogos continuam com seus próprios `updated_at`/`created_at`.

## SSR, hidratação, semântica e acessibilidade

Validado em 360, 390, 768 e 1280 px:

- `lang="pt-BR"`;
- um `main`;
- um H1;
- hierarquia H2/H3 preservada;
- seis abas funcionais;
- seção `#fontes-e-metodologia` no SSR e após hidratação;
- autoria e data iguais no texto e JSON-LD;
- 36 FAQs no HTML e JSON-LD;
- cinco figuras no SSR e DOM;
- IDs únicos e referências ARIA válidas;
- links de fonte com foco visível;
- sem overflow horizontal;
- `prefers-reduced-motion` preservado;
- nenhum erro do site no console;
- nenhum asset local com falha de rede.

O sanitizador público e o view model foram inspecionados. O sanitizador já preserva os dados do RE5 e não exigiu mudança. O bloco editorial nasce no SSR e é refeito com o mesmo modelo na hidratação, evitando CLS relevante.

## Screenshots

| Viewport | Cabeçalho editorial | Fontes e metodologia |
|---|---|---|
| 360 | [360-editorial-header.png](artifacts/re5-phase4/360-editorial-header.png) | [360-sources-methodology.png](artifacts/re5-phase4/360-sources-methodology.png) |
| 390 | [390-editorial-header.png](artifacts/re5-phase4/390-editorial-header.png) | [390-sources-methodology.png](artifacts/re5-phase4/390-sources-methodology.png) |
| 768 | [768-editorial-header.png](artifacts/re5-phase4/768-editorial-header.png) | [768-sources-methodology.png](artifacts/re5-phase4/768-sources-methodology.png) |
| 1280 | [1280-editorial-header.png](artifacts/re5-phase4/1280-editorial-header.png) | [1280-sources-methodology.png](artifacts/re5-phase4/1280-sources-methodology.png) |

Os oito PNGs somam **3.914.752 bytes**. O resultado completo da automação está em [qa-results.json](artifacts/re5-phase4/qa-results.json).

O navegador integrado foi tentado primeiro, mas não conseguiu criar a sessão local por limitação do ambiente. O fallback usou Microsoft Edge headless via CDP local, sem biblioteca nova.

## Testes

| Validação | Resultado |
|---|---|
| `npm run test:guide -- resident-evil-5` | Passou |
| `node scripts/qa-re5-phase4.js` | Passou: 4 viewports, 8 screenshots e 6 fontes |
| `npm run build` | Passou |
| `git diff --check` | Passou |
| JSON-LD | Parseado em SSR e DOM; nós, IDs e referências validados |
| Imagem social | PNG local 1200 × 630, abaixo de 400 KiB |
| Outros jogos | RE6 não recebeu bloco editorial, metodologia ou figuras do RE5 |

O build exibiu somente o aviso já conhecido de runtime: o projeto recomenda Node 20.x e o ambiente atual usa Node 24.14.1.

Não havia validador externo de schema instalado. O JSON-LD foi validado com `JSON.parse` e asserts estruturais, sem adicionar dependência.

## Arquivos da Fase 4

- `RELATORIO_RE5_FASE4.md`;
- `src/data/sampleGames.js`;
- `data/guides/resident-evil-5.json`;
- `src/services/games.service.js`;
- `scripts/export-data.js`;
- `src/app.js`;
- `public/js/ui-formatters.js`;
- `public/js/ui.js`;
- `public/js/ui-guide.js`;
- `public/css/guide.css`;
- `public/assets/guides/resident-evil-5/resident-evil-5-social.svg`;
- `public/assets/guides/resident-evil-5/resident-evil-5-social.png`;
- `scripts/test-layers.js`;
- `scripts/qa-re5-phase4.js`;
- `artifacts/re5-phase4/*`.

As alterações preexistentes e ainda não commitadas das Fases 2 e 3 foram preservadas. A exportação foi seguida de restauração de todos os snapshots que não eram o de Resident Evil 5.

## Confirmações finais

- nenhum conteúdo aprovado nas fases anteriores foi removido;
- outros jogos não receberam o bloco, a seção, o schema ou os assets do RE5;
- não houve redesign global;
- não houve keyword stuffing ou conteúdo oculto;
- não foi inventada experiência prática, pessoa, certificação, avaliação ou data de publicação;
- não foi criado commit;
- não houve deploy.
