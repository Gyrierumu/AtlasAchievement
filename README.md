# AtlasAchievement

Base mínima do AtlasAchievement criada durante a reconstrução controlada do projeto.

## Requisitos

- Node.js 20.x
- npm 10 ou superior

## Comandos

```bash
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

O servidor usa `PORT` (padrão `3000`). A aplicação pública possui uma homepage temporária, páginas de erro, SEO temporário e health check em `/api/health`.

O SQLite e o disco persistente do Render foram preservados, mas a aplicação mínima não depende deles para iniciar. Não execute operações de limpeza no banco durante esta fase.

Consulte [docs/REBUILD.md](docs/REBUILD.md) para o inventário, as rotas removidas e as instruções de restauração.
