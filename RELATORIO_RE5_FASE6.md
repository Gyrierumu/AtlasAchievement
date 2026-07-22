# Relatório — Resident Evil 5 — Fase 6

Data da execução: 21/07/2026  
Status: implementação e validação concluídas localmente  
Escopo: somente `/jogo/resident-evil-5`  
Commit/deploy: não realizados

## 1. Resumo executivo

A Fase 6 redesenha o guia de Resident Evil 5 como uma ferramenta operacional de platina: cabeçalho compacto, escopo base/100% inequívoco, resumo com próxima ação contextual, roadmap marcável, capítulos com estado, checklist mais densa, Extras pesquisáveis, DLCs separados da platina e alertas organizados por severidade.

O conteúdo aprovado nas Fases 0–5 foi preservado. A alteração é isolada por `body[data-re5-phase6="true"]` e `.atlas-guide--resident-evil-5`, sem mudar o contrato visual dos demais guias.

Resultados principais:

- 51 troféus da platina base e 20 troféus de DLC continuam separados; total único: 71.
- As 6 abas continuam presentes e funcionais.
- 36 FAQs, 12 pontos de atenção, 22 chefes/encontros e 5 figuras instrucionais continuam no DOM.
- Os sete tamanhos pedidos passaram sem overflow horizontal, IDs duplicados, referências ARIA quebradas ou controles menores que 24 × 24 CSS px.
- O fallback sem JavaScript expõe as 6 abas e todas as seções essenciais em fluxo linear.
- Lighthouse válido: mobile 99/100/100/100; desktop 100/100/100/100.

## 2. Contrato editorial preservado

| Bloco | Resultado auditado |
|---|---:|
| Troféus base | 51 |
| DLC Versus | 10 |
| DLC Lost in Nightmares | 5 |
| DLC Desperate Escape | 5 |
| DLC total | 20 |
| Total único base + DLC | 71 |
| Etapas do roadmap | 7 |
| Capítulos | 16 |
| FAQs | 36 |
| Pontos de atenção | 12 |
| Chefes e encontros críticos | 22 |
| Figuras instrucionais | 5 |
| Abas principais | 6 |

Listas de Extras preservadas:

- 30 BSAA Emblems;
- 50 tesouros;
- 27 armas/itens de Stockpile;
- 18 upgrades;
- 16 ranks S;
- 49 itens de bônus/figuras;
- 4 ovos;
- 22 troféus situacionais;
- 22 chefes e encontros críticos.

A camada de autoridade permanece vinculada à versão PS4/Remaster, à revisão editorial de 18/07/2026 e às seis fontes auditadas das fases anteriores.

## 3. Redesign implementado

### Cabeçalho e hierarquia

- Cover reduzida e título `Resident Evil 5` como único H1.
- Subtítulo editorial `Guia de platina e troféus` e plataforma PS4/Remaster.
- Separação explícita entre `Platina — 51 troféus base` e `100% — 71 troféus com 20 DLCs · DLC não obrigatório`.
- Dificuldade, tempo, campanhas/cleanup, perdíveis, online e coop exibidos em uma grade compacta.
- Confiança editorial mantida, com duas ações principais e salvar/reportar rebaixados a utilidades textuais.

### Navegação

- As 6 abas permanecem em uma única linha rolável no mobile e em uma grade equilibrada no desktop.
- A aba ativa usa fundo, sublinhado e marcador, não apenas cor.
- Teclado: setas, Home e End atualizam foco, estado selecionado, painel e fragmento.
- Fragmentos de aba e links internos abrem automaticamente a aba e o acordeão corretos.

### Resumo

- `O estado da platina` substitui blocos promocionais redundantes.
- `Próxima ação recomendada` muda conforme progresso de roadmap/checklist.
- `Plano rápido` apresenta as sete etapas com estado e acesso direto.
- Quatro alertas essenciais aparecem antes da execução.
- `Como usar este guia` foi reduzido a três intenções: começar, cleanup e DLC.
- FAQ e metodologia vivem no Resumo, reduzindo dispersão entre abas.

