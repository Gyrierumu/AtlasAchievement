# Como adicionar novo jogo sem quebrar deploy

## Fonte de verdade

Os guias versionados ficam em `src/data/sampleGames.js`. O site publica a partir do SQLite, mas o SQLite de produção é gerado/atualizado no deploy por `npm run db:setup`, que roda `migrate` e `seed` usando os dados versionados.

Não use `database.sqlite` local, PDF, ZIP, cache ou upload como fonte de verdade de um guia público.

## Checklist para criar um guia

1. Adicione o jogo em `src/data/sampleGames.js`.
2. Defina `slug` estável e sem acentos, por exemplo `ghost-of-yotei`.
3. Se houver grafias alternativas, preencha `aliases` no próprio guia.
4. Inclua resumo da platina em `before_you_start` e/ou `editorial_summary`.
5. Inclua top flags: tempo, dificuldade, perdíveis, online, coop, DLC, NG+, free roam e saves.
6. Inclua roadmap, FAQ e pontos de atenção.
7. Inclua todos os troféus com nome original EN e tradução PT-BR (`name` + `name_pt`).
8. Inclua tags/filtros coerentes, sem inflar online, coop, dificuldade ou perdíveis.
9. Use `published`/`verified` somente quando a validação editorial estiver completa.

## Validação local obrigatória

Rode:

```bash
npm run validate:new-guide -- ghost-of-yotei
npm run test:data
npm run test:roadmap
npm run test:quick
```

`validate:new-guide` cria um banco SQLite temporário, roda `migrate` + `seed`, confirma que o jogo entrou no banco, aparece no catálogo público e resolve pela rota `/jogo/:slug`. Ele não altera `database.sqlite`.

## Git e deploy

Antes de commitar:

```bash
git status --short
git diff --name-only
git branch --show-current
```

Confirme que:

- `src/data/sampleGames.js` está versionado.
- Qualquer script/documentação criada está versionada.
- Nenhum arquivo importante ficou untracked.
- `database.sqlite`, `.env`, `node_modules`, uploads e ZIPs não entram no commit.
- O commit está na branch conectada ao Render, atualmente `main`.

O Render usa `render.yaml`:

- `buildCommand: if [ -f server.js ]; then npm ci && npm run build; else cd .. && npm ci && npm run build; fi`
- `preDeployCommand: if [ -f server.js ]; then npm run db:setup; else cd .. && npm run db:setup; fi`
- `startCommand: if [ -f server.js ]; then npm start; else cd .. && npm start; fi`
- `DATABASE_PATH=/data/database.sqlite`
- `AUTO_IMPORT_GUIDES_ON_START=true`
- `autoDeploy: true`

Depois do push para `main`, o Auto-Deploy deve executar o pre-deploy e inserir jogos novos que ainda não existem no SQLite persistente. Se o deploy não iniciar automaticamente, acione Manual Deploy no Render usando o último commit da branch `main`.

## Verificação pós-deploy

Abra:

- `/catalogo`
- `/jogo/<slug>`
- `/api/games/slug/<slug>`
- `/sitemap.xml`

Confirme que o jogo aparece no catálogo, a página pública abre, o checklist tem todos os troféus e o sitemap contém `/jogo/<slug>`.
