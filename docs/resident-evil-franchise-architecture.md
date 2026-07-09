# Resident Evil — arquitetura futura de franquia

Este documento prepara a base editorial e técnica para um futuro hub `Resident Evil — Guias de Platina e Troféus`.

Status atual: rascunho interno. Não publicar rota, sitemap, canonical, breadcrumb ou link de navegação enquanto o hub não cumprir os critérios abaixo.

## Metadados recomendados

Quando o schema/banco aceitar metadados de franquia, usar:

- `franchise`: `Resident Evil`
- `publisher`: `Capcom`
- `developer`: `Capcom` ou estúdio responsável quando diferente
- `genre`: `Survival Horror / Action`, ajustado por jogo quando necessário
- `platforms`: plataformas cobertas pelo guia; para Resident Evil 5, a plataforma principal editorial é `PS4`
- `releaseYear` ou `release_year`: ano do lançamento da versão coberta

Observação: em `data/guides`, os campos persistidos hoje seguem as colunas exportadas/importadas pelo banco. Não adicionar campo público novo que será descartado pelo `export:data` sem antes atualizar schema e pipeline.

## Slugs futuros

Padrão recomendado:

- `/jogo/resident-evil`
- `/jogo/resident-evil-2-remake`
- `/jogo/resident-evil-3-remake`
- `/jogo/resident-evil-4-remake`
- `/jogo/resident-evil-5`
- `/jogo/resident-evil-6`
- `/jogo/resident-evil-7-biohazard`
- `/jogo/resident-evil-village`

Regras:

- usar slugs curtos, sem acentos e sem plataforma;
- incluir plataforma no slug só se existir conflito real entre versões;
- diferenciar original/remake pelo nome canônico usado pelo guia.

## Anchors internos premium

Padrão geral para guias premium:

- `#roadmap`
- `#checklist`
- `#extras-da-platina`
- `#dlcs-100-lista`, apenas quando houver DLC/100%
- anchors específicos para coletáveis, DLCs ou troféus de alta intenção.

Resident Evil 5 deve manter:

- `#re5-versus-dlc`
- `#re5-lost-in-nightmares-score-stars`
- `#re5-desperate-escape-agitator-majini`

Regras:

- IDs únicos por página;
- links internos rastreáveis com `<a href="#...">`;
- sitemap e canonical sempre sem hash.

## RelatedFranchiseGuides

Comportamento esperado:

- receber uma franquia, por exemplo `Resident Evil`;
- buscar apenas guias publicados/verificados da mesma franquia;
- excluir o guia atual;
- renderizar somente se houver pelo menos 2 guias relacionados reais;
- usar `<a href="/jogo/...">` com texto descritivo;
- nunca linkar páginas futuras inexistentes.

Não publicar bloco de franquia se existir apenas o guia atual.

## Futuro hub Resident Evil

Título sugerido:

`Resident Evil — Guias de Platina e Troféus`

Seções futuras:

1. Guias de platina da franquia.
2. Ordem recomendada para começar.
3. Jogos com DLC/100% separado.
4. Jogos com coletáveis críticos.
5. Guias mais rápidos.
6. Guias mais difíceis.
7. Todos os guias Resident Evil no Atlas.

Critérios mínimos para publicar:

- pelo menos 3 guias Resident Evil publicados e verificados;
- cada guia com title, meta description e canonical próprios;
- texto útil de orientação, não só lista de links;
- links internos reais e rastreáveis;
- hub em `noindex,follow` enquanto estiver em rascunho;
- sitemap só após publicação editorial.

## Regras de linkagem futura

- Linkar entre guias da franquia apenas quando a relação ajudar o usuário.
- Limitar a 2–4 links relacionados no fim de cada guia.
- Variar anchors naturalmente:
  - `guia de platina de Resident Evil 4 Remake`
  - `guia de troféus de Resident Evil 2 Remake`
  - `Resident Evil 5 — guia de platina e DLCs`
- Não repetir o mesmo anchor em todas as páginas.
- Não criar links para páginas futuras inexistentes.
- Não usar `clique aqui`.
- Não criar hub fraco para SEO.
