import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { friendlyError } from "@/lib/crud-helpers";

// POST /api/credit-cards/[id]/pay-invoice
// body: { amount, walletId, date?, description?, paymentMethod? }
//
// Registra o pagamento (parcial ou total) da fatura de um cartão:
// - cria o lançamento de saída na carteira escolhida (histórico rastreável)
// - debita o valor do saldo da carteira
// - LIBERA o limite usado do cartão (em vez de consumir, como uma compra faria)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { id } = await params;
    const card = await db.creditCard.findUnique({ where: { id } });
    if (!card)
      return NextResponse.json({ error: "Cartão não encontrado." }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const amt = Math.round(Number(body.amount) * 100) / 100;
    if (!amt || amt <= 0)
      return NextResponse.json({ error: "Informe o valor que você está pagando." }, { status: 400 });

    const used = Number(card.usedLimit) || 0;
    if (amt > used)
      return NextResponse.json(
        { error: `O valor passa da fatura em aberto (${used.toFixed(2)}). Confira o número — se o limite do cartão estiver desatualizado, ajuste na edição do cartão.` },
        { status: 400 }
      );

    const wallet = body.walletId
      ? await db.wallet.findUnique({ where: { id: body.walletId } })
      : null;
    if (!wallet)
      return NextResponse.json({ error: "Escolha a carteira de onde o dinheiro vai sair." }, { status: 400 });

    const when = body.date ? new Date(body.date) : new Date();
    if (isNaN(when.getTime()))
      return NextResponse.json({ error: "Data inválida." }, { status: 400 });

    const tx = await db.transaction.create({
      data: {
        type: "expense",
        category: "card_payment",
        description:
          body.description && String(body.description).trim()
            ? String(body.description).trim()
            : `Fatura ${card.name}`,
        amount: amt,
        date: when,
        paymentMethod: body.paymentMethod || "pix",
        walletId: wallet.id,
        creditCardId: card.id,
      },
      include: {
        wallet: { select: { id: true, name: true } },
        creditCard: { select: { id: true, name: true } },
      },
    });

    await db.wallet.update({
      where: { id: wallet.id },
      data: { balance: Number(wallet.balance) - amt },
    });
    await db.creditCard.update({
      where: { id: card.id },
      data: { usedLimit: Math.max(0, used - amt) },
    });

    return NextResponse.json({ data: tx });
  } catch (e: any) {
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 });
  }
}
