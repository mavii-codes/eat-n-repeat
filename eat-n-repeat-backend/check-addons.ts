import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const addons = await prisma.addon.findMany();
  console.log(JSON.stringify(addons, null, 2));
  await prisma.$disconnect();
}

main().catch(console.error);