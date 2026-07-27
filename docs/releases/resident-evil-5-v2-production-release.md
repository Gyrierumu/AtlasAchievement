# Resident Evil 5 V2 — registro de release em produção

## Estado

**BLOCKED**

**BLOCO 8 BLOQUEADO — RELEASE NÃO EXECUTADO OU NÃO VALIDADO EM PRODUÇÃO**

A release candidate foi preparada e validada localmente, mas não foi enviada ao pipeline de produção porque faltam três pré-condições bloqueadoras: execução oficial em Linux x64/Node 20, backup verificável do banco/volume de produção e acesso operacional ao Render para deploy, configuração, logs e rollback.

Produção permaneceu inalterada e a rota pública continuou em V1 durante toda esta execução.

## Identificação

| Campo | Valor |
| --- | --- |
| Branch | `release/resident-evil-5-v2-rc` |
| Commit candidato | `51dac4594622f5626d83321a95f2388b1957e5e2` |
| Tree candidata | `a6d148b308b7bd82966d08733a1e0b578ccdf1bc` |
| Commit de conteúdo validado | `fbf682cfd990bbcb4b066b8aa99b677a787e866b` |
| Integração de `origin/main` | árvore idêntica ao conteúdo validado |
| Tag | `NOT_CREATED` — não houve publicação |
| Artefato | `artifacts/re5-v2-final-validation.json` |
| Build identifier | `re5-v2-rc-51dac459-2ae4c181` |
| Node local | `v20.20.2` |
| npm local | `10.8.2` |
| Ambiente local | `win32-x64` |
| Ambiente alvo | Render, Linux; acesso operacional indisponível |
| releasedAt | `NOT_APPLICABLE` |
| releasedBy | `Codex automation agent` — preparação/auditoria, não publicação |
| Remoto | `https://github.com/Gyrierumu/AtlasAchievement.git` |
| `origin/main` observado | `6cce3f3cf2dc97601275e421250a2874f0525a74` |
| package-lock SHA-256 | `34e15116850de34cf19239b15b34ce0801b1c7452c4f876d21ba8905704531c3` |
| Snapshot semântico | `2ae4c181d580a624c980580e29910025c785391acd1a46d0601dc19773fc0f54` |
| Snapshot arquivo | `23233937299e2a64cfe6197eb1c48127a1f88d3e3cd9e0591dc7cbd872598292` |
| Manifesto arquivo | `a67749705812f7e5c9f427130dfb66487448444d0a104009db0536d98d2fb28a` |

## Integridade

| Camada | Total | Base | Versus | Lost | Desperate | Status |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Snapshot | 71 | 51 | 10 | 5 | 5 | `PASS` |
| Manifesto | 71 | 51 | 10 | 5 | 5 | `PASS` |
| Banco temporário | 71 | 51 | 10 | 5 | 5 | `PASS` |
| Banco de produção | — | — | — | — | — | `BLOCKED` |
| View model | 71 | 51 | 10 | 5 | 5 | `PASS` |
| SSR local V2 | 71 | 51 | 10 | 5 | 5 | `PASS` |
| SSR público V2 | — | — | — | — | — | `BLOCKED` — produção ainda em V1 |
| DOM cliente local | 71 | 51 | 10 | 5 | 5 | `PASS` |
| DOM cliente público V2 | — | — | — | — | — | `BLOCKED` — flag não ativada |

O Snapshot final também contém 1/1/16/53, 9 etapas, 31 seções, 30 emblemas, 50 tesouros, 27 itens, 18 upgrades, 18 Score Stars, 3 Agitators, 17 fontes, 29 claims, 71 IDs únicos, zero ID vazio e zero duplicação.

## Deploy

