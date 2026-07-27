# Resident Evil 5 V2 — registro de release em produção

## Estado

**BLOCKED**

**BLOCO 8 BLOQUEADO — RELEASE NÃO EXECUTADO OU NÃO VALIDADO EM PRODUÇÃO**

O proprietário autorizou explicitamente prosseguir apesar dos bloqueios externos de backup e staging. A release foi promovida para `main`, o pipeline do Render foi acionado e a ativação isolada de `resident-evil-5` foi versionada. Todas as tentativas do Render terminaram em `failure` antes da troca de tráfego.

O Render preservou a instância anterior. Em `2026-07-27T15:35:08Z`, a produção continuava saudável em V1, servindo o build `4.0.0-6cce3f3cf2dc97601275e421250a2874f0525a74`.

## Identificação

| Campo | Valor |
| --- | --- |
| Branch | `release/resident-evil-5-v2-rc` |
| Commit inicialmente promovido | `f040a5f2ae9dab5f58c2ee6b05f0c95eb8e707d0` |
| Commit de ativação | `69f5b48b58798c9cb5a3586e3f262bd1e4d5208a` |
| Commit do gate Linux/Node 20 | `f79e39f3c4334e4a68142adf092e82b9c4cceca3` |
| Commit final tentado | `798c56b898bfb39e9ad45f414c067f0592281e55` |
| Tree final tentada | `9e8a12c1c3ab8bf1817b9195c81252abfa52031a` |
| Tag | `NOT_CREATED` — não houve publicação bem-sucedida |
| Artefato | `artifacts/re5-v2-final-validation.json` |
| Screenshot pós-falha | `artifacts/re5-v2-production-v1-preserved-2026-07-27.png` |
| Node validado | `20.x`, Ubuntu Linux; patch local de referência `20.20.2` |
| npm validado | npm fornecido por `actions/setup-node@v4` |
| Ambiente alvo | Render, serviço `master-trophy-guide` |
| releasedAt | `NOT_APPLICABLE` |
| releasedBy | `Codex automation agent` — promoção, diagnóstico e validação |
| Remoto | `https://github.com/Gyrierumu/AtlasAchievement.git` |
| Build público preservado | `4.0.0-6cce3f3cf2dc97601275e421250a2874f0525a74` |
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
| Banco de produção | — | — | — | — | — | `UNVERIFIED` — sem acesso ao volume/log |
| View model | 71 | 51 | 10 | 5 | 5 | `PASS` |
| SSR local V2 | 71 | 51 | 10 | 5 | 5 | `PASS` |
| SSR público V2 | — | — | — | — | — | `BLOCKED` — build novo não recebeu tráfego |
| DOM cliente local | 71 | 51 | 10 | 5 | 5 | `PASS` |
| DOM cliente público V2 | — | — | — | — | — | `BLOCKED` — produção permaneceu em V1 |

O Snapshot final também contém 1/1/16/53, 9 etapas, 31 seções, 30 emblemas, 50 tesouros, 27 itens, 18 upgrades, 18 Score Stars, 3 Agitators, 17 fontes, 29 claims, 71 IDs únicos, zero ID vazio e zero duplicação.

## Deploy

| Etapa | Resultado | Evidência |
| --- | --- | --- |
| Override dos bloqueios externos | `AUTHORIZED` | instrução explícita do proprietário para fazer o deploy independentemente dos bloqueadores |
| Backup oficial | `WAIVED_BY_OWNER` | não executado; risco aceito no override, sem alegação de backup |
| Código com flag desligada | `FAILED` | commit `f040a5f2`; Render deploy `dep-d9jn3hmq1p3s738aek8g` terminou em `failure` |
| V1 smoke após a fase A | `PASS_PRESERVED` | processo antigo permaneceu HTTP 200, `sourceMode=relational-legacy` |
| Ativação isolada | `FAILED` | `GUIDE_V2_ENABLED_SLUGS=resident-evil-5` no commit `69f5b48`; não entrou em tráfego |
| Gate Linux/Node 20 | `PASS` | GitHub Actions run `30278960669` e run final `30280271960` |
| Pin do runtime Render | `FAILED` | `.node-version=20.20.2`; deploy `dep-d9jnisf9flrs73dlbdc0` terminou em `failure` |
| Migration | `UNVERIFIED` | nenhum deploy concluiu; sem log autenticado ou hash do volume |
| Cache | `NOT_EXECUTED` | a rota nunca mudou para V2 |
| V2 smoke | `BLOCKED` | não houve V2 pública |
| Progresso anônimo público | `BLOCKED` | V2 não publicada |
| Progresso autenticado público | `BLOCKED_BY_PRODUCTION_POLICY` | sem conta técnica e sem V2 publicada |
| SEO público V2 | `BLOCKED` | produção permanece em metadados V1 |
| Outros jogos | `PASS_PRESERVED` | instância anterior permaneceu ativa; regressões locais passaram |
| Logs do Render | `BLOCKED` | URLs de log exigem sessão autenticada |

Deployments observados no GitHub:

| Commit | Deployment/Render | Estado |
| --- | --- | --- |
| `f040a5f2` | `5624672297` / `dep-d9jn3hmq1p3s738aek8g` | `failure` |
| `69f5b48b` | `5624766196` / `dep-d9jn5q1bip4c73dli6cg` | `failure` |
| `f79e39f3` | `5624954797` / `dep-d9jnb7kvikkc73dm7jb0` | `failure` |
| `798c56b8` | `5625228176` / `dep-d9jnisf9flrs73dlbdc0` | `failure` |

