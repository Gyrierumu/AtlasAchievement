# Relatório — Resident Evil 5 — Fase 5

Data da validação: 18–19/07/2026  
Escopo: somente a rota pública `/jogo/resident-evil-5`  
Tema: performance, WCAG 2.2 AA, progressive enhancement, resiliência e QA de produção

## 1. Resultado executivo

A Fase 5 foi concluída sem redesign e sem alteração do conteúdo editorial.

Metas finais, pela mediana de três execuções frias do Lighthouse 12.8.2:

| Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT | Speed Index |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Mobile | 97 | 100 | 100 | 100 | 2,459 s | 0,00004 | 0 ms | 2,574 s |
| Desktop | 99 | 100 | 100 | 100 | 0,906 s | 0,001729 | 0 ms | 1,055 s |

As metas de mediana foram atingidas:

- Performance mobile ≥ 90;
- Accessibility, Best Practices e SEO ≥ 95;
- LCP ≤ 2,5 s;
- CLS ≤ 0,1;
- TBT ≤ 200 ms.

O INP não foi estimado em laboratório: **sem dados de campo disponíveis**.

## 2. Pré-validação editorial e estrutural

Foram lidos os relatórios disponíveis das Fases 1–4. O repositório não contém um arquivo de relatório da Fase 0; a especificação original anexada foi usada como referência e essa ausência fica registrada como limitação documental.

| Item | Resultado |
|---|---|
| Troféus base | 51 |
| Troféus de DLC | 20 |
| Troféus únicos | 71 |
| FAQs | 36 em API, SSR, DOM e FAQPage |
| Pontos de atenção | 12 |
| Encontros no compêndio | 22 |
| Figuras instrucionais | 5 |
| Abas públicas | 6 |
| Autoria e metodologia públicas | Preservadas |
| Article | Preservado e válido |
| VideoGame | Preservado e válido |
| BreadcrumbList | Preservado e válido |
| FAQPage | 36 perguntas, preservado e válido |
| Meta description corrigida | Preservada |
| Terceiro Agitator | Sem gatilho garantido por três/quatro kills |
| Diagramas em 360/390 px | Variante HTML mobile com mínimo real de 16 CSS px |

`npm run test:guide -- resident-evil-5` passou antes das mudanças e voltou a passar na versão final.

## 3. Baseline salvo antes do código

Os JSONs brutos estão em `artifacts/re5-phase5/baseline/`. Foram feitas três execuções mobile e três desktop, tanto na aplicação local de produção quanto na página pública.

### 3.1 Medianas do baseline

| Ambiente | Perfil | Perf. | A11y | BP | SEO | LCP | CLS | TBT | Speed Index | Req. | Transferido |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Local | Mobile | 54 | 95 | 93 | 100 | 15,400 s | 0 | 219 ms | 8,078 s | 62 | 2.968.868 B |
| Local | Desktop | 76 | 92 | 93 | 100 | 3,061 s | 0,000545 | 2 ms | 1,605 s | 62 | 2.968.875 B |
| Pública | Mobile | 56 | 95 | 93 | 100 | 8,036 s | 0 | 258 ms | 6,356 s | 62 | 1.024.567 B |
| Pública | Desktop | 81 | 92 | 93 | 100 | 1,800 s | 0,000338 | 2 ms | 2,485 s | 62 | 1.024.341 B |

A página pública de baseline foi `https://atlasachievement.com.br/jogo/resident-evil-5`. Não há medição pública “depois”, porque a solicitação proíbe deploy; comparar código local novo contra produção antiga como se ambos fossem a versão final seria incorreto.

### 3.2 Diagnóstico do baseline

- HTML bruto local: 982.012 B.
- Recursos descompactados: 3.343.148 B.
- DOM aproximado: 7.707 nós.
- Elemento LCP real: o `<h1>` “Resident Evil 5 — Guia de platina e troféus”.
- Não houve elemento de layout shift identificado no baseline mobile.
- Long tasks mobile:
  - `app-guide-controller.js`: 234 ms;
  - documento: 210 ms;
  - Google Tag Manager: 99 ms e 98 ms;
  - outras tarefas do documento: 96 ms e 85 ms.
