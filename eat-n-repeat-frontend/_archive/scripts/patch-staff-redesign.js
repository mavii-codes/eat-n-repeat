const fs = require('fs');
const path = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/app/staff/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add isMobileMenuOpen state
content = content.replace(
  'const [activeTab, setActiveTab] = useState<StaffTab>("dashboard");',
  'const [activeTab, setActiveTab] = useState<StaffTab>("dashboard");\n  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);'
);

// 2. Modify Sidebar and Main wrapper
const sidebarOld = `      {/* LEFT SIDEBAR */}
      <aside className="admin-sidebar fixed inset-y-0 left-0 z-40 flex w-72 flex-col overflow-y-auto text-white">`;

const sidebarNew = `      {/* MOBILE MENU OVERLAY */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* LEFT SIDEBAR */}
      <aside className={\`admin-sidebar fixed inset-y-0 left-0 z-40 flex w-72 flex-col overflow-y-auto text-white transition-transform duration-300 lg:translate-x-0 \${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}\`}>`;
content = content.replace(sidebarOld, sidebarNew);

const navLinkNew = `              onClick={() => { setActiveTab(tab.id); setIsMobileMenuOpen(false); }}`;
content = content.replace(/onClick=\{\(\) => setActiveTab\(tab\.id\)\}/g, navLinkNew);

const mainOld = `      {/* MAIN MAIN AREA */}
      <main className="relative z-10 pl-72 flex-1 mx-auto max-w-6xl px-8 py-8">`;
const mainNew = `      {/* MAIN MAIN AREA */}
      <main className="relative z-10 lg:pl-72 flex-1 mx-auto max-w-6xl px-4 sm:px-8 py-8 w-full">
        {/* MOBILE HEADER TOGGLE */}
        <div className="lg:hidden flex items-center justify-between mb-6 bg-white/90 p-4 rounded-2xl shadow-sm border border-white/20">
          <div className="flex items-center gap-3">
            <Logo size="sm" showText={false} />
            <span className="font-script text-xl text-[#63131d]">Eat n' Repeat</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-[#63131d] bg-white rounded-lg shadow-sm border border-accent/10">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
          </button>
        </div>`;
content = content.replace(mainOld, mainNew);

// 3. Replace Dashboard Tab content
const dashboardStartMarker = '        {/* TAB 1: DASHBOARD */}';
const dashboardEndMarker = '        {/* TAB 2: CUSTOMER ORDERS */}';

const startIndex = content.indexOf(dashboardStartMarker);
const endIndex = content.indexOf(dashboardEndMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not find dashboard markers");
  process.exit(1);
}

