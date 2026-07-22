# Relatório — Fase 9: governança do guia de Resident Evil 5

## Resultado executivo

Fase 9 implementada e certificada sem commit ou deploy. Não foram ativados anúncios, analytics, trackers, tags ou tarefas externas. As flags da Fase 8 permanecem desligadas. Não foi encontrado P0/P1 anterior.

Gate confirmado: Fase 7 aprovada; instrumentação da Fase 8 documentada; 51 troféus base + 20 DLC = 71 únicos; 36 FAQs; 12 pontos de atenção; 22 chefes; 30 BSAA Emblems; 50 tesouros; 18 Score Stars; 3 Agitators; 16 capítulos; 7 etapas; 5 figuras; 6 abas.

O estado final dos checks específicos do RE5 é PASS. O relatório consolidado usa `PASS_WITH_WARNING` apenas porque `npm test` conserva uma falha global pré-existente do catálogo no grupo “Duração”; os testes do guia, SEO, governança e build passam.

## Arquitetura de governança

A governança foi incorporada ao seed existente, sem criar CMS ou verdade paralela:

- `src/data/residentEvil5Governance.js` mantém fontes, claims, classificação, freshness, status online, workflow e política de rollback.
- `src/data/sampleGames.js` consome um builder único; as seis fontes exibidas ao jogador são derivadas do registro interno de 11 fontes.
- `src/shared/re5GovernanceValidators.js` contém as regras determinísticas, sem duplicar fatos.
- `data/guides/resident-evil-5.json` mantém o snapshot sincronizado.
- API e renderizadores continuam recebendo a projeção do seed/snapshot pela arquitetura existente.

O changelog público é limitado às três entradas recentes em SSR e hidratação. Fase 9 não adicionou entrada pública: governança, segurança, testes e refactors não fabricam mudança editorial.

## Classificação dos dados

- Estáveis: contagens, capítulos, BSAA, tesouros, nomes e desbloqueios; revisão por evento/ampla.
- Dependentes de versão: PS3/PS4, 50 versus 100 eliminações, trajes, Bonus Features e Remaster; plataforma/versão obrigatória.
- Práticos/editoriais: 6/10, horas, 80.000, loadouts, farms e rotas; nunca apresentados como requisitos oficiais.
- Voláteis: online, matchmaking, boost, links, vídeos e integrações; revisão mensal/por evento.

## Registro de fontes e claims

Foram normalizadas 11 fontes com todos os campos obrigatórios e confiabilidade A–D. A projeção pública continua com seis fontes. O audit atual encontrou cinco destinos OK e seis bloqueados por proteção HTTP; nenhum link quebrado, conteúdo divergente, rate limit ou timeout.

Foram registradas 17 claims sensíveis. Confiança atual: 9 HIGH, 7 MEDIUM e 1 LOW. Incluem contagens, All Dressed Up, Versus/15 vitórias/50 eliminações, Infinite Ammo/Rocket Launcher, Score Stars, crests/shards, ranks/Professional, três Agitators, 150 kills, alvo prático de 80.000, online, horas e dificuldade.

Regras aplicadas:

- claim factual/por versão exige fonte A ou B no conjunto de evidências;
- fonte C é corroboração prática/visual;
- fonte D isolada só permanece volátil, LOW e não conclusiva;
- claim sem fonte falha;
- plataforma é obrigatória quando a versão importa;
- divergência abre revisão humana e não altera o guia automaticamente.

## Comandos criados

```text
npm run audit:guide -- resident-evil-5
npm run audit:links -- resident-evil-5
npm run test:re5:governance
node scripts/qa-re5-phase9.js
node scripts/generate-re5-phase9-quality.js
```

O audit estrutural gera JSON e Markdown, usa exit code não zero em falhas determinísticas e valida contagens, IDs/nomes, seed/snapshot, manifest, DB, API, SSR, DOM hidratado, FAQ/alertas/colecionáveis/figuras/abas, anchors, JSON-LD, autoria, fontes, datas e claims.

Os servidores de audit/QA executam sobre uma cópia temporária do SQLite. Migrações de startup e sessões de teste são descartadas no encerramento; o banco real só é lido para paridade/contagens. Timestamps de `games` tocados pelas primeiras execuções, antes desse isolamento, foram restaurados transacionalmente a partir do backup seguro pré-audit, sem tocar tabelas de usuário.

O audit de links usa User-Agent identificável, concorrência 2, timeout de 15 s, no máximo quatro redirects, HEAD e GET leve com leitura limitada. Valida destino, título, assets, fragments, vídeos e timestamps. `403`, `429` e antibot são avisos, sem bypass.

## Divergências e freshness

As regras cobrem All Dressed Up entre FAQ/Extras; três Agitators entre checklist/alt/fallback/SVG; 18 Score Stars entre as mesmas superfícies; 51/20 entre seed/API/hero/HTML/JSON-LD; datas entre HTML/schema/sitemap; descriptions meta/OG/Twitter; e ressalva do status online.

O primeiro audit detectou que a FAQ de All Dressed Up não explicitava a exclusão dos quatro trajes adicionais, embora o checklist já o fizesse. A FAQ foi normalizada para o requisito já revisado e todas as camadas voltaram à paridade.

Datas preservadas:

- última revisão editorial: 2026-07-18;
- `dateModified`: 2026-07-18;
- próxima revisão volátil: 2026-08-17;
- `lastChecked`: somente nos artefatos técnicos da Fase 9.

