# Resident Evil 5 V2 — validação contemporânea do Versus

Data de preparação: 2026-07-27

Branch: `release/resident-evil-5-v2-rc`

HEAD de entrada: `4caae7ba0567b3b7e18a1a8912d826050f5f244f`

## Estado

**PENDENTE DE EXECUÇÃO HUMANA**

**TESTE VERSUS NÃO EXECUTADO**

Não foram fornecidos console, contas PSN de teste, cópia executável do jogo, participantes reais ou evidência de uma partida contemporânea. Fontes externas foram usadas somente como contexto; nenhuma delas foi convertida em prova de lobby, partida, progresso ou desbloqueio.

```text
recordVersion: 1
classification: NAO_EXECUTADO
humanExecution: PENDENTE_DE_EXECUCAO_HUMANA
testedAt: NAO_EXECUTADO
timezone: America/Sao_Paulo
country: Brasil
region: NAO_INFORMADA
networkType: NAO_INFORMADO
natType: NAO_INFORMADO
platformHardware: NAO_DISPONIBILIZADO
applicationVersion: NAO_OBSERVADA
nativeGameVersion: PS4_ALVO_NAO_OBSERVADO
executionMode: NAO_EXECUTADO
psnStatus: NAO_VERIFICADO_NO_CONSOLE
testerCount: 0
accountCount: 0
```

## Ambiente de teste

| Campo | Resultado |
| --- | --- |
| `testedAt` | `NÃO EXECUTADO` |
| `timezone` | `America/Sao_Paulo` |
| `country` | Brasil, apenas como contexto da consulta; não houve teste |
| `region` | não informada |
| `networkType` | não informado |
| `natType` | não informado |
| `platformHardware` | não disponibilizado |
| `applicationVersion` | não observada |
| `nativeGameVersion` | PS4 é o alvo obrigatório; não observada |
| `executionMode` | não executado |
| `psnStatus` | não verificado em console |
| `testerCount` | 0 |
| `accountCount` | 0 |

Valores válidos para uma execução futura:

```text
nativeGameVersion = PS4
executionMode = PS4 console
```

ou:

```text
nativeGameVersion = PS4
executionMode = PS5 backward compatibility
```

`nativeGameVersion = PS5` é inválido para este protocolo.

## Pré-condições

- [ ] Resident Evil 5 versão PS4 instalado
- [ ] Jogo atualizado
- [ ] Conteúdo Versus disponível
- [ ] Conta de teste com acesso online
- [ ] PSN verificada no console
- [ ] Quatro jogadores disponíveis
- [ ] Região de todos os participantes registrada
- [ ] Comunicação externa disponível
- [ ] Área restrita para evidências preparada
- [ ] Processo para ocultar IDs PSN confirmado

Falha de assinatura, NAT, conta, DLC, versão, manutenção da PSN, região ou rede deve ser registrada como falha de pré-condição. Isoladamente, ela não classifica o Versus como indisponível.

## Acesso ao modo

| Controle | Resultado | Evidência |
| --- | --- | --- |
| Menu Versus aparece | `NOT_EXECUTED` | nenhuma |
| Modos aparecem | `NOT_EXECUTED` | nenhuma |
| Criação de lobby | `NOT_EXECUTED` | nenhuma |
| Busca de lobby | `NOT_EXECUTED` | nenhuma |
| Convite | `NOT_EXECUTED` | nenhuma |
| Segundo jogador entra | `NOT_EXECUTED` | nenhuma |

## Modos

| Modo | Jogadores | Lobby | Início | Conclusão | Progresso | Resultado |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Slayers | 0/2 | `NOT_EXECUTED` | `NOT_EXECUTED` | `NOT_EXECUTED` | `NOT_EXECUTED` | `NOT_EXECUTED` |
| Survivors | 0/2 | `NOT_EXECUTED` | `NOT_EXECUTED` | `NOT_EXECUTED` | `NOT_EXECUTED` | `NOT_EXECUTED` |
| Team Slayers | 0/4 | `NOT_EXECUTED` | `NOT_EXECUTED` | `NOT_EXECUTED` | `NOT_EXECUTED` | `NOT_EXECUTED` |
| Team Survivors | 0/4 | `NOT_EXECUTED` | `NOT_EXECUTED` | `NOT_EXECUTED` | `NOT_EXECUTED` | `NOT_EXECUTED` |

Para cada modo executado, anexar em registro restrito:

```text
mode
playerCount
lobbyCreated
lobbyJoined
matchStarted
matchCompleted
resultScreenObserved
progressObserved
connectionIssues
errorCodes
evidenceReference
confidence
```

## Ataques físicos

| Controle | Resultado |
| --- | --- |
| Ataque físico válido | `NOT_EXECUTED` |
| Eliminação confirmada | `NOT_EXECUTED` |
| Progresso/estatística observado | `NOT_EXECUTED` |
| Distinção de finalização por arma | `NOT_EXECUTED` |
| Evidência | nenhuma |
| Confiança | nenhuma |

Não é necessário atingir cinquenta eliminações para validar o registro da mecânica. O requisito editorial de 50 não deve ser alterado sem evidência direta e revisão posterior.

## PS4 e PS5