const dashboardNew = `        {/* TAB 1: DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* HEADER */}
            <header className="flex flex-col gap-4 rounded-3xl border border-white/80 bg-white/90 px-6 py-6 shadow-sm backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-accent/80">Staff Workspace</p>
                <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight text-[#63131d]">Good afternoon!</h1>
                <p className="mt-1 text-sm text-[#8a5a5a]">Here's what's happening at Eat n' Repeat today.</p>
                <p className="mt-2 text-xs font-medium text-[#63131d]/60 bg-[#63131d]/5 inline-block px-3 py-1 rounded-full border border-[#63131d]/10">
                  {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button className="relative rounded-full bg-[#fffaf7] p-2.5 text-[#63131d] shadow-sm border border-accent/10 hover:bg-white transition-colors cursor-pointer">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                  {stockNotifications.length > 0 && <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-[#fffaf7]"></span>}
                </button>
              </div>
            </header>

            {/* KPI CARDS */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {[
                { label: "Today's Orders", value: salesSummary.totalOrders, color: "text-[#8b3b25]" },
                { label: "Pending Orders", value: salesSummary.pendingOrders, color: "text-[#9a6100]" },
                { label: "Sales", value: \`₱\${salesSummary.totalSales.toLocaleString()}\`, color: "text-[#24753c]" },
                { label: "Completed", value: salesSummary.completedOrders, color: "text-[#24753c]" },
                { label: "Low Stock", value: stockNotifications.length, color: "text-[#bd2525]" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/60 bg-white/80 p-5 shadow-sm backdrop-blur-sm transition-all hover:shadow-md hover:bg-white/95">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide">{stat.label}</p>
                  <p className={\`mt-2 font-serif text-3xl font-bold \${stat.color}\`}>{stat.value}</p>
                </div>
              ))}
            </section>

            {/* STATUS SUMMARY */}
            <section className="rounded-2xl border border-white/60 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
              <h2 className="text-sm font-bold text-[#63131d] mb-4 flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
                Order Status Summary
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 text-center">
                {[
                  { s: "Pending", c: "bg-amber-50 text-amber-700 border-amber-200" },
                  { s: "Confirmed", c: "bg-blue-50 text-blue-700 border-blue-200" },
                  { s: "Preparing", c: "bg-purple-50 text-purple-700 border-purple-200" },
                  { s: "Ready", c: "bg-teal-50 text-teal-700 border-teal-200" },
                  { s: "Completed", c: "bg-green-50 text-green-700 border-green-200" },
                  { s: "Cancelled", c: "bg-stone-50 text-stone-600 border-stone-200" },
                ].map(status => {
                  const count = [...storeOrders, ...deliveryOrders].filter(o => !o.archived && o.status === status.s.toLowerCase()).length;
                  return (
                    <div key={status.s} className={\`rounded-xl border p-3 flex flex-col items-center justify-center \${status.c}\`}>
                      <span className="text-2xl font-bold">{count}</span>
                      <span className="text-[10px] font-semibold uppercase mt-1 opacity-80">{status.s}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
              {/* LEFT COLUMN: CUSTOMER ORDERS */}
              <div className="space-y-6">
                <AdminPanel title="Customer Orders" subtitle="Today's active orders from all channels" action={<button onClick={() => setActiveTab("orders")} className="text-xs font-bold text-accent hover:underline">View all</button>}>
                  <div className="overflow-x-auto p-1">
                    <table className="w-full text-left text-sm min-w-[500px]">
                      <thead>
                        <tr className="border-b border-accent/10 text-muted">
                          <th className="px-4 py-3 font-medium">ID</th>
                          <th className="px-4 py-3 font-medium">Type</th>
                          <th className="px-4 py-3 font-medium">Items</th>
                          <th className="px-4 py-3 font-medium">Total</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...storeOrders.map(o => ({...o, type: "Dine-in/Pickup"})), ...deliveryOrders.map(o => ({...o, type: "Delivery"}))]
                          .filter(o => !o.archived && o.status !== "completed" && o.status !== "cancelled" && o.status !== "delivered")
                          .sort((a, b) => b.id.localeCompare(a.id))
                          .slice(0, 5)
                          .map((order) => (
                          <tr key={order.id} className="border-b border-accent/5 last:border-0 hover:bg-white/50">
                            <td className="px-4 py-3 font-bold text-[#63131d]">{order.orderId}</td>
                            <td className="px-4 py-3 text-xs font-medium text-muted">{order.type}</td>
                            <td className="px-4 py-3 text-xs text-[#1c1c1c] truncate max-w-[150px]">{order.items}</td>
                            <td className="px-4 py-3 font-semibold text-[#24753c]">₱{order.total}</td>
                            <td className="px-4 py-3">
                              <span className={\`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold capitalize \${
                                order.status === "pending" ? "bg-amber-100 text-amber-800" :
                                order.status === "preparing" ? "bg-purple-100 text-purple-800" :
                                "bg-blue-100 text-blue-800"
                              }\`}>{order.status}</span>
                            </td>
                          </tr>
                        ))}
                        {[...storeOrders, ...deliveryOrders].filter(o => !o.archived && o.status !== "completed" && o.status !== "cancelled" && o.status !== "delivered").length === 0 && (
                          <tr><td colSpan={5} className="py-8 text-center text-sm text-muted">No active orders at the moment.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </AdminPanel>

                <AdminPanel title="Customer Activity" subtitle="Recent interactions & updates">
                  <div className="divide-y divide-accent/5 px-5 py-2">
                    {[...storeOrders.map(o => ({id: o.id, text: \`New in-store order #\${o.orderId} received\`, time: o.time, raw: o})), 
                      ...deliveryOrders.map(o => ({id: o.id, text: \`New delivery order #\${o.orderId} received\`, time: o.time, raw: o}))]
                      .sort((a, b) => b.id.localeCompare(a.id))
                      .slice(0, 4)
                      .map((activity, i) => (
                      <div key={\`act-\${activity.id}-\${i}\`} className="flex items-start gap-3 py-3 text-sm">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#63131d]/10 text-[#63131d]">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                        </span>
                        <div className="flex-1">
                          <p className="text-[#1c1c1c] font-medium">{activity.text}</p>
                          <p className="text-[10px] text-muted mt-0.5">{activity.time}</p>
                        </div>
                      </div>
                    ))}
                    {storeOrders.length === 0 && deliveryOrders.length === 0 && (
                      <p className="py-8 text-center text-sm text-muted">No recent activity to show.</p>
                    )}
                  </div>
                </AdminPanel>
              </div>

              {/* RIGHT COLUMN: ALERTS & ACTIONS */}
              <div className="space-y-6">
                <AdminPanel title="Needs Attention" subtitle="Tasks requiring staff action">
                  <div className="divide-y divide-accent/10 px-5">
                    {salesSummary.pendingOrders > 0 && (
                      <button onClick={() => setActiveTab("orders")} className="w-full flex items-center justify-between py-3.5 hover:bg-white/40 transition-colors text-left group cursor-pointer">
                        <div className="flex items-center gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 font-bold text-sm">◷</span>
                          <div>
                            <p className="text-sm font-bold text-[#63131d] group-hover:text-accent">{salesSummary.pendingOrders} Pending Orders</p>
                            <p className="text-[10px] text-muted">Awaiting confirmation or prep</p>
                          </div>
                        </div>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-muted"><polyline points="9 18 15 12 9 6" /></svg>
                      </button>
                    )}
                    {stockNotifications.length > 0 && (
                      <button onClick={() => setActiveTab("inventory")} className="w-full flex items-center justify-between py-3.5 hover:bg-white/40 transition-colors text-left group cursor-pointer">
                        <div className="flex items-center gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600 font-bold text-sm">!</span>
                          <div>
                            <p className="text-sm font-bold text-[#63131d] group-hover:text-accent">{stockNotifications.length} Low Stock Items</p>
                            <p className="text-[10px] text-muted">Requires replenishment</p>
                          </div>
                        </div>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-muted"><polyline points="9 18 15 12 9 6" /></svg>
                      </button>
                    )}
                    {salesSummary.pendingOrders === 0 && stockNotifications.length === 0 && (
                      <p className="py-6 text-center text-xs text-muted">No urgent tasks at the moment.</p>
                    )}
                  </div>
                </AdminPanel>

                <AdminPanel title="Inventory Alerts" subtitle="Low or out of stock items" action={<button onClick={() => setActiveTab("inventory")} className="text-xs font-bold text-accent hover:underline">Open stock</button>}>
                  <div className="divide-y divide-accent/10 px-5">
                    {stockNotifications.slice(0, 3).map((alert) => (
                      <div key={alert.id} className="flex gap-3 py-3">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-red-50 text-xs font-bold text-red-600">!</span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#63131d]">{alert.title.replace("Low stock: ", "")}</p>
                          <p className="mt-0.5 text-[10px] text-muted">{alert.details}</p>
                        </div>
                      </div>
                    ))}
                    {stockNotifications.length === 0 && (
                      <p className="py-6 text-center text-xs text-muted">Stock levels are healthy.</p>
                    )}
                  </div>
                </AdminPanel>

                <AdminPanel title="Quick Actions" subtitle="Jump to section">
                  <div className="grid grid-cols-2 gap-3 px-4 py-4 text-center text-[11px] font-semibold text-[#63131d]">
                    {[
                      { label: "View Orders", icon: "▣", action: () => setActiveTab("orders") },
                      { label: "Manage Menu", icon: "☷", action: () => setActiveTab("menu") },
                      { label: "Check Stock", icon: "□", action: () => setActiveTab("inventory") },
                      { label: "Open POS", icon: "₱", action: () => setActiveTab("pos") }
                    ].map((action, index) => (
                      <button key={action.label} onClick={action.action} className="group flex flex-col items-center gap-2 rounded-xl py-3 border border-white/50 bg-white/40 hover:bg-white hover:shadow-sm transition-all cursor-pointer">
                        <span className={\`flex h-8 w-8 items-center justify-center rounded-lg text-lg \${["bg-rose-50 text-accent", "bg-emerald-50 text-emerald-700", "bg-blue-50 text-blue-700", "bg-amber-50 text-amber-700"][index]}\`}>{action.icon}</span>
                        {action.label}
                      </button>
                    ))}
                  </div>
                </AdminPanel>
              </div>
            </div>
          </div>
        )}
`;

content = content.substring(0, startIndex) + dashboardNew + content.substring(endIndex);

fs.writeFileSync(path, content, 'utf8');
console.log("Successfully updated the Staff Dashboard!");
