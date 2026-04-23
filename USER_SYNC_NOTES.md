# User Account + Sync Foundation

Base preparada para evolução de conta de usuário:

- sessão persistente
- guest session fallback
- biblioteca sincronizável
- progresso de troféus preparado para sync
- migração gradual do localStorage para backend

Fluxo recomendado:
1. visitante entra como guest
2. progresso começa normalmente
3. usuário cria conta
4. progresso local é migrado
5. biblioteca passa a sincronizar entre dispositivos

Próxima evolução:
- login com email
- reset de senha
- sync server-side real
- dashboard de progresso
