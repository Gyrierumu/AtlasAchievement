# Resident Evil 5 V2 — validação de staging do Bloco 7B

Data: 2026-07-27  
Estado: **NÃO EXECUTADO — acesso externo e ambiente Linux indisponíveis**.

Este relatório registra a incorporação local da remediação e os gates que puderam ser reproduzidos. Ele não transforma simulações locais em evidência de Linux, staging, usuários reais, backup ou rollback autenticado.

## Identidade da release candidate

| Campo | Valor |
| --- | --- |
| Branch | `release/resident-evil-5-v2-rc` |
| Commit-base | `3e5d557145f84a46ad10dc3cc59dc79ff2ce0732` |
| Origem da remediação | `security/re5-v2-sqlite-audit-remediation` |
| SHA-256 do lockfile | `34e15116850de34cf19239b15b34ce0801b1c7452c4f876d21ba8905704531c3` |
| SHA-256 do Snapshot | `8fc7783dd04b8b4b785bfec98f2f4e59c3d8db93f28c6e0333dd2816ef4b1c6d` |
| Hash semântico do Snapshot | `ee4207786ae29cc4667de602a1a9dc0381c4dd1473d6202d3d6dace9f9ce5598` |
| SHA-256 do manifesto | `214f83778f1ff52cd03bfb3deb05d6a11099ac5c903d86ec042fc331741aed85` |
| Feature flag padrão | vazia |

## Incorporação controlada

O candidato acumulado dos Blocos 1–7 foi reproduzido byte a byte em worktree separado, excluindo `.git`, `.env`, bancos, `node_modules`, temporários, logs e artefatos. Em seguida, somente estes oito arquivos foram transferidos do Bloco 7A e tiveram o hash conferido:

| Arquivo | SHA-256 aprovado e incorporado |
| --- | --- |
| `package.json` | `ec9f841a1858c7850384a49d9c41a486fc0561ef1ab61a7c64f1233774e6b4a6` |
| `package-lock.json` | `34e15116850de34cf19239b15b34ce0801b1c7452c4f876d21ba8905704531c3` |
| `scripts/test-sqlite-runtime-compatibility.js` | `3e6251e86b15712a53eb40380b013e906437681ee90e17d32e5b35a4471da1a4` |
| `scripts/test-sqlite-native-install.js` | `05dd027eb7ac903b46ccaf9ed580b40f758602fffecfeb06e5e8048e521cf147` |
| `scripts/test-dependency-security-gate.js` | `4ceecb8a544c246ccd0c53bed4cb99c3fcbb035c19093f2648eaba6291835327` |
| `scripts/audit-dependency-remediation.js` | `474134ecf3770080bfb49f54f7a814ed591cd9e3abf096ac2dd28ae43c0125f6` |
| `docs/releases/resident-evil-5-v2-release.md` | `e097ebac23564690cc779f0e70799f7cedf4a770584585ce174f9e03732abbf9` |
| `docs/releases/resident-evil-5-v2-security-remediation.md` | `733e84f451985587dfdda3b9e9ee1e5c79837a78c3b24a67c2f11308f464e4d3` |

Antes da documentação específica do Bloco 7B, a comparação integral com o candidato de origem apresentou exatamente essas oito diferenças. Snapshot, manifesto, migrations, banco, conteúdo editorial e RE2 não foram incorporados pela remediação.

## Validação local

| Controle | Ambiente | Resultado |
| --- | --- | --- |
| `npm ci --foreground-scripts` | Windows x64, Node `20.20.2`, npm `10.8.2` | aprovado duas vezes; 237 pacotes; lock estável |
| Árvore de produção | Windows x64 | `sqlite3@6.0.1`, `bcrypt@6.0.0`, `tar@7.5.22`, `node-gyp@12.4.0` |
| Gate de segurança | Windows x64 | 0 crítica, 0 alta, 3 moderadas, 0 baixa |
| Addon SQLite | Windows x64 | SQLite `3.52.0`, prebuild N-API, sem rebuild local |
| API SQLite/migração | memória/diretório temporário | CRUD, prepared statements, transações, rollback e 71 troféus aprovados |
| Matriz RC | Windows x64 | 20 comandos aprovados; única saída 1 no `npm test` por RE2 preexistente |
| Guias de controle | Windows x64 | RE5 com DLC, RE2, RE6, Stray e Inside sem DLC aprovados isoladamente |
| Rotas integradas | servidor temporário | autenticação, dois usuários, progresso, home, 404, sitemap e jogos V1 aprovados |
| Visual | Chrome e Edge | quatro viewports e rollback local V2 → V1 → V2 aprovados |
| Build | Windows x64 | aprovado |
| Banco real | worktree principal | não copiado para a RC e não aberto para escrita |

