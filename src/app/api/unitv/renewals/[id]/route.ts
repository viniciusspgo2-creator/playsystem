import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// DELETE /api/unitv/renewals/[id]
// Desfaz o lançamento: remove a entrada financeira, estorna a carteira e,
// se for a última renovação do cliente, volta o vencimento anterior.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser(req.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const { id } = await params;

    const r = await db.iptvRenewal.findUnique({ where: { id } });
    if (!r) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    await db.$transaction(async (tx) => {
      if (r.transactionId) {
        const t = await tx.transaction.findUnique({ where: { id: r.transactionId } });
        if (t) {
          if (t.walletId) {
            await tx.wallet.update({
              where: { id: t.walletId },
              data: { balance: { decrement: Number(t.amount) } },
            });
          }
          await tx.transaction.delete({ where: { id: t.id } });
        }
      }

      const newer = await tx.iptvRenewal.count({
        where: { clientId: r.clientId, createdAt: { gt: r.createdAt } },
      });
      await tx.iptvRenewal.delete({ where: { id } });
      if (newer === 0 && r.previousExpiry) {
        await tx.iptvClient.update({
          where: { id: r.clientId },
          data: { expiresAt: r.previousExpiry },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