### Roadmap

- Sete etapas numeradas e marcáveis, com persistência local própria.
- Índice interno para capítulos, Professional, farms e mitos.
- 16 capítulos em acordeões com cobertura, risco e estado de conclusão.
- Deep links revelam o conteúdo colapsado correto.

### Checklist

- Cards mais densos, com tipo do troféu, título, descrição e controle de conclusão em primeiro plano.
- Detalhes continuam disponíveis de forma progressiva, sem converter o toggle em CTA principal.
- Busca, filtros e densidade preservados.
- Filtros ficam em drawer no mobile e em toolbar sticky somente quando há largura suficiente.
- Estado da platina continua salvo na biblioteca já existente.

### Extras da Platina

- Índice por categoria e busca dedicada.
- Progresso por categoria e estado global persistentes.
- Categorias passam a funcionar como listas operacionais compactas, preservando texto, IDs, figuras e links aprovados.

### DLCs e 100%

- Bloco inicial reforça que DLC não é necessário para a platina.
- Versus, Lost in Nightmares e Desperate Escape têm resumo e progresso independentes.
- Versus recebe sinalização de dependência online/boost sem ser confundido com a rota base.
- Checklists detalhados, 18 Score Stars e 3 Agitator Majini permanecem intactos.

### Pontos de atenção

- Os 12 itens foram agrupados em `Crítico`, `Importante` e `Informação`.
- Cada item agora apresenta problema, impacto, prevenção, recuperação e link contextual.
- O texto editorial aprovado continua integralmente presente em `Prevenção`.

## 4. Responsividade e acessibilidade

Breakpoints revisados: 1100, 900, 768, 560 e 390 px.

Validações automatizadas em 320, 360, 390, 768, 1024, 1280 e 1440 px:

- zero overflow horizontal;
- um único H1;
- seis abas;
- zero IDs duplicados;
- zero referências `aria-controls`, `aria-labelledby` ou `aria-describedby` quebradas;
- zero alvos interativos abaixo do mínimo WCAG 2.2 de 24 × 24 px;
- reflow aprovado em zoom emulado de 200% e 400%;
- `prefers-reduced-motion` e `forced-colors` reconhecidos;
- navegação por teclado aprovada;
- oito fragmentos internos críticos testados;
- fallback sem JavaScript: 6/6 painéis visíveis, nenhuma seção essencial oculta e filtros expostos.

No desktop ≥1280 px, foi removida a coluna vazia que a navegação lateral antiga ainda reservava. O conteúdo agora usa a largura útil de até 1180 px sem perder o limite de leitura.

## 5. Antes e depois

As capturas de antes foram registradas a partir da instância da Fase 5 ainda carregada antes do reinício do servidor. As capturas de depois usam o código final da Fase 6.

| Viewport | Antes — Fase 5 | Depois — Fase 6 |
|---:|---|---|
| 320 | [PNG](artifacts/re5-phase6/before/re5-phase5-before-320.png) | [PNG](artifacts/re5-phase6/screenshots/re5-phase6-320.png) |
| 360 | [PNG](artifacts/re5-phase6/before/re5-phase5-before-360.png) | [PNG](artifacts/re5-phase6/screenshots/re5-phase6-360.png) |
| 390 | [PNG](artifacts/re5-phase6/before/re5-phase5-before-390.png) | [PNG](artifacts/re5-phase6/screenshots/re5-phase6-390.png) |
| 768 | [PNG](artifacts/re5-phase6/before/re5-phase5-before-768.png) | [PNG](artifacts/re5-phase6/screenshots/re5-phase6-768.png) |
| 1024 | [PNG](artifacts/re5-phase6/before/re5-phase5-before-1024.png) | [PNG](artifacts/re5-phase6/screenshots/re5-phase6-1024.png) |
| 1280 | [PNG](artifacts/re5-phase6/before/re5-phase5-before-1280.png) | [PNG](artifacts/re5-phase6/screenshots/re5-phase6-1280.png) |
| 1440 | [PNG](artifacts/re5-phase6/before/re5-phase5-before-1440.png) | [PNG](artifacts/re5-phase6/screenshots/re5-phase6-1440.png) |

