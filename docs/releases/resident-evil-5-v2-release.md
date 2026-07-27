# Resident Evil 5 V2 — relatório de release candidate

Data da auditoria: 2026-07-26  
Escopo: portão técnico do guia V2 de `resident-evil-5`; nenhuma ativação, publicação, alteração editorial ou commit foi executado.

## Decisão

**NO-GO para ativação pública.**

O código e os contratos locais de RE5 V2 passaram em Node 20, mas a árvore de produção ainda contém uma vulnerabilidade crítica transitiva reportada pelo `npm audit`, e não houve staging real nem teste manual de Versus. A flag deve continuar desligada.

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
- `npm ci`: 310 pacotes; `package-lock.json` permaneceu byte a byte com SHA-256 `200b9427b14012220263353610ef73cd526964215a1db2471f0814facde23585`.
- Build: verde.
- A cópia limpa excluiu `.git`, `node_modules`, banco real, backups, artefatos e temporários.

## Testes

Passaram em Node 20: runtime, baseline, Snapshot, migração, round-trip, adapter, SSR, SEO/JSON-LD, acessibilidade, cliente, segurança de aplicação, observabilidade, contratos, visual Chrome/Edge, auditor de release, governança, guia RE5, build, RE2, RE6, Stray e smoke de autenticação/progresso/outros jogos.

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

Tanto o candidato quanto o commit-base retornaram o mesmo `npm audit` e `npm audit --omit=dev`: 14 vulnerabilidades (2 baixas, 4 moderadas, 7 altas e 1 crítica). Não há vulnerabilidade nova atribuível ao V2. A crítica está em `tar`, transitiva pela cadeia de instalação de `sqlite3`/`node-gyp`; a correção indicada pelo npm exige atualização major de `sqlite3`. Como não há override ou mitigação verificada e upgrades amplos estavam fora do escopo, a vulnerabilidade crítica da árvore de produção é bloqueadora.

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

Não existe alvo de staging configurado nem `STAGING_BASE_URL`; o único serviço em `render.yaml` é produção. O teste de staging encerra com código 2 e status `NOT_EXECUTED`, sem tocar produção.

O protocolo manual de Versus está `NÃO EXECUTADO`: não foram fornecidos console/contas/PSN, jogo e participantes reais. A pendência impede ativar publicamente o conteúdo de 100% sem decisão editorial humana documentada.

## Observabilidade

Foram validados os seis eventos de seleção/fallback e os nove eventos de progresso exigidos. Os campos são limitados a evento, slug, modo, pacote, contagens, motivo, hash e estado da flag. Nome, e-mail, IP de aplicação, token, lista integral de progresso, conteúdo editorial e IDs PSN são excluídos.

Não há painel conectado. Os filtros reproduzíveis, limites iniciais e gatilhos de rollback estão no runbook de rollout.

## Rollout, rollback e pendências

- Rollout: ver `resident-evil-5-v2-rollout.md`; não executado.
- Rollback: ver `resident-evil-5-v2-rollback.md`; no gate limpo, o mecanismo local por flag foi ensaiado no Chrome (2,540 s) e Edge (1,331 s), preservando um estado V2 sem duplicação. O ensaio autenticado em staging não foi executado.
- Versus: ver `resident-evil-5-v2-versus-validation.md`.

Bloqueadores: vulnerabilidade crítica de dependência, staging não aprovado, rollback real/autenticado em staging não ensaiado, Versus não executado, backup de produção e responsável de janela ainda não designados.

## Alterações do Bloco 7

O Bloco 7 adiciona apenas auditoria/testes de release, documentação, comandos npm e uma correção mínima de privacidade no emissor de diagnóstico do progresso. O restante do worktree contém trabalho acumulado dos blocos anteriores sobre fonte canônica, importação/migração, adapters, renderização e progresso; esses arquivos foram preservados, não reatribuídos ou revertidos.

**BLOCO 7 BLOQUEADO — CORRIGIR REGRESSÕES, INTEGRIDADE OU ROLLBACK ANTES DA ATIVAÇÃO**
