const fs = require('fs');
const path = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/components/admin/InventoryTab.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

// 1. Imports
const importIndex = lines.findIndex(l => l.includes('import { useState, useMemo }'));
if (importIndex !== -1) {
  lines[importIndex] = 'import { useState, useMemo, useEffect, useRef } from "react";';
}
const iconImportIndex = lines.findIndex(l => l.includes('XCircle } from "lucide-react";'));
if (iconImportIndex !== -1) {
  lines[iconImportIndex] = lines[iconImportIndex].replace('XCircle }', 'XCircle, Check }');
}

// 2. Add toast state & logic
const stateIndex = lines.findIndex(l => l.includes('const [isContactModalOpen, setIsContactModalOpen] = useState(false);'));
if (stateIndex !== -1) {
  lines.splice(stateIndex, 0, 
    '  const [toastMessage, setToastMessage] = useState<{title: string, desc: string} | null>(null);',
    '  const prevRequestsRef = useRef<typeof stockRequests>([]);',
    '',
    '  useEffect(() => {',
    '    if (!user) return;',
    '    const currentMyRequests = (stockRequests || []).filter(req => req.staffId === user.id);',
    '    const prevMyRequests = prevRequestsRef.current.filter(req => req.staffId === user.id);',
    '',
    '    currentMyRequests.forEach(currentReq => {',
    '      const prevReq = prevMyRequests.find(r => r.id === currentReq.id);',
    '      if (prevReq && prevReq.status === "Pending" && currentReq.status !== "Pending") {',
    '        setToastMessage({',
    '          title: `Restock request ${currentReq.status.toLowerCase()}`,',
    '          desc: `The Admin has ${currentReq.status.toLowerCase()} your request for ${currentReq.ingredientName}.`',
    '        });',
    '        setTimeout(() => setToastMessage(null), 5000);',
    '      }',
    '    });',
    '    prevRequestsRef.current = stockRequests || [];',
    '  }, [stockRequests, user]);',
    ''
  );
}

// 3. Replace alert
const alertIndex = lines.findIndex(l => l.includes('alert("Request sent to Admin!");'));
if (alertIndex !== -1) {
  lines.splice(alertIndex, 1, 
    '    setToastMessage({',
    '      title: "Restock request sent",',
    '      desc: `The Admin has been notified about ${selectedItemForRequest.name}.`',
    '    });',
    '    setTimeout(() => setToastMessage(null), 5000);'
  );
}

// 4. Update the "Contact Admin" button in the Low Stock alerts (around line 200)
// We need to find the map where it renders the alert items.
const mapIndex = lines.findIndex(l => l.includes('alertsList.map(item => {'));
if (mapIndex !== -1) {
  // Let's find the button inside this map
  const btnIdx = lines.findIndex((l, i) => i > mapIndex && l.includes('onClick={() => openContactAdminModal(item)}'));
  if (btnIdx !== -1) {
    // We must define isPending inside the map.
    lines.splice(mapIndex + 2, 0, '                const isPending = (stockRequests || []).some(req => req.ingredientId === item.id && req.status === "Pending");');
    
    // Now replace the button
    const btnStart = lines.findIndex((l, i) => i > mapIndex && l.includes('<button'));
    const btnEnd = lines.findIndex((l, i) => i > btnStart && l.includes('</button>'));
    
    const newBtn = [
      '                <button',
      '                  onClick={() => openContactAdminModal(item)}',
      '                  disabled={isPending}',
      '                  className={`mt-2 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-colors ${isPending ? "bg-stone-200 text-stone-500 cursor-not-allowed" : isOut ? "bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-200" : "bg-amber-600 hover:bg-amber-700 text-white shadow-sm shadow-amber-200"}`}',
      '                >',
      '                  <Send className="w-3.5 h-3.5" />',
      '                  {isPending ? "Request Pending" : "Contact Admin"}',
      '                </button>'
    ];
    lines.splice(btnStart, btnEnd - btnStart + 1, ...newBtn);
  }
}

// 5. Update history widget status styles
const handledIndex = lines.findIndex(l => l.includes('req.status === "Handled"'));
while (lines.findIndex(l => l.includes('req.status === "Handled"')) !== -1) {
  const idx = lines.findIndex(l => l.includes('req.status === "Handled"'));
  lines[idx] = lines[idx].replace(/req\.status === "Handled"/g, 'req.status === "Approved"');
}
// Add Rejected style handling
const dotIdx = lines.findIndex(l => l.includes("req.status === 'Approved' ? 'bg-emerald-500' : 'bg-amber-500'"));
if (dotIdx !== -1) {
  lines[dotIdx] = lines[dotIdx].replace("'bg-amber-500'", "req.status === 'Rejected' ? 'bg-red-500' : 'bg-amber-500'");
}
const textIdx = lines.findIndex(l => l.includes("req.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'"));
if (textIdx !== -1) {
  lines[textIdx] = lines[textIdx].replace("'bg-amber-50 text-amber-700 border border-amber-200'", "req.status === 'Rejected' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'");
}

// 6. Add toast to return block
const returnIndex = lines.lastIndexOf('    </div>');
if (returnIndex !== -1) {
  lines.splice(returnIndex, 0, 
    '      {/* TOAST NOTIFICATION */}',
    '      {toastMessage && (',
    '        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">',
    '          <div className="bg-white rounded-xl shadow-xl shadow-[#5A1824]/5 border border-[#5A1824]/10 p-4 flex items-start gap-3 max-w-sm">',
    '            <div className="bg-emerald-100 text-emerald-700 rounded-full p-1 mt-0.5 shrink-0">',
    '              <Check className="w-4 h-4" />',
    '            </div>',
    '            <div>',
    '              <h4 className="text-sm font-bold text-[#5A1824]">{toastMessage.title}</h4>',
    '              <p className="text-xs text-[#817875] mt-1">{toastMessage.desc}</p>',
    '            </div>',
    '          </div>',
    '        </div>',
    '      )}'
  );
}

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Successfully patched InventoryTab.tsx');
