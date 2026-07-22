# Resident Evil 5 — contrato de analytics e observabilidade

Versão do contrato: 1.0  
Escopo: `/jogo/resident-evil-5`  
Estado inicial: `RE5_PRODUCT_ANALYTICS_ENABLED=false`, `RE5_CWV_ENABLED=false`

## Princípios

Este contrato mede utilidade agregada sem criar perfil individual. O cliente só envia eventos quando a flag interna está habilitada **e** um adaptador de consentimento aprovado responde `AtlasConsent.hasConsent('analytics') === true`. A ausência do adaptador equivale a recusa. O transporte é first-party, para `/api/analytics/events`, com `credentials: 'omit'`; nenhuma tag externa é instalada por esta implementação.

Nunca enviar:

- nome, username, e-mail, IP coletado no frontend ou identificador publicitário próprio;
- texto de comentários, formulários ou busca;
- URL completa, query string, hash livre ou referrer completo;
- conteúdo do localStorage, IDs/nomes de troféus ou a lista individual concluída;
- stack, mensagem de erro, cookies, tokens ou headers;
- valor livre que possa gerar cardinalidade ilimitada.

O campo `page` é sempre `/jogo/resident-evil-5`; `gameSlug` é sempre `resident-evil-5`. Propriedades desconhecidas são descartadas no cliente e novamente no servidor.

## Categorias de armazenamento e consentimento

| Categoria | Exemplos | Comportamento sem consentimento |
|---|---|---|
| Essencial | checklist local e preferências funcionais já existentes | continua funcionando |
| Preferências | densidade e estado visual do guia | continua conforme a política vigente do produto |
| Analytics | eventos deste documento e Core Web Vitals | não envia e não grava o marcador agregado de retorno |
| Publicidade | futura chamada de anúncio | não carrega; placeholders de teste não fazem chamada real |

Este código não é uma CMP. Antes de ativar analytics/publicidade onde consentimento for exigido, o proprietário precisa integrar uma CMP aprovada e submeter sua configuração à revisão jurídica independente.

## Propriedades contextuais fechadas

- `initial_tab`: `summary`, `roadmap`, `checklist`, `extras`, `dlc`, `attention`.
- `source`: `hero`, `tab`, `anchor`, `next_action`, `utility`, `unknown`.
- `progress_bucket`: `0%`, `1-24%`, `25-49%`, `50-74%`, `75-99%`, `100%`.
- `device_class`: `mobile` ou `desktop`.
- `connection_bucket`: `slow-2g`, `2g`, `3g`, `4g`, `unknown`.
- `ad_state`: `none`, `reserved`, `loaded`.
- `frontend_version`: versão técnica limitada a 64 caracteres `[A-Za-z0-9._-]`.

## Contrato por evento

Em todas as linhas, “proibido comum” referencia a lista de dados proibidos acima. Cada exemplo mostra apenas `metadata`; o envelope acrescenta `eventType`, `page` e `gameSlug`.

| Evento | Descrição e gatilho | Propriedades permitidas | Propriedades proibidas | Base/configuração | Exemplo | Teste obrigatório |
|---|---|---|---|---|---|---|
| `guide_view` | Uma vez por carregamento elegível do guia. | `entry_context`, `initial_tab`, `visit_type` | referrer/URL completos; proibido comum | analytics + consentimento | `{"entry_context":"direct","initial_tab":"summary","visit_type":"first"}` | duas inicializações produzem no máximo um evento |
| `guide_tab_open` | Abertura explícita de aba sem evento mais específico. | `tab`, `interaction` | texto do botão; proibido comum | analytics + consentimento | `{"tab":"attention","interaction":"keyboard"}` | mouse e teclado; nenhuma duplicação |
| `guide_anchor_open` | Clique explícito em anchor interno não especializado. | `anchor_group` | hash/anchor livre; proibido comum | analytics + consentimento | `{"anchor_group":"professional"}` | somente grupos enumerados |
| `guide_internal_search` | Busca interna após debounce de 650 ms. | `query_length_bucket`, `result_count_bucket` | **query**, termos e resultados individuais | analytics + consentimento | `{"query_length_bucket":"5-10","result_count_bucket":"11-25"}` | afirmar que o texto digitado não aparece no payload |
| `guide_filter_change` | Mudança explícita de filtro/densidade. | `filter`, `value` | rótulo livre; proibido comum | analytics + consentimento | `{"filter":"density","value":"compact"}` | valores fora do enum são descartados |
| `roadmap_start` | Primeira abertura explícita do roadmap. | `source` | etapa/conteúdo livre | analytics + consentimento | `{"source":"hero"}` | dispara uma vez por carregamento |
| `roadmap_step_open` | Clique em abrir/marcar uma etapa. | `step_index` de 1 a 7 | título/texto da etapa | analytics + consentimento | `{"step_index":3}` | rejeitar 0, 8, decimal e string livre |
| `checklist_open` | Primeira abertura explícita do checklist. | `source` | conteúdo/checklist | analytics + consentimento | `{"source":"tab"}` | dispara uma vez por carregamento |
| `checklist_first_toggle` | Primeira interação com qualquer troféu. | `progress_bucket` | ID/nome/tipo do troféu | analytics + consentimento | `{"progress_bucket":"1-24%"}` | payload não identifica o troféu |
| `checklist_progress_milestone` | Primeira entrada em cada faixa posterior de progresso. | `progress_bucket` | contagem exata e lista concluída | analytics + consentimento | `{"progress_bucket":"50-74%"}` | no máximo um evento por faixa/carregamento |
| `next_action_open` | Clique na próxima ação recomendada. | `target_group` | título/texto livre | analytics + consentimento | `{"target_group":"roadmap"}` | um evento para o clique |
| `instructional_visual_view` | Abertura explícita de um visual por link/controle. Nunca por scroll automático. | `visual_id` fechado | URL/alt/texto livre | analytics + consentimento | `{"visual_id":"score-stars-route"}` | scroll isolado não dispara |
| `source_link_open` | Clique em fonte editorial externa. | `source_group` | URL completa, título e query | analytics + consentimento | `{"source_group":"official"}` | domínio vira grupo, não URL |
| `video_link_open` | Clique em vídeo de apoio. | `video_group` | URL, timestamp e ID livre | analytics + consentimento | `{"video_group":"bsaa"}` | IDs conhecidos viram grupo fechado |
| `guide_save` | Salvar/remover o guia da biblioteca. | `action` | usuário, conta, biblioteca | analytics + consentimento | `{"action":"saved"}` | nenhuma identificação de conta |
| `guide_copy_link` | Copiar link por controle explícito. | `target_group` | clipboard e URL completa | analytics + consentimento | `{"target_group":"checklist"}` | conteúdo copiado nunca é lido/enviado |
| `report_problem_open` | Abrir o fluxo para reportar problema. | `source` | mensagem, nome, e-mail | analytics + consentimento | `{"source":"hero"}` | mede abertura, não submissão/conteúdo |
| `dlc_package_open` | Abertura explícita de pacote de DLC. | `package` | nome livre | analytics + consentimento | `{"package":"lost-in-nightmares"}` | somente três pacotes enumerados |
| `versus_route_open` | Abertura explícita da rota Versus. | `source` | sessão, jogador ou disponibilidade livre | analytics + consentimento | `{"source":"anchor"}` | um evento especializado, sem `guide_anchor_open` simultâneo |
| `score_stars_open` | Abertura explícita da rota de 18 Score Stars. | `source` | item/timestamp individual | analytics + consentimento | `{"source":"anchor"}` | um evento especializado |
| `agitators_open` | Abertura explícita da rota de Agitators. | `source` | gatilho/item individual | analytics + consentimento | `{"source":"anchor"}` | um evento especializado |
| `guide_web_vital` | Uma amostra por métrica/carregamento elegível. | `metric`, `value_ms` ou `value`, `rating`, `device_class`, `connection_bucket`, `initial_tab`, `frontend_version`, `ad_state` | URL/query, UA, IP frontend, ID de sessão | analytics + CWV + consentimento | `{"metric":"LCP","value_ms":2180,"rating":"good","device_class":"mobile","connection_bucket":"4g","initial_tab":"summary","frontend_version":"4.0.0","ad_state":"none"}` | métricas deduplicadas e flags/consentimento obrigatórios |

