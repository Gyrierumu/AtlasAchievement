# Resident Evil 5 V2 — remediação de segurança da árvore de produção

Data: 2026-07-27  
Escopo: Bloco 7A, executado exclusivamente no worktree e branch isolados `security/re5-v2-sqlite-audit-remediation`. Nenhum staging, Versus, deploy, banco de produção ou ativação de feature flag foi executado.

## Resumo executivo

O baseline em Node `v20.20.2` reproduziu uma vulnerabilidade crítica em `tar@6.2.1`: `GHSA-23hp-3jrh-7fpw` / `CVE-2026-59873`, negação de serviço por consumo ilimitado de recursos durante descompressão/parsing. O pacote era transitivo das cadeias de instalação nativa de `sqlite3@5.1.7` e `bcrypt@5.1.1`.

Foram avaliadas quatro estratégias. A menor solução que respeita as faixas declaradas, mantém suporte oficial ao Node 20 e elimina a crítica sem `audit fix --force` foi atualizar as dependências diretas para `sqlite3@6.0.1` e `bcrypt@6.0.0`. O lockfile passou a resolver `tar@7.5.22`, removeu `@mapbox/node-pre-gyp` e reduziu o audit da árvore de produção de 14 constatações para 3 moderadas: `0 critical / 0 high / 3 moderate / 0 low`.

O driver SQLite atualizado carregou seu binário N-API pré-compilado em Windows x64, informou SQLite `3.52.0` e passou pelos contratos usados pela aplicação, migração RE5 e rollback transacional. A decisão técnica do bloco é **GO CONDICIONAL**: a remediação local está aprovada, mas as validações externas continuam obrigatórias antes de qualquer ativação.

## Vulnerabilidade e alcançabilidade

| Campo | Resultado |
| --- | --- |
| Advisory | node-tar: consumo ilimitado de recursos ao processar entrada compactada |
| CVE/GHSA | `CVE-2026-59873` / `GHSA-23hp-3jrh-7fpw` |
| Severidade | Crítica; CVSS v4 9,2 |
| CWE | `CWE-770` |
| Pacote afetado | `tar@6.2.1` |
| Faixa do advisory crítico | `<=7.5.18`; correção específica em `7.5.19` |
| Versão selecionada | `tar@7.5.22`, necessária também para limpar os advisories agregados conhecidos pelo npm |
| Caminhos principais | `sqlite3@5.1.7 > tar@6.2.1`; `bcrypt@5.1.1 > @mapbox/node-pre-gyp@1.0.11 > tar@6.2.1`; e cadeias de build de `node-gyp@8.4.1` |
| Alcançabilidade HTTP | Não observada: a aplicação não encaminha arquivos compactados fornecidos por usuários ao `tar` |
| Alcançabilidade efetiva | Instalação, obtenção/extração de prebuilds e compilação de addons nativos; permanece relevante para supply chain e disponibilidade de build/release |

## Alternativas avaliadas

| Alternativa | Resultado técnico | Audit de produção | Compatibilidade e risco | Decisão |
| --- | --- | ---: | --- | --- |
| A — override global de `tar@7.5.21` | Instalou e carregou os addons | 0 crítica, 1 alta, 4 moderadas, 5 baixas | Forçou `tar@7` em consumidores que declaravam `^6`; risco de API/contrato transitive não suportado | Rejeitada |
| B1 — somente `sqlite3@6.0.1` | Atualizou uma das cadeias | 1 crítica, 3 altas, 3 moderadas | A cadeia antiga de `bcrypt` preservou `tar@6.2.1` | Rejeitada |
| B2 — `sqlite3@6.0.1` + `bcrypt@6.0.0` | Instalou, carregou e passou nos testes | 0 crítica, 0 alta, 3 moderadas | Faixas oficiais compatíveis com Node 20; elimina `node-pre-gyp` legado | Escolhida |
| C — override de `node-gyp@11.5.0` | Introduziu árvore mista | 1 crítica, 10 altas, 3 moderadas | Forçou major fora da faixa `8.x` e não eliminou todos os caminhos vulneráveis | Rejeitada |
| D — trocar de driver/arquitetura | Não implementada | Não aplicável | Mudança ampla de API, persistência e operação, desproporcional após B2 passar | Reserva arquitetural |

