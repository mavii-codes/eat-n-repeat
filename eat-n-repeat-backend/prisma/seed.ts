import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Seed default admin
  const adminPasswordHash = await bcrypt.hash('EatnRepeat!2026', 12);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      id: 'admin-1',
      name: 'Cafe Administrator',
      username: 'admin',
      email: 'owner@eatnrepeat.com',
      passwordHash: adminPasswordHash,
      role: 'admin',
      status: 'active',
    },
  });

  // Seed default addons
  const defaultAddons = [
    { id: 'addon-1', name: 'Extra Cheese', price: 20.00 },
    { id: 'addon-2', name: 'Extra Sauce', price: 10.00 },
    { id: 'addon-3', name: 'Extra Rice', price: 15.00 },
    { id: 'addon-4', name: 'Extra Chicken', price: 40.00 },
    { id: 'addon-5', name: 'Fried Egg', price: 15.00 },
  ];

  for (const addon of defaultAddons) {
    await prisma.addon.upsert({
      where: { id: addon.id },
      update: {},
      create: { ...addon, available: true },
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
