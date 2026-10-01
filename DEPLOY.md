# PlayMedia System — Deploy na Vercel

Sistema completo de gestão financeira pessoal com IA (Gemini), dashboard interativo, carteiras, cartões de crédito, produção (Kanban), comprovantes, orçamentos e assistente inteligente.

## A) Variáveis de Ambiente (Vercel)

Configure no painel da Vercel → Settings → Environment Variables:

| Nome | Formato | Descrição |
|------|---------|-----------|
| `DATABASE_URL` | `postgresql://usuario:senha@host/neon?sslmode=require` | String de conexão do Neon (PostgreSQL). Pegue no painel do Neon → Connection string. |
| `AUTH_SECRET` | string aleatória de 32+ chars | Gere com `openssl rand -base64 32`. Usado para assinar cookies de sessão. |

> A variável `NEXT_PUBLIC_APP_NAME` é opcional (default = "PlayMedia System").

## B) Passo a passo do deploy

1. **Suba o código para um repositório Git** (GitHub/GitLab/Bitbucket).
2. **No painel da Vercel**: "Add New Project" → importe o repositório.
3. **Configurar variáveis** (ver seção A).
4. **Schemas Prisma** — o projeto tem 3 variantes:
   - `prisma/schema.prisma` → **SQLite** (usado em dev local/sandbox, apontado por `DATABASE_URL=file:...`)
   - `prisma/schema.sqlite.prisma` → cópia SQLite para dev local
   - `prisma/schema.vercel.prisma` → **PostgreSQL (Vercel + Neon)** — é este que o build usa
   - `DATABASE_URL` precisa começar com `postgresql://` na Vercel.
   - **IMPORTANTE**: qualquer modelo/campo novo precisa ser adicionado nos TRÊS arquivos de schema.
5. **O script de build** já está pronto em `package.json` e aponta direto pro schema PostgreSQL:
   ```
   "build": "prisma generate --schema prisma/schema.vercel.prisma && prisma db push --schema prisma/schema.vercel.prisma --accept-data-loss --skip-generate && next build"
   ```
   Ele gera o client Prisma, aplica o schema no banco e builda o Next.js — sem precisar trocar arquivo nenhum.
6. **Deploy** — a Vercel roda o build automaticamente.

### Após o primeiro deploy (rodar UMA vez)

- **Seed do catálogo**: ao fazer o **primeiro login** (setup da senha), o sistema detecta que não há tipos de serviço e **automaticamente** faz o seed de:
  - 7 tipos de serviço (Arte, Vídeo, Site, Sistemas PHP, Automações, Dublagem de Vídeos, Text-to-Speech)
  - 3 carteiras (Nubank, PicPay, Mercado Pago)
  - 7 cartões de crédito (Credicard, Banco BV, Mercado Pago, PicPay, Wise, PayPal, Nubank Crédito)

  **Não é necessário rodar seed manual.**

## C) Acesso ao painel

- **URL**: a URL do seu projeto Vercel (ex: `https://playmedia-system.vercel.app`)
- **Primeiro acesso**: a tela de login mostra a aba "Primeiro acesso". Informe **email + nome + senha** (mín. 4 caracteres). Esta senha é **gerada por você** no primeiro acesso e protegida com hash **scrypt** (sem dependências externas).
- **Login seguinte**: use a aba "Entrar" com email + senha criados.
- **Credenciais padrão**: NÃO há credenciais fixas — a primeira senha é definida por você no setup. Isso é mais seguro.

> Para resetar o acesso, delete o registro na tabela `User` do banco (via Neon console) e refaça o setup.

## C2) Novidades desta versão (modo TDAH + lançamentos flexíveis)

- **Lembretes (nova seção "Lembretes" na sidebar)**:
  - Captura rápida: digite + Enter (data, prioridade e repetição são opcionais)
  - Seções: Atrasados / Hoje / Próximos / Ideias (sem data) / Concluídos
  - Adiar sem culpa (+1h, +3h, amanhã, +1 semana) e repetição automática (diário/semanal/mensal)
  - "Despejo mental": notas rápidas sem formulário, com botão "Virar lembrete"
  - Sino no header com badge e popover "Foco de agora"; toast ao abrir o sistema
  - Painel **Foco de Hoje** no dashboard (lembretes + a receber hoje + a pagar hoje) com add rápido
- **Lançamentos sem cliente cadastrado (Entradas & Saídas)**:
  - O campo "Cliente / Pessoa" aceita qualquer nome digitado (pessoa avulsa) OU um cliente cadastrado (com sugestões)
  - Badge "Avulso" identifica lançamentos sem cadastro
- **Contas a receber avulsas**:
  - O campo "Quem vai pagar?" é opcional para clientes cadastrados — digite o nome livre e use as observações
  - Badge "Avulso" + busca por nome livre e observações
- **Edição de transações corrige saldo**: editar valor/carteira/cartão de um lançamento agora reconcilia o saldo da carteira e o limite usado do cartão automaticamente.

## D) Build TypeScript

O build usa `next build` com `typescript.ignoreBuildErrors: false`. O código passa sem erros de TypeScript. Rode localmente para confirmar:
```bash
bun run lint   # ESLint: 0 errors
# ou
bun run build # prisma generate + db push + next build
```

## Estrutura do projeto