Audits, testes e ajustes de governança não alteram `reviewedAt`, `dateModified`, sitemap ou histórico editorial.

## Feedback e segurança

O formulário RE5 aceita as oito categorias pedidas, seção/âncora, descrição, plataforma/versão, fonte opcional e contato opcional já coberto pela política. Captura automaticamente somente slug, âncora, versão do frontend, data, bucket de viewport e aba ativa. Query/hash são removidos da URL armazenada, e nenhum estado do checklist é enviado.

Controles validados: sanitização, escaping existente na saída, texto sem HTML/script, CSRF obrigatório inclusive para anônimo, mesma origem, rate limit, limites de tamanho, URL HTTP(S) sem credenciais, honeypot, idade mínima e validações XSS/spam. URL enviada nunca é aberta ou consultada automaticamente.

O banco recebeu apenas colunas opcionais de governança em `feedbacks`; não houve transformação de registros nem migração de dados/progresso de usuário. O estado inicial é `NEW`.

Workflow: `NEW → TRIAGED → NEEDS_EVIDENCE → ACCEPTED → IMPLEMENTED → VERIFIED → PUBLISHED`, com `REJECTED` e retorno de verificação quando aplicável. `ACCEPTED` exige evidência e teste planejado; `VERIFIED` exige testes e revisor humano. Feedback continua sendo pista, não fonte.

## Cadência, online e alertas

O playbook documenta rotina semanal, mensal, trimestral e por evento. Nenhuma rotina foi agendada. O status online usa apenas os estados permitidos e permanece `APPARENTLY_AVAILABLE`, com data e ressalva de que sinais comunitários não garantem matchmaking.

Alertas cobrem revisão vencida, fonte volátil há mais de 30 dias, link inconclusivo por três execuções, vídeo removido, claim sem versão, fonte D isolada, data sem changelog, visual/fallback divergente, report aceito sem teste e online sem data. Alertas nunca editam conteúdo.

## CI, changelog e rollback

O repositório não possui CI; por isso nenhum workflow ou secret foi adicionado. O playbook deixa os gates preparados para uma CI futura e separa link audit externo para que 403/429/antibot não bloqueiem uma PR.

O changelog público mostra apenas três mudanças relevantes recentes. Refactor, teste e ajuste cosmético não são publicados.

Rollback: preservar hashes/snapshots, restaurar somente o snapshot editorial do RE5, reconstruir e auditar. Progresso, biblioteca e tabelas de usuário ficam intocados. Não se usa `git reset --hard`, exclusão ampla ou restauração destrutiva do banco.

## Resultados dos testes

- `npm run test:re5:governance`: PASS, incluindo 404, 403, 429, timeout, redirect, título divergente, XSS, URL maliciosa, claim sem fonte, data sem changelog, SVG/fallback, report aceito sem teste e rollback.
- `npm run test:guide -- resident-evil-5`: PASS.
- `npm run test:seo`: PASS.
- `npm run build`: PASS.
- `npm run audit:guide -- resident-evil-5`: PASS.
- `npm run audit:links -- resident-evil-5`: PASS_WITH_WARNINGS; 5 OK, 6 BLOCKED, 0 BROKEN; 49 timestamps conferidos e 0 inválidos.
- Browser Edge/CDP: PASS em 1440 e 390 px, sem overflow; CSRF ausente retorna 403; nenhum request para fonte digitada; controle em outro jogo sem campos RE5.
- `npm test`: falha global pré-existente em `catalogo precisa organizar filtros pelo grupo Duração`, fora do escopo RE5.
- `git diff --check`: executado no fechamento.

## Escopo e arquivos

Principais arquivos da Fase 9:

- `src/data/residentEvil5Governance.js`
- `src/shared/re5GovernanceValidators.js`
- `src/data/sampleGames.js`
- `data/guides/resident-evil-5.json`
- `scripts/re5-audit-utils.js`
- `scripts/audit-guide-governance.js`
- `scripts/audit-guide-links.js`
- `scripts/test-re5-phase9-governance.js`
- `scripts/qa-re5-phase9.js`
- `scripts/generate-re5-phase9-quality.js`
- `public/js/app-feedback.js`
- `src/services/feedback.service.js`
- `src/middleware/csrfProtection.js`
- `src/db/migrate.js`
- `src/app.js`
- `public/js/ui-guide.js`
- `package.json`
- `docs/RE5_EDITORIAL_PLAYBOOK.md`
- `artifacts/re5-phase9/`

O exportador existente opera globalmente. Ao gerar o snapshot, 104 arquivos de outros jogos tiveram somente `updated_at` regravado; a comparação estrutural provou ausência de qualquer outra diferença e esses 104 timestamps foram restaurados. O diff final em `data/guides` fica restrito ao snapshot RE5.

## Limitações e ações humanas

- Seis fontes retornam proteção 403 e precisam de revisão humana periódica; não foram contornadas.
- Status online continua inferência temporária; criar sala/matchmaking deve ser testado por pessoa quando possível.
- O browser integrado da ferramenta não iniciou por falta de `sandboxPolicy`; a verificação foi feita no Edge local headless via CDP, com screenshots.
- O formulário não foi enviado com token válido para não poluir o banco; contrato, validação, CSRF negativo e UI foram testados separadamente.
- A falha global do grupo “Duração” precisa ser tratada pelo responsável do catálogo.
- Publicação, deploy, triagem de feedback, mudança de status online e promoção para `VERIFIED/PUBLISHED` continuam ações humanas.
