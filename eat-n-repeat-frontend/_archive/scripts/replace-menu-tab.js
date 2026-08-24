const fs = require('fs');

const path = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/app/staff/page.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

// 1. Remove Menu Modal
const modalStart = lines.findIndex(l => l.includes('{/* ADD/EDIT MENU ITEM MODAL */}'));
if (modalStart !== -1) {
  const modalEnd = lines.findIndex((l, i) => i > modalStart && l.includes('</AdminModal>'));
  if (modalEnd !== -1) {
    lines.splice(modalStart, modalEnd - modalStart + 1);
  }
}

// 2. Remove inline TAB 3 and replace with Component
const tab3Start = lines.findIndex(l => l.includes('{/* TAB 3: MENU ITEMS */}'));
if (tab3Start !== -1) {
  const tab4Start = lines.findIndex((l, i) => i > tab3Start && l.includes('{/* TAB 4: INVENTORY */}'));
  if (tab4Start !== -1) {
    lines.splice(tab3Start, tab4Start - tab3Start, 
`        {/* TAB 3: MENU ITEMS */}
        {activeTab === "menu" && (
          <MenuItemsTab />
        )}
`
    );
  }
}

// 3. Remove openAddMenu, openEditMenu, handleMenuSubmit
const openAddMenuStart = lines.findIndex(l => l.includes('function openAddMenu()'));
if (openAddMenuStart !== -1) {
  const handleMenuSubmitEnd = lines.findIndex((l, i) => i > openAddMenuStart && l.includes('setMenuModalOpen(false);')) + 2; // +2 to get the closing brace and newline
  if (handleMenuSubmitEnd !== -1) {
    lines.splice(openAddMenuStart, handleMenuSubmitEnd - openAddMenuStart + 1);
  }
}

// 4. Remove form states
const stateStart = lines.findIndex(l => l.includes('// Form states for adding/editing menu items'));
if (stateStart !== -1) {
  const stateEnd = lines.findIndex((l, i) => i > stateStart && l.includes('image: "",')) + 2;
  if (stateEnd !== -1) {
    lines.splice(stateStart, stateEnd - stateStart + 1);
  }
}

// 5. Add Import statement
lines.splice(20, 0, `import { MenuItemsTab } from "@/components/admin/MenuItemsTab";`);

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Successfully updated page.tsx with MenuItemsTab');
