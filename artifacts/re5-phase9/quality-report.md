# Relatório de qualidade contínua — Resident Evil 5

- Estado: **PASS_WITH_WARNING**
- Último check técnico: 2026-07-21T23:42:43.709Z
- Última revisão editorial: 2026-07-18
- Próxima revisão volátil: 2026-08-17
- Claims: 17 (HIGH=9, MEDIUM=7, LOW=1)
- Fontes: 11; links OK=5; bloqueados=6; quebrados=0
- Feedbacks RE5 abertos: 0 (somente contagem; mensagens e contatos não foram lidos)
- Snapshot: `75281e7d54cbbf8911f3ff409e6c84aa444d9807bf14cce45f6675028fa1fb07`

## Checks

| Status | Comando | Exit code |
|---|---|---:|
| PASS | `npm run test:re5:governance` | 0 |
| PASS | `npm run test:guide -- resident-evil-5` | 0 |
| PASS | `npm run test:seo` | 0 |
| PASS | `npm run build` | 0 |
| FAIL | `npm test` | 1 |

Audit estrutural: PASS. Audit de links: PASS_WITH_WARNINGS. Browser QA: PASS. Divergências abertas: 0. Alertas de obsolescência: 0.

Falha de teste/refactor técnico não atualiza `dateModified`, `reviewedAt` ou changelog público.
