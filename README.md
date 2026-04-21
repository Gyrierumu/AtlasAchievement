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
npm start
```

Abra `http://localhost:3000`.

Login padrão:
- usuário: `admin`
- senha: `admin123`

## Variáveis de ambiente

```bash
PORT=3000
NODE_ENV=development
SESSION_SECRET=sua-chave-forte
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
DATABASE_PATH=./database.sqlite
UPLOAD_DIR=./public/uploads
MAX_UPLOAD_SIZE_BYTES=5242880
```

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

O arquivo `render.yaml` já está pronto.

### Passos
1. suba o projeto para GitHub
2. no Render, crie um novo serviço a partir do repositório
3. o Render lê o `render.yaml`
4. configure manualmente:
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
5. faça o deploy

### Por que o disco persistente importa
- o SQLite precisa persistir entre deploys
- as imagens enviadas também precisam persistir
- por isso o projeto usa:
  - `DATABASE_PATH=/data/database.sqlite`
  - `UPLOAD_DIR=/data/uploads`

## Observações de produção

- `express-session` com MemoryStore serve para projeto pequeno e MVP
- para produção mais forte, o próximo passo é usar store de sessão persistente
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
