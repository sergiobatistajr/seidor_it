# Mesa · Central de chamados

Uma fatia de um ITSM em React: consultar, assumir e abrir chamados, conversar, registrar notas internas, alterar status com motivo, reabrir e acompanhar a distribuição da equipe.

**Estado dos dados:** o `dados.json` original não foi obtido. O link do WeTransfer não disponibilizou um download acessível nesta implementação, e a consulta de transferência retornou HTTP 401. Esta entrega usa **84 chamados fictícios**, identificados na interface como demonstração. Não afirma reproduzir o schema ou o volume do material original. Integrar e validar esse material é uma pendência antes de considerar o teste completo.

## Rodar

Requisitos: **Bun 1.4.4** e **Node.js 24 LTS** (ou uma versão compatível com Next.js 16). A verificação nesta máquina utilizou Bun 1.4.4 e Node.js 26.13.1.

```sh
bun install --frozen-lockfile
bun run dev:demo
```

Abra **http://localhost:3001**. A demonstração **não exige servidor de API, PostgreSQL, Docker, conta ou credenciais**. O valor padrão `NEXT_PUBLIC_SERVER_URL` atende às rotas legadas do scaffold; a central não faz chamadas àquele servidor.

```sh
bun run test                         # testes do domínio e dos intervalos sem atribuição
bun run --cwd apps/web check-types   # checagem TypeScript
bun run build:demo                   # build de produção
bun run --cwd apps/web start --port 3001  # servir o build (pare o dev antes)
```

O `bun run dev` original ainda inicia a infraestrutura do monorepo. Para avaliar esta entrega, use **`dev:demo`**.

## Ver cada perfil

O seletor no rodapé da barra lateral alterna os perfis. No celular, abra o menu no cabeçalho. Cada aba pode estar em um perfil diferente.

| Perfil | Link | O que aparece primeiro |
| --- | --- | --- |
| Marina, consultora | http://localhost:3001/?perfil=marina | Chamados atribuídos, ordenados por prazo, e acesso à fila do grupo |
| Ricardo, gestor | http://localhost:3001/?perfil=ricardo | Carga dos 12 consultores, pessoas sem chamados e prazos em risco |
| Helena, cliente | http://localhost:3001/?perfil=helena | Seus atendimentos, quem está cuidando deles e o próximo passo |

Um chamado tem link próprio: `/?perfil=helena&chamado=chamado-0`. A visão do cliente permite apenas chamados do próprio solicitante. Abrir um link de outro cliente mostra uma mensagem de indisponibilidade.

## Roteiro de avaliação

1. **Priorizar:** como Marina, abra os prazos em atenção. Atrasados e vencimentos nas próximas duas horas aparecem antes dos demais; cor vem acompanhada de texto e ícone. Busca por assunto, número, descrição ou solicitante; filtros de status; ordenação; paginação de dez registros.
2. **Assumir:** abra a fila do grupo, escolha um chamado sem responsável e use **Assumir chamado**. Ele passa para os atendimentos de Marina.
3. **Conversar:** abra `chamado-0` como Marina e como Helena em duas abas. Envie uma resposta pelo cliente e observe a aba da consultora. Escreva um rascunho antes de enviar a mensagem na outra aba: o conteúdo é preservado.
4. **Nota interna:** na consultora, alterne para **Nota interna** e envie uma anotação. Ela aparece para a equipe e não aparece na interface, resumo ou notificações do cliente. Os rascunhos de nota e resposta são separados.
5. **Mudar status:** o responsável ou gestor usa **Alterar status**. O motivo é obrigatório e público, com aviso explícito no formulário. O histórico registra autoria, momento e transição. Um chamado fechado bloqueia novas mensagens até ser reaberto.
6. **Reabrir:** como Helena, vá a **Concluídos**, abra um atendimento e use **O problema voltou**. Informe o motivo para retornar a Recebido. Na abertura de um chamado, um título como “VPN desconecta” sugere o atendimento fechado semelhante.
7. **Redistribuir:** como Ricardo, abra um chamado e mude o responsável no painel lateral. A lista contém somente consultores do grupo. A nova carga aparece no painel e nas demais abas.
8. **Simular concorrência:** o rodapé permite enviar um evento por vez ou ativar um evento a cada 18 segundos. A sequência é mensagem → abertura → atribuição → status. Cada evento é entregue duas vezes propositalmente; a interface deve aplicar apenas uma. Os eventos automáticos começam desativados.

