/**
 * Menu-only seed — safe for production one-time initialization.
 *
 * Upserts ONLY menu_categories and menu_items by fixed id. It NEVER touches
 * users, admins, customers, orders, payments, addons, stock, or any other
 * table, and NEVER resets passwords. Fully idempotent: re-running changes
 * nothing. Staff edits to existing rows are preserved (update: {}).
 *
 * Usage (DATABASE_URL must point at the target database):
 *   npx tsx prisma/seed-menu.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
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

  const catCount = await prisma.menuCategory.count();
  const itemCount = await prisma.menuItem.count();
  console.log(`Menu seed complete. categories=${catCount} items=${itemCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