- Main thread mobile:
  - avaliação de scripts: 643,684 ms;
  - outros: 535,976 ms;
  - style/layout: 526,124 ms;
  - parse/compile: 171,416 ms.
- CSS não utilizado no baseline:
  - `admin.css`: 100%;
  - `checklist.css`: 98,41%;
  - `home.css`: 97,37%;
  - `catalog.css`: 98,78%;
  - `components.css`: 88,59%;
  - Font Awesome: 98,13%.
- JavaScript não utilizado no baseline:
  - `ui-catalog.js`: 97,38%;
  - `ui-library.js`: 85,19%;
  - `catalogModel.js`: 51,82%;
  - GTM: 39,97%;
  - além de partes das camadas genéricas do guia.

## 4. Comparativo antes/depois

| Métrica local — mediana | Mobile antes | Mobile depois | Desktop antes | Desktop depois |
|---|---:|---:|---:|---:|
| Performance | 54 | 97 | 76 | 99 |
| LCP | 15,400 s | 2,459 s | 3,061 s | 0,906 s |
| CLS | 0 | 0,00004 | 0,000545 | 0,001729 |
| TBT | 219 ms | 0 ms | 2 ms | 0 ms |
| Speed Index | 8,078 s | 2,574 s | 1,605 s | 1,055 s |
| Requisições | 62 | 10 | 62 | 10 |
| Transferido | 2.968.868 B | 455.344 B | 2.968.875 B | 455.349 B |
| Descompactado | 3.343.148 B | 1.331.070 B | 3.343.148 B | 1.331.070 B |
| Nós do DOM | 7.707 | 8.589 | 7.707 | 8.589 |

Reduções mobile:

- LCP: aproximadamente 84%;
- requisições: aproximadamente 84%;
- bytes transferidos: aproximadamente 85%;
- recursos descompactados: aproximadamente 60%;
- JavaScript inicial: de 37 arquivos para 1 arquivo de 31.986 B.

O DOM final é maior porque o SSR completo permanece disponível para o modo sem JavaScript, sem a reconstrução cliente que antes alterava a árvore. O custo de layout/pintura fora da viewport é adiado com `content-visibility`; conteúdo e indexação não foram removidos.

### 4.1 Elemento LCP

Antes e depois, o LCP é texto:

```text
section.atlas-panel > div.atlas-guide-hero__layout >
div.atlas-guide-hero__body > h1
```

Rótulo: “Resident Evil 5 — Guia de platina e troféus”.

A capa continua `loading="eager"` e é o único recurso com `fetchpriority="high"`, mas não é o LCP medido.

### 4.2 Requisições e bytes por tipo

Valores da execução representativa da mediana mobile:

| Tipo | Req. antes | Transferido antes | Descompactado antes | Req. depois | Transferido depois | Descompactado depois |
|---|---:|---:|---:|---:|---:|---:|
| Documento | 1 | 983.297 B | 982.012 B | 1 | 91.462 B | 680.241 B |
| CSS | 12 | 386.105 B | 445.362 B | 2 | 56.773 B | 327.768 B |
| JavaScript | 37 | 1.296.631 B | 1.624.434 B | 1 | 9.776 B | 31.986 B |
| Imagens | 3 | 128.845 B | 127.300 B | 2 | 128.814 B | 127.258 B |
| Fontes | 1 | 127.558 B | 126.828 B | 1 | 127.640 B | 126.828 B |
| Manifest | 1 | 2.022 B | 689 B | 1 | 2.077 B | 689 B |
| Outros/fetch/ping | 7 | 44.412 B | 36.523 B | 2 | 38.889 B | 36.300 B |

## 5. Mudanças de performance

### 5.1 CSS