```
src/
├── app/
│   ├── api/
│   │   ├── auth/            # setup/login/logout (scrypt hash)
│   │   ├── chat/            # assistente IA (z-ai-web-dev-sdk / Gemini)
│   │   ├── crud/[resource]/ # CRUD genérico (clients, orders, transactions, wallets, ...)
│   │   ├── dashboard/       # métricas agregadas
│   │   └── seed/            # catálogo padrão
│   ├── layout.tsx           # ThemeProvider + fonts + metadata
│   ├── page.tsx             # rota única (SPA com views via Zustand)
│   └── globals.css          # tema white/orange/blue + dark mode
├── components/
│   ├── ui-primitives/       # MetricCard, PageHeader, FormModal, EmptyState
│   ├── views/               # 14 telas (dashboard, clients, services, ...)
│   ├── app-shell.tsx        # shell + auth gate
│   ├── sidebar.tsx          # navegação
│   ├── app-header.tsx       # topo + toggle tema
│   ├── auth-gate.tsx        # setup/login
│   ├── theme-toggle.tsx
│   └── footer.tsx           # sticky footer
└── lib/
    ├── auth.ts              # hash scrypt + sessão cookie
    ├── crud-helpers.ts      # map de recursos + includes
    ├── api-hooks.ts         # useFetch, apiPost, apiDelete
    ├── format.ts            # moeda/data BR
    └── store.ts             # Zustand (view, sidebar, authed)

prisma/
├── schema.prisma          # PostgreSQL + binaryTargets (Vercel/Neon) — padrão
└── schema.sqlite.prisma   # SQLite (somente dev local)
```

## Funcionalidades

- **Dashboard**: métricas animadas (saldo, entradas, saídas, lucro, a receber/pagar, crédito disponível, mensalistas), gráficos (6 meses, carteiras, limites), pipeline, meta, atividade recente, alertas de vencidos
- **Clientes**: CRUD completo + mensalistas
- **Serviços**: catálogo customizável (CRUD com cores/ícones) + ordens de serviço
- **Transações**: entradas/saídas com filtros, afeta carteiras e limites de crédito automaticamente
- **Contas Fixas**: recorrentes com lançamento mensal
- **A Pagar / A Receber**: com status, vencimento, marcação de pago/recebido (atualiza carteiras)
- **Mensalistas**: clientes recorrentes com receita mensal
- **Carteiras & Cartões**: Nubank, PicPay, Mercado Pago + 7 cartões com limite (compra no crédito reduz limite automaticamente)
- **Produção (Kanban)**: arrastar-e-soltar entre A Fazer / Fazendo / Concluído / Entregue
- **Comprovante de Pagamento**: gerador + impressão
- **Orçamento**: gerador com itens dinâmicos + impressão
- **Metas de Depósito**: depósito mínimo obrigatório (ex: R$ 80)
- **Assistente IA (Gemini)**: conhece todos os dados do sistema, responde perguntas, sugere ações

## Tema

- **Claro**: branco + laranja + azul
- **Noturno**: dark navy + laranja + azul (letras mudam de cor para legibilidade)
- Toggle no topo (Sol/Lua com animação)

## Stack

- Next.js 16 (App Router, Turbopack)
- TypeScript 5
- Tailwind CSS 4 + shadcn/ui (New York)
- Prisma ORM
- Framer Motion (animações)
- Recharts (gráficos)
- @dnd-kit (Kanban drag-and-drop)
- Zustand (estado client)
- z-ai-web-dev-sdk (Gemini AI no backend)
- scrypt (hash de senha, sem libs externas)

---

## Novidades: Configurações + UNITV

### Configurações (menu "Sistema > Configurações")
- **Gemini**: cole a chave gerada em https://aistudio.google.com/apikey, clique em **Buscar modelos** (lista os Gemini 3+ liberados na sua chave), escolha o modelo, **Testar conexão** e **Salvar tudo**.
  - A chave fica salva no banco (tabela `Setting`) e nunca é devolvida inteira para a tela (só os 4 últimos caracteres).
  - Alternativa: definir `GEMINI_API_KEY` nas variáveis da Vercel. A chave salva em Configurações tem prioridade.
- **UNITV**: quantos dias antes do vencimento avisar (padrão 5) e o texto da mensagem de WhatsApp (`{nome}` `{vencimento}` `{dias}` `{valor}`).
- **Instruções extras para a IA**: texto livre que é somado ao prompt do Assistente.

### UNITV (menu "Assinaturas > UNITV")
- Cadastro de clientes do painel IPTV (nome, WhatsApp, usuário, vencimento, valor habitual). Importação em massa colando a lista (`nome; whatsapp; vencimento; valor; usuário`).
- **Renovar / Ativar**: informa plano (1, 3, 6, 12 meses ou outro), valor livre, data e carteira. O vencimento é calculado (se ainda ativo soma no vencimento atual; se já venceu conta do pagamento) e pode ser ajustado.
- Cada renovação gera automaticamente uma **entrada** em Entradas & Saídas (categoria Serviço, descrição "UNITV - Renovação - Nome") e soma na carteira escolhida. Desfazer um lançamento no Histórico remove a entrada e estorna a carteira.
- **Alertas**: aviso ao abrir o sistema, número no menu UNITV, faixa de alerta no topo da aba e botão de WhatsApp pronto.

### Banco de dados
Duas tabelas novas (`IptvClient`, `IptvRenewal`). O `build` já roda `prisma db push`, então elas são criadas sozinhas no deploy (só adiciona tabelas, não mexe nos dados atuais).
