# Master Trophy Guide Pro

Projeto com:
- Express + SQLite
- login de admin com sessão
- senha com bcrypt
- painel admin com CRUD de jogos
- upload de capa do jogo
- deploy pronto para Render

## Rodando localmente

```bash
npm install
npm run db:setup
npm start
```

Abra `http://localhost:3000`.

`npm start` tambem executa migration, bootstrap do admin local e seed antes de subir o servidor. O comando `npm run db:setup` faz a mesma preparacao do banco sem iniciar o servidor, util para validar uma instalacao nova depois de `npm install`.

O banco local padrao e `database.sqlite`, criado a partir de migration + seed quando necessario. Esse arquivo e artefato local, fica ignorado pelo Git e nao deve ser enviado em ZIP/release.

Alteracoes feitas no painel admin ficam no SQLite configurado por `DATABASE_PATH`; como `database.sqlite` e ignorado pelo Git, elas precisam ser exportadas antes do push:

```bash
npm run export:data
npm run import:data -- --yes
npm run import:data:changed -- --yes
```

Veja o fluxo completo e os cuidados de backup em [`docs/publicar-dados-guias.md`](docs/publicar-dados-guias.md).

Login padrão:
- usuário: `admin`
- senha: `admin123`

Esse login padrao e apenas para desenvolvimento local. Em producao, defina `ADMIN_USERNAME` e `ADMIN_PASSWORD` no servidor e nao use a senha local de exemplo.

## Variáveis de ambiente

```bash
PORT=3000
NODE_ENV=development
SESSION_SECRET=sua-chave-forte
SESSION_MAX_AGE_HOURS=8
SESSION_CLEANUP_INTERVAL_MINUTES=30
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
AUTO_IMPORT_GUIDES_ON_START=false
DATABASE_PATH=./database.sqlite
UPLOAD_DIR=./public/uploads
MAX_UPLOAD_SIZE_BYTES=5242880
```

`AUTO_IMPORT_GUIDES_ON_START=true` ativa a importacao automatica dos snapshots versionados em `data/guides` durante o startup. Quando ausente ou `false`, nada e importado automaticamente. O importador automatico usa hashes em `guide_import_state`, cria backup antes de importacao real, roda em transacao e pula guias ja sincronizados.

## Testes e release

```bash
npm run test:guide -- resident-evil-requiem
npm run test:quick
npm test
npm run release:check
```

`npm test` usa um banco temporario via `DATABASE_PATH`, entao nao depende de `database.sqlite` local.

Fluxo recomendado:
- durante ajuste de um guia: `npm run test:guide -- slug-do-jogo`;
- depois de ajustes editoriais pequenos: `npm run test:quick`;
- antes de commit/deploy: `npm test` e `npm run release:check`.

Camadas disponiveis:
- `npm run test:guide -- slug-do-jogo`: valida o guia informado, checklist, roadmap, imagens, status editorial, API e SEO basico da pagina;
- `npm run test:roadmap`: valida roadmaps de todos os jogos contra placeholders, serializacao crua e etapas genericas;
- `npm run test:data`: valida integridade geral dos dados seed, slugs, imagens, jogos duplicados e trophy ids;
- `npm run test:seo`: valida canonical, title, meta description e sitemap sem browser pesado;
- `npm run test:quick`: com slug, roda `test:guide`; sem slug, roda `test:data` e `test:roadmap`.

`npm test` continua sendo a regressao completa obrigatoria antes de deploy. `npm run release:check` continua sendo a auditoria final de artefatos proibidos.

## Como gerar um release limpo

Um ZIP limpo deve conter o codigo-fonte e os arquivos de configuracao seguros, mas nao deve carregar estado local da maquina de desenvolvimento.

