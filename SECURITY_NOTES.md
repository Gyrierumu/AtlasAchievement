# Segurança e configuração do admin

## Variáveis recomendadas
Defina estas variáveis antes de subir em produção:

- `SESSION_SECRET` com pelo menos 16 caracteres
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD` com pelo menos 8 caracteres

## Rate limit de login
O login admin agora usa controle simples de tentativas:

- `LOGIN_RATE_LIMIT_WINDOW_MS`
- `LOGIN_RATE_LIMIT_MAX_ATTEMPTS`
- `LOGIN_BLOCK_DURATION_MS`

## Bootstrap do admin
Em ambiente local, o projeto ainda pode criar um admin inicial automaticamente.

Em produção, isso não acontece sem credenciais explícitas.

Se quiser forçar bootstrap temporário, use:

- `ALLOW_DEFAULT_ADMIN_BOOTSTRAP=true`