| Controle | Resultado |
| --- | --- |
| PS4 executando versão PS4 | `NOT_EXECUTED` |
| PS5 executando versão PS4 por retrocompatibilidade | `NOT_EXECUTED` |
| Lobby entre os dois hardwares | `NOT_EXECUTED` |
| Partida concluída | `NOT_EXECUTED` |
| Progresso/reconexão | `NOT_EXECUTED` |

Uma futura combinação PS4/PS5 representa a mesma aplicação e a mesma lista PS4 em hardwares diferentes, não uma versão nativa PS5 nem listas distintas.

## Estabilidade

| Controle | Resultado |
| --- | --- |
| Saída voluntária e nova busca | `NOT_EXECUTED` |
| Nova entrada | `NOT_EXECUTED` |
| Desconexão controlada | `NOT_EXECUTED` |
| Comportamento dos demais jogadores | `NOT_EXECUTED` |
| Reconexão | `NOT_EXECUTED` |
| Nova partida | `NOT_EXECUTED` |
| Erros e repetibilidade | `NOT_EXECUTED` |

## Evidências

| Referência | Tipo | Conteúdo | Dados ocultados |
| --- | --- | --- | --- |
| Nenhuma | — | Nenhuma evidência de console, lobby, partida ou troféu foi fornecida | não aplicável |

Evidência futura com dados pessoais não deve entrar no repositório. Use `Tester A`, `Tester B`, `Tester C` e `Tester D`, e armazene capturas/vídeos em local externo restrito com IDs, avatares, mensagens, notificações e nomes ocultados.

## Fontes complementares

| Fonte | Publicada/observada | Acessada | Claim limitado | Confiança |
| --- | --- | --- | --- | --- |
| [PlayStation Store — Resident Evil 5](https://store.playstation.com/en-us/product/UP0102-CUSA04437_00-RE5HDPS400000000) | produto PS4 de 2016; página ativa em 2026 | 2026-07-27 | Lista versão PS4, Versus incluído, PS Plus e até quatro jogadores online; informa execução no PS5 por retrocompatibilidade | alta para metadados da loja; nenhuma para partida atual |
| [Status da PlayStation no Brasil](https://status.playstation.com/pt-BR/) | estado dinâmico | 2026-07-27 | Contexto geral da PSN; não é monitor específico do RE5 | média para PSN geral; nenhuma para Versus |
| [Manual oficial web da Capcom](https://game.capcom.com/manual/bio5/) | manual histórico | 2026-07-27 | Confirma a família de versões e a documentação oficial; não comprova serviço contemporâneo | alta para contexto histórico; nenhuma para disponibilidade atual |
| [Lista PS4 com 71 troféus](https://www.playstationtrophies.org/game/resident-evil-5-ps4/trophies/) | lista consultada em 2026 | 2026-07-27 | Confirma a estrutura pública de 71 troféus; não comprova desbloqueio contemporâneo | média |
| [Pedido recente por jogadores de Team Versus](https://www.reddit.com/r/residentevil5online/comments/1v32wdn/looking_for_help_with_the_team_versus_trophies/) | 2026-07-22 | 2026-07-27 | Indica procura contemporânea por participantes; não registra partida concluída | baixa; evidência secundária |

As fontes indicam que o produto e seu suporte anunciado continuam listados e que há interesse recente. Isso não demonstra criação de lobby, conclusão de partida, estabilidade ou progresso.

## Classificação

```text
NÃO EXECUTADO
```

Motivo: jogadores, contas, consoles e autorização operacional não foram disponibilizados. Não há evidência forte para `INDISPONÍVEL`, nem partida real para `APROVADO`, `PARCIAL` ou `FALHOU`.

Impacto editorial:

- os requisitos atuais podem permanecer como conteúdo aprovado historicamente;
- não há confirmação contemporânea para declarar o 100% operacional;
- a platina continua independente do Versus;
- a publicação integral do 100% exige teste aprovado ou dispensa humana válida;
- nenhuma alteração de Snapshot ou manifesto foi autorizada.

## Entrega para execução humana

O responsável humano deve duplicar e preencher este registro, trocar `classification`, registrar apenas referências sanitizadas e obter confirmação escrita de dois testadores quando não houver vídeo completo.

Critério de `APROVADO`:

- [ ] menu acessível;
- [ ] lobby criado;
- [ ] segundo jogador entrou;
- [ ] Slayers concluído;
- [ ] Survivors concluído;
- [ ] Team Slayers concluído com quatro jogadores;
- [ ] Team Survivors concluído com quatro jogadores;
- [ ] ataque físico validado;
- [ ] nenhuma limitação crítica;
- [ ] evidências registradas.

## Privacidade e integridade

Não registrar IDs PSN, nomes pessoais, e-mails, endereços IP, tokens, credenciais ou capturas sem sanitização. Não usar vídeo antigo como prova contemporânea. Não inferir encerramento por ausência de lobby público e não inferir funcionamento apenas porque a loja ou o menu estão acessíveis.

## Relação com o Bloco 7B

O resultado deste bloco não remove os bloqueadores do Bloco 7B.

Linux, staging, backup, restauração, progresso autenticado, rollback, observabilidade, responsável da janela e autorização de produção continuam pendentes.
