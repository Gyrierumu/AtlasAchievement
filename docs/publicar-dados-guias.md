# Publicacao de jogos e guias

## Fonte atual dos dados

O AtlasAchievement tem duas camadas de dados:

- `database.sqlite` e o SQLite configurado por `DATABASE_PATH` sao a fonte em execucao. O site, a API e o painel admin leem de `games`, `roadmaps`, `trophies` e `game_slug_redirects`.
- `data/guides/*.json` e `data/guides/manifest.json` sao snapshots versionados dos guias. Eles sao gerados por `npm run export:data` e importados por `npm run import:data`.
- `src/data/sampleGames.js` segue como fonte versionada de seed/bootstrap. `npm run db:setup` roda migrations e `seed`, inserindo jogos que ainda nao existem. Algumas migrations tambem sincronizam slugs especificos.

No Render, `render.yaml` aponta `DATABASE_PATH=/data/database.sqlite`, em disco persistente. Esse banco nao vem do Git: ele vive no volume do Render.

## Diretorio correto no Render

O projeto deve rodar a partir da raiz do repositorio, nao de `src`.

A raiz contem:

- `package.json`;
- `package-lock.json`;
- `server.js`;
- `scripts/`;
- `data/guides/`;
- `src/`.

Essa e a opcao mais segura porque os scripts `export:data`, `import:data`, `import:data:changed`, o bootstrap e o auto-import compartilham caminhos relativos a raiz. O `render.yaml` foi ajustado para subir pela raiz mesmo que o shell/servico esteja temporariamente em `src`.

Configuracao recomendada no Render:

- **Root Directory**: vazio ou raiz do repositorio;
- **Build Command**: `if [ -f server.js ]; then npm ci && npm run build; else cd .. && npm ci && npm run build; fi`;
- **Pre-Deploy Command**: `if [ -f server.js ]; then npm run db:setup; else cd .. && npm run db:setup; fi`;
- **Start Command**: `if [ -f server.js ]; then npm start; else cd .. && npm start; fi`;
- **Environment**: `AUTO_IMPORT_GUIDES_ON_START=true`.

Se o Render Shell abrir em `~/project/src`, `npm run import:data` e `npm run prepare:guides` tambem funcionam: `src/package.json` apenas delega os scripts para a raiz. Isso existe para diagnostico/emergencia; o fluxo normal continua sendo `git push origin main`.

## Por que `git push` nao publicava algumas alteracoes

`database.sqlite` esta no `.gitignore`, corretamente. Quando um jogo e criado ou editado no painel admin local, a gravacao acontece no SQLite local. Como esse arquivo e ignorado, o `git push` nao leva essas mudancas.

O push leva apenas arquivos versionados, como `src/data/sampleGames.js` e os snapshots em `data/guides`. Se a alteracao ficou apenas no banco local, ela precisa ser exportada antes de publicar.

## Como publicar uma feature

Quando a mudanca for somente codigo do site:

```bash
git add .
git commit -m "feat: ..."
git push
```

O Render faz build/deploy automaticamente. Nao rode `npm run prepare:guides` se nenhum guia foi alterado no admin local.

## Como publicar um jogo/guia

1. Fazer a alteracao no admin local.
2. Rodar:

   ```bash
   npm run prepare:guides
   ```

3. Conferir o que mudou:

   ```bash
   git diff data/guides
   ```

4. Commitar apenas os snapshots versionados:

   ```bash
   git add data/guides
   git commit -m "data: atualizar guias"
   git push
   ```

5. Com `autoDeploy: true`, o Render faz deploy automaticamente apos o push.
6. No Render, se `AUTO_IMPORT_GUIDES_ON_START=true`, a importacao dos guias alterados acontece automaticamente no proximo startup.
7. O site publico passa a refletir os dados importados do SQLite persistente.

Nunca commitar `database.sqlite`, `.env`, backups ou uploads locais.

## Como publicar feature + guia no mesmo deploy

1. Alterar o codigo.
2. Editar/adicionar o guia no admin local.
3. Rodar:

   ```bash
   npm run prepare:guides
   ```

4. Conferir:

   ```bash
   git diff data/guides
   ```

5. Adicionar codigo e dados versionados:

   ```bash
   git add arquivos-de-codigo data/guides
   git commit -m "feat: ..."
   git push
   ```

## Como saber se deu certo

Nos logs do Render, procure:

```text
guides import startup context
guides import startup summary
```

`guides import startup context` mostra `cwd`, raiz do pacote, caminho de `data/guides`, manifest, total de guias e SQLite usado. `guides import startup summary` mostra slugs pendentes, importados, pulados, ausentes no banco mesmo com hash registrado, alterados por hash e ainda nao rastreados.

Depois abra:

- `/catalogo`;
- `/jogo/slug-do-jogo`.

Se o guia novo aparecer no catalogo e a rota do slug abrir, os dados versionados foram importados para `/data/database.sqlite`.

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
- se o hash for igual, mas o jogo nao existir em `games`, reimporta o slug em vez de pular;
- cria backup do banco antes de qualquer importacao real;
- importa somente guias com hash novo ou alterado;
- atualiza `guide_import_state` na mesma transacao;
- registra slugs importados e pulados;
- falha com mensagem clara em conflitos ou erros de dados.

Se nao houver mudancas, o log mostra `guides import: no changes` e o banco nao e alterado.

Se houver erro, procure `guides import startup error`. Conflitos de nome/slug aparecem como `Conflito de jogo: name ja existe com outro slug...` e fazem o startup falhar de forma visivel quando `AUTO_IMPORT_GUIDES_ON_START=true`.

Se a importacao automatica falhar com `AUTO_IMPORT_GUIDES_ON_START=true`, o startup falha. Essa e a opcao mais segura para producao porque evita subir o servidor com deploy novo e banco parcialmente desatualizado. O rollback da transacao protege o banco se algo quebrar durante a importacao.

Para desativar rapidamente, altere no Render:

```bash
AUTO_IMPORT_GUIDES_ON_START=false
```

Depois faca um novo deploy/restart. O comportamento volta ao fluxo manual.

## Comando local simples

`npm run prepare:guides` faz o trabalho diario:

- roda `npm run export:data`;
- valida `data/guides/manifest.json`;
- valida cada JSON referenciado pelo manifest;
- falha cedo se houver slug duplicado ou `name` igual com slug diferente;
- mostra os slugs alterados segundo o Git;
- lembra o proximo comando: `git add data/guides && git commit -m "data: atualizar guias" && git push`.

Ele nao commita automaticamente e nao importa nada em producao.

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

## Slug canonico e aliases

Quando um jogo ja existe em producao, o slug versionado deve preservar o slug do banco persistente. Para a serie Assassin's Creed, os slugs canonicos usam `assassin-s-creed-*`, por compatibilidade com registros ja existentes no SQLite de producao. Os slugs `assassins-creed-*` ficam apenas como redirects/aliases em `game_slug_redirects`.

`npm run prepare:guides` valida antes do commit se `manifest.json`, arquivos em `data/guides`, `sampleGames.js` e redirects continuam coerentes. Se o mesmo `name` aparecer com slugs diferentes, ou se um arquivo/manifest apontar para o slug errado, o comando falha localmente antes do deploy.

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
