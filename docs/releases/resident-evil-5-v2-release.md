# Resident Evil 5 V2 — relatório de release candidate

Data da auditoria: 2026-07-27  
Escopo: incorporação da remediação na branch RC e portão técnico local do guia V2 de `resident-evil-5`; nenhuma ativação, publicação, alteração editorial ou ação em produção foi executada.

## Decisão

**NO-GO para publicação, staging ou ativação pública enquanto os gates externos permanecerem ausentes.**

O bloqueador crítico da árvore de produção foi removido e a remediação foi incorporada em `release/resident-evil-5-v2-rc`, com validação local Windows/Node 20 sem regressão nova. Não havia runner Linux, serviço/URL de staging, contas, backup ou acesso a logs/feature flag de staging. A flag deve continuar desligada. O estado do Bloco 7B é condicional, não uma aprovação de staging.

## Arquitetura e integridade

O V2 usa Snapshot JSON canônico, manifesto com hash semântico, resolver de fonte com fallback para o modelo relacional legado, adapter/view model, SSR completo e cliente de progresso. A seleção é por slug em `GUIDE_V2_ENABLED_SLUGS`; o valor padrão permanece vazio. O fallback não foi removido.

| Evidência | Valor |
| --- | --- |
| Hash semântico do Snapshot | `ee4207786ae29cc4667de602a1a9dc0381c4dd1473d6202d3d6dace9f9ce5598` |
| SHA-256 do arquivo Snapshot | `8fc7783dd04b8b4b785bfec98f2f4e59c3d8db93f28c6e0333dd2816ef4b1c6d` |
| SHA-256 do manifesto | `214f83778f1ff52cd03bfb3deb05d6a11099ac5c903d86ec042fc331741aed85` |
| Banco real antes da auditoria | SHA-256 `e62a5b6a2f2435f7d08750b055e396b7699953108bab44a5b0a503e5fd406779`; 3.153.920 bytes; sem WAL/journal/SHM |

| Camada | Total | Base | Versus | Lost in Nightmares | Desperate Escape |
| --- | ---: | ---: | ---: | ---: | ---: |
| Snapshot | 71 | 51 | 10 | 5 | 5 |
| Manifesto | 71 | 51 | 10 | 5 | 5 |
| View model | 71 | 51 | 10 | 5 | 5 |
| SSR | 71 | 51 | 10 | 5 | 5 |
| DOM cliente | 71 | 51 | 10 | 5 | 5 |

Tipos: 1 Platina, 1 Ouro, 16 Prata e 53 Bronze. O auditor confirmou 71 IDs, checkboxes e labels, cinco barras de progresso, dois scripts V2, metadados/JSON-LD válidos, ausência de placeholders/caminhos locais e canonical de produção.

## Ambiente e reprodução

- Runtime limpo: Node `v20.20.2`, npm `10.8.2`, Windows x64.
- Distribuição portátil oficial do Node verificada pelo SHA-256 publicado: `dc3700fdd57a63eedb8fd7e3c7baaa32e6a740a1b904167ff4204bc68ed8bf77`.
- `npm ci`: 237 pacotes instalados e 238 auditados; duas execuções reproduzíveis; `package-lock.json` permaneceu byte a byte com SHA-256 `34e15116850de34cf19239b15b34ce0801b1c7452c4f876d21ba8905704531c3`.
- Build: verde.
- A cópia limpa excluiu `.git`, `node_modules`, banco real, backups, artefatos e temporários.
- Linux x64: não executado; Docker, WSL e workflow CI estavam indisponíveis.

## Testes

Passaram em Node 20: runtime, baseline, Snapshot, migração, round-trip, adapter, SSR, SEO/JSON-LD, acessibilidade, cliente, segurança de aplicação, observabilidade, contratos, visual Chrome/Edge, auditor de release, governança, guia RE5, build, RE2, RE6, Stray e smoke de autenticação/progresso/outros jogos.

O Bloco 7A repetiu a matriz depois de um `npm ci` limpo e acrescentou controles específicos para o driver nativo: carregamento do binário pré-compilado, versão SQLite, operações CRUD, prepared statements, constraints, transações com commit e rollback, concorrência básica, persistência após reabertura, migração RE5 idempotente, preservação dos 71 troféus e gate de vulnerabilidades da árvore de produção. Os novos testes passaram em Node `v20.20.2`/Windows x64.

O Bloco 7B repetiu a suíte na branch RC. Passaram: baseline, Snapshot, migração, round-trip, adapter, SSR, SEO, acessibilidade, cliente, segurança integrada, contratos, visual, auditor de release, governança, RE5 com DLC, RE2, RE6, Stray, Inside sem DLC e build. Autenticação simulada, isolamento entre dois usuários, progresso, home, 404 e sitemap passaram no servidor temporário. A única saída não verde permaneceu o `npm test` global abaixo.

`npm test` mantém uma única falha:

```text
Resident Evil 2 Remake deve ter coverage strong sem selo complete
actual: complete
expected: strong
scripts/regression-smoke.js:13164
```

Waiver: a mesma falha foi reproduzida em Node 20 no commit-base destacado `3e5d557145f84a46ad10dc3cc59dc79ff2ce0732`, sem as alterações acumuladas de RE5. Nenhum arquivo de RE2 foi alterado no candidato. Portanto, ela é preexistente e não foi silenciada, mas mantém o `npm test` global não verde.

## Segurança