## Linux x64

| Evidência exigida | Resultado |
| --- | --- |
| Container/runner | indisponível: Docker não instalado |
| WSL | indisponível: subsistema não instalado |
| CI do repositório | inexistente: nenhum workflow ou configuração de runner |
| Distribuição/kernel/libc | não observados |
| Node/npm Linux | não executados |
| Prebuild SQLite Linux | não executado |
| Contratos/build Linux | não executados |

Instalar WSL, Docker Desktop ou uma VM alteraria o host fora do escopo operacional autorizado. Sem runner já disponível, a validação Linux permanece bloqueadora.

## Acesso a staging

| Evidência | Resultado |
| --- | --- |
| `STAGING_BASE_URL` | ausente |
| `.openai/hosting.json` | ausente |
| Serviço dedicado no `render.yaml` | ausente |
| Serviço configurado | somente `master-trophy-guide`, com domínio/configuração de produção e `autoDeploy` |
| Credenciais/contas de staging | não fornecidas |
| `npm run test:re5:v2:staging` | código 2, `NOT_EXECUTED` |

Nenhum push, deploy, mudança de variável, cache ou acesso ao serviço de produção foi realizado.

## Cenários externos

| Cenário | Estado | Motivo |
| --- | --- | --- |
| Publicação com flag desligada | não executado | staging inexistente/não identificado |
| Baseline V1 | não executado | sem URL de staging |
| Ativação V2 somente para RE5 | não executado | sem URL/autorização da plataforma |
| Progresso anônimo real | não executado | sem staging |
| Progresso autenticado | não executado | sem conta de staging |
| Dois navegadores/usuários | não executado | sem contas e banco de staging |
| Migração legado em staging | não executado | sem staging |
| Rollback V2 → V1 → V2 | não executado | sem controle da flag de staging |
| Logs/métricas/alertas | não executado | sem painel ou stream de staging |
| Teste real de Versus | não executado | explicitamente fora do Bloco 7B |

Os contratos locais continuam sendo evidência útil de implementação, mas não substituem os cenários acima.

## Backup e restauração

Não foi encontrado processo, banco, volume ou artefato atual de staging que pudesse ser copiado com segurança. Consequentemente:

- nenhum backup de staging foi criado;
- nenhum hash ou permissão de backup foi validado;
- nenhuma restauração temporária foi ensaiada;
- nenhuma afirmação de restaurabilidade foi feita.

Esse é um bloqueador para publicar e ensaiar rollback autenticado.

## Performance e acessibilidade

As medições e automações locais aprovadas no Bloco 7 permanecem válidas como baseline de desenvolvimento. TTFB, compressão, sincronização, teclado, zoom, mobile, leitor de tela e violações no ambiente de staging não foram medidos.

## Observabilidade

Os contratos locais validam nomes e campos permitidos dos eventos. Consultas, filtros e limites estão no runbook de rollout, mas não foram conectados a logs ou alertas reais de staging.

## Bloqueadores e decisão

- runner Linux x64/Node 20;
- serviço e URL exclusivos de staging;
- acesso ao backup/restauração de staging;
- contas anônima/autenticadas de teste;
- acesso à feature flag, logs, métricas e alertas de staging.

**Decisão operacional: NO-GO para publicação ou produção.**

**BLOCO 7B CONDICIONAL — RELEASE CANDIDATE INTEGRADA, VALIDAÇÕES DE STAGING PENDENTES**
