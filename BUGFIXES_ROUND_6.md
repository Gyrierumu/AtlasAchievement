# Bugfixes Round 6

## Corrigido

- **Home/busca truncadas em catálogos maiores que 100 jogos**: o carregamento público agora pagina até buscar todo o catálogo, em vez de ficar limitado ao primeiro lote de 100 itens.
- **Progresso da biblioteca podendo passar de 100%**: entradas salvas agora deduplicam `completed` e ignoram IDs de troféu que não existem mais no jogo atual.
- **Tempo desconhecido rotulado como maratona longa**: a UI do catálogo agora mostra `Tempo não informado` quando o campo de tempo não tem número parseável, em vez de classificar incorretamente como projeto longo.
