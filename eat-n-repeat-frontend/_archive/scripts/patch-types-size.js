const fs = require('fs');

function patchTypes() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\lib\\admin\\types.ts';
  let content = fs.readFileSync(file, 'utf-8');

  // 1. Re-apply Stock Archive Types
  if (!content.includes('archived?: boolean')) {
    content = content.replace(/export type StockItem = {/g, 'export type StockItem = {\n  archived?: boolean;\n  archivedAt?: string;');
    content = content.replace(/export type StockCategory = {/g, 'export type StockCategory = {\n  archived?: boolean;\n  archivedAt?: string;');
    
    content = content.replace(/export type StockItemInput = Omit<StockItem, "id">;/g, 'export type StockItemInput = Omit<StockItem, "id" | "archived" | "archivedAt">;');
    content = content.replace(/export type StockCategoryInput = Omit<StockCategory, "id">;/g, 'export type StockCategoryInput = Omit<StockCategory, "id" | "archived" | "archivedAt">;');
  }

  // 2. Apply Menu Size Types
  if (!content.includes('MenuSize')) {
    const sizeType = `export type MenuSize = {
  name: string;
  price: number;
  available: boolean;
};

export type MenuItem = {`;
    content = content.replace('export type MenuItem = {', sizeType);
    
    // Inject sizes? into MenuItem
    content = content.replace('customizations?: CustomizationConfig;', 'customizations?: CustomizationConfig;\n  sizes?: MenuSize[];');
  }

  fs.writeFileSync(file, content);
  console.log('Types patched successfully.');
}

patchTypes();
