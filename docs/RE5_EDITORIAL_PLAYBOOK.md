# Playbook editorial — Resident Evil 5

Este playbook governa exclusivamente o guia `resident-evil-5`. Ele não agenda tarefas, não publica, não altera fatos automaticamente e não autoriza contorno de antibot. A fonte canônica de governança é `src/data/residentEvil5Governance.js`; a projeção pública de seis fontes é derivada do registro interno e não constitui uma segunda verdade.

## Papéis e separação de responsabilidades

- Autor/editor: propõe texto e registra a evidência.
- Revisor factual: confere versão, requisito, fontes e superfícies afetadas.
- Revisor técnico: executa audits, testes, acessibilidade e paridade de dados.
- Publicador: só publica item `VERIFIED`; não pode usar apenas o feedback comunitário como prova.

Uma mesma pessoa pode exercer mais de um papel numa equipe pequena, mas o registro deve identificar quem verificou. Nenhum bot promove estado editorial ou muda fato, disponibilidade online, data editorial ou changelog.

## Classificação dos dados

| Classe | Natureza | Exemplos | Cadência documentada |
|---|---|---|---|
| A — estável | Requisitos e estrutura consolidados | 51 base, 20 DLC, capítulos, BSAA, tesouros | Por evento ou revisão ampla |
| B — dependente de versão | Pode mudar entre PS3, PS4 e remaster | 50 versus 100 eliminações, trajes, Bonus Features | Trimestral e por mudança de plataforma |
| C — editorial | Estimativa ou recomendação Atlas | 6/10, horas, 80.000, farms, loadouts | Trimestral |
| D — volátil | Estado temporário ou dependência externa | Online, matchmaking, boost, links e vídeos | Mensal e por evento |

As letras desta tabela classificam o dado; as letras de confiabilidade abaixo classificam a fonte. Não devem ser confundidas.

## Registro de fontes

Cada fonte precisa ter `id`, `title`, `url`, `publisher`, `type`, `platform`, `version`, `purpose`, `accessedAt`, `lastVerifiedAt`, `status`, `reliability`, `notes` e `claims`. URLs externas devem usar HTTPS. A relação fonte↔claim é validada nos dois sentidos.

Confiabilidade:

- A: fonte oficial primária, como manual ou comunicado da Capcom.
- B: lista/guia independente consolidado e específico da plataforma.
- C: guia comunitário ou vídeo usado como corroboração prática/visual.
- D: sinal temporário ou comunitário; é pista, não comprovação factual.

Regras de evidência:

1. Requisito estável ou dependente de versão precisa de ao menos uma fonte A ou B.
2. Fonte C pode corroborar mecânica, rota, imagem ou comportamento; não converte sozinha informação de outra versão em requisito PS4.
3. Fonte D isolada só sustenta claim `volatile`, com confiança `LOW`, próxima revisão e linguagem não conclusiva.
4. Claim sem fonte existente falha deterministicamente.
5. Divergência entre fontes deve permanecer registrada; não se escolhe silenciosamente a versão mais conveniente.
6. Feedback de usuário pode iniciar investigação, mas nunca é promovido automaticamente a fonte.

## Claims sensíveis

O registro contém 17 claims: contagem base/DLC, All Dressed Up, requisitos e grind de Versus, Infinite Ammo/Rocket Launcher, Score Stars, crests/shards, S ranks e Professional das DLCs, três Agitators, 150 kills, meta editorial de 80.000, status online, horas e dificuldade. Cada claim declara classificação, plataforma/versão, fontes, confiança, datas, responsável e superfícies públicas.

Ao editar uma claim:

1. identifique a versão afetada;
2. registre fonte primária e contraprova;
3. liste todas as superfícies (`seed`, snapshot, FAQ, roadmap, checklist, alertas, visual, alt, fallback, metadados);
4. implemente a mudança em uma cópia de trabalho;
5. execute os audits e os cenários negativos;
6. faça revisão humana;
7. só então altere data editorial e changelog, se houve mudança factual pública.

## Workflow de feedback e correção

Fluxo permitido:

`NEW → TRIAGED → NEEDS_EVIDENCE → ACCEPTED → IMPLEMENTED → VERIFIED → PUBLISHED`

