# Improvements Round 4

## Sessões persistentes em SQLite
- substitui o `MemoryStore` por um store persistente em SQLite
- sessões sobrevivem a reinícios do processo dentro da validade do cookie
- renovação automática de validade com `rolling: true`
- limpeza periódica de sessões expiradas

## Configurações novas
- `SESSION_MAX_AGE_HOURS`
- `SESSION_CLEANUP_INTERVAL_MINUTES`

## Observações
- o store usa o mesmo banco SQLite já existente no projeto
- para múltiplas instâncias simultâneas, o próximo salto ideal continua sendo Redis