Os testes de aplicação passaram para autenticação, isolamento entre usuários, CSRF/origin, entradas inválidas, corpo excessivo, JSON malformado, método, CSP, sanitização, prototype pollution, logs e privacidade. O endpoint de login reutiliza o rate limit existente; o endpoint de progresso não possui limiter dedicado, risco residual a acompanhar.

O baseline reproduziu 14 vulnerabilidades tanto no `npm audit` completo quanto em `npm audit --omit=dev`: 2 baixas, 4 moderadas, 7 altas e 1 crítica. A crítica era `GHSA-23hp-3jrh-7fpw`/`CVE-2026-59873` em `tar@6.2.1`, alcançada pelas cadeias de instalação de `sqlite3@5.1.7` e `bcrypt@5.1.1`.

A remediação atualizou `sqlite3` para `6.0.1` e `bcrypt` para `6.0.0`, removendo `@mapbox/node-pre-gyp` e fazendo toda ocorrência de `tar` resolver em `7.5.22`. O resultado de produção é 0 crítica, 0 alta, 3 moderadas e 0 baixa. O audit completo registra ainda 1 alta somente de desenvolvimento, preexistente na cadeia `exceljs > unzipper > ... > brace-expansion`, além das mesmas 3 moderadas de produção em `body-parser`/`express`/`qs`. Nenhuma nova alta foi introduzida e nenhuma constatação foi ocultada.

## Performance

Medição local na mesma instância/máquina, via HTTP e Chrome DevTools Protocol:

| Métrica | V1 | V2 |
| --- | ---: | ---: |
| SSR mediana / p95 | 232,16 / 247,38 ms | 34,50 / 38,14 ms |
| HTML / gzip | 727.187 / 101.777 B | 300.501 / 38.752 B |
| CSS / scripts | 344.306 / 73.882 B | 17.254 / 47.561 B |
| DOM / requisições do navegador | 9.283 / 16 | 8.559 / 8 |
| Parse / load | 404,9 / 2.925,9 ms | 25,4 / 238,9 ms |
| Inicialização / aplicação de 71 estados | n/a | 211,6 / 18,6 ms |
| CLS | 0,00473 | 0 |
| Heap aproximado | 1.073.752 B | 1.580.947 B |

Não havia Lighthouse instalado; nenhuma dependência foi adicionada apenas para obter uma nota. Não foi observado bloqueador de performance.

## Acessibilidade e visual

Automação, teclado, skip link, foco visível, labels, `aria-live`, barras de progresso, reflow equivalente a 200%, reduced motion e quatro viewports passaram. Chrome e Edge validaram 17 capturas temporárias por navegador, sem overflow horizontal, cards cortados, tabela insegura ou controle subdimensionado. As capturas ficaram em `tmp/` e não foram versionadas.

## Staging e Versus

Não existe alvo de staging configurado nem `STAGING_BASE_URL`; o único serviço em `render.yaml` é produção. O teste de staging foi repetido no Bloco 7B e encerrou com código 2 e status `NOT_EXECUTED`, sem tocar produção. Sem URL, contas, backup, logs e controle da flag de staging, V1/V2, progresso autenticado e rollback externo não foram executados.

O protocolo manual de Versus está `NÃO EXECUTADO`: não foram fornecidos console/contas/PSN, jogo e participantes reais. A pendência impede ativar publicamente o conteúdo de 100% sem decisão editorial humana documentada.

## Observabilidade

Foram validados os seis eventos de seleção/fallback e os nove eventos de progresso exigidos. Os campos são limitados a evento, slug, modo, pacote, contagens, motivo, hash e estado da flag. Nome, e-mail, IP de aplicação, token, lista integral de progresso, conteúdo editorial e IDs PSN são excluídos.

Não há painel conectado. Os filtros reproduzíveis, limites iniciais e gatilhos de rollback estão no runbook de rollout.

## Rollout, rollback e pendências

- Rollout: ver `resident-evil-5-v2-rollout.md`; não executado.
- Rollback: ver `resident-evil-5-v2-rollback.md`; no gate limpo, o mecanismo local por flag foi ensaiado no Chrome (2,540 s) e Edge (1,331 s), preservando um estado V2 sem duplicação. O ensaio autenticado em staging não foi executado.
- Versus: ver `resident-evil-5-v2-versus-validation.md`.

Pendências que ainda impedem promoção: Linux x64/Node 20 não validado, staging não publicado, rollback real/autenticado não ensaiado, backup/restauração de staging não validado, Versus não executado ou formalmente dispensado e responsável pela janela ainda não designado. O bloqueador crítico de dependência permanece removido.

## Alterações do Bloco 7

O Bloco 7 adiciona apenas auditoria/testes de release, documentação, comandos npm e uma correção mínima de privacidade no emissor de diagnóstico do progresso. O restante do worktree contém trabalho acumulado dos blocos anteriores sobre fonte canônica, importação/migração, adapters, renderização e progresso; esses arquivos foram preservados, não reatribuídos ou revertidos.

**BLOCO 7A APROVADO — BLOQUEADOR CRÍTICO REMOVIDO, RELEASE SEGUE PARA VALIDAÇÕES EXTERNAS**

## Alterações do Bloco 7B

O Bloco 7B criou a branch RC, incorporou os oito arquivos aprovados por hash, repetiu instalação/audit/suíte local e atualizou os runbooks. Linux e staging não foram simulados nem inventados. Ver `resident-evil-5-v2-staging-validation.md`.

**BLOCO 7B CONDICIONAL — RELEASE CANDIDATE INTEGRADA, VALIDAÇÕES DE STAGING PENDENTES**
