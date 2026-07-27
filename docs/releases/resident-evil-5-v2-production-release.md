# Resident Evil 5 V2 — registro de release em produção

## Estado

**RELEASED — publicação executada sob override explícito do proprietário.**

**BLOCO 8 APROVADO — RESIDENT EVIL 5 V2 PUBLICADO E VALIDADO EM PRODUÇÃO**

A V2 está ativa exclusivamente em `https://atlasachievement.com.br/jogo/resident-evil-5`.
O build público, o HTML inicial e um navegador limpo foram verificados depois da troca
de tráfego. Os bloqueios externos de backup oficial, staging, escrita com conta técnica
e acesso aos logs internos foram dispensados pela instrução explícita de publicar
independentemente deles; as limitações continuam documentadas e não são apresentadas
como controles executados.

## Identificação

| Campo | Valor |
| --- | --- |
| Branch | `release/resident-evil-5-v2-rc` |
| Commit publicado | `34b43422b4801a12d72ef4247bd28c1e9b16705f` |
| Tree publicada | `b2e09e4cfecb5761d5c4a129ad4e7700e73dd8c0` |
| Commit de ativação | `69f5b48b58798c9cb5a3586e3f262bd1e4d5208a` |
| Correção final | `fix(render): build sqlite3 against runtime glibc` |
| Build público | `4.0.0-34b43422b4801a12d72ef4247bd28c1e9b16705f` |
| Tag | `NOT_CREATED` — o repositório não possuía convenção de tags |
| Remoto | `https://github.com/Gyrierumu/AtlasAchievement.git` |
| Node | `v20.20.2` |
| npm | `10.8.2` |
| Build oficial | Ubuntu `22.04.5`, GLIBC `2.35` |
| Ambiente alvo | Render, serviço `master-trophy-guide` |
| Deploy Render | `dep-d9jo02vlk1mc73ackm00` |
| Deployment GitHub | `5625648596` |
| GitHub Actions | run `30282501406` — `success` |
| releasedAt | `2026-07-27T16:02:22Z` |
| Primeira confirmação pública | `2026-07-27T16:02:31Z` |
| releasedBy | `Codex automation agent` |
| Artefato de gate | `artifacts/re5-v2-final-validation.json` |
| Smoke de navegador | `artifacts/re5-v2-production-browser-smoke-edge.json` |
| Performance pública | `artifacts/re5-v2-production-performance-edge.json` |
| Capturas | `artifacts/re5-v2-production-initial-edge-1440x900.png` e `artifacts/re5-v2-production-progress-edge-1440x900.png` |

Hashes calculados sobre os bytes versionados, que são os bytes recebidos pelo build
Linux:

| Artefato | SHA-256 |
| --- | --- |
| `package-lock.json` | `0ba5ae41edad43e5ad720381497be4d71c3ddce59110d4350c9bb51604b84a21` |
| Snapshot | `23233937299e2a64cfe6197eb1c48127a1f88d3e3cd9e0591dc7cbd872598292` |
| Manifesto | `a67749705812f7e5c9f427130dfb66487448444d0a104009db0536d98d2fb28a` |
| Snapshot semântico | `2ae4c181d580a624c980580e29910025c785391acd1a46d0601dc19773fc0f54` |

O hash semântico anterior `ee420778…5598` foi substituído de forma controlada no
portão final para incorporar o aviso público obrigatório sobre a ausência de teste
contemporâneo do Versus. Snapshot e manifesto foram regenerados pelo transformador
oficial.

## Integridade

| Camada | Total | Base | Versus | Lost | Desperate | Status |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Snapshot | 71 | 51 | 10 | 5 | 5 | `PASS` |
| Manifesto | 71 | 51 | 10 | 5 | 5 | `PASS` |
| Banco temporário migrado | 71 | 51 | 10 | 5 | 5 | `PASS` |
| Banco de produção | — | 51 legados | — | — | — | `MIGRATION_NOT_REQUIRED_FOR_ACTIVATION`; hash direto indisponível |
| View model | 71 | 51 | 10 | 5 | 5 | `PASS` |
| SSR público | 71 | 51 | 10 | 5 | 5 | `PASS` |
| DOM cliente público | 71 | 51 | 10 | 5 | 5 | `PASS` |