- `home.css`, `catalog.css`, `checklist.css` e `admin.css` não são mais enviados pela rota RE5.
- Os sete arquivos realmente necessários ao guia e o pequeno CSS da Fase 5 são consolidados em memória pelo servidor e servidos como um único asset versionado:
  - `/css/re5-guide.ef3046c8cf1a.css`;
  - `Cache-Control: public, max-age=31536000, immutable`;
  - `Content-Type: text/css`.
- A consolidação não cria uma segunda cópia autoral dos estilos: o bundle é montado a partir dos arquivos-fonte existentes no startup.
- O CSS específico da Fase 5 permanece escopado ao RE5.
- `content-visibility: auto` adia layout/pintura do corpo do guia que está abaixo da dobra, sem retirar esse conteúdo do DOM ou da árvore de acessibilidade.

### 5.2 JavaScript e hidratação

- A rota deixou de carregar os 37 scripts genéricos de home, catálogo, biblioteca, UI e reconstrução do guia.
- Um enhancement local de 31.986 B preserva:
  - tabs e fragments;
  - voltar/avançar;
  - teclado;
  - accordions;
  - checklist e persistência;
  - busca e filtros;
  - comentários;
  - salvar na biblioteca;
  - autenticação sob interação;
  - feedback carregado sob demanda;
  - links internos e navegação pública.
- Não há reconstrução de FAQ, alertas, figuras, checklist ou conteúdo editorial.
- O estado inicial deixou de duplicar troféus, FAQs e demais dados editoriais já presentes no SSR; contém somente página, id/slug/nome do jogo e estado de autenticação.
- Eventos de checklist e filtros usam delegation; não existem 71 listeners individuais.
- Busca/filtros atualizam os cards existentes e a região de status, com anúncio moderado.

### 5.3 Font Awesome

A página usa 31 ícones distintos, portanto não é um caso de um ou dois ícones isolados. Para preservar a linguagem visual sem enviar uma icon font bloqueante:

- Font Awesome não está no caminho crítico;
- a folha é anexada após o evento `load`;
- caixas de ícone têm espaço reservado para reduzir shift;
- rótulos textuais mantêm os controles utilizáveis se a fonte externa falhar.

O Lighthouse ainda identifica alto percentual não utilizado na biblioteca; ele não bloqueia LCP e fica registrado como oportunidade futura de criar um subconjunto local dos 31 glifos.

### 5.4 Cache e compressão

- `compression@1.8.1` habilita gzip no servidor Express para respostas acima de 1 KiB.
- HTML dinâmico continua `no-cache, no-store, must-revalidate`.
- JS e CSS versionados usam cache imutável por um ano.
- SVGs continuam com `image/svg+xml`.
- Nenhum asset da rota retornou 404 no QA normal.
- A borda pública já comprimia o baseline; Brotli depende da CDN/infraestrutura e não foi configurado fora do repositório.

## 6. Progressive enhancement

Sem JavaScript:

- as seis áreas ficam visíveis em fluxo linear;
- accordions essenciais ficam expandidos;
- resumo, roadmap, checklist textual, Extras, DLCs, pontos de atenção, fontes e metodologia permanecem acessíveis;
- não há duplicação em `<noscript>`.

Com JavaScript:

- somente o painel ativo recebe exposição de tab;
- o hash inicial é respeitado antes da primeira pintura;
- uma falha no download ou na execução do enhancement remove a classe de tabs e restaura o fluxo linear.

Falha da API:

- o HTML SSR não é substituído;
- checklist local/sessão continua funcional;
- falha de sincronização gera aviso não bloqueante somente quando relevante.

Falha do `localStorage`:

- o toggle continua alterando o estado durante a sessão;
- não há exceção não tratada;
- um status informa que a persistência não foi possível.

## 7. Acessibilidade WCAG 2.2 AA

### 7.1 Automatizada

- Lighthouse Accessibility: 100/100 em todas as seis execuções finais.
- Sem IDs duplicados.
- Sem referências ARIA quebradas.
- Sem erro de contraste detectado.
- Sem erro de accessible name.
- Sem foco dentro de conteúdo fechado.
- Sem erro de console ou CSP no fluxo normal.

