# Auditoria Google AdSense — conteúdo de baixo valor

Data da validação: 9 de julho de 2026.

## Resultado

O HTML SSR foi isolado por rota. Páginas institucionais, catálogo, biblioteca, perfil e guias não entregam mais as demais views ocultas da SPA nem os modais globais. Guias indexáveis também não entregam os textos genéricos de carregamento.

A política de indexação de guias agora exige simultaneamente:

- status editorial publicado;
- selo e revisões com estado `verified`;
- cobertura `complete`;
- dificuldade numérica entre 1 e 10;
- tempo preenchido e sem texto de revisão;
- ao menos um troféu e uma etapa de roadmap;
- ausência dos placeholders editoriais conhecidos.

Guias que não atendem a todos os critérios recebem `meta robots="noindex,follow"`, cabeçalho `X-Robots-Tag: noindex, follow` e são removidos do sitemap.

## Arquivos alterados

- `src/app.js`: isolamento SSR, política de elegibilidade, canonical/robots, sitemap, coleções e conteúdo institucional.
- `public/index.html`: acesso à página Sobre e melhoria de texto editorial na home.
- `scripts/test-layers.js`: cobertura automatizada de noindex, sitemap, canonical, isolamento e ausência de placeholders.
- `scripts/regression-smoke.js`: expectativas do sitemap alinhadas à nova política.
- `data/guides/resident-evil-5.json`
- `src/data/sampleGames.js`
- `public/js/app-guide-controller.js`
- `public/js/ui-guide.js`

Os quatro últimos arquivos preservam ajustes editoriais/de navegação de Resident Evil 5 que já estavam no worktree durante esta auditoria. `database.sqlite`, `.env`, `node_modules` e o layout global não foram alterados.

## Rotas indexáveis

- `/`
- `/catalogo`
- facetas de catálogo com pelo menos três guias elegíveis;
- coleções editoriais com pelo menos três guias elegíveis;
- `/sobre`
- `/contato`
- `/privacidade`
- `/termos`
- `/comece-aqui`
- listas orgânicas com pelo menos três guias elegíveis;
- `/jogo/:slug` somente quando o guia atende integralmente à política acima.

Na base validada, o sitemap contém 81 URLs: home, catálogo, coleções/listas suficientes, cinco páginas institucionais e 58 guias completos e verificados.

## Rotas noindex ou excluídas

- `/biblioteca`: `noindex,follow`, fora do sitemap;
- `/perfil`: `noindex,follow`, fora do sitemap;
- `/admin` e `/admin.html`: `noindex,nofollow` e `X-Robots-Tag`, fora do sitemap;
- login, conta, editor, feedback e APIs: bloqueados no `robots.txt` quando aplicável e ausentes do sitemap;
- facetas, coleções e listas com menos de três guias elegíveis: `noindex,follow` e fora do sitemap;
- qualquer guia incompleto, em revisão, placeholder ou não verificado: `noindex,follow` e fora do sitemap.

## HTML esperado pelo crawler

Trechos simplificados; cada resposta mantém somente a view indicada, além do cabeçalho, rodapé e scripts necessários.

### `/contato`

```html
<title>Contato | AtlasAchievement</title>
<link rel="canonical" href="https://atlasachievement.com.br/contato">
<section id="view-seo-page">
  <h1>Contato</h1>
  <!-- conteúdo editorial e contato por e-mail -->
</section>
```

Sem `view-home`, `view-catalog`, `view-library`, `view-guide`, `view-profile` ou modais globais.

### `/privacidade`

```html
<title>Política de Privacidade | AtlasAchievement</title>
<link rel="canonical" href="https://atlasachievement.com.br/privacidade">
<section id="view-seo-page">
  <h1>Política de Privacidade</h1>
  <!-- política completa -->
</section>
```

### `/termos`

```html
<title>Termos de Uso | AtlasAchievement</title>
<link rel="canonical" href="https://atlasachievement.com.br/termos">
<section id="view-seo-page">
  <h1>Termos de Uso</h1>
  <!-- termos completos -->
</section>
```

### `/biblioteca`

```html
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="https://atlasachievement.com.br/biblioteca">
<section id="view-library">
  <!-- ferramenta pessoal de biblioteca -->
</section>
```

A resposta também envia `X-Robots-Tag: noindex, follow`.

### Guia verificado

```html
<title>Horizon Zero Dawn – Guia de platina e troféus</title>
<link rel="canonical" href="https://atlasachievement.com.br/jogo/horizon-zero-dawn">
<section id="view-guide">
  <!-- resumo, roadmap, checklist, conteúdo editorial e JSON-LD -->
</section>
```

Não há meta `noindex`, views concorrentes, modais globais ou textos “Carregando guia/checklist/biblioteca”.

## Validação executada

- `npm run test:seo`: passou — guias elegíveis, noindex, canonical, rotas isoladas e sitemap.
- `npm run test:quick`: passou — 105 jogos, 105 roadmaps e headers/cache.
- Respostas HTTP locais inspecionadas para contato, privacidade, termos, biblioteca, sobre, guia verificado e guia noindex.
- `npm test`: para em uma asserção preexistente e fora deste escopo: o módulo `public/js/ui-catalog.js` não contém o rótulo “Duração” esperado por `scripts/regression-smoke.js:677`.

## Checklist antes de reenviar ao AdSense

- Publicar esta versão no domínio canônico.
- Limpar cache/CDN e confirmar que o HTML de produção corresponde ao SSR validado.
- Abrir `https://atlasachievement.com.br/sitemap.xml` e confirmar que não há biblioteca, perfil, admin ou guia em revisão.
- Inspecionar no Search Console uma página institucional, uma coleção e pelo menos três guias verificados.
- Solicitar nova indexação apenas das URLs elegíveis.
- Validar que páginas noindex exibem o estado “Excluída pela tag noindex”, não erro de rastreamento.
- Corrigir links quebrados, respostas 5xx ou imagens principais ausentes antes da revisão.
- Manter novos guias fora da indexação até preencherem todos os campos de qualidade.
- Reenviar o site para análise do AdSense somente após o deploy e a recaptura das páginas principais pelo Google.
