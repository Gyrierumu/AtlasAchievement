# Resident Evil 5 V2 — runbook de rollout

Este é um plano operacional. Não foi executado em produção.

## Pré-condições

- [x] Node 20 validado
- [x] Instalação limpa validada
- [x] Contratos RE5 V2 verdes
- [x] Falha de RE2 provada como preexistente
- [x] Build verde
- [ ] Staging aprovado
- [ ] Segurança aprovada: `npm audit --omit=dev` ainda reporta uma crítica
- [x] Performance aprovada
- [x] Acessibilidade aprovada
- [ ] Teste manual de Versus aprovado ou dispensado por decisão humana registrada
- [ ] Backup de produção concluído e verificado
- [ ] Rollback local e autenticado ensaiado em staging
- [x] Eventos e consultas de observabilidade documentados
- [ ] Operador responsável presente durante toda a janela

Não prosseguir enquanto qualquer item obrigatório estiver aberto.

## Preparação e evidências

Em uma cópia limpa do artefato candidato:

```powershell
node --version
npm --version
npm ci
npm run check:runtime
npm run test:re5:v2:contracts
npm run test:re5:v2:visual
npm run test:re5:v2:performance
npm run audit:re5:v2:release
npm run build --if-present
npm audit
npm audit --omit=dev
```

Registrar identificador imutável do artefato, SHA-256 do Snapshot/manifesto, versão Node/npm e saída dos comandos. Antes da janela, executar o protocolo de staging com `STAGING_BASE_URL` apontando exclusivamente ao staging:

```powershell
$env:STAGING_BASE_URL='https://<host-real-de-staging>'
$env:STAGING_EXPECT_V2='1'
npm run test:re5:v2:staging
```

O script recusa hosts reconhecidos como produção. Não preencher `<host-real-de-staging>` sem um alvo confirmado.

## Sequência proposta de produção

1. Nomear operador e pessoa com autoridade de manter/reverter.
2. Registrar release/commit atualmente em produção e a configuração, com a flag ainda desligada.
3. Parar escritas conforme o procedimento operacional existente e criar snapshot/backup recuperável do disco/banco.
4. No ambiente Linux da aplicação, registrar sem modificar:

```bash
sha256sum /data/database.sqlite
stat --format='%s %y' /data/database.sqlite
test ! -e /data/database.sqlite-wal
test ! -e /data/database.sqlite-journal
test ! -e /data/database.sqlite-shm
```

5. Validar a restauração do backup em ambiente isolado.
6. Publicar o artefato aprovado com `GUIDE_V2_ENABLED_SLUGS` vazio; executar smoke V1 e saúde.
7. Confirmar hashes e assets, resposta HTTP 200, home, RE5, RE2, RE6, Stray, sitemap e 404.
8. Somente após aprovação explícita, alterar no provedor:

```text
GUIDE_V2_ENABLED_SLUGS=resident-evil-5
```

9. Recarregar a configuração pelo mecanismo normal do serviço e invalidar somente o cache configurado para a rota/assets.
10. Executar smoke V2 anônimo e autenticado, progresso local e remoto, fallback controlado, SEO/JSON-LD, links e ausência de 5xx.
11. Registrar a decisão de manter ou iniciar rollback.

Não executar migração destrutiva, não apagar o Snapshot/fallback e não restaurar banco como primeira resposta.

## Verificações por janela

Executar imediatamente, em 15, 30 e 60 minutos e em 24 horas:

- saúde e 4xx/5xx da rota e endpoints;
- seleção V2 com flag ativa e fallback inesperado;
- hash/manifesto, 71 IDs e 71 checkboxes;
- latência da página e endpoints;
- sincronização, migração ambígua e resets;
- perda/duplicação de progresso ou falha de isolamento;
- canonical, SSR sem JavaScript e regressão crítica de acessibilidade;
- home, RE2, RE6 e Stray.

O operador precisa estar presente ao menos durante a ativação e a janela de 60 minutos; a verificação de 24 horas deve ter dono nomeado.

## Filtros de logs reproduzíveis

Quando os logs estruturados estiverem disponíveis:

```bash
grep -E '"event":"guide_v2_(selected|fallback|invalid_snapshot|manifest_mismatch|source_missing|adapter_error)"' application.log
grep -E '"event":"guide_progress_(initialized|changed|reset_package|reset_all|legacy_migrated|legacy_ambiguous_dlc|sync_success|sync_failed|invalid_local_state)"' application.log
grep -E 'GET /jogo/resident-evil-5|/api/library/guides/resident-evil-5/progress' application.log
grep -E 'resident-evil-5.* (4[0-9]{2}|5[0-9]{2}) ' application.log
```

Não exportar nome, e-mail, IP de aplicação, token, conteúdo editorial, lista completa de progresso ou ID PSN.

## Limites iniciais de alerta

São limites conservadores propostos, não baselines históricos:

- qualquer falha de autorização cruzada, perda de progresso, hash divergente, total diferente de 71 ou canonical incorreto: rollback imediato;
- qualquer 5xx na ativação/smoke ou dois 5xx da rota em cinco minutos: pausar e reverter;
- flag ativa com ausência de `guide_v2_selected`: reverter;
- fallback inesperado acima de 1% por cinco minutos, ou qualquer sequência de cinco fallbacks: investigar e reverter se persistir;
- p95 sustentado acima de 500 ms por 15 minutos ou duas vezes o baseline medido: investigar;
- falha de sincronização acima de 5% por 15 minutos: reverter se houver risco ao estado local;
- regressão crítica de acessibilidade, HTML sem conteúdo ou asset essencial quebrado: reverter.

## Encerramento

Anexar hashes, logs sem dados pessoais, tempos, pessoa responsável e decisão. O fallback legado só poderá ser removido em projeto separado após período definido de estabilidade, zero fallback inesperado, erros aceitáveis, sincronização concluída, ausência de regressões e autorização explícita.