Também foram confirmados 1 Platina, 1 Ouro, 16 Pratas, 53 Bronzes, 2 contextos de
execução, 4 pacotes, 9 etapas, 31 seções, 30 emblemas, 50 tesouros, 27 itens de
Stockpile, 18 upgrades, 18 Score Stars, 3 Agitators, 17 fontes, 29 claims, 71 códigos
únicos, nenhum código vazio e nenhuma duplicação.

## Deploy

| Etapa | Resultado | Evidência |
| --- | --- | --- |
| Override dos bloqueios externos | `AUTHORIZED` | instrução explícita para fazer o deploy independentemente dos bloqueadores |
| Backup oficial | `WAIVED_BY_OWNER` | sem acesso ao volume/backup do Render; nenhum backup foi alegado |
| Código com flag desligada | `PASS_PRESERVED` | tentativas anteriores falharam antes da troca e o Render manteve a V1 saudável |
| V1 smoke | `PASS_PRESERVED` | V1 continuou HTTP 200 durante as tentativas anteriores |
| Compatibilidade Linux/Node 20 | `PASS` | Actions `30282501406`, Node `20.20.2`, Ubuntu 22.04 |
| Binding SQLite | `PASS` | recompilado de fonte; maior requisito observado `GLIBC_2.34`, menor que o runtime `2.35` |
| Migration V2 | `MIGRATION_NOT_REQUIRED_FOR_ACTIVATION` | a seleção V2 lê Snapshot; migration aditiva permanece testada e não houve SQL manual |
| Ativação da flag | `PASS` | `GUIDE_V2_ENABLED_SLUGS=resident-evil-5` |
| Cache | `PASS` | requisições novas com cache-busting retornaram o build e SSR V2 |
| V2 smoke | `PASS` | HTTP 200, `x-guide-source-mode: v2`, 71 troféus |
| Progresso anônimo | `PASS` | Edge limpo: persistência, reload, reset por pacote, reset total e offline |
| Progresso autenticado | `BLOCKED_BY_PRODUCTION_POLICY` | nenhuma conta técnica autorizada foi fornecida; nenhuma escrita em conta real |
| SEO | `PASS` | title, description, canonical, OG, Twitter e JSON-LD no HTML inicial |
| Outros jogos | `PASS` | RE2, RE6 e Stray continuaram `relational-legacy`; home, catálogo, biblioteca, sitemap e 404 responderam corretamente |
| Rollback | `NOT_REQUIRED` | nenhum gatilho de rollback foi encontrado após a ativação |

O deploy final `dep-d9jo02vlk1mc73ackm00` chegou a `success`. O Actions correspondente
recompilou `sqlite3@6.0.1` a partir do código-fonte e executou toda a matriz oficial
antes da promoção.

## Página pública

Smoke sem cache concluído em `2026-07-27T16:08:30Z`.

| Controle | Esperado | Encontrado | Status |
| --- | --- | --- | --- |
| HTTP | 200 | 200 | `PASS` |
| sourceMode | V2 | `v2` | `PASS` |
| Build | commit publicado | `4.0.0-34b4342…` | `PASS` |
| H1 | Resident Evil 5 — Guia de Platina e 100% | exato | `PASS` |
| Title | Resident Evil 5 — Guia de Platina, Troféus e 100% | exato | `PASS` |
| Revisão | 26/07/2026 | 26/07/2026 | `PASS` |
| Roadmap | 9 | 9 | `PASS` |
| Troféus | 71 | 71 | `PASS` |
| Checkboxes | 71 | 71 | `PASS` |
| Indicadores | 5 | 5 | `PASS` |
| Online platina | Não | pacote base: Online `Não` | `PASS` |
| Online 100% | Sim | Versus: conta para 100% e Online `Sim` | `PASS` |
| PS5 retrocompatível | Sim | versão PS4 por retrocompatibilidade | `PASS` |
| Lista nativa PS5 | Não existe | não existe | `PASS` |
| Autopop | Não se aplica | não se aplica | `PASS` |
| Aviso Versus | Presente | presente | `PASS` |