Não foi usado `npm audit fix`, `npm audit fix --force`, override de versão incompatível ou edição manual do lockfile.

## Dependências e lockfile

| Pacote | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `sqlite3` | `5.1.7` | `6.0.1` | Direta | Adotar cadeia mantida para Node 20 e `tar@7` corrigido |
| `bcrypt` | `5.1.1` | `6.0.0` | Direta | Remover `@mapbox/node-pre-gyp` e sua cadeia `tar@6` |
| `tar` | `6.2.1` | `7.5.22` | Transitiva | Corrigir o advisory crítico e os demais advisories agregados |
| `node-gyp` | `8.4.1` | `12.4.0` | Transitiva | Versão requerida pela nova árvore de `sqlite3`, compatível com Node 20.17+ |
| `node-addon-api` | `5.1.0` | `8.9.0` | Transitiva | API de addon requerida pelas novas versões |
| `@mapbox/node-pre-gyp` | `1.0.11` | removido | Transitiva | Substituído pela instalação moderna de binário do `bcrypt` |

- SHA-256 anterior de `package-lock.json`: `200b9427b14012220263353610ef73cd526964215a1db2471f0814facde23585`.
- SHA-256 posterior de `package-lock.json`: `34e15116850de34cf19239b15b34ce0801b1c7452c4f876d21ba8905704531c3`.
- O lockfile foi regenerado pelo npm 10, não editado manualmente.
- A árvore caiu de 311 para 238 entradas: 8 foram adicionadas, 81 cadeias legadas foram removidas e 13 versões/integridades mudaram.
- As remoções concentram-se na cadeia antiga de instalação/compilação nativa; não foi identificada mudança transitiva sem relação com os dois upgrades diretos.
- Um `npm ci` limpo preservou o hash posterior byte a byte.

## Audit antes e depois

| Severidade | Antes (completo e produção) | Depois completo | Depois `--omit=dev` | Introduzidas |
| --- | ---: | ---: | ---: | ---: |
| Crítica | 1 | 0 | 0 | 0 |
| Alta | 7 | 1 | 0 | 0 |
| Moderada | 4 | 3 | 3 | 0 |
| Baixa | 2 | 0 | 0 | 0 |
| Total | 14 | 4 | 3 | 0 |

A alta remanescente no audit completo é preexistente e exclusiva de desenvolvimento, em `exceljs > unzipper > fstream > rimraf > glob > minimatch > brace-expansion`. As moderadas de produção são preexistentes em `body-parser`, `express` e `qs`. Elas não foram ocultadas, não são requisito de escopo para substituir a crítica e devem ser tratadas em uma rodada própria de atualização do framework.

## Compatibilidade SQLite

| Controle | Resultado | Observação |
| --- | --- | --- |
| Node/npm | Passou | Node `v20.20.2`, npm `10.8.2`, Windows x64 |
| Instalação limpa | Passou | Binário N-API pré-compilado; nenhum rebuild local observado |
| Carregamento nativo | Passou | `node_sqlite3.node` carregado por `sqlite3@6.0.1` |
| Biblioteca SQLite | Passou | Runtime reportou SQLite `3.52.0` |
| CRUD e tipos | Passou | números, UTF-8, `NULL`, JSON, timestamp e BLOB |
| Prepared statements | Passou | parâmetros posicionais/nomeados, `lastID`, `changes` e `finalize` |
| Constraints e índices | Passou | PK/unique/FK, alteração de schema e índice |
| Transações | Passou | commit, rollback e `BEGIN IMMEDIATE` |
| Concorrência básica | Passou | `serialize`, `parallelize` e `busyTimeout` |
| Persistência | Passou | fechar, reabrir e reler banco temporário |
| Migração RE5 | Passou | backfill de 51 + inserção de 20 = 71; idempotência e rollback forçado |
| Banco usado nos testes | Seguro | somente `:memory:` e arquivos em diretório temporário |

