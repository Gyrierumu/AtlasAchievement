# Reconstrução controlada do AtlasAchievement

## Ponto de restauração

- Commit: `63c7f7149a0970ba6db6a0d93bbfa33e7d4aae4b`
- Branch: `backup/pre-rebuild-atlas`
- Tag anotada: `pre-rebuild-atlas`
- Banco local: `backups/pre-rebuild-atlas-local-20260727/database.sqlite`
- SHA-256 do banco: `E62A5B6A2F2435F7D08750B055E396B7699953108BAB44A5B0A503E5FD406779`

O banco local, os backups, `node_modules` e os temporários continuam ignorados pelo Git e não fazem parte do bundle.

Os 39 logs ignorados que restavam no antigo diretório `artifacts/` foram movidos para `backups/pre-rebuild-atlas-ignored/legacy-artifact-logs/`. Eles não foram apagados.

## Inventário anterior

A aplicação anterior usava Node.js 20, Express 4 e SQLite. O start executava migrations, seed opcional, importação automática de guias e bootstrap administrativo antes de abrir a porta. O Render executava `npm ci`, build, preparação do banco e `npm start`, com um disco persistente montado em `/data`.

Superfícies retiradas da aplicação ativa:

- homepage, catálogo, biblioteca, perfil, páginas institucionais, coleções e guias;
- painel administrativo, autenticação, comentários, feedback e uploads;
- APIs de jogos, usuários, progresso, analytics e administração;
- catálogo editorial versionado, mocks, fixtures e dados de demonstração;
- CSS, JavaScript e assets específicos da aplicação antiga;
- scripts de importação, exportação, auditoria, migração e QA do produto anterior;
- artefatos visuais e documentação específica do Resident Evil 5;
- workflow de release que dependia desses scripts.

## Infraestrutura preservada

- repositório, histórico, remote, branch principal e arquivos ignorados;
- Node 20 em `.nvmrc`, `.node-version`, `package.json` e Render;
- npm e `package-lock.json`;
- nome, plano, comandos, domínio, variáveis e disco do serviço Render;
- `DATABASE_PATH=/data/database.sqlite` e `UPLOAD_DIR=/data/uploads`;
- banco local original, sem drop, truncate, reset ou migration destrutiva;
- assets globais de marca, ícones e manifest.

O pre-deploy deixou de executar migrations e agora apenas valida o runtime. Isso impede que a aplicação temporária toque no banco, mantendo o disco e as variáveis disponíveis para uma fase futura.

## Rotas ativas

| Rota | Resposta |
| --- | --- |
| `/` | Homepage temporária, HTTP 200 |
| `/api/health` | Health check independente, HTTP 200 |
| `/health` | Redirecionamento 308 para o health check |
| `/robots.txt` | Política temporária de rastreamento |
| `/sitemap.xml` | Sitemap somente com a homepage |
| `/indisponivel` | Experiência de indisponibilidade, HTTP 503 |
| `/assets/*` e ícones globais | Assets mínimos |

As demais rotas públicas, inclusive `/catalogo`, `/biblioteca`, `/jogo/:slug`, coleções, páginas institucionais e `/admin`, retornam 404 real. APIs antigas retornam 404 em JSON. Não há redirecionamento genérico para a homepage.

## Dependências

Preservadas:

- `express`: servidor HTTP e roteamento;
- `compression`: compressão das respostas.

Removidas da base ativa:

- `bcrypt`, `cors`, `express-session`, `multer` e `sqlite3`;
- `exceljs` e `jszip`.

Essas dependências pertenciam exclusivamente à autenticação, sessões, uploads, banco e ferramentas editoriais anteriores. A infraestrutura de dados continua preservada fora do runtime temporário.

## Validação

- instalação limpa com `npm ci --ignore-scripts`;
- lint e sintaxe dos arquivos JavaScript;
- contratos dos módulos CommonJS;
- 10 testes HTTP com Node 20.20.2;
- build completo;
- start de produção com Node 20.20.2;
- homepage 200, health check 200, rota antiga 404, API antiga 404 e indisponibilidade 503;
- auditoria npm sem vulnerabilidades conhecidas;
- inspeção visual em 1440 × 900 e viewport mobile equivalente a 390 × 844;
- hash do SQLite idêntico antes e depois do start.

O computador usado para a reconstrução possui Node 24 como runtime global, por isso o comando local de build registra um aviso informativo. Os testes e o start também foram executados com o Node 20.20.2 configurado no Render e passaram.

## Deploy

Nenhum push, merge ou deploy foi executado. O `autoDeploy` do Render continua preservado, portanto uma publicação só ocorrerá quando as alterações forem revisadas e enviadas ao remote.

## Como restaurar

Para inspecionar o estado anterior sem alterar a branch atual:

```bash
git worktree add ../atlasachievement-pre-rebuild pre-rebuild-atlas
```

Para criar uma branch de restauração:

```bash
git switch -c restore/pre-rebuild-atlas pre-rebuild-atlas
```

Para retornar a branch atual ao estado anterior, somente depois de preservar quaisquer alterações posteriores:

```bash
git switch main
git reset --hard pre-rebuild-atlas
```

O último comando é destrutivo para mudanças posteriores não preservadas; prefira a branch ou o worktree de restauração. O banco copiado pode ser comparado com o original pelo SHA-256 acima, sem substituir automaticamente nenhum banco de produção.
