import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

// GET system context for the AI assistant
async function buildSystemContext(): Promise<string> {
  let context = `Você é o assistente oficial do "PlayMedia System", um sistema de gestão financeira pessoal.
Conhece TODAS as funcionalidades: clientes, serviços, ordens de produção, transações (entrada/saída),
contas fixas, contas a pagar/receber, mensalistas, carteiras (Nubank, PicPay, Mercado Pago),
cartões de crédito (Credicard, Banco BV, Mercado Pago, PicPay, Wise, PayPal, Nubank),
metas de depósito, comprovantes de pagamento, orçamentos e pipeline de produção (Kanban: a fazer, fazendo, concluído, entregue).

RESPOSTAS SEMPRE em português brasileiro, objetivas e amigáveis. Use emojis com moderação.

Quando o usuário pedir informações, busque abaixo os dados atuais e resuma de forma clara.`;

  try {
    const [clients, serviceTypes, orders, transactions, wallets, creditCards, payables, receivables, goal] =
      await Promise.all([
        db.client.findMany({ select: { id: true, name: true, email: true, phone: true, isMonthly: true, monthlyFee: true } }),
        db.serviceType.findMany({ select: { id: true, name: true, color: true, basePrice: true, active: true } }),
        db.serviceOrder.findMany({
          include: { client: { select: { name: true } }, serviceType: { select: { name: true } } },
        }),
        db.transaction.findMany({
          take: 30,
          orderBy: { date: "desc" },
          include: { client: { select: { name: true } }, wallet: { select: { name: true } } },
        }),
        db.wallet.findMany(),
        db.creditCard.findMany(),
        db.payable.findMany({ where: { paid: false } }),
        db.receivable.findMany({ where: { received: false }, include: { client: { select: { name: true } } } }),
        db.goal.findFirst({ where: { active: true } }),
      ]);

    context += `\n\n== DADOS ATUAIS DO SISTEMA ==\n`;

    context += `\n### CLIENTES (${clients.length}):\n`;
    clients.forEach((c) => {
      context += `- ${c.name}${c.email ? ` <${c.email}>` : ""}${c.phone ? ` tel:${c.phone}` : ""}${c.isMonthly ? ` [MENSALISTA - R$ ${Number(c.monthlyFee || 0).toFixed(2)}/mês]` : ""}\n`;
    });

    context += `\n### TIPOS DE SERVIÇO (${serviceTypes.length}):\n`;
    serviceTypes.forEach((s) => {
      context += `- ${s.name}${s.basePrice ? ` (base R$ ${Number(s.basePrice).toFixed(2)})` : ""}${s.active ? "" : " [INATIVO]"}\n`;
    });

    context += `\n### ORDENS DE SERVIÇO / PRODUÇÃO (${orders.length}):\n`;
    orders.forEach((o) => {
      context += `- ${o.number}: ${o.title} | Cliente: ${o.client?.name || "-"} | Serviço: ${o.serviceType?.name || "-"} | Status: ${o.status} | Valor: R$ ${Number(o.price).toFixed(2)}${o.paid ? " [PAGO]" : " [PENDENTE]"}\n`;
    });

    const income = transactions.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const expense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    context += `\n### TRANSAÇÕES RECENTES (${transactions.length}) — Entradas: R$ ${income.toFixed(2)} | Saídas: R$ ${expense.toFixed(2)}:\n`;
    transactions.slice(0, 15).forEach((t) => {
      context += `- [${t.type === "income" ? "ENTRADA" : "SAÍDA"}] ${t.description} | R$ ${Number(t.amount).toFixed(2)} | ${new Date(t.date).toLocaleDateString("pt-BR")}${t.client ? ` | Cliente: ${t.client.name}` : ""}${t.wallet ? ` | Carteira: ${t.wallet.name}` : ""}\n`;
    });

    context += `\n### CARTEIRAS (${wallets.length}):\n`;
    wallets.forEach((w) => {
      context += `- ${w.name} (${w.type}): R$ ${Number(w.balance).toFixed(2)}\n`;
    });
    const totalBalance = wallets.reduce((s, w) => s + Number(w.balance), 0);
    context += `SALDO TOTAL NAS CARTEIRAS: R$ ${totalBalance.toFixed(2)}\n`;

    context += `\n### CARTÕES DE CRÉDITO (${creditCards.length}):\n`;
    creditCards.forEach((c) => {
      const avail = Number(c.totalLimit) - Number(c.usedLimit);
      context += `- ${c.name}: Limite R$ ${Number(c.totalLimit).toFixed(2)} | Usado R$ ${Number(c.usedLimit).toFixed(2)} | Disponível R$ ${avail.toFixed(2)}\n`;
    });

    context += `\n### CONTAS A PAGAR PENDENTES (${payables.length}): R$ ${payables.reduce((s, p) => s + Number(p.amount), 0).toFixed(2)}\n`;
    payables.forEach((p) => {
      context += `- ${p.description}: R$ ${Number(p.amount).toFixed(2)} venc. ${new Date(p.dueDate).toLocaleDateString("pt-BR")}${p.supplier ? ` | ${p.supplier}` : ""}\n`;
    });

    context += `\n### CONTAS A RECEBER PENDENTES (${receivables.length}): R$ ${receivables.reduce((s, r) => s + Number(r.amount), 0).toFixed(2)}\n`;
    receivables.forEach((r) => {
      context += `- ${r.description}: R$ ${Number(r.amount).toFixed(2)} venc. ${new Date(r.dueDate).toLocaleDateString("pt-BR")}${r.client ? ` | Cliente: ${r.client.name}` : ""}\n`;
    });

    if (goal) {
      context += `\n### META ATIVA: ${goal.name} — Objetivo R$ ${Number(goal.targetAmount).toFixed(2)} | Acumulado R$ ${Number(goal.currentAmount).toFixed(2)} | Depósito mínimo R$ ${Number(goal.minDeposit).toFixed(2)}\n`;
    }

    context += `\n== FIM DOS DADOS ==\n`;
    context += `\nCom base nesses dados, responda às perguntas do usuário. Você pode:
1. Resumir a situação financeira atual
2. Apontar quem está devendo (contas a receber vencidas)
3. Apontar contas a pagar (especialmente vencidas)
4. Calcular lucro, saldo, limites de crédito disponíveis
5. Sugerir próximos passos de produção (o que está parado, atrasado)
6. Avisar sobre metas de depósito

Se o usuário pedir para CRIAR/CADASTRAR algo, você NÃO pode executar a ação, mas deve orientar exatamente qual tela do sistema usar (ex: "Vá em Clientes > Novo Cliente"). Seja específico e útil.`;
  } catch (e) {
    context += `\n[Atenção: não foi possível carregar dados ao vivo. Responda com base nas funcionalidades gerais do sistema.]`;
  }

  return context;
}

// POST /api/chat
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { message, history } = await req.json();

    if (!message)
      return NextResponse.json({ error: "Mensagem obrigatória" }, { status: 400 });

    const systemPrompt = await buildSystemContext();

    const messages: { role: string; content: string }[] = [
      { role: "assistant", content: systemPrompt },
    ];
    if (Array.isArray(history)) {
      for (const h of history.slice(-10)) {
        messages.push({ role: h.role === "user" ? "user" : "assistant", content: h.content });
      }
    }
    messages.push({ role: "user", content: message });

    // Use z-ai-web-dev-sdk (provides Gemini-class model)
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();

    const completion = await zai.chat.completions.create({
      messages: messages as any,
      thinking: { type: "disabled" },
    });

    const reply = completion.choices[0]?.message?.content || "Sem resposta.";

    return NextResponse.json({ reply });
  } catch (e: any) {
    console.error("Chat error:", e);
    return NextResponse.json(
      { error: e.message || "Erro no assistente" },
      { status: 500 }
    );
  }
}
