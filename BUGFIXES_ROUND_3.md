# Bugfixes Round 3

## Corrigido

- Evitado apagar capas compartilhadas entre jogos duplicados ou reutilizados. Agora a remoção de uploads só acontece quando nenhuma outra entrada do catálogo ainda referencia a mesma imagem.
- Corrigido vazamento de arquivo em falha de atualização: se um update quebrar depois de trocar a capa, o upload novo deixa de ficar órfão no disco.
- Sitemap agora inclui todo o catálogo paginado, não apenas os 100 primeiros jogos.
- Busca principal ficou mais robusta quando o usuário pressiona Enter rápido demais: agora o frontend atualiza as sugestões antes de abrir o melhor resultado, reduzindo falsos “nenhum jogo encontrado” ou abertura do jogo errado.