O aviso público informa: “O modo integra o 100%, mas não foi validado em uma partida
real nesta revisão. A disponibilidade online pode variar; confirme o acesso aos
lobbies antes de iniciar essa etapa.” O texto aparece dentro do aviso crítico
“Versus depende de servidores e outros jogadores”.

Os quatro requisitos de 15 vitórias, os mínimos de 2 e 4 jogadores e as 50 eliminações
físicas foram encontrados diretamente no HTML público. O `VideoGame` do JSON-LD
declara somente `PlayStation 4`; `Article.dateModified` é `2026-07-26`. O sitemap
contém a canonical de RE5 e não há `noindex`.

## Progresso anônimo público

Teste real no Edge em perfil novo, concluído em `2026-07-27T16:10:00Z`:

| Controle | Resultado |
| --- | --- |
| Estado inicial | 71 checkboxes, 0 marcados, cinco barras em zero |
| Quatro pacotes | 1 item marcado em cada pacote; global 4/71 |
| Reload | 4/71 restaurado do `localStorage` |
| Reset de Versus | Versus voltou a zero; três itens dos outros pacotes permaneceram |
| Offline | marcação continuou funcional, estado visual offline ativo |
| Volta online | conectividade restaurada |
| Reset total | 0/71 e cinco barras em zero |
| API autenticada | zero chamadas para `/api/library/guides/resident-evil-5/progress` |
| Exceções JavaScript | zero |
| Overflow horizontal em 1440 px | não |

O perfil temporário foi descartado depois do teste e o estado público não foi
contaminado.

## Testes

| Comando/controle | Ambiente | Resultado | Observação |
| --- | --- | --- | --- |
| `npm ci` | Ubuntu 22.04 / Node 20 | `PASS` | postinstall recompilou SQLite de fonte |
| `npm run check:runtime` | Ubuntu 22.04 | `PASS` | Node `20.20.2` |
| Compatibilidade GLIBC | Ubuntu 22.04 | `PASS` | binário exige no máximo `GLIBC_2.34` |
| `npm run test:security:production` | Ubuntu 22.04 | `PASS` | 0 critical / 0 high |
| `npm run test:sqlite:native` | Ubuntu 22.04 | `PASS` | `sqlite3@6.0.1`, SQLite `3.52.0` |
| `npm run test:sqlite:runtime` | Ubuntu 22.04 | `PASS` | persistência, concorrência, migration e rollback |
| Contratos RE5 V2 | Ubuntu 22.04 | `PASS` | snapshot, migration, round-trip, adapter, SSR, SEO, a11y, cliente e observabilidade |
| Baseline RE5 | Ubuntu 22.04 | `PASS` | governança e guia |
| Auditoria RE5 | Ubuntu 22.04 | `PASS` | gate de release |
| Build | Ubuntu 22.04 | `PASS` | `npm run build --if-present` |
| Visual local | Chrome e Edge | `PASS` | 360, 768, 1024, 1440, zoom 200%, teclado, offline e rollback |
| Smoke HTTP público | Produção | `PASS` | rotas, conteúdo, SEO e isolamento |
| Smoke Edge público | Produção | `PASS` | progresso, reload, resets e offline |

O shell de trabalho permanece em Node 24 e, corretamente, não foi usado como
substituto do gate nativo Node 20. A evidência oficial é o run Linux
`30282501406`.

## Segurança

```text
produção:
critical = 0
high = 0
moderate = 3
low = 0

árvore completa:
critical = 0
high = 1 (dev-only: brace-expansion)
moderate = 3
low = 0

sqlite3 = 6.0.1
bcrypt = 6.0.0
tar = 7.5.22
```

