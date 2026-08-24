const fs = require('fs');
const path = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/app/admin/stock/page.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

// 1. Add StockRequest to types import
const typeImportIdx = lines.findIndex(l => l.includes('import type { StockCategory'));
if (typeImportIdx !== -1) {
  lines[typeImportIdx] = lines[typeImportIdx].replace('StockItem, StockItemInput }', 'StockItem, StockItemInput, StockRequest }');
}

// 2. Add lucide icons import
const iconsImportIdx = lines.findIndex(l => l.includes('import { AdminPageHeader }'));
if (iconsImportIdx !== -1) {
  lines.splice(iconsImportIdx, 0, 'import { CheckCircle2, XCircle, Clock } from "lucide-react";');
}

// 3. Add to useAdminData
const useAdminIdx = lines.findIndex(l => l.includes('getStockItemsByCategory,'));
if (useAdminIdx !== -1) {
  lines.splice(useAdminIdx, 0, '    stockRequests,', '    updateStockRequestStatus,');
}

// 4. Add state for resolving request
const stateIdx = lines.findIndex(l => l.includes('const [categoryForm, setCategoryForm]'));
if (stateIdx !== -1) {
  lines.splice(stateIdx + 1, 0, 
    '  const [resolvingRequest, setResolvingRequest] = useState<{ req: StockRequest, action: "Approved" | "Rejected" } | null>(null);',
    '  const [adminNote, setAdminNote] = useState("");'
  );
}

// 5. Add action handlers
const handlerIdx = lines.findIndex(l => l.includes('function handleCategoryDelete'));
if (handlerIdx !== -1) {
  lines.splice(handlerIdx - 1, 0, 
    '',
    '  function handleResolveSubmit() {',
    '    if (!resolvingRequest) return;',
    '    updateStockRequestStatus(resolvingRequest.req.id, resolvingRequest.action, adminNote);',
    '    setResolvingRequest(null);',
    '    setAdminNote("");',
    '  }',
    ''
  );
}

// 6. Add Requests panel
const kpiEndIdx = lines.findIndex(l => l.includes('</section>') && lines[l - 3]?.includes('admin-stat-card'));
// Actually, let's just find `<div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">`
const gridIdx = lines.findIndex(l => l.includes('<div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">'));
if (gridIdx !== -1) {
  const panelHtml = [
    '      <section className="mt-5">',
    '        <AdminPanel title="Restock Requests" subtitle="Manage incoming staff inventory requests">',
    '          <div className="overflow-x-auto px-2 pb-2">',
    '            <table className="w-full min-w-[800px] text-left text-sm">',
    '              <thead>',
    '                <tr className="admin-table-head text-muted">',
    '                  <th className="rounded-l-lg px-4 py-3 font-medium">Ingredient</th>',
    '                  <th className="px-4 py-3 font-medium">Status / Qty</th>',
    '                  <th className="px-4 py-3 font-medium">Requested By</th>',
    '                  <th className="px-4 py-3 font-medium">Date</th>',
    '                  <th className="rounded-r-lg px-4 py-3 font-medium text-right">Actions</th>',
    '                </tr>',
    '              </thead>',
    '              <tbody>',
    '                {[...(stockRequests || [])]',
    '                  .sort((a, b) => {',
    '                     if (a.status === "Pending" && b.status !== "Pending") return -1;',
    '                     if (a.status !== "Pending" && b.status === "Pending") return 1;',
    '                     return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();',
    '                  })',
    '                  .map(req => (',
    '                  <tr key={req.id} className="border-b border-accent/5 last:border-0">',
    '                    <td className="px-4 py-3">',
    '                      <p className="font-semibold text-[#800000]">{req.ingredientName}</p>',
    '                      {(req.status === "Approved" || req.status === "Rejected") && req.adminNote && (',
    '                        <p className="text-xs text-muted mt-0.5"><span className="font-semibold">Note:</span> {req.adminNote}</p>',
    '                      )}',
    '                    </td>',
    '                    <td className="px-4 py-3">',
    '                      <div className="flex items-center gap-2">',
    '                        {req.status === "Pending" && <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md"><Clock className="w-3 h-3" /> Pending</span>}',
    '                        {req.status === "Approved" && <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md"><CheckCircle2 className="w-3 h-3" /> Approved</span>}',
    '                        {req.status === "Rejected" && <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md"><XCircle className="w-3 h-3" /> Rejected</span>}',
    '                        <span className="text-xs text-muted ml-1">{req.currentQuantity} / {req.threshold} left</span>',
    '                      </div>',
    '                    </td>',
    '                    <td className="px-4 py-3 text-muted">{req.staffName}</td>',
    '                    <td className="px-4 py-3 text-muted">{new Date(req.createdAt).toLocaleString()}</td>',
    '                    <td className="px-4 py-3 text-right">',
    '                      {req.status === "Pending" && (',
    '                        <div className="flex justify-end gap-2">',
    '                          <button onClick={() => { setResolvingRequest({ req, action: "Approved" }); setAdminNote(""); }} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors">Approve</button>',
    '                          <button onClick={() => { setResolvingRequest({ req, action: "Rejected" }); setAdminNote(""); }} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors">Reject</button>',
    '                        </div>',
    '                      )}',
    '                    </td>',
    '                  </tr>',
    '                ))}',
    '                {(!stockRequests || stockRequests.length === 0) && (',
    '                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted text-sm">No restock requests.</td></tr>',
    '                )}',
    '              </tbody>',
    '            </table>',
    '          </div>',
    '        </AdminPanel>',
    '      </section>',
    ''
  ];
  lines.splice(gridIdx, 0, ...panelHtml);
}

// 7. Add resolving modal at the end before `</>`
const endIdx = lines.lastIndexOf('    </>');
if (endIdx !== -1) {
  const modalHtml = [
    '      <AdminModal',
    '        open={!!resolvingRequest}',
    '        title={resolvingRequest?.action === "Approved" ? "Approve Restock" : "Reject Restock"}',
    '        onClose={() => setResolvingRequest(null)}',
    '        footer={',
    '          <>',
    '            <AdminButton variant="secondary" onClick={() => setResolvingRequest(null)}>Cancel</AdminButton>',
    '            <AdminButton onClick={handleResolveSubmit} className={resolvingRequest?.action === "Rejected" ? "!bg-red-600 hover:!bg-red-700 !border-red-700" : "!bg-emerald-600 hover:!bg-emerald-700 !border-emerald-700"}>',
    '              Confirm {resolvingRequest?.action}',
    '            </AdminButton>',
    '          </>',
    '        }',
    '      >',
    '        <div className="space-y-4">',
    '          <p className="text-sm text-muted">You are about to <strong>{resolvingRequest?.action.toLowerCase()}</strong> the restock request for <strong className="text-[#800000]">{resolvingRequest?.req.ingredientName}</strong>.</p>',
    '          <AdminField label="Admin Note (Optional)">',
    '            <textarea',
    '              className="w-full rounded-xl border border-accent/20 bg-white/50 px-4 py-2.5 text-sm text-[#5A1824] placeholder:text-muted/60 focus:border-accent focus:bg-white focus:outline-none focus:ring-1 focus:ring-accent"',
    '              rows={3}',
    '              placeholder="Add a note for the staff member..."',
    '              value={adminNote}',
    '              onChange={(e) => setAdminNote(e.target.value)}',
    '            />',
    '          </AdminField>',
    '        </div>',
    '      </AdminModal>'
  ];
  lines.splice(endIdx, 0, ...modalHtml);
}

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Successfully patched stock/page.tsx');
