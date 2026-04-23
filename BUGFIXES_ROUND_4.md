# Bugfixes Round 4

## Corrigido

1. **Logout e troca de senha sem proteção CSRF**
   - `POST /api/auth/logout` e `POST /api/auth/change-password` agora exigem token CSRF.
   - Evita logout forçado e troca de senha disparados por páginas de terceiros enquanto o admin está autenticado.

2. **Cookie de sessão podia não ser limpo corretamente em produção atrás de proxy**
   - O app agora usa `trust proxy` no Express e limpa o cookie com a mesma política `secure` usada na sessão.
   - Corrige casos em que o logout aparentemente funcionava, mas o cookie persistia em deploy HTTPS reverso.

3. **Biblioteca local podia perder vínculo após renomear/resslugificar um jogo**
   - Ao abrir um guia, o frontend agora tenta reconciliar entradas salvas por `id` ou `name` e migra para a nova `slug`.
   - Corrige jogos salvos que sumiam da progressão após edição do nome no admin.

4. **Abrir jogo salvo podia usar snapshot obsoleto mesmo quando já existia uma rota canônica nova**
   - A biblioteca agora tenta abrir o guia canônico pela `slug` antes de cair no snapshot local.
   - Reduz divergência entre o que está salvo localmente e a versão atual do conteúdo no servidor.

5. **Serialização SSR inicial mais robusta**
   - O estado inline agora escapa `<`, `>` e separadores Unicode além de `</script>`.
   - Evita quebra de hidratação e reduz superfície de injeção em nomes/textos editoriais com caracteres problemáticos.
