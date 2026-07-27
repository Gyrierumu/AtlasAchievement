# Resident Evil 5 V2 — proposta de dispensa editorial do Versus

Data de preparação: 2026-07-27

Estado: **DISPENSA NÃO APROVADA**

Este documento prepara a Rota B sem assinar ou aprovar a decisão em nome de uma pessoa. A ausência de teste não é apresentada como confirmação de funcionamento.

```text
waiverStatus: NAO_APROVADA
decisionId: RE5-VERSUS-2026-07-27-01
game: resident-evil-5
scope: modo Versus e conteúdo de 100%
reason: consoles, contas PSN e quatro jogadores não foram disponibilizados
evidenceAvailable: listagem oficial PS4/Versus, status geral PSN e fontes secundárias contemporâneas
evidenceMissing: lobby, partidas, progresso, ataque físico, estabilidade e compatibilidade PS4/PS5 observados
risk: ALTO
publicImpact: risco de orientar o leitor a uma rota online sem confirmação prática contemporânea
mitigations: separar platina de 100%, manter aviso de incerteza e agendar teste com quatro jogadores
approvedBy: PENDENTE_DE_DECISAO_HUMANA
role: PENDENTE_DE_DECISAO_HUMANA
approvedAt: PENDENTE_DE_DECISAO_HUMANA
expiresAt: PENDENTE_DE_DECISAO_HUMANA
nextValidationDate: 2026-08-26
revalidationOwner: PENDENTE_DE_DECISAO_HUMANA
revalidationMethod: executar integralmente resident-evil-5-v2-versus-validation.md
publicationDecision: PENDENTE
proposedWaiverLevel: A
```

## Decisão proposta

Recomendação técnica, sujeita a decisão humana:

```text
Dispensa A — publicar platina, segurar 100%
```

É a opção de menor risco porque a platina usa os 51 troféus-base e não depende do Versus, enquanto os dez troféus do modo online integram o 100%.

Esta recomendação não é aprovação editorial. Até que os campos `approvedBy`, `role`, `approvedAt`, `expiresAt`, `revalidationOwner` e `publicationDecision` sejam preenchidos por uma pessoa autorizada, o estado permanece:

```text
DISPENSA NÃO APROVADA
```

## Avaliação das alternativas

| Nível | Impacto | Condição humana necessária | Estado |
| --- | --- | --- | --- |
| A — publicar platina, segurar 100% | Preserva o conteúdo-base e não promete disponibilidade do Versus | Aprovação editorial e separação/publicação tecnicamente suportada | recomendado, não aprovado |
| B — publicar 100% com aviso | Expõe o leitor a incerteza online declarada | Aprovação editorial explícita e revisão do aviso público | não aprovado |
| C — não publicar | Evita risco factual, mas retém também o conteúdo-base | Decisão editorial explícita | não aprovado |

## Risco

As páginas oficiais ainda anunciam Versus e multiplayer PS4, mas não foi observada uma partida real. Relatos recentes de procura por jogadores não demonstram sucesso de lobby ou conclusão. Os riscos são:

- disponibilidade regional ou por horário desconhecida;
- baixa população;
- falhas de NAT, conta ou assinatura confundidas com indisponibilidade do serviço;
- compatibilidade PS4/PS5 não observada;
- progresso dos troféus não observado;
- recomendação de 100% baseada somente em evidência histórica.

## Mitigações

1. Preferir Dispensa A até o teste completo.
2. Manter explícita a separação entre platina e 100%.
3. Não alterar os requisitos 15/15/15/15 e 50 sem revisão factual.
4. Agendar quatro testadores e registrar região/NAT sem dados pessoais.
5. Definir validade máxima de 30 dias a partir da assinatura.
6. Revalidar antes da publicação se a data proposta de 2026-08-26 for alcançada.
7. Não editar Snapshot ou manifesto neste bloco.

## Texto público proposto somente para eventual Dispensa B

> O modo Versus integra o 100%, mas sua disponibilidade online pode variar. A última validação prática completa ainda está pendente; confirme o acesso aos lobbies antes de iniciar a rota.

Esse texto ainda precisa de revisão editorial. Sua presença aqui não autoriza inserção no Snapshot.

## Aprovação humana obrigatória

| Campo | Preenchimento |
| --- | --- |
| `approvedBy` | pendente; deve ser uma pessoa identificável no registro interno |
| `role` | Responsável editorial, técnico ou pela publicação |
| `approvedAt` | pendente, ISO `YYYY-MM-DD` |
| `decision` | A, B ou C |
| `expiresAt` | pendente; no máximo 30 dias após aprovação |
| `revalidationOwner` | pendente |

`Codex`, `ChatGPT`, `Automação` e `Sistema` são aprovadores inválidos.

## Solicitação editorial futura

Se uma pessoa aprovar a Dispensa B:

1. abrir solicitação separada;
2. indicar a seção pública de Versus/100%;
3. anexar o texto aprovado;
4. citar a decisão e o prazo;
5. registrar fonte, confiança e impacto;
6. executar transformação e round-trip em bloco separado.

Nenhum dado do guia foi alterado nesta etapa.

## Relação com a release

O resultado deste bloco não remove os bloqueadores do Bloco 7B.

Mesmo uma dispensa assinada não aprovaria Linux, staging, backup, restauração, rollback autenticado, observabilidade ou produção.
