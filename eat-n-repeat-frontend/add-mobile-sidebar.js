const fs = require('fs');
const path = require('path');

const filePath = path.join('c:', 'Eat n RepEat Cafe', 'eat-n-repeat-frontend', 'app', 'staff', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('isMobileSidebarOpen')) {
  content = content.replace(
    'const [activeTab, setActiveTab] = useState<StaffTab>("dashboard");',
    'const [activeTab, setActiveTab] = useState<StaffTab>("dashboard");\n  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);'
  );
}

content = content.replace(
  '<aside className="admin-sidebar fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-y-auto text-white shadow-xl">',
  '<aside className={`admin-sidebar fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-y-auto text-white shadow-xl transition-transform duration-300 md:translate-x-0 ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>'
);

content = content.replace(
  '<aside className={`admin-sidebar',
  '{isMobileSidebarOpen && <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden" onClick={() => setIsMobileSidebarOpen(false)} />}\n      <aside className={`admin-sidebar'
);

content = content.replace(
  '<main className="relative z-10 pl-64 flex-1 mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">',
  '<main className="relative z-10 md:pl-64 flex-1 mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">'
);

content = content.replace(
  '<header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">',
  `<header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-center justify-between md:hidden mb-2 border-b border-[#5A1824]/10 pb-4">
                <div className="flex items-center gap-2">
                  <Logo size="sm" showText={false} />
                  <span className="font-script text-lg text-[#5A1824]">Eat n' Repeat</span>
                </div>
                <button onClick={() => setIsMobileSidebarOpen(true)} className="p-2 text-[#5A1824] bg-white rounded-lg shadow-sm border border-[#5A1824]/10">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
                </button>
              </div>`
);

content = content.replaceAll(
  'onClick={() => setActiveTab(tab.id)}',
  'onClick={() => { setActiveTab(tab.id); setIsMobileSidebarOpen(false); }}'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Added mobile sidebar functionality to page.tsx');
