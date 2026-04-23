# Melhorias — Round 3

## Catálogo e listagem movidos para o banco

Este round removeu a parte mais cara da listagem de jogos: filtros, ordenação e paginação que antes ainda eram finalizados em memória no backend.

### O que mudou
- a API `/api/games` agora aplica filtro, ordenação e paginação diretamente no SQLite
- filtros por dificuldade, tempo e faixa de troféus agora saem do banco já prontos
- a contagem total usada na paginação agora é consistente com os filtros aplicados
- pedidos para páginas acima do total agora retornam a última página válida
- o backend deixa de trazer e reordenar listas grandes desnecessariamente

### Impacto
- respostas mais consistentes no catálogo e no admin
- menor custo de CPU/memória no Node conforme o catálogo crescer
- base melhor para próximos passos de performance e índices