## Página pública depois das tentativas

Consulta sem cache em `https://atlasachievement.com.br/jogo/resident-evil-5`, às `2026-07-27T15:35:08Z`:

| Controle | Esperado V2 | Encontrado | Status |
| --- | --- | --- | --- |
| HTTP | 200 | 200 | `PASS` para V1 preservado |
| Build | commit novo | `4.0.0-6cce3f3cf2dc97601275e421250a2874f0525a74` | `BLOCKED` |
| sourceMode | `v2` | `relational-legacy` | `BLOCKED` |
| H1 | Resident Evil 5 — Guia de Platina e 100% | Resident Evil 5 | `BLOCKED` |
| Title | Resident Evil 5 — Guia de Platina, Troféus e 100% | Resident Evil 5 — Guia de Platina PS4 + DLCs \| AtlasAchievement | `BLOCKED` |
| Revisão | 26/07/2026 | 18/07/2026 | `BLOCKED` |
| Marcadores V2 | 71 | 0 | `BLOCKED` |
| Script de progresso V2 | presente | ausente | `BLOCKED` |
| Aviso Versus | presente | ausente no V1 | `BLOCKED` |
| Canonical | URL de produção | correto | `PASS` |

ETag observado: `W/"b18a9-WLq5JF8ZJRPhynOhFRd+npU9vYk"`.

## Testes

| Comando/controle | Ambiente | Resultado | Observação |
| --- | --- | --- | --- |
| `npm ci` | Ubuntu Linux, Node 20 | `PASS` | GitHub Actions |
| `npm run check:runtime` | Ubuntu Linux | `PASS` | Node 20 |
| `npm run test:security:production` | Ubuntu Linux | `PASS` | 0 critical/0 high |
| `npm run test:sqlite:native` | Ubuntu Linux | `PASS` | `sqlite3@6.0.1` |
| `npm run test:sqlite:runtime` | Ubuntu Linux | `PASS` | install/reload/rollback |
| Contratos RE5 V2 | Ubuntu Linux | `PASS` | snapshot, migration, round-trip, adapter, SSR, SEO, a11y, client, security e observabilidade |
| Baseline RE5 | Ubuntu Linux | `PASS` | governance + guia |
| Auditoria RE5 | Ubuntu Linux | `PASS` | gate de release |
| Build | Ubuntu Linux | `PASS` | `npm run build --if-present` |
| Visual | Chrome e Edge locais | `PASS` | viewports, zoom, teclado, offline e rollback |
| `db:setup` em cópia do banco local | modo produção, isolado | `PASS` | original permaneceu intocado |
| Staging | indisponível | `WAIVED_BY_OWNER` | override explícito |
| Render deploy | Render | `FAIL` | causa detalhada inacessível sem log autenticado |

O teste nativo repetido no shell Windows/Node 24 foi corretamente recusado pelo próprio gate (`Node 20 is required`); ele não substitui nem invalida os runs Linux/Node 20 verdes.

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

## Banco

| Campo | Resultado |
| --- | --- |
| Hash de produção antes/depois | `UNAVAILABLE` |
| Tamanho/mtime/sidecars | `UNAVAILABLE` |
| Backup oficial | `WAIVED_BY_OWNER` |
| Migration em produção | `UNVERIFIED` — nenhum deploy concluiu |
| Progresso de produção | nenhuma perda observada pela interface pública; verificação de volume indisponível |
| Reprodução local | `PASS` em cópia isolada; hash de origem `e62a5b6a2f2435f7d08750b055e396b7699953108bab44a5b0a503e5fd406779` |

Nenhum SQL manual foi executado. O banco local original não foi alterado.

## Performance local V2

| Métrica | Valor |
| --- | ---: |
| SSR p95 | 91,60 ms |
| HTML | 300.572 bytes |
| HTML gzip | 38.778 bytes |
| CSS | 17.254 bytes |
| JavaScript | 47.561 bytes |
| Nós DOM | 8.559 |
| Inicialização | 408,20 ms |
| Aplicação de 71 estados | 58,40 ms |
| Requisições | 8 |
| CLS | 0 |
| Erros contínuos de console | 0 |

Não há métrica V2 pós-release porque o Render não publicou a nova instância.

## Rollback

| Campo | Valor |
| --- | --- |
| Necessário no tráfego | não |
| Gatilho | todos os deployments novos falharam antes da troca |
| Mecanismo efetivo | retenção automática do último deploy saudável pelo Render |
| Resultado | V1 continuou HTTP 200 e `sourceMode=relational-legacy` |

Não houve rollback destrutivo de migration, exclusão de Snapshot, limpeza de progresso ou alteração de outro guia.

## Bloqueio remanescente

É necessário acesso autenticado ao deployment `dep-d9jnisf9flrs73dlbdc0` para obter a primeira linha de erro do Render e distinguir com evidência entre falha de instalação, configuração de runtime prevalente no painel, build ou predeploy. Repetir alterações sem esse log não é seguro.

## Pendência factual não bloqueadora

Versus permanece **NÃO VALIDADO CONTEMPORANEAMENTE**. O Snapshot final informa publicamente que o modo integra o 100%, não foi validado em partida real nesta revisão e pode variar em disponibilidade. Essa pendência foi autorizada editorialmente e não é apresentada como evidência prática.
