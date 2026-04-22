# Melhorias aplicadas na rodada 1

## Segurança
- Cookies de sessão ajustados para `SameSite=Lax`
- Middleware de headers de segurança adicionado (CSP, frame deny, nosniff, referrer policy, permissions policy, COOP)
- Proteção CSRF adicionada para operações autenticadas do admin
- CORS passou a aceitar apenas origens explicitamente configuradas por ambiente

## Frontend / estabilidade
- `ApiService` agora propaga e envia token CSRF automaticamente
- Biblioteca local passou a usar `slug` como chave estável
- Migração automática da chave antiga `trophy_library` para `trophy_library_v2`
- Home reduziu pré-carregamento inicial de 500 para 120 jogos

## SEO / deploy
- `robots.txt` dinâmico
- `sitemap.xml` dinâmico
- `site.webmanifest`
- `.env.example` incluído

## Antes de publicar
1. Definir `APP_URL`
2. Definir `CORS_ALLOWED_ORIGINS`
3. Definir `SESSION_SECRET` forte
4. Definir `ADMIN_USERNAME` e `ADMIN_PASSWORD`
5. Instalar dependências no ambiente alvo com `npm install`
