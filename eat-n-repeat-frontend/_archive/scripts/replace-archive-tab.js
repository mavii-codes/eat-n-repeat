const fs = require('fs');

const path = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/app/staff/page.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

// 1. Add ArchiveTab import
lines.splice(21, 0, `import { ArchiveTab } from "@/components/admin/ArchiveTab";`);

// 2. Add "archive" to StaffTab type
const typeIndex = lines.findIndex(l => l.includes('type StaffTab ='));
if (typeIndex !== -1) {
  lines[typeIndex] = lines[typeIndex].replace(';', ' | "archive";');
}

// 3. Add archive to tabs list
const tabsIndex = lines.findIndex(l => l.includes('id: "inventory"'));
if (tabsIndex !== -1) {
  // Go up to the start of the object and insert before it
  let insertIndex = tabsIndex;
  while (!lines[insertIndex].includes('{') && insertIndex > 0) {
    insertIndex--;
  }
  
  const archiveTabDef = `      {
        id: "archive",
        label: "Archived Items",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <polyline points="21 8 21 21 3 21 3 8" />
            <rect x="1" y="3" width="22" height="5" />
            <line x1="10" y1="12" x2="14" y2="12" />
          </svg>
        ),
      },`;
  lines.splice(insertIndex, 0, archiveTabDef);
}

// 4. Add rendering block
const renderIndex = lines.findIndex(l => l.includes('{/* TAB 4: INVENTORY */}'));
if (renderIndex !== -1) {
  lines.splice(renderIndex, 0, `        {/* TAB: ARCHIVE */}
        {activeTab === "archive" && (
          <ArchiveTab />
        )}\n`);
}

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Successfully updated page.tsx with ArchiveTab');
