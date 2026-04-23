# Bugfixes Round 5

- Corrigida a rota pública `/biblioteca` no servidor. Antes o frontend navegava para essa URL, mas recarregar a página ou abrir o link direto retornava 404.
- Corrigida a resolução de chaves da biblioteca local. Entradas legadas ou sem `slug` podiam falhar ao abrir ou remover o jogo a partir da tela de biblioteca/focus cards.
- Corrigido o helper de `fetch` da API para não perder headers calculados (incluindo CSRF e Content-Type) quando `options.headers` fosse usado.