`REJECTED` pode encerrar `NEW`, `TRIAGED`, `NEEDS_EVIDENCE` ou `ACCEPTED`. `VERIFIED` pode voltar a `IMPLEMENTED` quando a verificação encontra problema.

Critérios mínimos:

- `TRIAGED`: categoria, escopo e superfície identificados.
- `NEEDS_EVIDENCE`: hipótese registrada e lacuna explícita.
- `ACCEPTED`: evidência registrada; opinião ou link enviado não bastam.
- `IMPLEMENTED`: referência rastreável da mudança e superfícies atualizadas.
- `VERIFIED`: testes determinísticos passaram e um revisor humano foi identificado.
- `PUBLISHED`: somente após `VERIFIED`, com revisão de data/changelog quando aplicável.

O formulário RE5 coleta categoria, seção/âncora, descrição, plataforma/versão e, opcionalmente, fonte e contato. O contexto automático contém apenas slug, âncora, versão do frontend, data, faixa de viewport e aba ativa. Query string, hash de navegação sensível, estado do checklist, IDs concluídos e progresso nunca são capturados.

Controles obrigatórios: escaping na saída, texto simples, rejeição de HTML/script, CSRF até para anônimo, mesma origem, rate limit, limites de tamanho, validação de URL HTTP(S) sem credenciais, honeypot e idade mínima do formulário. Uma URL enviada é armazenada para triagem e jamais aberta/fetchada automaticamente.

## Freshness honesta

- `lastChecked` pertence aos artefatos técnicos.
- `lastEditorialReview`, `reviewedAt` e `dateModified` pertencem à revisão factual pública.
- Audit, teste, refactor, mudança de segurança ou geração de relatório não atualiza datas editoriais.
- Mudança de data editorial exige nova entrada de changelog na mesma data.
- O changelog público exibe no máximo as três entradas editoriais mais recentes.
- O sitemap do RE5 usa a data editorial, não a hora do último teste técnico.

Estado online permitido: `CONFIRMED_AVAILABLE`, `APPARENTLY_AVAILABLE`, `DEGRADED`, `UNCONFIRMED`, `OFFLINE` ou `UNKNOWN`. Alterar o estado exige revisão humana e evidência adequada. Sinal de sessão/boost não comprova matchmaking nem disponibilidade oficial.

## Cadência operacional — sem automação externa

Estas são rotinas documentadas; este projeto não cria cron, GitHub Actions, webhook, mensagem, e-mail ou agenda externa.

- Semanal: build, testes do guia, contagens, paridade, assets, schemas, links internos e smoke test.
- Mensal: status online, Versus/boost, links bloqueados ou inconclusivos, vídeos, feedback e claims voláteis.
- Trimestral: matriz dos 71 troféus, diferenças de versão, estimativas, rotas, DLCs e amostra de fontes.
- Por evento: comunicado da Capcom, mudança PSN, encerramento de servidor, remoção de fonte, pico de relatos ou regressão de produção.

Não há configuração de CI neste repositório. Portanto, nenhum workflow foi adicionado. Quando CI existir, os comandos abaixo podem ser incorporados sem alterar suas regras de falha.

## Comandos

```text
npm run audit:guide -- resident-evil-5
npm run audit:links -- resident-evil-5
npm run test:re5:governance
npm run test:guide -- resident-evil-5
npm run test:seo
npm run build
node scripts/qa-re5-phase9.js
node scripts/generate-re5-phase9-quality.js
```

`audit:guide` falha com exit code não zero para contagem, unicidade, manifest, camada, schema, data, claim ou superfície determinística incorreta. `audit:links` usa User-Agent identificado, concorrência 2, timeout, no máximo quatro redirects, HEAD seguido de GET leve e leitura limitada. `404`, `410`, erro 5xx persistente, redirect excedido, asset/fragment ausente e conteúdo incompatível são falhas. `403`, `429`, antibot e timeout são `BLOCKED`, `RATE_LIMITED` ou `INCONCLUSIVE`: geram alerta e revisão humana, nunca tentativa de bypass.

Os servidores locais dos audits e do QA usam uma cópia temporária de `database.sqlite` dentro do diretório temporário do sistema. Migrações de startup, sessões de browser e dados de teste são descartados com essa cópia; o banco real é aberto apenas em modo read-only para as verificações de paridade e contagem.