## Funil e métricas de produto

Funil principal, sempre agregado:

1. `guide_view`;
2. `roadmap_start` ou `checklist_open`;
3. primeira interação útil (`checklist_first_toggle`, busca, filtro ou próxima ação);
4. `checklist_progress_milestone`;
5. novo `guide_view` com `visit_type=returning`, sem ID persistente transmitido.

Taxas devem usar `guide_view` como denominador e explicitar a janela. Tempo de permanência isolado não é métrica de qualidade.

O endpoint administrativo de métricas agrega esses dados em `residentEvil5` numa janela de 90 dias. A saída expõe somente contagens, taxas, grupos fechados e p75 elegível; nunca devolve payloads individuais, texto de busca ou identidade/lista de troféus.

## Core Web Vitals de campo

Métricas: LCP, INP, CLS, TTFB e FCP. Segmentação permitida: mobile/desktop, conexão em bucket, aba inicial, versão do frontend e estado de anúncios. O pathname é constante e normalizado.

Metas no p75: LCP ≤ 2,5 s; INP ≤ 200 ms; CLS ≤ 0,1. Um segmento só pode receber avaliação quando tiver **ao menos 200 amostras válidas por métrica, coletadas em pelo menos 7 dias e distribuídas em pelo menos 3 dias distintos**. Abaixo disso, mostrar `dados insuficientes`; não combinar segmentos apenas para produzir um resultado favorável.

## Prevenção de duplicidade e cardinalidade

- inicialização idempotente;
- `guide_view`, primeiro checklist, início do roadmap e cada CWV têm chave de deduplicação;
- eventos especializados substituem o genérico no mesmo clique;
- nenhuma emissão em SSR, renderização repetida ou scroll automático;
- enums fechados e números limitados no cliente e no servidor;
- nenhum evento contém texto livre.

## Error monitoring desacoplado

`AtlasRe5Production.reportError(kind, context)` só encaminha para um adaptador aprovado preexistente em `AtlasErrorMonitoring.capture`. Sem adaptador/flag, retorna `false` e não armazena nada. O envelope permite apenas categoria e componente enumerados, pathname fixo e versão; mensagem, stack, tokens, cookies, headers, parâmetros e formulários nunca são passados. Há limite local de cinco grupos/minuto e deduplicação do mesmo grupo por um minuto, evitando loop de telemetria.

## Testes

- `node scripts/test-re5-phase8-events.js`: contrato, buckets, propriedades proibidas, flags servidor e escopo RE5.
- `node scripts/qa-re5-phase8.js`: consentimento ausente/recusado/aceito simulado, deduplicação, busca sem texto, checklist sem ID, placeholders, no-fill, tag bloqueada, mobile/desktop, teclado e regressões.
- Lighthouse com e sem placeholders: comparação de performance e acessibilidade sem rede de anúncios real.

Passar testes técnicos não constitui declaração de conformidade LGPD/GDPR. A ativação exige revisão jurídica independente.