Atalhos: `/` foca a busca; `Ctrl + Enter` ou `⌘ + Enter` envia uma resposta. Os diálogos usam os comportamentos de foco e teclado do Base UI. Tema claro e escuro no botão ao lado do perfil.

## Decisões de produto

- **Um sistema, três prioridades.** A consultora decide o próximo atendimento pelo prazo. O gestor compara carga e risco sem precisar ler conversas. O cliente recebe contexto resumido e um próximo passo; não preenche categoria, grupo nem prioridade interna.
- **Detalhe sem perder o trabalho.** Rascunhos são separados por usuário, chamado e visibilidade. Novas mensagens mostram um aviso para ir ao final; não deslocam automaticamente uma conversa em leitura.
- **Atualização útil para quem recebe.** Notificações de Marina cobrem seus chamados; Helena vê apenas mensagens públicas de seus próprios atendimentos. O resumo do cliente usa a última resposta pública da equipe ou o motivo público da última mudança de status, conforme o mais recente.
- **Datas sem ambiguidade.** Armazenamento e eventos usam UTC. Marina e Ricardo veem `America/Sao_Paulo`; Helena vê `Europe/Lisbon`, incluindo horário de verão via `Intl`.
- **SLA explícito na demonstração.** `prazo_em` é um prazo absoluto de resolução, em horas corridas. Aguardar o cliente não pausa a contagem. Novo chamado recebe oito horas; reabertura mantém o prazo original, inclusive quando vencido, até existir uma política definida. Não inventamos um novo prazo de primeira resposta ou uma extensão silenciosa de SLA.
- **Sem confundir disponibilidade com produtividade.** A coluna “Sem chamados” integra intervalos sem nenhum chamado ativo atribuído, nos últimos sete dias e somente desde o início do período observado. Inclui horas corridas; não desconta jornada, ausência ou feriado. A interface informa que a primeira sessão não fornece uma semana completa. Uma métrica semanal real exige histórico de atribuições e uma definição de calendário operacional.
- **Simulação transparente.** A interface identifica os dados fictícios, a persistência no navegador e a sincronização local. Não indica uma conexão WebSocket real nem uma notificação por e-mail que não existe.

## Arquitetura

O monorepo Next.js/React já existia. A central fica isolada em `apps/web/src/features/tickets`:

| Arquivo | Responsabilidade |
| --- | --- |
| `domain.ts` | Tipos, schemas Zod de eventos, autorização simulada, replay, visibilidade, datas e SLA |
| `seed.ts` | Dados fictícios reproduzíveis a partir de uma data de referência |
| `store.ts` | API simulada assíncrona, IndexedDB, transporte entre abas e reconciliação |
| `metrics.ts` | Integração dos intervalos observados sem chamados |
| `workspace.tsx` | Navegação, perfis, notificações e indicadores |
| `ticket-list.tsx` | Busca, filtros, ordenação e paginação |
| `ticket-detail.tsx` | Conversa, rascunhos, notas e contexto do atendimento |
| `ticket-dialogs.tsx` | Criação e alteração de status com validação |
| `team.tsx` | Distribuição da equipe e fila em risco |

### Eventos e persistência

- Os quatro eventos seguem o envelope solicitado: `id` UUID, `tipo`, `ocorrido_em` UTC e `payload`.
- Zod valida o contrato na entrada. O log é deduplicado por ID de evento e as mensagens por ID de mensagem.
- Replay ordenado por data e UUID torna o resultado independente da ordem de chegada. A mesma mensagem repetida não duplica a conversa, e um status antigo recebido depois não sobrescreve o mais recente.
- O snapshot inicial e o log são persistidos em **IndexedDB**. A criação do snapshot usa uma transação para evitar bases diferentes quando duas abas abrem simultaneamente.
- **BroadcastChannel** propaga eventos entre abas. A reconciliação do log ao recuperar foco e a cada cinco segundos cobre mensagens perdidas e navegadores sem esse transporte.
- **Web Locks** serializa comandos concorrentes no mesmo navegador. Antes de gravar, o comando relê o log e verifica o responsável/status atual. Numeração e timestamps de comandos são definidos dentro da região serializada. Sem Web Locks, essa garantia de concorrência é reduzida.
- O estado React usa `useSyncExternalStore`. Rascunhos e marcadores de leitura usam `localStorage`, com tratamento de indisponibilidade. Falha no armazenamento de eventos mantém a sessão utilizável e mostra um aviso de persistência limitada.