O projeto não continha axe-core. A suíte disponível (Lighthouse + verificações DOM/CDP específicas) cobriu a rota sem enviar biblioteca de auditoria para produção.

### 7.2 Checklist manual/semiautomatizado

| Critério | Resultado/evidência |
|---|---|
| 1.1.1 Alternativas textuais | Capa com alt; cinco figuras com alt, legenda e fallback |
| 1.3.1 Relações semânticas | tabs/tabpanel, headings, figure/figcaption e ARIA válidos |
| 1.3.2 Sequência significativa | SSR linear disponível sem JS |
| 1.4.3 Contraste de texto | Lighthouse sem falha |
| 1.4.10 Reflow | 320/360/390/768/1280 e zoom 200/400 sem overflow da página |
| 1.4.11 Contraste não textual | foco e bordas reforçados; forced-colors validado |
| 1.4.12 Espaçamento de texto | estilo de auditoria injetado sem overflow ou perda do H1 |
| 2.1.1 Teclado | tabs e controles operáveis |
| 2.1.2 Keyboard trap | nenhuma detectada |
| 2.4.1 Skip link | preservado |
| 2.4.3 Ordem de foco | preservada e verificada nos controles principais |
| 2.4.6 Headings/labels | H1 único; labels e nomes acessíveis |
| 2.4.7 Foco visível | outline de 3 px |
| 2.4.11 Foco não obscurecido | `scroll-margin-top` nos destinos |
| 2.5.3 Label in name | problema anterior da marca removido |
| 2.5.8 Tamanho dos alvos | nenhum alvo principal abaixo de 44 px no QA |
| 3.1.1 Idioma | `pt-BR` |
| 3.2.4 Identificação consistente | navegação e rótulos preservados |
| 4.1.2 Name, role, value | Lighthouse 100; ARIA íntegra |
| 4.1.3 Mensagens de status | progresso, filtro, storage e comentários usam status/live region |

Preferências realmente emuladas no navegador:

- `prefers-reduced-motion: reduce`;
- `prefers-contrast: more`;
- `forced-colors: active`.

## 8. Teclado, tabs, accordions e checklist

Tabs:

- `role="tablist"`, `role="tab"` e `role="tabpanel"`;
- `aria-selected`, `aria-controls`, IDs únicos e `tabindex` roving;
- ArrowRight/ArrowLeft;
- Home/End;
- Enter/Espaço;
- foco preservado;
- hash atualizado;
- `popstate` e `hashchange` preservados.

As seis URLs passaram:

- `#guideTab-summary`;
- `#guideTab-roadmap`;
- `#guideTab-checklist`;
- `#guideTab-extras`;
- `#guideTab-dlc`;
- `#guideTab-attention`.

Accordions:

- botão real;
- `aria-expanded` sincronizado;
- `aria-controls` válido;
- conteúdo fechado com `hidden`;
- abertura/fechamento sem salto de foco.

Checklist/filtros:

- estado anunciado por `aria-pressed`;
- contadores atualizados;
- persistência local e sincronização de conta isoladas;
- busca com nome acessível;
- limpar filtros com nome visível;
- resultado em `aria-live`;
- estado de nenhum resultado programaticamente exposto.

## 9. Testes de resiliência

| Cenário | Resultado |
|---|---|
| API indisponível | SSR, seis tabs e 51 cards preservados |
| Comentários indisponíveis | painel SSR preservado; checklist/tabs funcionais |
| Capa indisponível | fallback de capa; H1 preservado |
| Um SVG indisponível | legenda e alternativa textual preservadas |
| localStorage bloqueado | interação em memória/sessão; sem crash |
| Link externo bloqueado | guia e metodologia permanecem disponíveis |
| JavaScript desativado | 6/6 painéis e conteúdo essencial visíveis |
| Script de hydration bloqueado | fallback linear automático |
| Conexão lenta simulada | H1 e seis tabs disponíveis; carga de QA em 3.302 ms |

No fluxo normal:

