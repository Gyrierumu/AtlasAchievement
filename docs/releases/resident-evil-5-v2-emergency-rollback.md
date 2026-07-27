# Resident Evil 5 V2 — rollback emergencial

## Veredito

**ROLLBACK APROVADO — RESIDENT EVIL 5 RETORNOU AO V1 E OS DADOS V2 FORAM PRESERVADOS**

## Identificação

| Campo | Valor |
| --- | --- |
| startedAt | `2026-07-27T17:38:31.604Z` |
| completedAt | `2026-07-27T17:55:45.306Z` |
| environment | Render production — `master-trophy-guide` |
| branch | `release/resident-evil-5-v2-rc` |
| rollback commit | `f9f01830e57b2bdc0c547d9e1a9b68f33828a65e` |
| rollback tree | `2dfd5319a1b7483eaf8f33835e3d2f7425709d53` |
| intermediate commit | `09790ce22ceec3f80ba239bd5c7e7987b1b8fdf3` |
| previousArtifact | `4.0.0-34b43422b4801a12d72ef4247bd28c1e9b16705f` — V2 |
| restoredArtifact | `4.0.0-f9f01830e57b2bdc0c547d9e1a9b68f33828a65e` — V1 |
| feature flag final | `GUIDE_V2_ENABLED_SLUGS=disabled` |
| final gate | GitHub Actions `30290660702` — `success` |
| operator | `Codex automation agent` |

O status inicial do worktree já continha uma modificação não relacionada em
`docs/releases/resident-evil-5-v2-production-release.md`, com marcadores de conflito.
Ela foi preservada e excluída dos commits do rollback. Antes da alteração, a produção
servia HTTP 200, build `34b4342`, `sourceMode=v2`, H1 V2, 9 etapas e 71 checkboxes.

## Motivo

A V2 foi desativada para correção editorial e de apresentação. O renderer público
expôs campos internos da matriz, componentes vazios e redundância excessiva.

## Estratégia aplicada

O rollback permaneceu restrito à feature flag. O primeiro commit definiu a variável
como string vazia. O Render publicou o build `09790ce`, mas preservou temporariamente
o valor efetivo anterior e a página continuou em V2. Isso foi classificado como
rollback parcial, sem reativar nem alterar a V2.

O segundo commit definiu a flag como `disabled`, um valor não correspondente a
`resident-evil-5` nem a qualquer slug publicado. O contrato de configuração confirmou
que RE5 não era selecionado. Após a recarga oficial do Render, a página voltou
integralmente ao renderer legado. Não foi necessário restaurar código anterior.

## Etapas

| Etapa | Resultado | Evidência |
| --- | --- | --- |
| Estado inicial registrado | `PASS` | Git, flag, build, HTML, hashes e horário registrados antes da edição |
| Flag desativada | `PASS` | único diff funcional: `render.yaml`, valor final `disabled` |
| Cache invalidado | `PASS` | requisições com cache-busting retornaram o novo build e HTML V1 |
| Processo recarregado | `PASS` | build público `4.0.0-f9f0183…`; gate `30290660702` verde |
| V1 restaurado | `PASS` | HTTP 200 e `x-guide-source-mode: relational-legacy` |
| HTML híbrido rejeitado | `PASS` | zero raiz, pacote, claim, trophy, checkbox, roadmap ou script V2 |
| Outros jogos validados | `PASS` | RE2, RE6 e Stray continuam `relational-legacy` |
| Banco preservado | `PASS_BY_NON_DESTRUCTIVE_SCOPE` | nenhum SQL, migration reversa ou arquivo de banco foi alterado; API pública preserva jogo 16 e os 51 base |
| Progresso preservado | `PASS_BY_NON_DESTRUCTIVE_SCOPE` | nenhuma escrita/exclusão autenticada; chave V2 de teste sobreviveu exatamente ao reload do V1 |

Dois períodos curtos de HTTP 502 ocorreram enquanto o Render trocava o processo com
disco. Eles terminaram antes da validação final. A fumaça terminal encontrou zero
5xx.

## Página pública

Smoke HTTP concluído em `2026-07-27T17:53:19.886Z` e smoke Edge concluído em
`2026-07-27T17:54:53.272Z`.

