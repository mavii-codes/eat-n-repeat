import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Seed default admin
  // Password comes from SEED_ADMIN_PASSWORD (loaded by the Prisma CLI when
  // running `prisma db seed`); the fallback keeps the historical dev value so
  // bare tsx runs and fresh machines still seed with something valid.
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'EatnRepeat!2026';
  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash: adminPasswordHash, name: 'Marvin Barro', email: 'owner@eatnrepeat.com', role: 'admin', status: 'active' },
    create: {
      id: 'admin-1',
      name: 'Marvin Barro',
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

  // Seed default menu (shared across all devices — staff edits persist here)
  const defaultMenuCategories = [
    { id: 'mc-1', name: 'Coffee & Espresso', description: 'Hot and iced handcrafted coffees' },
    { id: 'mc-2', name: 'Milktea & Boba', description: 'Signature milk tea, boba, and frappes' },
    { id: 'mc-3', name: 'Rice Bowls & Meals', description: 'Hearty Filipino comfort bowls and grilled specials' },
    { id: 'mc-4', name: 'Pastries & Desserts', description: 'Freshly baked pastries and sweet treats' },
    { id: 'mc-5', name: 'Sides & Bites', description: 'Crispy fries, wings, and light snacks' },
  ];

  for (const category of defaultMenuCategories) {
    await prisma.menuCategory.upsert({
      where: { id: category.id },
      update: {},
      create: { ...category, archived: false },
    });
  }

  const defaultMenuItems = [
    { id: 'mi-1', name: 'House Special Latte', description: 'Silky double shot espresso with velvety steamed milk and vanilla bean', price: 145, categoryId: 'mc-1', image: 'https://images.unsplash.com/photo-1541180464527-0245efded371?w=600&auto=format&fit=crop' },
    { id: 'mi-2', name: 'Cordova Cold Brew', description: '16-hour slow-steeped single origin beans served over crystal ice', price: 135, categoryId: 'mc-1', image: 'https://images.unsplash.com/photo-1517668808822-9ebb02ae2a0e?w=600&auto=format&fit=crop' },
    { id: 'mi-3', name: 'Uji Matcha Milktea', description: 'Creamy authentic Japanese matcha topped with cheese foam', price: 139, categoryId: 'mc-2', image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=600&auto=format&fit=crop' },
    { id: 'mi-4', name: 'Brown Sugar Boba Milk', description: 'Warm brown sugar tapioca pearls with cold fresh farm milk', price: 149, categoryId: 'mc-2', image: 'https://images.unsplash.com/photo-1558857563-b371033873b8?w=600&auto=format&fit=crop' },
    { id: 'mi-5', name: 'Signature Chicken Inasal Rice Bowl', description: 'Flame-grilled marinated chicken thigh with annatto rice and spiced vinegar', price: 189, categoryId: 'mc-3', image: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=600&auto=format&fit=crop' },
    { id: 'mi-6', name: 'Spam & Egg Comfort Bowl', description: 'Thick slice fried Spam, sunny side egg over garlic fried rice', price: 165, categoryId: 'mc-3', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop' },
    { id: 'mi-7', name: 'French Butter Croissant', description: 'Flaky golden multi-layered croissant baked fresh every morning', price: 95, categoryId: 'mc-4', image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&auto=format&fit=crop' },
    { id: 'mi-8', name: 'Garlic Parmesan Truffle Fries', description: 'Golden crispy skin-on fries tossed in garlic parmesan & truffle oil', price: 119, categoryId: 'mc-5', image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=600&auto=format&fit=crop' },
  ];

  for (const item of defaultMenuItems) {
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: {},
      create: { ...item, available: true, archived: false },
    });
  }

  // Seed default stock categories
  const defaultStockCategories = [
    { id: 'sc-1', name: 'Frozen' },
    { id: 'sc-2', name: 'Grains' },
    { id: 'sc-3', name: 'Meat' },
    { id: 'sc-4', name: 'Coffee' },
    { id: 'sc-5', name: 'Dairy' },
    { id: 'sc-6', name: 'Milktea' },
  ];

  for (const cat of defaultStockCategories) {
    await prisma.stockCategory.upsert({
      where: { id: cat.id },
      update: {},
      create: cat,
    });
  }

  // Seed default stock items
  const defaultStockItems = [
    { id: 'st-1', name: 'Matcha Milktea powder', categoryId: 'sc-6', quantity: 3, unit: 'kg', lowStockThreshold: 5 },
    { id: 'st-2', name: 'Spam', categoryId: 'sc-3', quantity: 8, unit: 'cans', lowStockThreshold: 10 },
    { id: 'st-3', name: 'Arabica Coffee Beans', categoryId: 'sc-4', quantity: 12, unit: 'kg', lowStockThreshold: 5 },
    { id: 'st-4', name: 'Whole Milk', categoryId: 'sc-5', quantity: 20, unit: 'L', lowStockThreshold: 8 },
    { id: 'st-5', name: 'Jasmine Rice', categoryId: 'sc-2', quantity: 25, unit: 'kg', lowStockThreshold: 10 },
    { id: 'st-6', name: 'Frozen Fries', categoryId: 'sc-1', quantity: 15, unit: 'kg', lowStockThreshold: 6 },
  ];

  for (const item of defaultStockItems) {
    await prisma.stockItem.upsert({
      where: { id: item.id },
      update: {},
      create: item,
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
