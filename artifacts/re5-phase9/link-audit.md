# Audit de links RE5 — Fase 9

- Resultado: **PASS_WITH_WARNINGS**
- Verificação técnica: 2026-07-21T23:42:10.560Z
- User-Agent identificado: `AtlasAchievementEditorialAudit/1.0 (+https://atlasachievement.com.br/sobre; contato editorial)`
- Concorrência: 2
- Timeout: 15000 ms
- Política: HEAD seguido de GET leve; até 4 redirecionamentos; 403/429/antibot não são classificados como quebrados.

| Status | Fonte | HTTP | Destino final |
|---|---|---:|---|
| OK | capcom-manual-ps4 | 206 | https://static.capcom.com/manuals/re5/RE5_PS4_DMNL_EN.pdf |
| BLOCKED | pst-list-ps4 | 403 | https://www.playstationtrophies.org/game/resident-evil-5-ps4/trophies/ |
| BLOCKED | pst-guide-ps4 | 403 | https://www.playstationtrophies.org/game/resident-evil-5-ps4/guide/ |
| BLOCKED | gamefaqs-list-ps4 | 403 | https://gamefaqs.gamespot.com/ps4/187184-resident-evil-5/trophies |
| BLOCKED | gamefaqs-lost-in-nightmares | 403 | https://gamefaqs.gamespot.com/ps3/989571-resident-evil-5-lost-in-nightmares/faqs/59192 |
| BLOCKED | gamefaqs-desperate-escape | 403 | https://gamefaqs.gamespot.com/ps3/991006-resident-evil-5-desperate-escape/faqs/59292 |
| OK | youtube-bsaa-30 | 200 | https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DqG94-12Nznk&format=json |
| OK | youtube-heart-of-africa | 200 | https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DXKfQyYb_hBY&format=json |
| OK | youtube-score-stars-18 | 200 | https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D4KAJ6zfUNxc&format=json |
| OK | youtube-agitators-3 | 200 | https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DZxx5PkPYeuU&format=json |
| BLOCKED | psnprofiles-sessions-re5 | 403 | https://psnprofiles.com/sessions |

Fragments internos quebrados: 0. Assets locais quebrados: 0. Timestamps verificados: 49; inválidos: 0.
