const fs = require('fs');
const file = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/app/staff/page.tsx';
let c = fs.readFileSync(file, 'utf8');

// 1. Add ArchiveTab import if missing
if (!c.includes('import { ArchiveTab }')) {
  c = c.replace(
    'import { StaffInventoryTab } from "@/components/staff/StaffInventoryTab";',
    'import { StaffInventoryTab } from "@/components/staff/StaffInventoryTab";\r\nimport { ArchiveTab } from "@/components/admin/ArchiveTab";'
  );
  if (!c.includes('import { ArchiveTab }')) {
    c = c.replace(
      'import { StaffInventoryTab } from "@/components/staff/StaffInventoryTab";',
      'import { StaffInventoryTab } from "@/components/staff/StaffInventoryTab";\nimport { ArchiveTab } from "@/components/admin/ArchiveTab";'
    );
  }
  console.log('1. ArchiveTab import added');
}

// 2. Add "archive" to StaffTab type definition
if (!c.includes('"archive"')) {
  c = c.replace(
    'type StaffTab = "dashboard" | "orders" | "menu" | "inventory" | "delivery" | "profile" | "pos";',
    'type StaffTab = "dashboard" | "orders" | "menu" | "inventory" | "delivery" | "archive" | "profile" | "pos";'
  );
  console.log('2. StaffTab type updated');
}

// 3. Add Archive tab object to sidebar tabs array
if (!c.includes('id: "archive"')) {
  const deliveryTabMarker = '        label: "Delivery Orders",';
  const deliveryBlockEnd = '      },';
  const deliveryIndex = c.indexOf(deliveryTabMarker);
  if (deliveryIndex !== -1) {
    const insertPos = c.indexOf(deliveryBlockEnd, deliveryIndex) + deliveryBlockEnd.length;
    const archiveTabObj = `\r\n      {\r\n        id: "archive",\r\n        label: "Archived Items",\r\n        icon: (\r\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">\r\n            <polyline points="21 8 21 21 3 21 3 8" />\r\n            <rect x="1" y="3" width="22" height="5" />\r\n            <line x1="10" y1="12" x2="14" y2="12" />\r\n          </svg>\r\n        ),\r\n      },`;
    c = c.substring(0, insertPos) + archiveTabObj + c.substring(insertPos);
    console.log('3. Archive tab added to sidebar list');
  } else {
    console.error('Failed to find deliveryTabMarker');
  }
}

// 4. Render {activeTab === "archive" && <ArchiveTab />}
if (!c.includes('<ArchiveTab />')) {
  const inventoryEndMarker = '{/* TAB 5: DELIVERY ORDERS */}';
  const inventoryEndIdx = c.indexOf(inventoryEndMarker);
  if (inventoryEndIdx !== -1) {
    const archiveRenderBlock = `        {/* TAB: ARCHIVE */}\r\n        {activeTab === "archive" && (\r\n          <ArchiveTab />\r\n        )}\r\n\r\n`;
    c = c.substring(0, inventoryEndIdx) + archiveRenderBlock + c.substring(inventoryEndIdx);
    console.log('4. ArchiveTab rendering block inserted');
  } else {
    console.error('Failed to find inventoryEndMarker');
  }
}

fs.writeFileSync(file, c, 'utf8');
console.log('Done patching page.tsx for ArchiveTab!');