| Etapa | Resultado | Evidência |
| --- | --- | --- |
| Backup | `BLOCKED` | sem shell/API do volume Render e sem hash/restore de produção |
| Código com flag desligada | `NOT_EXECUTED` | pipeline não acionado |
| V1 smoke pré-release | `PASS` | URL pública HTTP 200 e `sourceMode=relational-legacy` |
| Migration | `BLOCKED` | necessária para sync autenticado dos 20 códigos adicionais; backup ausente |
| Ativação da flag | `NOT_EXECUTED` | `GUIDE_V2_ENABLED_SLUGS` não alterada |
| Cache | `NOT_EXECUTED` | nenhuma invalidação realizada |
| V2 smoke | `BLOCKED` | V2 não publicada |
| Progresso anônimo público | `BLOCKED` | V2 não publicada |
| Progresso autenticado público | `BLOCKED_BY_PRODUCTION_POLICY` | sem conta técnica/procedimento e sem V2 publicada |
| SEO público V2 | `BLOCKED` | produção permanece em metadados V1 |
| Outros jogos pós-release | `NOT_APPLICABLE` | não houve release; regressões locais passaram |
| Logs/observabilidade | `BLOCKED` | acesso aos logs Render indisponível |

## Página pública antes do release

Consulta sem cache executada em `https://atlasachievement.com.br/jogo/resident-evil-5`:

| Controle | Esperado V2 | Encontrado | Status |
| --- | --- | --- | --- |
| HTTP | 200 | 200 | `PASS` para V1 |
| sourceMode | `v2` | `relational-legacy` | `BLOCKED` |
| H1 | Resident Evil 5 — Guia de Platina e 100% | Resident Evil 5 | `BLOCKED` |
| Title | Resident Evil 5 — Guia de Platina, Troféus e 100% | Resident Evil 5 — Guia de Platina PS4 + DLCs \| AtlasAchievement | `BLOCKED` |
| Revisão | 26/07/2026 | 18/07/2026 | `BLOCKED` |
| Roadmap | 9 | 7 | `BLOCKED` |
| Troféus V2 | 71 | marcadores V2 ausentes | `BLOCKED` |
| Checkboxes V2 | 71 | 0 | `BLOCKED` |
| Online platina | Não | resumo V1 não faz a distinção exigida | `BLOCKED` |
| Online 100% | Sim | resumo V1 não faz a distinção exigida | `BLOCKED` |
| PS5 retrocompatível | Sim | contexto V2 ausente | `BLOCKED` |
| Aviso Versus | Presente | ausente no V1 público | `BLOCKED` |
| Canonical | URL de produção | correto | `PASS` |
| Cache | no-cache/no-store | `no-cache, no-store, must-revalidate` | `PASS` |

Essa é evidência de que nenhum deploy ou ativação acidental ocorreu. Não é evidência de V2 publicada.

## Testes

| Comando/controle | Ambiente | Resultado | Observação |
| --- | --- | --- | --- |
| `npm ci` | Windows x64, Node 20 | `PASS` | lockfile permaneceu idêntico |
| `npm run check:runtime` | Windows x64 | `PASS` | Node 20 |
| `npm run test:security:production` | Windows x64 | `PASS` | 0 critical/0 high |
| SQLite nativo/runtime | Windows x64 | `PASS` | `sqlite3@6.0.1` |
| Snapshot/migration/round-trip | banco temporário | `PASS` | 71/51/10/5/5 |
| Adapter/SSR/SEO/a11y/client | local isolado | `PASS` | contrato V2 integral |
| Contratos | local isolado | `PASS` | 239.038 ms |
| Visual | Chrome e Edge | `PASS` | 4 viewports, 200%, teclado, offline e rollback |
| RE5 | local isolado | `PASS` | guia V2 |
| RE2 | base + candidato | `PASS` isolado | falha global histórica reproduzida no base |
| RE6, Stray, Inside | local isolado | `PASS` | com/sem DLC |
| Build | Windows x64 | `PASS` | script presente |
| Backup/restore local | temporário | `PASS` | hash e integridade preservados |
| Linux x64 oficial | indisponível | `BLOCKED` | requisito de produção |
| Staging | indisponível | `BLOCKED` | sem URL/credencial |

Resultado completo: `TECHNICALLY_VALIDATED_EXTERNAL_BLOCKERS`.

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

`npm audit` e `npm audit --omit=dev` retornam código 1 pelos achados moderados conhecidos; o gate específico de produção confirma zero crítica e zero alta na árvore de produção.

## Banco

