# Resident Evil 5 V2 — runbook de rollback

O rollback preferencial é a troca não destrutiva de fonte pela feature flag. Nenhum procedimento deste documento foi executado em produção.

## Gatilhos

Iniciar rollback por 5xx, V2 não selecionado com flag ativa, fallback recorrente, divergência de hash/manifesto, total/IDs/checkboxes diferente de 71, perda ou duplicação de progresso, falha de autorização, sincronização apagando estado local, canonical incorreto, HTML incompleto sem JavaScript, vulnerabilidade, asset essencial quebrado ou regressão crítica de acessibilidade.

## Rollback primário

1. Registrar hora, release, motivo, sintomas e responsável.
2. Remover apenas `resident-evil-5` de `GUIDE_V2_ENABLED_SLUGS`; preservar outros slugs eventualmente aprovados.
3. Recarregar a configuração pelo mecanismo normal do provedor.
4. Invalidar somente o cache configurado para a rota/assets.
5. Confirmar HTTP 200 e fonte V1 em `/jogo/resident-evil-5`.
6. Confirmar URL/canonical, home, RE2, RE6, Stray, saúde e ausência de 5xx.
7. Verificar que o banco, Snapshot, tabelas V2, progresso autenticado e chave `atlas:guide-progress:v2:resident-evil-5` permanecem intactos.
8. Registrar o tempo até estabilização e manter evidências sem dados pessoais.

Valor final esperado:

```text
GUIDE_V2_ENABLED_SLUGS=
```

Se houver outros slugs na lista, o valor final deve preservá-los e remover somente `resident-evil-5`.

## Ensaio observado

O fluxo equivalente foi ensaiado localmente no mesmo servidor de teste:

| Navegador | V2 → V1 → V2 | Progresso local | Duplicação | Tempo |
| --- | --- | --- | ---: | ---: |
| Chrome | aprovado | 1/71 reapareceu | 0 | 2,540 s |
| Edge | aprovado | 1/71 reapareceu | 0 | 1,331 s |
| Staging/autenticado | não executado | não observado | não observado | não observado |

O ensaio também confirmou que a seleção V1 não apaga o `localStorage` V2. O resultado não substitui o ensaio com usuário autenticado e banco de staging.

## Ensaio obrigatório em staging

Com autorização e V2 ativo apenas em staging:

1. marcar progresso local e autenticado;
2. registrar hashes/estado;
3. remover o slug da flag e confirmar V1/HTTP 200;
4. confirmar que banco e estados continuam presentes;
5. reativar a flag em staging;
6. confirmar que o progresso reaparece sem duplicação;
7. confirmar que a migração legado não se repete e que chave vazia migra zero DLC;
8. registrar comandos, logs e tempo.

## Estado do Bloco 7B

O ensaio autenticado continuou `NÃO EXECUTADO`: não existe URL/serviço exclusivo de staging configurado, não foram fornecidas contas de staging e não há acesso verificável ao controle da flag, banco, backup ou logs. O teste automatizado recusou prosseguir sem `STAGING_BASE_URL` e encerrou com código 2.

O ensaio local Chrome/Edge continua válido apenas para a preservação de `localStorage` na seleção V2 → V1 → V2. Ele não comprova persistência do servidor, isolamento entre contas, backup ou restauração.

## O que não fazer

- Não apagar tabelas V2, Snapshot, os 20 troféus adicionais ou qualquer progresso.
- Não limpar `localStorage`.
- Não alterar slug, URL ou canonical.
- Não restaurar banco automaticamente.
- Não reverter migração aditiva por reflexo.
- Não remover o fallback legado.

## Rollback de código

Usar somente se a flag não contiver o dano, por exemplo: falha também no V1, vulnerabilidade, erro de servidor, incompatibilidade de runtime ou assets compartilhados quebrados.

Com a flag desligada, identificar o commit implantado e criar uma reversão auditável em branch de correção:

```bash
git status --short
git log -1 --oneline
git switch -c hotfix/re5-v2-rollback
git revert <commit-da-release>
npm ci
npm run test:re5:v2:baseline
npm run build --if-present
npm test
```

Publicar somente pelo processo aprovado da plataforma e manter a flag desligada. Não executar esses comandos contra mudanças locais não registradas.

## Rollback de banco

Reservado a corrupção comprovada. Exige backup anterior verificado, restauração testada em ambiente isolado, aprovação humana, janela de manutenção e plano explícito para conciliar progresso criado após o backup. O hash/tamanho/data do banco antes e depois devem ser registrados. Sem esses requisitos, não restaurar.

## Remoção futura do fallback

Somente em projeto separado, após período de estabilidade formalmente definido, zero fallback inesperado, métricas de erro aceitáveis, progresso sincronizado, migração de usuários concluída, ausência de regressões, rollback alternativo disponível e autorização explícita.