Manifestos e evidências:

- [QA de navegador](artifacts/re5-phase6/browser-qa.json)
- [Manifesto das capturas de baseline](artifacts/re5-phase6/baseline-screenshots.json)
- [Lighthouse mobile](artifacts/re5-phase6/lighthouse-mobile.json)
- [Lighthouse desktop](artifacts/re5-phase6/lighthouse-desktop.json)

## 6. Performance

Lighthouse 13.4.1, Headless Chromium 150, servidor local em modo development.

| Perfil | Performance | Acessibilidade | Boas práticas | SEO | FCP | LCP | TBT | CLS | Speed Index | Transferência | Requests |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Mobile | 99 | 100 | 100 | 100 | 1,4 s | 2,1 s | 40 ms | 0 | 1,5 s | 457 KiB | 10 |
| Desktop | 100 | 100 | 100 | 100 | 0,3 s | 0,4 s | 0 ms | 0 | 0,5 s | 457 KiB | 10 |

Observação operacional: no Windows, o processo do Lighthouse terminou com `EPERM` ao tentar apagar o próprio diretório temporário depois de já escrever os relatórios. Os JSONs são completos e válidos; a coleta mobile que apresentou `NO_NAVSTART` na primeira execução paralela foi descartada e repetida isoladamente com sucesso.

## 7. Testes executados

| Teste | Resultado |
|---|---|
| `npm run test:guide -- resident-evil-5` | passou |
| `node scripts/qa-re5-phase6.js` | passou |
| `npm run build` | passou |
| `node --check src/app.js` | passou |
| `node --check public/js/re5-guide-enhance.a30a6622.js` | passou |
| `node --check scripts/qa-re5-phase6.js` | passou |
| `git diff --check` | passou |
| `npm run test:guide -- resident-evil-2-remake` | passou |
| `npm run test:guide -- resident-evil-6` | passou |
| `npm run test:guide -- resident-evil-village` | passou |

O build também validou 105 jogos, 105 roadmaps e os headers/cache da aplicação.

O teste adicional de `resident-evil-4-remake` apontou uma exigência editorial preexistente na FAQ (`deve ter respostas diretas`). Esse guia não recebeu marcação, CSS ou JavaScript da Fase 6 e não foi alterado para contornar o problema.

Aviso de ambiente: o projeto recomenda Node 20.x; a execução local usou Node 24.14.1 sem falhas funcionais.

## 8. Arquivos da Fase 6

- `src/app.js` — composição SSR específica de RE5 e inclusão do CSS da fase.
- `public/css/re5-phase6.css` — tokens e apresentação totalmente escopados ao RE5.
- `public/js/re5-guide-enhance.a30a6622.js` — abas, acordeões, deep links, estados, busca e persistência.
- `scripts/test-layers.js` — contratos SSR atualizados para a arquitetura aprovada.
- `scripts/qa-re5-phase6.js` — QA real de navegador e geração dos screenshots.
- `artifacts/re5-phase6/` — evidências antes/depois, QA e Lighthouse.
- `RELATORIO_RE5_FASE6.md` — este relatório.

## 9. Decisões e problemas corrigidos

- O asset JavaScript manteve a URL já cacheada pela Fase 5 para não quebrar o contrato de headers; o comportamento novo é restrito pelo root RE5.
- Um conflito da regra antiga de acordeões mantinha deep links visualmente colapsados. O estado `data-re5-collapsed` agora acompanha `aria-expanded` e `hidden`.
- A grade antiga ainda reservava 230 px para uma sidebar vazia em ≥1280 px. A Fase 6 colapsa essa coluna apenas no RE5.
- O navegador integrado não pôde iniciar por ausência de `sandboxPolicy`; o QA foi executado em Microsoft Edge headless via CDP local, com perfil isolado e limpeza automática.

Não há pendência funcional conhecida no escopo de Resident Evil 5. Nenhum commit, push ou deploy foi realizado.