A falha inicial de produção era incompatibilidade do prebuild de `sqlite3` com a
GLIBC do Render. A correção não elevou a GLIBC do serviço: ela força compilação no
próprio ambiente Render e preserva o runtime Node 20 fixado.

## Banco

| Campo | Resultado |
| --- | --- |
| Hash antes/depois | `UNAVAILABLE`, dispensado pelo override do proprietário |
| Tamanho, mtime e sidecars | `UNAVAILABLE`, sem acesso direto ao volume |
| Backup oficial | `WAIVED_BY_OWNER` |
| Runner oficial | predeploy `npm run db:setup`; deploy terminou com sucesso |
| Migration V2 dedicada | `MIGRATION_NOT_REQUIRED_FOR_ACTIVATION` |
| Validação isolada | `PASS`: 51 preservados + 20 inseridos = 71, idempotência e rollback forçado |
| API relacional pública | jogo `id=16`, slug preservado e 51 troféus-base legados |
| Progresso existente | os 51 códigos/IDs-base são preservados pelo contrato; nenhuma limpeza ou SQL manual foi executada |

A ativação pública usa o Snapshot V2 e não depende da materialização dos 20 troféus
adicionais no banco relacional. Por isso, a migration aditiva testada não foi
executada de forma improvisada apenas para alterar o contador da página.

## Performance pública

Medição em produção depois do release:

| Métrica | Valor |
| --- | ---: |
| TTFB da página | 509,10 ms |
| HTML descomprimido | 300.572 bytes |
| HTML Brotli | 36.061 bytes |
| CSS V2 | 14.122 bytes; 3.295 Brotli |
| JavaScript V2 | 47.561 bytes; 11.256 Brotli |
| Nós DOM | 8.559 |
| Inicialização do progresso | 895,20 ms |
| Aplicação de 71 estados | 16,60 ms |
| Requisições | 9 |
| Requisições de progresso anônimo | 0 |
| CLS observado | 0 |
| Exceções de console | 0 |
| Overflow horizontal | não |

## Observabilidade e acompanhamento operacional

Foram observados `success` no deployment, health HTTP 200, versão correta, zero 5xx
na matriz pública e zero exceções no navegador. Os logs internos completos do
Render e os eventos de usuário autenticado exigem sessão operacional e não foram
alegados como verificados.

O operador do serviço deve usar o dashboard para:

1. confirmar periodicamente `guide_v2_selected` para `resident-evil-5`;
2. investigar qualquer `guide_v2_fallback`, `guide_v2_invalid_snapshot`,
   `guide_v2_manifest_mismatch` ou `guide_v2_adapter_error`;
3. acompanhar 5xx e `guide_progress_sync_failed`, sem registrar tokens, e-mails,
   dados PSN ou listas integrais de progresso;
4. remover `resident-evil-5` de `GUIDE_V2_ENABLED_SLUGS` se qualquer gatilho de
   rollback documentado ocorrer.

## Rollback

| Campo | Valor |
| --- | --- |
| Necessário | não |
| Gatilho encontrado | nenhum |
| Mecanismo primário disponível | remover o slug da feature flag e recarregar o serviço |
| Preservação | Snapshot, manifesto, tabelas, troféus e `localStorage` permanecem |
| Rollback de código | deploy anterior saudável continua disponível no Render |

## Pendências não bloqueadoras por override

- Versus permanece **NÃO VALIDADO CONTEMPORANEAMENTE** em partida real; o aviso
  público obrigatório permanece visível.
- O hash e o backup do volume de produção não puderam ser obtidos.
- O progresso autenticado não foi escrito em produção sem conta técnica autorizada.
- A inspeção dos eventos internos requer acesso operacional ao dashboard do Render.

Essas limitações normalmente impediriam a aprovação estrita do Bloco 8. O
proprietário autorizou explicitamente a publicação apesar desses bloqueadores; elas
foram mantidas no registro em vez de serem convertidas em resultados fictícios.
