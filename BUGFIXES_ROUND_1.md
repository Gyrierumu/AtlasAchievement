# Bugfixes Round 1

## Corrigidos

1. **Falha de inicialização ao carregar jogos**
   - O frontend pedia `limit=120`, mas a API aceita no máximo `100`.
   - Isso podia derrubar o carregamento inicial com erro de query inválida.

2. **Campo de troféu perdível não era persistido**
   - O frontend e a camada editorial usavam `is_missable`, mas o dado não existia de ponta a ponta.
   - Foi adicionada migração para `trophies.is_missable` e suporte completo no payload, banco, leitura e admin.

3. **Admin não permitia marcar troféu como perdível**
   - O formulário só tinha checkbox de spoiler.
   - Agora o formulário também inclui checkbox de `Troféu perdível`.

4. **Conversão de texto bruto de troféus ignorava pistas de perdível**
   - A heurística agora marca `is_missable` quando encontra termos típicos como “perdível”, “missable”, “não perca” e similares.

5. **Restauração de rascunho no admin perdia estados básicos**
   - Checkboxes não eram restaurados corretamente.
   - O código agora trata `checkbox` como booleano no save/restore.

6. **Sincronização visual do rascunho com a UI**
   - A restauração não conseguia reaproveitar utilitários da UI porque eles não estavam expostos globalmente.
   - `window.UI` agora fica disponível para sincronizar preview e imagem ao restaurar o formulário.
