# PlayMedia System — Download

## 📦 Arquivo

**`playmedia-system.zip`** (556 KB, 126 arquivos)

## 🚀 Como rodar localmente

1. Descompacte o ZIP:
   ```bash
   unzip playmedia-system.zip -d playmedia-system
   cd playmedia-system
   ```

2. Instale as dependências:
   ```bash
   bun install
   ```

3. Configure o ambiente:
   ```bash
   cp .env.example .env
   ```
   Edite o `.env`:
   - Para dev local (SQLite): `DATABASE_URL="file:./db/custom.db"`
   - Para Vercel (Neon PostgreSQL): `DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"`

4. Rode o banco:
   ```bash
   bun run db:push
   ```

5. Inicie o dev server:
   ```bash
   bun run dev
   ```
   Abra http://localhost:3000

6. **Primeiro acesso**: tela "Primeiro acesso" → defina seu email + senha → entrar.

## ☁️ Deploy na Vercel

Leia o **`DEPLOY.md`** (incluído no ZIP) com instruções completas:
- Variáveis de ambiente (DATABASE_URL, AUTH_SECRET)
- O `schema.prisma` já é PostgreSQL (Vercel/Neon); SQLite local fica em `schema.sqlite.prisma`
- O seed do catálogo é automático no primeiro login

## 🔑 Credenciais do preview (sandbox)

Se quiser só conhecer o sistema rodando no preview:
- **Email**: `admin@playmedia.com`
- **Senha**: `12345`

> Em produção, VOCÊ define sua própria senha no primeiro acesso.

## 📁 Estrutura

```
src/
├── app/
│   ├── api/          # auth, crud (genérico), dashboard, chat, seed
│   ├── layout.tsx
│   ├── page.tsx      # rota única (SPA)
│   └── globals.css   # tema white/orange/blue + dark mode
├── components/
│   ├── ui-primitives/ # MetricCard, PageHeader, FormModal
│   ├── views/        # 14 telas (dashboard, clients, ...)
│   └── ...            # shell, sidebar, header, auth-gate
└── lib/              # auth, store, format, api-hooks

prisma/
├── schema.prisma          # PostgreSQL (Vercel/Neon) — padrão
└── schema.sqlite.prisma   # SQLite (somente dev local)

DEPLOY.md    # instruções de deploy
```

## ✨ Funcionalidades

- Dashboard com métricas animadas + gráficos
- Clientes + mensalistas
- Catálogo de serviços customizável (7 tipos pré-cadastrados)
- Transações (entradas/saídas) que afetam carteiras e limites de crédito
- Contas fixas, a pagar, a receber
- Carteiras (Nubank, PicPay, Mercado Pago) + 7 cartões de crédito com limite
- **Compra no crédito reduz o limite automaticamente**
- Produção Kanban (drag-and-drop)
- Gerador de comprovante de pagamento + orçamento (com impressão)
- Metas de depósito com mínimo obrigatório
- **Assistente IA Gemini** que conhece todo o sistema
- Modo claro (branco/laranja/azul) + modo noturno 100% funcional

## 🛠 Stack

Next.js 16 · TypeScript 5 · Tailwind 4 · shadcn/ui · Prisma · Framer Motion · Recharts · @dnd-kit · Zustand · z-ai-web-dev-sdk (Gemini)