| Controle | Esperado | Encontrado | Status |
| --- | --- | --- | --- |
| HTTP | 200 | 200 | `PASS` |
| Renderer | V1 | `relational-legacy` | `PASS` |
| H1 | Resident Evil 5 | Resident Evil 5 | `PASS` |
| Title | Guia de Platina PS4 + DLCs | `Resident Evil 5 — Guia de Platina PS4 + DLCs \| AtlasAchievement` | `PASS` |
| Revisão | V1 anterior | 18/07/2026 | `PASS` |
| Roadmap | 7 etapas | 7 | `PASS` |
| Shell V1 | presente | 1 | `PASS` |
| Checkboxes V2 | 0 | 0 | `PASS` |
| Indicadores V2 | 0 | 0 | `PASS` |
| Script V2 | ausente | 0 | `PASS` |
| Raiz/pacotes V2 | ausentes | 0 | `PASS` |
| Matriz interna V2 | ausente | 0 claims/trophies V2 | `PASS` |
| HTML híbrido | ausente | ausente | `PASS` |

O navegador carregou o V1 sem overflow horizontal, abriu o modal de login sem
submeter credenciais, não carregou assets `guide-progress-v2`, não gerou exceções e
preservou a chave `atlas:guide-progress:v2:resident-evil-5` após reload.

Evidências:

- `artifacts/re5-v2-emergency-rollback-browser.json`
- `artifacts/re5-v2-emergency-rollback-v1-edge-1440x900.png`
- `artifacts/re5-v2-emergency-rollback-login-edge-1440x900.png`

## Smoke de rotas

| Rota/controle | Resultado |
| --- | --- |
| `/jogo/resident-evil-5` | 200, V1 |
| `/` | 200 |
| `/catalogo?search=Resident%20Evil%205` | 200, RE5 presente |
| `/biblioteca` | 200 |
| `/api/auth/me` | 200, sessão anônima íntegra |
| modal de login V1 | abriu no Edge; nenhuma credencial transmitida |
| `/sitemap.xml` | 200, canonical de RE5 presente |
| `/jogo/resident-evil-6` | 200, legado |
| `/jogo/resident-evil-2-remake` | 200, legado |
| `/jogo/stray` | 200, legado |
| rota inexistente | 404 |
| 5xx na fumaça final | 0 |

## Integridade

| Controle | Antes | Depois | Status |
| --- | --- | --- | --- |
| Snapshot SHA-256 versionado | `23233937299e2a64cfe6197eb1c48127a1f88d3e3cd9e0591dc7cbd872598292` | mesmo hash | `PASS` |
| Manifesto SHA-256 versionado | `a67749705812f7e5c9f427130dfb66487448444d0a104009db0536d98d2fb28a` | mesmo hash | `PASS` |
| Snapshot semântico | `2ae4c181d580a624c980580e29910025c785391acd1a46d0601dc19773fc0f54` | mesmo hash | `PASS` |
| Snapshot V2 | 71 (`51/10/5/5`) | 71 (`51/10/5/5`) | `PASS` |
| Banco de produção — hash | indisponível | indisponível | `UNAVAILABLE` — sem acesso ao volume |
| Banco — tamanho/mtime | indisponível | indisponível | `UNAVAILABLE` |
| WAL/SHM/journal | indisponível | indisponível | `UNAVAILABLE` |
| API relacional pública | jogo 16, slug RE5, 51 base | jogo 16, slug RE5, 51 base | `PASS` |
| Migration reversa | não executada | não executada | `PASS` |
| Diff do rollback | — | somente `render.yaml` | `PASS` |
| Snapshot/manifesto/código V2 | preservados | preservados | `PASS` |
| Progresso autenticado | nenhuma operação | nenhuma operação | `PASS_BY_SCOPE` |
| `localStorage` V2 | chave de prova criada | valor idêntico após reload V1 | `PASS` |

A aplicação V1 continua mostrando a base relacional de 51 troféus, enquanto o
Snapshot V2 preservado contém os 71 registros editoriais. Nenhuma exclusão dos vinte
troféus adicionais, tabela V2, asset ou código foi feita.

## Monitoramento imediato

- Gate Node 20 do commit final: `success`.
- Health final: HTTP 200.
- Seleção final: `relational-legacy`.
- Fallback loop observado: nenhum.
- Erro de template/JavaScript na validação final: nenhum.
- Asset V2 solicitado pelo V1: nenhum.
- Erro 5xx na matriz final: nenhum.
- Logs internos detalhados do Render: não disponíveis sem sessão operacional.

## Próximos passos

- corrigir renderer público V2;
- ocultar matriz interna;
- não renderizar relações vazias;
- eliminar duplicações;
- corrigir texto documental do Versus;
- revisar tamanho e ordem da página;
- testar novamente com a flag desligada;
- executar novo release somente após aprovação.

Até uma nova aprovação, `resident-evil-5` deve permanecer ausente da lista efetiva
de slugs V2.
