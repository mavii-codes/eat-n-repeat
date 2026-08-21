const fs = require('fs');
const file = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/app/staff/page.tsx';
let c = fs.readFileSync(file, 'utf8');

// 1. Add StaffInventoryTab import (after Logo import)
if (!c.includes('StaffInventoryTab')) {
  c = c.replace(
    'import { Logo } from "@/components/brand/Logo";',
    'import { Logo } from "@/components/brand/Logo";\nimport { StaffInventoryTab } from "@/components/staff/StaffInventoryTab";'
  );
  console.log('1. Import added');
} else {
  console.log('1. Import already exists');
}

// 2. Add addStockItem, updateStockItem, deleteStockItem to destructured context
// Match CRLF line endings
if (!c.includes('addStockItem,')) {
  c = c.replace(
    '    archiveMenuItem,\r\n  } = useAdminData();',
    '    archiveMenuItem,\r\n    addStockItem,\r\n    updateStockItem,\r\n    deleteStockItem,\r\n  } = useAdminData();'
  );
  console.log('2. Context destructure added:', c.includes('addStockItem,'));
} else {
  console.log('2. Context destructure already exists');
}

// 3. Replace inline inventory tab with component
const startMarker = '        {/* TAB 4: INVENTORY */}';
const endMarker = '        {/* TAB 5: DELIVERY ORDERS */}';

const startIdx = c.indexOf(startMarker);
const endIdx = c.indexOf(endMarker);

if (startIdx !== -1 && endIdx !== -1) {
  const replacement = '        {/* TAB 4: INVENTORY */}\r\n        {activeTab === "inventory" && (\r\n          <StaffInventoryTab\r\n            stockItems={stockItems}\r\n            stockCategories={stockCategories}\r\n            getStockCategoryName={getStockCategoryName}\r\n            addStockItem={addStockItem}\r\n            updateStockItem={updateStockItem}\r\n            deleteStockItem={deleteStockItem}\r\n            staffName={user?.name || "Staff"}\r\n          />\r\n        )}\r\n\r\n';
  c = c.substring(0, startIdx) + replacement + c.substring(endIdx);
  console.log('3. Inventory tab replaced with component');
} else {
  console.error('3. Could not find markers!', 'start:', startIdx !== -1, 'end:', endIdx !== -1);
}

fs.writeFileSync(file, c, 'utf8');
console.log('Done! File saved.');