Alertas de obsolescência são gerados quando `nextReviewAt` vence ou quando uma fonte entra em `BROKEN`/`CONTENT_MISMATCH`. Alertas não editam o guia.

## Arquitetura e pontos de edição

- `src/data/sampleGames.js`: conteúdo canônico do guia; conecta o RE5 à governança.
- `src/data/residentEvil5Governance.js`: registro de fontes, claims, classificações, datas, política online e projeção pública.
- `data/guides/resident-evil-5.json`: snapshot exportado; nunca deve ser alterado isoladamente sem sincronizar e auditar o seed.
- `src/shared/re5GovernanceValidators.js`: regras determinísticas; não contém fatos do jogo.
- `src/app.js` e `public/js/ui-guide.js`: SSR e hidratação; qualquer mudança pública equivalente precisa permanecer em paridade.
- `public/assets/guides/resident-evil-5/`: figuras. SVG, `alt`, fallback textual, caption e checklist relacionado precisam ser revisados juntos.
- `public/js/app-feedback.js` e `src/services/feedback.service.js`: contrato público/servidor do feedback.

Não editar isoladamente snapshot, JSON-LD, FAQ renderizada, SVG, `alt`, fallback, meta description ou sitemap. O seed/registro comum deve ser atualizado primeiro e os audits precisam provar todas as projeções.

Para adicionar uma fonte, inclua o registro completo, associe claims existentes nos dois sentidos, defina A–D e execute os dois audits. Para uma nova claim sensível, declare todas as superfícies e uma fonte existente antes de usar `VERIFIED`.

Para atualizar uma figura, altere o asset, caption, `alt`, fallback e âncora/checklist correspondente; depois valide desktop, mobile e asset local. Para alterar FAQ, localize a claim, confira as outras superfícies e atualize o snapshot no mesmo conjunto. Para revisar o online, preserve linguagem temporária, registre evidência/data/próxima revisão e nunca derive `OFFLINE` de uma única tentativa.

## Publicação e Definition of Done

Este playbook não executa deploy. Um publicador autorizado deve, fora desta fase:

1. revisar o diff isolado ao RE5 e aos mecanismos compartilhados estritamente necessários;
2. confirmar fonte/claim, impacto, testes e changelog quando a mudança for pública;
3. executar os comandos locais e a CI existente, quando houver;
4. publicar somente estado `VERIFIED`;
5. conferir página, API, SSR e DOM após a publicação;
6. acionar o rollback seguro se qualquer camada divergir.

Definition of Done:

- contagens, IDs e nomes únicos corretos;
- seed, snapshot, manifest, DB, API, SSR e DOM coerentes;
- fonte e claim válidas para toda informação sensível alterada;
- figuras, alt e fallback sem divergência;
- JSON-LD, descriptions, anchors e datas coerentes;
- feedback seguro e sem PII técnica desnecessária;
- testes determinísticos, link audit e QA visual registrados;
- revisão humana identificada;
- changelog/data alterados apenas para mudança editorial substancial;
- nenhum dado de usuário, anúncio, tracker, secret, tarefa externa, commit ou deploy incluído por este processo.

## Rollback seguro

1. Pausar a publicação; não executar `git reset --hard` nem apagar banco.
2. Preservar o snapshot atual e registrar seu SHA-256.
3. Selecionar o snapshot editorial anterior conhecido e revisar o diff somente do RE5.
4. Restaurar apenas dados editoriais do RE5; tabelas de usuário, biblioteca, progresso e checklist ficam intocadas.
5. Executar `audit:guide`, `audit:links`, testes do guia e QA visual.
6. Publicar novamente apenas após `VERIFIED`.

Backups do banco criados por ferramentas de exportação são somente uma rede de segurança; não autorizam restauração destrutiva. Um rollback de conteúdo nunca depende de reverter progresso de usuário.

## Registros e retenção pública

Os artefatos técnicos ficam em `artifacts/re5-phase9/` e podem conter status, contagens, hashes, tempos e nomes de checks. O relatório consolidado lê apenas a contagem de feedbacks abertos: mensagem, e-mail e apelido não entram no artefato. O changelog público permanece compacto e exclusivamente editorial.