O pacote `sqlite3` declara prebuilds N-API para plataformas suportadas, mas Linux x64 não foi executado neste host Windows. Além disso, o repositório upstream foi arquivado em julho de 2026; isso não invalida o gate atual, porém eleva o risco de manutenção futura e recomenda planejar a substituição do driver.

## Comandos de validação

| Comando | Resultado esperado/obtido |
| --- | --- |
| `npm ci --foreground-scripts` | Passou; instalação reproduzível e lock estável |
| `npm run test:security:production` | Passou; 0 critical e 0 high em produção |
| `npm run test:sqlite:native` | Passou; addon e prebuild nativos validados |
| `npm run test:sqlite:runtime` | Passou; API, transações e migração validadas |
| `npm run test:re5:v2:contracts` | Passou |
| Matriz RE5 V2 e guias de controle | Passou, ressalvada a falha global preexistente abaixo |
| `npm run build --if-present` | Passou |
| `npm test` | Falha esperada e preexistente no selo de cobertura de RE2 (`complete` versus `strong`) |
| `npm audit` | 0 crítica, 1 alta dev-only, 3 moderadas, 0 baixa |
| `npm audit --omit=dev` | 0 crítica, 0 alta, 3 moderadas, 0 baixa |
| `node --check` / `git diff --check` | Passou nos arquivos do bloco |

## Banco, dados e limites de escopo

O worktree isolado foi criado sem `database.sqlite`, WAL, journal ou SHM. Todos os testes SQLite usaram bancos temporários. A verificação do banco real no worktree principal deve manter:

- SHA-256 `e62a5b6a2f2435f7d08750b055e396b7699953108bab44a5b0a503e5fd406779`;
- 3.153.920 bytes;
- mtime UTC `2026-07-26T03:48:28.0257130Z`;
- nenhum sidecar;
- nenhuma escrita detectada.

Snapshot, manifesto, dados editoriais, progresso cliente, migration RE5, jogos de controle e demais arquivos proibidos pelo escopo foram apenas comparados por hash. Staging, Versus, deploy e produção não foram acessados. `GUIDE_V2_ENABLED_SLUGS` permaneceu vazio por padrão.

## Rollback

Caso o upgrade falhe em outro ambiente:

1. manter a feature flag desligada e impedir a promoção do candidato;
2. reverter somente `package.json`, `package-lock.json`, os quatro scripts de validação e esta documentação;
3. executar `npm ci` no lockfile anterior;
4. repetir o audit e os testes SQLite/RE5;
5. não promover a árvore anterior enquanto `tar@6.2.1` continuar crítico — escolher uma nova remediação segura.

O rollback do código é simples, mas não constitui mitigação aceitável para produção porque restaura a vulnerabilidade crítica.

## Riscos remanescentes e decisão

| Risco | Severidade | Preexistente | Bloqueia staging técnico | Tratamento |
| --- | --- | ---: | ---: | --- |
| 3 moderadas em `body-parser`/`express`/`qs` | Moderada | Sim | Não para este bloco | Atualização dedicada do framework com regressão HTTP |
| 1 alta dev-only em `brace-expansion` | Alta | Sim | Não | Atualizar cadeia `exceljs`/`unzipper`; não entra na árvore de produção |
| `sqlite3` upstream arquivado | Média/estratégica | Não | Não no gate atual | Planejar migração de driver e acompanhar advisories |
| Linux x64 não executado localmente | Média | Sim | Sim para promoção multiplataforma | Validar `npm ci` e smoke SQLite no ambiente real de staging |
| Staging e rollback autenticado pendentes | Alta operacional | Sim | Sim | Executar runbooks antes da ativação |
| Versus não validado ou dispensado | Alta editorial | Sim | Sim para publicação 100% | Teste manual ou dispensa formal |

**Decisão: GO CONDICIONAL.**

**BLOCO 7A APROVADO — BLOQUEADOR CRÍTICO REMOVIDO, RELEASE SEGUE PARA VALIDAÇÕES EXTERNAS**
