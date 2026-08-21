const fs = require('fs');

const path = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/app/staff/page.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

// 1. Add InventoryTab import
lines.splice(22, 0, `import { InventoryTab } from "@/components/admin/InventoryTab";`);

// 2. Replace Tab 4
const tab4Start = lines.findIndex(l => l.includes('{/* TAB 4: INVENTORY */}'));
if (tab4Start !== -1) {
  const tab5Start = lines.findIndex((l, i) => i > tab4Start && l.includes('{/* TAB 5: DELIVERY ORDERS */}'));
  if (tab5Start !== -1) {
    lines.splice(tab4Start, tab5Start - tab4Start, 
`        {/* TAB 4: INVENTORY */}
        {activeTab === "inventory" && (
          <InventoryTab />
        )}
`
    );
  }
}

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Successfully updated page.tsx with InventoryTab');
