const fs = require('fs');
let file = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/app/staff/page.tsx';
let c = fs.readFileSync(file, 'utf8');

// 1. Add destructured props
if (!c.includes('addStockRequest')) {
  c = c.replace(
    /stockCategories,(\s+)updateStoreOrderStatus,/,
    'stockCategories,$1stockRequests,$1addStockRequest,$1updateStoreOrderStatus,'
  );
}

// 2. Add toast state
if (!c.includes('restockToast')) {
  c = c.replace(
    /const \[activeTab, setActiveTab\] = useState<StaffTab>\("dashboard"\);/,
    `const [activeTab, setActiveTab] = useState<StaffTab>("dashboard");
  const [restockToast, setRestockToast] = useState<{show: boolean, itemName: string}>({show: false, itemName: ""});`
  );
}

// 3. Replace Inventory Tab rendering
const searchInventoryTab = `        {/* TAB 4: INVENTORY */}
        {activeTab === "inventory" && (
          <div className="space-y-6">
            <div>
              <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold capitalize text-accent border border-accent/10">Inventory</span>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-[#800000] mt-1.5">Stock Levels</h1>
              <p className="text-sm text-muted">View ingredient levels. Staff cannot manually reduce stock.</p>
            </div>

            <AdminPanel title="Raw Ingredients & Stock Items" subtitle="Read-only stock levels for staff">
              <div className="overflow-x-auto p-2">
                <table className="w-full text-left text-sm min-w-[640px]">
                  <thead>
                    <tr className="admin-table-head text-muted">
                      <th className="px-4 py-3 font-medium rounded-l-lg">Ingredient</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Alert Level</th>
                      <th className="px-4 py-3 font-medium rounded-r-lg text-center">Remaining Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockItems.map((item) => {
                      const isLow = item.quantity <= item.lowStockThreshold;
                      return (
                        <tr key={item.id} className="border-b border-accent/5 last:border-0 hover:bg-accent-light/10">
                          <td className="px-4 py-3 font-medium text-ink">{item.name}</td>
                          <td className="px-4 py-3 text-xs text-muted">{getStockCategoryName(item.categoryId)}</td>
                          <td className="px-4 py-3">
                            <span className={\`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold border \${
                              isLow ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-green-50 text-green-800 border-green-200"
                            }\`}>
                              {isLow ? \`Low stock (<=\${item.lowStockThreshold})\` : "Optimal"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-sm">
                            {item.quantity} <span className="text-xs font-normal text-muted">{item.unit}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </AdminPanel>
          </div>
        )}`;

const replaceInventoryTab = `        {/* TAB 4: INVENTORY */}
        {activeTab === "inventory" && (
          <div className="space-y-6">
            <div>
              <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold capitalize text-accent border border-accent/10">Inventory</span>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-[#800000] mt-1.5">Stock Levels</h1>
              <p className="text-sm text-muted">View ingredient levels. Staff cannot manually reduce stock.</p>
            </div>

            <AdminPanel title="Raw Ingredients & Stock Items" subtitle="Read-only stock levels for staff">
              <div className="overflow-x-auto p-2">
                <table className="w-full text-left text-sm min-w-[800px]">
                  <thead>
                    <tr className="admin-table-head text-muted">
                      <th className="px-4 py-3 font-medium rounded-l-lg w-1/3">Ingredient</th>
                      <th className="px-4 py-3 font-medium w-1/5">Category</th>
                      <th className="px-4 py-3 font-medium w-1/4">Remaining Quantity</th>
                      <th className="px-4 py-3 font-medium w-1/6">Status</th>
                      <th className="px-4 py-3 font-medium rounded-r-lg text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockItems.map((item) => {
                      const isLow = item.quantity <= item.lowStockThreshold;
                      const hasPendingReq = stockRequests?.some(r => r.ingredientId === item.id && r.status === "Pending");
                      return (
                        <tr key={item.id} className="border-b border-accent/5 last:border-0 hover:bg-accent-light/10">
                          <td className="px-4 py-4 align-middle">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-stone-100 flex items-center justify-center shrink-0 border border-stone-200">
                                📦
                              </div>
                              <p className="font-medium text-ink break-words">{item.name}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-middle">
                            <span className="inline-flex items-center text-xs font-semibold text-stone-600 bg-stone-100 px-2 py-1 rounded-md border border-stone-200">
                              {getStockCategoryName(item.categoryId)}
                            </span>
                          </td>
                          <td className="px-4 py-4 align-middle">
                            <div className="w-full">
                              <p className="font-bold text-sm text-stone-800 mb-1">
                                {item.quantity} <span className="text-xs font-normal text-muted">{item.unit}</span>
                              </p>
                              <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
                                <div 
                                  className={\`h-full rounded-full \${isLow ? 'bg-red-500' : 'bg-green-500'}\`} 
                                  style={{ width: \`\${Math.min(100, Math.max(5, (item.quantity / (item.lowStockThreshold * 3)) * 100))}%\` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-middle">
                            {isLow ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
                                Low Stock
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-green-50 text-green-700 border border-green-200">
                                Optimal
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 align-middle text-right">
                            {hasPendingReq ? (
                              <span className="inline-flex items-center px-2 py-1 text-[10px] font-bold text-stone-500 bg-stone-100 rounded-lg">
                                Request Pending
                              </span>
                            ) : (
                              <button
                                onClick={() => {
                                  addStockRequest({
                                    ingredientId: item.id,
                                    itemName: item.name,
                                    staffName: profileName || user?.name || "Staff",
                                    requestedQuantity: item.lowStockThreshold * 2,
                                    unit: item.unit
                                  });
                                  setRestockToast({ show: true, itemName: item.name });
                                  setTimeout(() => setRestockToast({ show: false, itemName: "" }), 3000);
                                }}
                                className="inline-flex items-center px-2.5 py-1 text-xs font-bold text-[#800000] bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors"
                              >
                                Contact Admin
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </AdminPanel>
          </div>
        )}`;

c = c.replace(searchInventoryTab, replaceInventoryTab);

// 4. Add Toast UI to the bottom
if (!c.includes('Restock request sent')) {
  const searchEnd = `    </div>
  );
}`;
  const replaceEnd = `
      {/* RESTOCK TOAST */}
      {restockToast.show && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-white border border-stone-200 shadow-xl rounded-xl p-4 flex items-start gap-3 w-[300px]">
            <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <div>
              <p className="font-bold text-stone-800 text-sm">Restock request sent</p>
              <p className="text-xs text-stone-500 mt-0.5 leading-snug">The Admin has been notified about {restockToast.itemName}.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}`;
  c = c.replace(searchEnd, replaceEnd);
}

fs.writeFileSync(file, c, 'utf8');
console.log('Restored Inventory Ledger and Restock Request.');