| Campo | Resultado |
| --- | --- |
| Hash de produção antes | `BLOCKED` |
| Tamanho/mtime antes | `BLOCKED` |
| WAL/journal/shm | `BLOCKED` |
| Backup oficial | `BLOCKED` |
| Hash do backup | `BLOCKED` |
| Restore isolado do backup oficial | `BLOCKED` |
| Hash de produção depois | `NOT_APPLICABLE` — deploy não ocorreu |
| Migration aplicada | não |
| Progresso de produção alterado | não |

A V2 renderiza a partir de Snapshot, porém a sincronização autenticada persiste por `trophy_code`. Os vinte códigos adicionais precisam existir na camada relacional quando a migration/backfill testada for exigida pelo runner. Portanto, não foi usado `MIGRATION_NOT_REQUIRED_FOR_ACTIVATION`: ativar a experiência completa sem inspecionar schema, fazer backup e executar o runner oficial seria inseguro.

O único backup/restore realizado foi local, com dados fictícios e diretório temporário. Nenhum banco real foi copiado, migrado ou editado.

## Performance local

| Métrica V2 | Valor |
| --- | ---: |
| SSR p95 | 91,60 ms |
| HTML | 300.572 bytes |
| HTML gzip | 38.778 bytes |
| CSS | 17.254 bytes |
| JavaScript | 47.561 bytes |
| Nós DOM | 8.559 |
| Inicialização | 408,20 ms |
| Aplicação de 71 estados | 58,40 ms |
| Requisições observadas | 8 |
| CLS | 0 |
| Erros contínuos de console | 0 no harness |
| Overflow horizontal | não |

Não há métrica pós-release porque não houve release.

## Rollback

| Campo | Valor |
| --- | --- |
| Necessário | não |
| Gatilho | release bloqueada antes do deploy |
| Mecanismo primário planejado | remover somente `resident-evil-5` de `GUIDE_V2_ENABLED_SLUGS` |
| Migration destrutiva planejada | não |
| Resultado | produção permaneceu em V1 |

O rollback local V2→V1→V2 passou em 3.041 ms, preservando progresso local e sem duplicação. O rollback externo continua `BLOCKED`.

## Observabilidade para o operador

Quando o acesso existir, o operador deve verificar imediatamente e nas janelas de 15, 30, 60 minutos e 24 horas:

- `guide_v2_selected` presente para RE5;
- zero fallback inesperado;
- zero `guide_v2_invalid_snapshot`, `guide_v2_manifest_mismatch` e `guide_v2_adapter_error`;
- zero 5xx;
- progresso inicializado e sincronizado sem dados pessoais em log;
- nenhum token, e-mail, ID PSN ou lista integral de progresso;
- latência, falhas de sync e isolamento entre usuários;
- RE2, RE6, Stray, home, busca, biblioteca, sitemap e 404.

Qualquer 5xx, fallback inesperado, hash/manifesto divergente, total diferente de 71, perda de progresso, violação entre usuários, regressão grave de acessibilidade ou erro crítico de JavaScript exige remover a flag de RE5 imediatamente.

## Bloqueios para uma nova tentativa

1. Disponibilizar runner Linux x64 oficial com Node 20 e validar SQLite nesse ambiente.
2. Disponibilizar acesso ao Render/serviço correto, sem expor credenciais.
3. Registrar versão/artefato/configuração atualmente publicados.
4. Criar backup oficial do volume/banco, registrar hash/tamanho/mtime/sidecars e provar restore isolado.
5. Nomear operador da janela e responsável pelo rollback.
6. Publicar primeiro com a flag vazia, executar smoke V1 e somente depois ativar `resident-evil-5`.
7. Executar smoke V2, progresso, SEO, outros jogos e observabilidade diretamente em produção.

## Pendência factual não bloqueadora por decisão editorial

Versus permanece **NÃO VALIDADO CONTEMPORANEAMENTE**. O Snapshot final informa publicamente que o modo integra o 100%, não foi validado em partida real nesta revisão e pode variar em disponibilidade. Essa pendência factual foi autorizada pelo Bloco 8, mas não é convertida em evidência prática.
