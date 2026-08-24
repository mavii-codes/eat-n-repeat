const fs = require('fs');

const path = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/app/staff/page.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

const startIndex = lines.findIndex(l => l.includes('{/* TAB 2: CUSTOMER ORDERS */}'));
const endIndex = lines.findIndex(l => l.includes('{/* TAB 3: MENU ITEMS */}'));

if (startIndex !== -1 && endIndex !== -1) {
  const newTabContent = `        {/* TAB 2: CUSTOMER ORDERS */}
        {activeTab === "orders" && (
          <CustomerOrdersTab />
        )}
`;
  
  // Replace the lines between startIndex and endIndex
  lines.splice(startIndex, endIndex - startIndex, newTabContent);
  
  // Add import statement at line 20
  lines.splice(20, 0, `import { CustomerOrdersTab } from "@/components/admin/CustomerOrdersTab";`);
  
  fs.writeFileSync(path, lines.join('\n'), 'utf8');
  console.log('Successfully updated page.tsx with CustomerOrdersTab');
} else {
  console.log('Failed to find start or end index', startIndex, endIndex);
}
