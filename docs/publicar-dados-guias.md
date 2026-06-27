# Publicacao de jogos e guias

## Fonte atual dos dados

O AtlasAchievement tem duas camadas de dados:

- `database.sqlite` e o SQLite configurado por `DATABASE_PATH` sao a fonte em execucao. O site, a API e o painel admin leem de `games`, `roadmaps`, `trophies` e `game_slug_redirects`.
- `src/data/sampleGames.js` e a fonte versionada de seed/bootstrap. `npm run db:setup` roda migrations e `seed`, inserindo jogos que ainda nao existem. Algumas migrations tambem sincronizam slugs especificos.

No Render, `render.yaml` aponta `DATABASE_PATH=/data/database.sqlite`, em disco persistente. Esse banco nao vem do Git: ele vive no volume do Render.

## Por que `git push` nao publicava algumas alteracoes

`database.sqlite` esta no `.gitignore`, corretamente. Quando um jogo e criado ou editado no painel admin local, a gravacao acontece no SQLite local. Como esse arquivo e ignorado, o `git push` nao leva essas mudancas.

O push leva apenas arquivos versionados, como `src/data/sampleGames.js` e os snapshots em `data/guides`. Se a alteracao ficou apenas no banco local, ela precisa ser exportada antes de publicar.

## Fluxo seguro recomendado

1. Fazer a alteracao no admin local ou no seed versionado.
2. Rodar:

   ```bash
   npm run export:data
   ```

3. Revisar `git status` e o diff em `data/guides/*.json`.
4. Rodar validacoes:

   ```bash
   npm run build
   npm run validate:new-guide -- slug-do-jogo
   ```

5. Commitar os arquivos versionados, nunca `database.sqlite`.
6. Fazer push.
7. No Render, depois do deploy e do `npm run db:setup`, importar o snapshot versionado quando houver mudanca vinda do banco/admin:

   ```bash
   npm run import:data -- --yes
   ```

Use `--only slug-a,slug-b` para limitar a importacao a guias especificos:

```bash
npm run import:data -- --yes --only stellar-blade,ghost-of-yotei
```

Sem `--yes`, o importador faz apenas dry-run e mostra o plano.

## Backups

`npm run export:data` cria backup antes de exportar.

`npm run import:data -- --yes` cria backup antes de importar. Em producao, como `DATABASE_PATH=/data/database.sqlite`, o backup fica abaixo de `/data/backups`, no disco persistente.

## O que os scripts exportam

Os snapshots versionados ficam em `data/guides`:

- `manifest.json`
- um arquivo por jogo, por exemplo `data/guides/elden-ring.json`

Cada arquivo preserva os dados que existem no SQLite:

- slug, nome, dificuldade, tempo, status e metadados editoriais;
- resumos, notas, imagens e campos de revisao;
- roadmap;
- trofeus com nome, PT-BR, tipo, dica, spoiler e perdiveis;
- redirects de slug.

Os scripts nao exportam nem importam:

- admin/users/sessoes;
- analytics;
- feedback;
- progresso de usuarios;
- uploads;
- `.env`;
- `database.sqlite`.

Campos que hoje existem apenas no seed JS, como alguns blocos de FAQ, SEO, checklist e tags editoriais, continuam tendo `src/data/sampleGames.js` como fonte ate o schema do SQLite ganhar colunas proprias para eles.

## Database.sqlite deve continuar ignorado?

Sim. O banco local contem estado de runtime, admin, sessoes e possiveis dados que nao devem ir para Git. A forma segura de publicar jogos/guias e commitar dados versionados e usar `npm run import:data` no destino com backup.