- 0 erros de console;
- 0 exceções;
- 0 requisições com falha;
- 0 referências ARIA quebradas;
- 0 IDs duplicados;
- 0 overflow horizontal da página.

## 10. Screenshots

- [360 px](artifacts/re5-phase5/screenshots/re5-phase5-360.png)
- [390 px](artifacts/re5-phase5/screenshots/re5-phase5-390.png)
- [768 px](artifacts/re5-phase5/screenshots/re5-phase5-768.png)
- [1280 px](artifacts/re5-phase5/screenshots/re5-phase5-1280.png)

Os screenshots foram gerados após uma navegação fria por viewport. Em 768 px, a barra de tabs mantém rolagem interna própria; a página não apresenta overflow horizontal.

## 11. Testes finais

| Comando/validação | Resultado |
|---|---|
| `npm run test:guide -- resident-evil-5` | Passou |
| `npm run build` | Passou |
| `git diff --check` | Passou; somente avisos de normalização LF/CRLF |
| `node scripts/qa-re5-phase5.js` | Passou |
| Lighthouse mobile ×3 | 99, 94, 97; mediana 97 |
| Lighthouse desktop ×3 | 99, 98, 99; mediana 99 |
| Lighthouse A11y/BP/SEO | 100 em todas as execuções finais |

`npm run build` informou que o ambiente local usa Node 24.14.1, enquanto o projeto recomenda Node 20.x; a suíte passou.

## 12. Limitações e observações

- INP: **sem dados de campo disponíveis**.
- Não houve deploy, portanto não existe Lighthouse público pós-mudança.
- O browser integrado do Codex foi tentado, mas o ambiente retornou `missing sandboxPolicy`; o QA equivalente foi executado no Microsoft Edge headless via CDP local.
- O Lighthouse no Windows gerou `EPERM` ao tentar remover alguns perfis temporários. Os relatórios JSON escolhidos foram validados individualmente e contêm LCP/CLS/TBT válidos.
- Uma das três execuções mobile finais teve LCP de 2,836 s; a mediana exigida ficou em 2,459 s.
- A execução mobile representativa ainda registra long task do documento/style-layout de 244 ms. Ela está ligada ao parse/estilo do SSR editorial completo exigido para no-JS; não há TBT e não existe long task de script do enhancement. Remover conteúdo para reduzir esse custo violaria o escopo.
- O Font Awesome continua sendo uma dependência externa adiada; um subconjunto local dos 31 ícones seria uma otimização futura possível.
- `npm install` reportou 12 vulnerabilidades na árvore existente (2 baixas, 4 moderadas e 6 altas). Não foi executado `npm audit fix`, pois isso ampliaria o escopo e poderia introduzir mudanças incompatíveis.

## 13. Arquivos da Fase 5

- `src/app.js`
- `src/middleware/securityHeaders.js`
- `public/js/re5-guide-enhance.a30a6622.js`
- `public/css/re5-phase5.7c3b265c.css`
- `scripts/test-layers.js`
- `scripts/qa-re5-phase5.js`
- `package.json`
- `package-lock.json`
- `artifacts/re5-phase5/baseline/*`
- `artifacts/re5-phase5/after/*`
- `artifacts/re5-phase5/screenshots/*`
- `artifacts/re5-phase5/browser-qa.json`
- `RELATORIO_RE5_FASE5.md`

## 14. Confirmações finais

- Nenhum conteúdo editorial foi resumido, removido ou reescrito para melhorar métricas.
- Os 51 troféus base, 20 DLCs, 71 únicos, 36 FAQs, 12 alertas, 22 encontros e cinco figuras permanecem.
- Os fallbacks textuais permanecem.
- JSON-LD, autoria, fontes e datas permanecem.
- O SSR continua sendo o conteúdo principal.
- Outros jogos continuam com a composição de assets anterior; o bundle e o enhancement novos são exclusivos do RE5.
- A suíte rápida validou 105 jogos e 105 roadmaps.
- Nenhum commit foi criado.
- Nenhum deploy foi realizado.
