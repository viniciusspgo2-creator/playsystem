// One-off: transações UNITV antigas saem de "service" e ganham a categoria própria "unitv".
// Uso: bun scripts/backfill-unitv-category.ts   (rode também no Postgres da Vercel com DATABASE_URL apontando pra lá)
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const r = await db.transaction.updateMany({
    where: { description: { startsWith: "UNITV" }, category: "service" },
    data: { category: "unitv" },
  });
  console.log(`Atualizadas ${r.count} transações UNITV para a categoria "unitv".`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
