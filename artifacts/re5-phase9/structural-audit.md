# Audit estrutural RE5 — Fase 9

- Resultado: **PASS**
- Verificação técnica: 2026-07-21T23:41:25.693Z
- Revisão editorial preservada: 2026-07-18
- Snapshot: `75281e7d54cbbf8911f3ff409e6c84aa444d9807bf14cce45f6675028fa1fb07`
- Erros determinísticos: 0
- Alertas de obsolescência: 0

| Status | Regra | Evidência |
|---|---|---|
| PASS | COUNTS_CANONICAL | {"baseTrophies":51,"dlcTrophies":20,"uniqueTotal":71,"faq":36,"attention":12,"bosses":22,"bsaa":30,"treasures":50,"scoreStars":18,"agitators":3,"chapters":16,"roadmapStages":7,"instructionalFigures":5,"tabs":6} |
| PASS | BASE_IDS_UNIQUE | 51/51 IDs únicos |
| PASS | DLC_IDS_UNIQUE | 20/20 IDs únicos |
| PASS | TROPHY_NAMES_UNIQUE | base=51; DLC=20; total=71 |
| PASS | DB_TROPHIES_UNIQUE | 51 linhas |
| PASS | MANIFEST_ENTRY | {"file":"resident-evil-5.json","name":"Resident Evil 5","roadmaps":7,"slug":"resident-evil-5","status":"verified","trophies":51} |
| PASS | SEED_SNAPSHOT_EDITORIAL_PARITY | 429e0b424ac27a147f7841403b25c794c134b0cb6dbdbb5dfbb7f05db6401c65 / 429e0b424ac27a147f7841403b25c794c134b0cb6dbdbb5dfbb7f05db6401c65 |
| PASS | SEED_API_EDITORIAL_PARITY | 429e0b424ac27a147f7841403b25c794c134b0cb6dbdbb5dfbb7f05db6401c65 / 429e0b424ac27a147f7841403b25c794c134b0cb6dbdbb5dfbb7f05db6401c65 |
| PASS | ROADMAP_LAYER_PARITY | 6ec72227289d4acb197e47f3c16e2b7ca39deafa5077a6923dad9796abf9e978 / 6ec72227289d4acb197e47f3c16e2b7ca39deafa5077a6923dad9796abf9e978 / 6ec72227289d4acb197e47f3c16e2b7ca39deafa5077a6923dad9796abf9e978 / 6ec72227289d4acb197e47f3c16e2b7ca39deafa5077a6923dad9796abf9e978 |
| PASS | SOURCE_REGISTRY_VALID | 11 fontes; 0 erros |
| PASS | CLAIM_REGISTRY_VALID | 17 claims; 0 erros |
| PASS | FRESHNESS_HONEST | datas coerentes |
| PASS | PUBLIC_SOURCES_DERIVED | 6 fontes públicas |
| PASS | SENSITIVE_SURFACES_CONSISTENT | sem divergências |
| PASS | SENSITIVE_SURFACES_EXPECTED | {"re5-all-dressed-up":{"faq":true,"checklist":true},"re5-score-stars-18":{"checklist":18,"alt":18,"fallback":18,"svg":18},"re5-agitators-3":{"checklist":3,"alt":3,"fallback":3,"svg":3},"re5-counts":{"seed":"51/20","api":"51/20","hero":"51/20","html":"51/20","jsonLd":"51/20"}} |
| PASS | DESCRIPTIONS_MATCH | Guia de platina de Resident Evil 5 no PS4: 51 troféus base formam a platina, com roadmap, BSAA e Professional; 20 troféus de DLC são só para o 100%. / Guia de platina de Resident Evil 5 no PS4: 51 troféus base formam a platina, com roadmap, BSAA e Professional; 20 troféus de DLC são só para o 100%. / Guia de platina de Resident Evil 5 no PS4: 51 troféus base formam a platina, com roadmap, BSAA e Professional; 20 troféus de DLC são só para o 100%. |
| PASS | EDITORIAL_DATE_SURFACES | seed=2026-07-18; html=true; schema=2026-07-18; sitemap=2026-07-18T00:00:00.000Z |
| PASS | JSON_LD_AUTHORSHIP | Equipe Editorial AtlasAchievement; FAQ=36 |
| PASS | ONLINE_CAVEAT_PRESENT | Situação verificada em julho de 2026: há pedidos recentes de boost e registros recentes de conclusão da lista PS4, então o online está aparentemente disponível. Isso é uma inferência por atividade observada, não um anúncio oficial de status. Não presuma matchm |
| PASS | SSR_IDS_UNIQUE | 0 duplicados |
| PASS | SSR_SURFACE | troféus=51; FAQ=36 |
| PASS | DOM_BROWSER_COMPLETED | 730695 bytes |
| PASS | DOM_HYDRATED_SURFACE | troféus=51; tabs=6 |
| PASS | API_AND_HTML_OK | 200/200/200 |

O campo `lastChecked` pertence somente a este artefato técnico. O audit não altera `reviewedAt`, `dateModified`, sitemap ou changelog.
