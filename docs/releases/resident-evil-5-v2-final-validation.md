# Resident Evil 5 V2 — validação final

## Veredito

**PORTÃO FINAL CONDICIONAL — IMPLEMENTAÇÃO VALIDADA, BLOQUEIOS EXTERNOS PERMANECEM**

Status de máquina: `TECHNICALLY_VALIDATED_EXTERNAL_BLOCKERS`.

Todos os controles técnicos locais terminaram em `PASS`. Nenhum controle técnico permanece em `FAIL`. Linux real, staging, backup/restore de produção, rollback externo, observabilidade externa, partida contemporânea de Versus e prontidão de produção permanecem em `BLOCKED`.

Artefato canônico: `artifacts/re5-v2-final-validation.json`.

## Identificação da execução

| Campo | Valor |
| --- | --- |
| Branch | `release/resident-evil-5-v2-rc` |
| HEAD durante os testes | `dbf5a2c8d03847eff83eeb6e7be439a830aca3e1` + mudanças de gate explicitamente inventariadas |
| Tree de origem | `0b148c5d61a3ddbf096cd893b0b76d9f71fb2509` |
| Commit-base de comparação | `3e5d557145f84a46ad10dc3cc59dc79ff2ce0732` |
| Gerado em | `2026-07-27T14:11:19.122Z` |
| Host | `win32-x64` |
| Node | `v20.20.2` |
| npm | `10.8.2` |
| Linux compatível | `BLOCKED` — host Windows, Docker ausente e WSL indisponível |

## Integridade canônica

| Camada | Total | Base | Versus | Lost | Desperate | Status |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Snapshot | 71 | 51 | 10 | 5 | 5 | `PASS` |
| Manifesto | 71 | 51 | 10 | 5 | 5 | `PASS` |
| Banco temporário/migration | 71 | 51 | 10 | 5 | 5 | `PASS` |
| View model | 71 | 51 | 10 | 5 | 5 | `PASS` |
| SSR local | 71 | 51 | 10 | 5 | 5 | `PASS` |
| DOM cliente | 71 | 51 | 10 | 5 | 5 | `PASS` |

| Controle | Encontrado | Status |
| --- | ---: | --- |
| Tipos | 1 Platina, 1 Ouro, 16 Prata, 53 Bronze | `PASS` |
| Roadmap | 9 etapas | `PASS` |
| Seções | 31 | `PASS` |
| BSAA Emblems | 30 | `PASS` |
| Tesouros | 50 | `PASS` |
| Stockpile | 27 | `PASS` |
| Upgrades | 18 | `PASS` |
| Score Stars | 18 | `PASS` |
| Agitators | 3 | `PASS` |
| Fontes | 17 | `PASS` |
| Claims | 29 | `PASS` |
| IDs vazios | 0 | `PASS` |
| IDs duplicados | 0 | `PASS` |

Hashes finais:

- hash semântico do Snapshot: `2ae4c181d580a624c980580e29910025c785391acd1a46d0601dc19773fc0f54`;
- SHA-256 do arquivo Snapshot: `23233937299e2a64cfe6197eb1c48127a1f88d3e3cd9e0591dc7cbd872598292`;
- SHA-256 do manifesto: `a67749705812f7e5c9f427130dfb66487448444d0a104009db0536d98d2fb28a`.

O hash semântico anterior, `ee420778…5598`, foi substituído de forma controlada porque o Bloco 8 exigiu que o aviso público dissesse expressamente que Versus não foi validado em partida real nesta revisão. A fonte editorial canônica foi alterada e o Snapshot/manifesto foram regenerados pela transformação oficial; o JSON não foi editado manualmente.

## Matriz de controles

| Controle | Resultado | Evidência |
| --- | --- | --- |
| Repositório e diff | `PASS` | allowlist explícita, `git diff --check` verde, zero mudança inesperada |
| Dependências | `PASS` | instalação limpa e árvore resolvida |
| Segurança de produção | `PASS` | 0 critical, 0 high, 3 moderate |
| Node 20 | `PASS` | `v20.20.2` |
| Linux real | `BLOCKED` | ambiente compatível não disponível |
| Instalação limpa | `PASS` | `npm ci`, 237 pacotes, lockfile estável |
| Build | `PASS` | `npm run build --if-present` |
| SQLite | `PASS` | binding nativo e runtime |
| Migrations | `PASS` | migration e round-trip temporários |
| Snapshot/manifesto | `PASS` | hash, schema e contagens |
| Conteúdo 71 | `PASS` | todas as camadas 71/51/10/5/5 |
| Adapter/view model | `PASS` | contrato e contagens |
| V1 | `PASS` | baseline, SSR, contratos e visual |
| V2 | `PASS` | snapshot, adapter, SSR, contratos e visual |
| Fallback | `PASS` | seleção V1/V2 e rollback local |
| SSR | `PASS` | HTML integral sem JavaScript |
| SEO/JSON-LD | `PASS` | metadados, canonical e dados estruturados |
| Acessibilidade | `PASS` | contrato + Chrome/Edge |
| Cliente/progresso | `PASS` | 71 estados, 5 indicadores, resets e persistência |
| Migração legada | `PASS` | apenas os 51 IDs-base são recuperados |
| Sync autenticado | `PASS` | contrato local sem escrita em conta real |
| Segurança da aplicação | `PASS` | autorização, isolamento e payloads |
| Regressões | `PASS` | RE2, RE6, Stray e Inside |
| Performance | `PASS` | todos os orçamentos abaixo dos limites |
| Backup/restore local | `PASS` | cópia e restauração SQLite apenas em diretório temporário |
| Backup/restore de produção | `BLOCKED` | sem acesso ao volume/banco de produção |
| Staging | `BLOCKED` | URL e credenciais ausentes |
| Rollback local | `PASS` | V2→V1→V2, progresso preservado |
| Rollback externo | `BLOCKED` | staging/produção indisponíveis |
| Observabilidade contratual | `PASS` | eventos e redaction |
| Observabilidade externa | `BLOCKED` | logs de staging/produção indisponíveis |
| Versus prático | `BLOCKED` | 0 testers, 0 contas, nenhuma partida real |
| Prontidão de produção | `BLOCKED` | depende dos bloqueios externos anteriores |

