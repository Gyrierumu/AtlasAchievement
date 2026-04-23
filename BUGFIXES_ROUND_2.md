# Bugfixes Round 2

- Corrigido bug SSR em rotas /catalogo/:facetSlug: a página específica de coleção agora aguarda a renderização assíncrona antes de responder.
- Corrigido bug de exclusão no admin: a remoção de jogo agora limpa entradas correspondentes da biblioteca local pelo id/nome, evitando atalhos quebrados após exclusão.
- Refeito o autosave/restore de rascunho do admin para persistir campos estruturados e a lista dinâmica de troféus, incluindo compatibilidade com o formato legado.
