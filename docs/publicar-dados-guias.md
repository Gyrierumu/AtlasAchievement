# Publicacao de jogos e guias

## Fonte atual dos dados

O AtlasAchievement tem duas camadas de dados:

- `database.sqlite` e o SQLite configurado por `DATABASE_PATH` sao a fonte em execucao. O site, a API e o painel admin leem de `games`, `roadmaps`, `trophies` e `game_slug_redirects`.
- `data/guides/*.json` e `data/guides/manifest.json` sao snapshots versionados dos guias. Eles sao gerados por `npm run export:data` e importados por `npm run import:data`.
- `src/data/sampleGames.js` segue como fonte versionada de seed/bootstrap. `npm run db:setup` roda migrations e `seed`, inserindo jogos que ainda nao existem. Algumas migrations tambem sincronizam slugs especificos.

No Render, `render.yaml` aponta `DATABASE_PATH=/data/database.sqlite`, em disco persistente. Esse banco nao vem do Git: ele vive no volume do Render.

## Por que `git push` nao publicava algumas alteracoes

`database.sqlite` esta no `.gitignore`, corretamente. Quando um jogo e criado ou editado no painel admin local, a gravacao acontece no SQLite local. Como esse arquivo e ignorado, o `git push` nao leva essas mudancas.

O push leva apenas arquivos versionados, como `src/data/sampleGames.js` e os snapshots em `data/guides`. Se a alteracao ficou apenas no banco local, ela precisa ser exportada antes de publicar.

## Fluxo seguro recomendado

1. Fazer a alteracao no admin local.
2. Rodar:

   ```bash
   npm run export:data
   ```

3. Revisar `git status` e o diff em `data/guides/*.json` e `data/guides/manifest.json`.
4. Rodar validacoes locais:

   ```bash
   npm run build
   npm run validate:new-guide -- slug-do-jogo
   ```

5. Commitar apenas os arquivos versionados:

   ```bash
   git add data/guides
   git commit -m "data: atualizar guias"
   git push origin main
   ```

6. Nunca commitar `database.sqlite`, `.env`, backups ou uploads locais.
7. Com `autoDeploy: true`, o Render faz deploy automaticamente apos o push.
8. No Render, se `AUTO_IMPORT_GUIDES_ON_START=true`, a importacao dos guias alterados acontece automaticamente no proximo deploy/start.
9. O site publico passa a refletir os dados importados do SQLite persistente.
10. Se quiser controle manual, mantenha `AUTO_IMPORT_GUIDES_ON_START=false` ou ausente e rode o importador manualmente no Render Shell.

## Importacao automatica no Render

Configure a variavel de ambiente no Render:

```bash
AUTO_IMPORT_GUIDES_ON_START=true
```

Em servicos novos criados a partir do Blueprint, `render.yaml` ja define essa variavel. Em servicos existentes, confirme no painel do Render em **Environment** ou reaplique o Blueprint.

Com essa variavel ligada, o startup roda uma importacao protegida:

- le `data/guides/manifest.json`;
- valida os JSONs selecionados;
- calcula hash SHA-256 deterministico de cada guia;
- compara com `guide_import_state`;
- cria backup do banco antes de qualquer importacao real;
- importa somente guias com hash novo ou alterado;
- atualiza `guide_import_state` na mesma transacao;
- registra slugs importados e pulados;
- falha com mensagem clara em conflitos ou erros de dados.

Se nao houver mudancas, o log mostra `guides import: no changes` e o banco nao e alterado.

Se a importacao automatica falhar com `AUTO_IMPORT_GUIDES_ON_START=true`, o startup falha. Essa e a opcao mais segura para producao porque evita subir o servidor com deploy novo e banco parcialmente desatualizado. O rollback da transacao protege o banco se algo quebrar durante a importacao.

Para desativar rapidamente, altere no Render:

```bash
AUTO_IMPORT_GUIDES_ON_START=false
```

Depois faca um novo deploy/restart. O comportamento volta ao fluxo manual.

## Importacao manual

O comando antigo continua valido:

```bash
npm run import:data
npm run import:data -- --yes
```

Use `--only slug-a,slug-b` para limitar a importacao a guias especificos:

```bash
npm run import:data -- --yes --only stellar-blade,ghost-of-yotei
```

Sem `--yes`, o importador faz apenas dry-run e mostra o plano.

Para importar somente guias cujo hash mudou desde a ultima importacao registrada:

```bash
npm run import:data:changed
npm run import:data:changed -- --yes
npm run import:data:changed -- --yes --only stellar-blade,ghost-of-yotei
```

Use o dry-run antes de ligar a automacao em producao quando quiser auditar o primeiro plano de importacao. Em uma instalacao sem historico em `guide_import_state`, guias ainda nao rastreados aparecem como pendentes.

## Backups

`npm run export:data` cria backup antes de exportar.

`npm run import:data -- --yes` cria backup antes de importar. Em producao, como `DATABASE_PATH=/data/database.sqlite`, o backup fica abaixo de `/data/backups`, no disco persistente.

`npm run import:data:changed -- --yes` tambem cria backup antes de qualquer importacao real. Quando nao ha guias alterados, nenhum backup novo e criado e o banco nao e modificado.

Todas as importacoes reais rodam em transacao. Se um guia falhar, o importador faz rollback e nao deixa importacao parcial.

## Conflito de name e slug

O importador e o bootstrap sao idempotentes:

- se ja existe jogo com o mesmo `slug`, o registro e atualizado;
- se nao existe `slug`, mas existe o mesmo `name` com slug vazio, o registro e recuperado e atualizado com o slug correto;
- se existe o mesmo `name` com outro `slug`, a execucao falha antes de modificar o banco.

O erro esperado nesse caso e:

```text
Conflito de jogo: name ja existe com outro slug. name="...", slug existente="...", slug novo="...".
```

Para resolver, confira se o JSON em `data/guides` representa o mesmo jogo do banco. Se for o mesmo jogo, mantenha o slug canonical correto e exporte novamente. Se forem jogos diferentes com o mesmo nome, ajuste o nome editorial ou slug com cuidado antes de tentar importar de novo. Nao resolva apagando jogos aleatoriamente do banco persistente.

## Controle de hashes

A tabela `guide_import_state` registra:

- `slug`
- `content_hash`
- `imported_at`
- `source_file`
- `import_version`

Ela nao substitui `games`, `roadmaps` ou `trophies`; serve apenas para saber quais snapshots versionados ja foram aplicados ao SQLite atual.

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

Sim. O banco local contem estado de runtime, admin, sessoes e possiveis dados que nao devem ir para Git. A forma segura de publicar jogos/guias e commitar dados versionados e usar `npm run import:data` ou `npm run import:data:changed` no destino com backup.

Para evitar sobrescrever producao por acidente:

- nunca remova `database.sqlite` do `.gitignore`;
- nunca copie banco local para `/data/database.sqlite`;
- revise o diff de `data/guides` antes do commit;
- use `npm run import:data:changed` sem `--yes` para dry-run;
- use `--only slug` quando quiser limitar a publicacao;
- deixe `AUTO_IMPORT_GUIDES_ON_START=false` se precisar pausar a automacao.