Antes de gerar o ZIP:
1. remova `database.sqlite`, `*.sqlite`, `*.sqlite3`, `*.db` e `*.db-journal` da pasta do projeto;
2. remova `node_modules/`; dependencias devem ser instaladas no destino com `npm ci`;
3. remova `.env`, `.env.local`, `.env.production` e `.env.development`; mantenha apenas `.env.example`;
4. remova logs, dumps, backups, sessoes, temporarios, `.DS_Store` e ZIPs antigos dentro do projeto;
5. configure variaveis de ambiente no servidor, sem colocar segredos reais no README ou no ZIP;
6. rode `npm test`;
7. rode `npm run release:check`;
8. gere o ZIP somente depois dos checks passarem.

`npm run release:check` ignora o `.gitignore` para fins de auditoria: se um arquivo proibido existir no diretorio do projeto, o release e bloqueado e o caminho exato aparece na mensagem de erro.

O banco de producao deve ser criado/inicializado no ambiente de destino usando `DATABASE_PATH` apontando para armazenamento persistente, por exemplo `/data/database.sqlite` no Render. O release nao deve carregar usuarios locais, progresso, sessoes, admin local ou dados temporarios.

Variaveis importantes para producao:
- `NODE_ENV=production`
- `SESSION_SECRET` com valor longo e secreto, definido no servidor
- `ADMIN_USERNAME` e `ADMIN_PASSWORD` definidos no servidor
- `DATABASE_PATH` apontando para volume persistente do ambiente
- `UPLOAD_DIR` apontando para volume persistente quando houver uploads
- `ALLOW_DEFAULT_ADMIN_BOOTSTRAP=false`
- `AUTO_IMPORT_GUIDES_ON_START=true` para importar guias versionados no proximo deploy/start, ou `false` para manter controle manual

## Upload de capas

No painel admin:
1. clique em **Novo jogo**
2. selecione a imagem no campo de arquivo
3. clique em **Enviar capa**
4. a URL é preenchida automaticamente no formulário
5. salve o jogo

Formatos aceitos:
- JPG
- PNG
- WEBP
- GIF

Limite padrão: 5MB.

## Deploy no Render

### Fluxo automatico de guias

Com `autoDeploy: true` no `render.yaml` e `AUTO_IMPORT_GUIDES_ON_START=true` no ambiente do Render, o fluxo normal e:

```bash
git push origin main
```

O Render faz build/deploy, roda o startup do app e importa automaticamente os guias novos ou alterados de `data/guides` para o SQLite persistente em `/data/database.sqlite`.

Em servicos novos criados pelo Blueprint, `render.yaml` ja define `AUTO_IMPORT_GUIDES_ON_START=true`. Em servicos existentes, confirme no painel do Render em **Environment** se a variavel esta ativa, ou reaplique o Blueprint.

Se aparecer `Conflito de jogo: name ja existe com outro slug`, revise o JSON em `data/guides` e o registro existente no banco. O mesmo jogo deve manter o mesmo `slug`; um nome igual com slug diferente e tratado como conflito real para evitar duplicacao.

O arquivo `render.yaml` já está pronto.

### Passos
1. suba o projeto para GitHub
2. no Render, crie um novo serviço a partir do repositório
3. o Render lê o `render.yaml`
4. configure manualmente:
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
5. confirme `AUTO_IMPORT_GUIDES_ON_START=true`
6. faça o deploy

### Por que o disco persistente importa
- o SQLite precisa persistir entre deploys
- as imagens enviadas também precisam persistir
- por isso o projeto usa:
  - `DATABASE_PATH=/data/database.sqlite`
  - `UPLOAD_DIR=/data/uploads`

## Observações de produção

- sessões agora usam store persistente em SQLite por padrão
- reinícios do processo não derrubam imediatamente as sessões do admin
- limpeza de sessões expiradas é automática e configurável
- se usar frontend e backend em domínios diferentes, ajuste CORS e cookies

## Estrutura principal

```text
public/
  index.html
  uploads/
  js/
src/
  config/
  controllers/
  db/
  middleware/
  routes/
  services/
  validators/
server.js
render.yaml
```


## Rotas principais

- `/` site público
- `/admin` painel administrativo
