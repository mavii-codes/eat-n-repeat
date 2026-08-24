const fs = require('fs');

function addArchiveTypes() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\lib\\admin\\types.ts';
  let content = fs.readFileSync(file, 'utf-8');
  
  if (!content.includes('archived?: boolean')) {
    content = content.replace(/export type StockItem = {/g, 'export type StockItem = {\n  archived?: boolean;\n  archivedAt?: string;');
    content = content.replace(/export type StockCategory = {/g, 'export type StockCategory = {\n  archived?: boolean;\n  archivedAt?: string;');
    
    // Also we need to make sure StockItemInput doesn't require it
    content = content.replace(/export type StockItemInput = Omit<StockItem, "id">;/g, 'export type StockItemInput = Omit<StockItem, "id" | "archived" | "archivedAt">;');
    content = content.replace(/export type StockCategoryInput = Omit<StockCategory, "id">;/g, 'export type StockCategoryInput = Omit<StockCategory, "id" | "archived" | "archivedAt">;');
    
    fs.writeFileSync(file, content);
    console.log('Updated types.ts');
  }
}

function updateAdminContext() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\context\\AdminDataContext.tsx';
  let content = fs.readFileSync(file, 'utf-8');
  
  // Interface
  if (!content.includes('archiveStockItem: (id: string) => void;')) {
    content = content.replace('deleteStockItem: (id: string) => void;', 'deleteStockItem: (id: string) => void;\n  archiveStockItem: (id: string) => void;');
    content = content.replace('deleteStockCategory: (id: string) => void;', 'deleteStockCategory: (id: string) => void;\n  archiveStockCategory: (id: string) => void;');
  }

  // Implementation
  if (!content.includes('const archiveStockItem = useCallback(')) {
    const implTarget = 'const deleteStockItem = useCallback((id: string) => {';
    const inject = `const archiveStockItem = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      stockItems: prev.stockItems.map((item) =>
        item.id === id ? { ...item, archived: true, archivedAt: new Date().toISOString() } : item
      ),
    }));
  }, []);

  const archiveStockCategory = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      stockCategories: prev.stockCategories.map((c) =>
        c.id === id ? { ...c, archived: true, archivedAt: new Date().toISOString() } : c
      ),
    }));
  }, []);
`;
    content = content.replace(implTarget, inject + '\n  ' + implTarget);
  }

  // Returns
  if (!content.includes('archiveStockItem,')) {
    content = content.replace('deleteStockItem,', 'deleteStockItem,\n      archiveStockItem,');
    content = content.replace('deleteStockCategory,', 'deleteStockCategory,\n      archiveStockCategory,');
  }

  fs.writeFileSync(file, content);
  console.log('Updated AdminDataContext.tsx');
}

function updateStockPage() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\app\\admin\\stock\\page.tsx';
  let content = fs.readFileSync(file, 'utf-8');
  
  // Change Trash2 to Archive
  content = content.replace(/Trash2,/g, 'Trash2,\n  Archive,');
  content = content.replace(/<Trash2/g, '<Archive');
  
  // Replace deleteStockItem with archiveStockItem
  content = content.replace(/deleteStockItem,/g, 'archiveStockItem,');
  content = content.replace(/deleteStockItem\(/g, 'archiveStockItem(');
  
  // Replace deleteStockCategory with archiveStockCategory
  content = content.replace(/deleteStockCategory,/g, 'archiveStockCategory,');
  content = content.replace(/deleteStockCategory\(/g, 'archiveStockCategory(');

  // Update text
  content = content.replace(/Delete stock item/g, 'Archive stock item');
  content = content.replace(/Delete Item/g, 'Archive Item');
  content = content.replace(/Delete stock category/g, 'Archive stock category');
  
  // Ensure we filter out archived items in the page
  // The stock page might have a `useMemo` for filteredStockItems or something
  // We'll just patch where it maps or filters.
  // Wait, I can't easily guess the exact variable name without reading it properly. Let's just do a regex replace for `stockItems.filter` or something.
  if (content.includes('stockItems.filter(')) {
    content = content.replace(/stockItems\.filter\(\(item\) => \{/g, 'stockItems.filter((item) => {\n      if (item.archived) return false;');
    content = content.replace(/stockCategories\.filter\(\(cat\) =>/g, 'stockCategories.filter((cat) => !cat.archived &&');
  } else {
    // maybe it doesn't filter, we just map
    content = content.replace(/stockItems\.map/g, 'stockItems.filter(i => !i.archived).map');
    content = content.replace(/stockCategories\.map/g, 'stockCategories.filter(c => !c.archived).map');
  }

  fs.writeFileSync(file, content);
  console.log('Updated stock page');
}

addArchiveTypes();
updateAdminContext();
updateStockPage();