## Comandos finais

| Comando | Resultado | Duração |
| --- | --- | ---: |
| `npm run test:security:production` | `PASS` | 3,193 ms |
| `npm run test:sqlite:native` | `PASS` | 324 ms |
| `npm run test:sqlite:runtime` | `PASS` | 999 ms |
| `npm run test:re5:v2:performance` | `PASS` | 69,388 ms |
| `npm run test:re5:v2:baseline` | `PASS` | 60,354 ms |
| `npm run test:re5:v2:snapshot` | `PASS` | 382 ms |
| `npm run test:re5:v2:migration` | `PASS` | 830 ms |
| `npm run test:re5:v2:roundtrip` | `PASS` | 1,633 ms |
| `npm run test:re5:v2:adapter` | `PASS` | 933 ms |
| `npm run test:re5:v2:ssr` | `PASS` | 59,249 ms |
| `npm run test:re5:v2:seo` | `PASS` | 55,849 ms |
| `npm run test:re5:v2:accessibility` | `PASS` | 56,082 ms |
| `npm run test:re5:v2:client` | `PASS` | 341 ms |
| `npm run test:re5:v2:contracts` | `PASS` | 239,038 ms |
| `npm run test:re5:v2:visual` | `PASS` | 82,365 ms |
| `npm run audit:re5:v2:release` | `PASS` | 459 ms |
| `npm run test:re5:governance` | `PASS` | 823 ms |
| `npm run test:guide -- resident-evil-5` | `PASS` | 60,429 ms |
| `npm run test:guide -- resident-evil-2-remake` | `PASS` | 64,959 ms |
| `npm run test:guide -- resident-evil-6` | `PASS` | 56,204 ms |
| `npm run test:guide -- stray` | `PASS` | 56,619 ms |
| `npm run test:guide -- inside` | `PASS` | 56,980 ms |
| `npm run test:re5:v2:backup-restore` | `PASS` | 485 ms |
| `npm run test:re5:versus:documentation` | `PASS` | 307 ms |
| `npm run build --if-present` | `PASS` | 1,700 ms |
| `npm test` | `PASS` com waiver estrita | 915 ms |

### Falha histórica do RE2

`npm test` ainda encerra com código 1 exclusivamente na asserção:

`Resident Evil 2 Remake deve ter coverage strong sem selo complete`

A mesma falha foi reproduzida no commit-base `3e5d557…`; o valor real continua `complete`, o esperado continua `strong`, os arquivos de RE2 não mudaram e o teste isolado de RE2 passou. Nenhuma falha adicional foi aceita pelo waiver.

## Performance local

| Métrica V2 | Resultado |
| --- | ---: |
| SSR mediana | 84,41 ms |
| SSR p95 | 91,60 ms |
| HTML | 300.572 bytes |
| HTML gzip | 38.778 bytes |
| CSS V2 | 17.254 bytes |
| JavaScript V2 | 47.561 bytes |
| Requisições do documento/assets | 6 |
| Nós DOM | 8.559 |
| Parse | 49,10 ms |
| Inicialização do progresso | 408,20 ms |
| Aplicação de 71 estados | 58,40 ms |
| Requisições observadas no navegador | 8 |
| CLS | 0 |
| Overflow horizontal | não |

Chrome e Edge passaram em 360×800, 768×1024, 1024×768 e 1440×900, além de zoom equivalente a 200%, teclado, foco, reduced motion, offline, erro de sync, migração legada, resets e rollback local.

## Backup/restore local

O ensaio criou uma base relacional mínima somente no diretório temporário do sistema, inseriu 71 troféus e três estados de um usuário fictício, copiou o backup, restaurou outra cópia e confirmou:

- SHA-256 idêntico entre origem, backup e restaurado;
- `PRAGMA integrity_check = ok`;
- `foreign_key_check` vazio;
- 71 troféus, sendo 51+10+5+5;
- três progressos preservados;
- nenhuma base real alterada.

O controle de produção permanece `BLOCKED`.

## Anomalias observadas e remediação

1. Uma primeira matriz registrou falha de performance não reproduzida. Duas repetições isoladas e duas execuções integrais posteriores passaram. O histórico foi preservado no JSON.
2. Uma segunda matriz concluiu screenshots e relatórios de Chrome/Edge, mas ficou retida no `taskkill` de limpeza. A limpeza recebeu timeout explícito de 15 segundos; a prova visual isolada e a matriz integral seguinte passaram.
3. A correção editorial do Versus mudou apenas o aviso canônico e o manifesto do pacote. Snapshot, round-trip, auditoria e toda a suíte foram reexecutados.

## Bloqueios externos

- `linux`: binding e instalação não foram validados em Linux x64 oficial;
- `staging`: URL/credenciais não fornecidas;
- `backupRestore`: banco e backup de produção inacessíveis;
- `rollback`: nenhuma reversão foi exercitada fora do ambiente local;
- `observability`: logs externos inacessíveis;
- `versus`: nenhuma partida real, quatro contas ou quatro jogadores foram disponibilizados;
- `productionReadiness`: consequência dos bloqueios anteriores.

Não houve deploy, mudança de feature flag de produção, migration de produção, escrita em conta real ou alteração do banco real.