Em produção, uma sequência/cursor do servidor deve resolver ordenação causal; timestamps e UUIDs, sozinhos, não bastam para eventos simultâneos. O backend deve fornecer autorização, isolamento de tenant, validação das transições, compare-and-set de atribuições, idempotência, replay após reconexão e política de SLA. Para volumes grandes, substituir o replay integral e os filtros locais por projeções incrementais, busca/paginação de servidor e snapshots compactados.

**O seletor de perfis não é autenticação.** Por ser uma demonstração sem backend, o dataset completo está no navegador. Ocultar notas na interface não constitui uma barreira de segurança contra inspeção do armazenamento. Em produção, a API e os canais de eventos do cliente devem omitir as notas internas antes de enviá-las.

Para integrar o `dados.json`, mapear seu schema para `Dataset`, validar IDs, relações, status e regras de SLA, substituir a origem do snapshot em `store.ts` e manter os componentes sobre esse contrato. O cálculo de intervalos recebe o snapshot original, não reconstrói o passado a partir da fila atual. Não há um importador genérico que prometa aceitar um arquivo cujo formato não foi visto.

### Dependências e suporte

- **Next.js 16**, linha Active LTS na política consultada em 13/11/2026; build validado em **16.4.6**. Preferimos manter a linha suportada já presente no projeto a migrar para uma major nova apenas por novidade. [Política oficial](https://nextjs.org/support-policy).
- **React 19**, validado em **19.3.1**, e TypeScript com checagem estrita. React não oferece aqui uma garantia plurianual de LTS.
- **shadcn/ui com Base UI**, preset **`b3DqK6kfYm`**, aplicado pelo CLI: **Luma, neutral, Phosphor, Roboto e JetBrains Mono nos títulos**. Os componentes da central estão em `apps/web/src/components/ui`; os tokens compartilhados estão em `packages/ui/src/styles/globals.css`. O restante do pacote de UI é do scaffold anterior.
- **Tailwind CSS 4**, Zod e Sonner já compatíveis com a base. Não foi necessária uma biblioteca adicional de gráficos: a carga usa barras neutras com escala comum, valores em tabela, tooltips e tratamento de alto contraste. Contraste das barras contra a superfície: 5,42:1 no claro e 7,09:1 no escuro.
- `bun.lock` preserva as versões efetivamente verificadas. Use `--frozen-lockfile` para reproduzir. A manutenção ao longo dos próximos anos exige patches frequentes, revisão de suporte antes do go-live e migrações de major planejadas; nenhuma versão escolhida hoje dispensa isso.

O backend Hono/oRPC, autenticação, banco e infraestrutura já presentes foram preservados. As rotas `/login` e `/dashboard` pertencem ao scaffold e não fazem parte da demonstração; dependem da API original. O contexto de queries do dashboard foi mantido no layout dessa rota.

## Verificações

- **13 testes / 115 assertions**: duplicidade de eventos, entrega fora de ordem, contratos inválidos, isolamento de clientes/notas, disputa de atribuição, status obsoleto, reabertura autorizada, limites de SLA, fixtures e intervalos de ociosidade.
- Checagem TypeScript e build de produção.
- Lint/format dos arquivos TypeScript da implementação. O CSS usa estilos por componente e breakpoints; o Biome sinaliza avisos de especificidade entre seletores independentes e `!important` nas regras de movimento reduzido.
- Validação manual em Chromium: fila, detalhe, rascunho durante evento, separação de rascunhos, nota interna oculta do cliente, resposta entre abas, redistribuição, reabertura com motivo, sugestão de chamado anterior, abertura e persistência após recarga.
- Layout conferido em **1440 × 1000** e **390 × 844**; sem transbordamento horizontal no cenário móvel avaliado. Isso não substitui uma matriz de testes entre navegadores e leitores de tela.

Para reiniciar a demonstração, feche suas abas e remova o armazenamento de `localhost:3001` nas ferramentas do navegador (IndexedDB `chamados-demo-v1` e chaves de rascunho/leitura). Isso apaga apenas os dados locais dessa demonstração. Os testes do domínio não alteram esse armazenamento.

## Entrega por git bundle

O bundle preserva o commit inicial e os commits da implementação. Para abrir uma cópia:

```sh
git clone mesa-itsm.bundle mesa-itsm
cd mesa-itsm
git switch feat/chamados-workspace
bun install --frozen-lockfile
bun run dev:demo
```

O projeto também está disponível no repositório público [sergiobatistajr/seidor_it](https://github.com/sergiobatistajr/seidor_it), conforme solicitado pelo proprietário. O histórico foi preservado e a branch principal é `main`. Por ser público, o código pode ser consultado sem convite de colaborador. O aviso ao avaliador não foi enviado.
