import type { Prisma } from "@prisma/client";
import { ymdToNoon, ymdToDate } from "@/lib/unitv";

/**
 * Registra um pagamento UNITV (ativação ou renovação) de uma vez só:
 * lança a entrada financeira, soma na carteira, grava o histórico e atualiza o vencimento do cliente.
 */
export async function recordPayment(
  tx: Prisma.TransactionClient,
  p: {
    clientId: string;
    clientName: string;
    kind: "activation" | "renewal";
    planMonths: number;
    amount: number;
    paidAt: string; // YYYY-MM-DD
    previousExpiry: Date | null;
    newExpiry: string; // YYYY-MM-DD
    walletId?: string | null;
    paymentMethod?: string | null;
    notes?: string | null;
  }
) {
  // Regras de ouro: dinheiro não pode sumir nem entrar do nada.
  if (p.amount < 0) throw new Error("O valor pago não pode ser negativo.");
  if (p.amount > 0 && !p.walletId)
    throw new Error("Escolha a carteira que recebeu o pagamento — o valor precisa entrar no caixa.");

  let transactionId: string | null = null;

  if (p.amount > 0) {
    const label = p.kind === "activation" ? "Ativação" : "Renovação";
    const t = await tx.transaction.create({
      data: {
        type: "income",
        category: "unitv",
        description: `UNITV - ${label} - ${p.clientName} (${p.planMonths} ${p.planMonths === 1 ? "mês" : "meses"})`,
        amount: p.amount,
        date: ymdToNoon(p.paidAt),
        paymentMethod: p.paymentMethod || null,
        walletId: p.walletId || null,
      },
    });
    transactionId = t.id;
    if (p.walletId) {
      await tx.wallet.update({
        where: { id: p.walletId },
        data: { balance: { increment: p.amount } },
      });
    }
  }

  const renewal = await tx.iptvRenewal.create({
    data: {
      clientId: p.clientId,
      kind: p.kind,
      planMonths: p.planMonths,
      amount: p.amount,
      paidAt: ymdToNoon(p.paidAt),
      previousExpiry: p.previousExpiry,
      newExpiry: ymdToDate(p.newExpiry),
      walletId: p.walletId || null,
      transactionId,
      notes: p.notes || null,
    },
  });

  await tx.iptvClient.update({
    where: { id: p.clientId },
    data: {
      expiresAt: ymdToDate(p.newExpiry),
      lastAmount: p.amount > 0 ? p.amount : undefined,
      active: true,
    },
  });

  return renewal;
}
