const fs = require('fs');
const path = require('path');

const filePath = path.join('c:', 'Eat n RepEat Cafe', 'eat-n-repeat-frontend', 'app', 'staff', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const newSidebarAndDashboard = `      {/* LEFT SIDEBAR */}
      <aside className="admin-sidebar fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-y-auto text-white shadow-xl">
        <div className="border-b border-white/10 px-6 py-6">
          <Logo size="md" showText={false} />
          <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-white/50">
            Staff Portal
          </p>
          <p className="mt-1 font-script text-xl text-white/90">Eat n&apos; Repeat</p>
        </div>

        <nav className="flex-1 space-y-1.5 px-4 py-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={\`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all \${
                activeTab === tab.id
                  ? "bg-white/15 text-white font-bold"
                  : "text-white/70 hover:bg-white/5 font-medium"
              }\`}
            >
              <span className={\`flex h-8 w-8 shrink-0 items-center justify-center rounded-md \${
                activeTab === tab.id ? "text-white" : "text-white/70"
              }\`}>
                {tab.icon}
              </span>
              <span className="text-sm">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* FOOTER USER CARD */}
        <div className="border-t border-white/10 px-6 py-5">
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-bold text-white/95">{user.name}</p>
              <p className="text-xs text-white/50 capitalize">{user.role.replace("_", " ")}</p>
            </div>
            <button
              onClick={logout}
              className="flex w-full items-center gap-2 rounded-md bg-white/10 py-2 px-3 text-xs font-semibold text-white transition-all hover:bg-white/20 cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN MAIN AREA */}
      <main className="relative z-10 pl-64 flex-1 mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        
        {/* TAB 1: DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* 1. HEADER / WELCOME AREA */}
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="font-serif text-2xl font-bold tracking-tight text-[#5A1824] sm:text-3xl">Good afternoon, {user.name.split(" ")[0]}!</h1>
                <p className="mt-1 text-sm text-[#817875]">Here&apos;s what&apos;s happening at Eat n&apos; Repeat today.</p>
              </div>
              <div className="flex items-center gap-4 text-sm font-medium text-[#2B2523]">
                <p className="hidden sm:block text-[#817875]">
                  {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </p>
                <div className="h-4 w-px bg-[#817875]/20 hidden sm:block"></div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <span className="text-xl">🔔</span>
                    {stockNotifications.length > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#A51D35] px-1 text-[9px] font-bold text-white">{stockNotifications.length}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-[#5A1824]/10 bg-white px-3 py-1.5 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-green-500"></span>
                  <span className="text-xs">Online</span>
                  <span className="ml-1 font-bold text-[#5A1824]">{user.name.split(" ")[0]}</span>
                </div>
              </div>
            </header>

            {/* 2. SUMMARY / KPI SECTION */}
            <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              {[
                { label: "Today's Orders", value: salesSummary.totalOrders, note: "All order channels", color: "text-[#5A1824]" },
                { label: "Pending Orders", value: salesSummary.pendingOrders, note: "Needs attention", color: "text-[#A51D35]" },
                { label: "Today's Sales", value: \`₱\${salesSummary.totalSales.toLocaleString()}\`, note: "Today's revenue", color: "text-[#2B2523]" },
                { label: "Completed", value: salesSummary.completedOrders, note: "Served or delivered", color: "text-green-700" },
                { label: "Low Stock", value: stockNotifications.length, note: "Items to restock", color: "text-[#A51D35]" },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col justify-center rounded-2xl border border-[#5A1824]/10 bg-white/90 p-4 shadow-sm backdrop-blur-sm">
                  <p className="text-xs font-semibold text-[#817875]">{stat.label}</p>
                  <p className={\`mt-1 font-serif text-2xl font-bold \${stat.color}\`}>{stat.value}</p>
                  <p className="mt-1 text-[10px] text-[#817875]">{stat.note}</p>
                </div>
              ))}
            </section>

            {/* MAIN GRID */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* LEFT COLUMN: TODAY'S ORDERS & SALES */}
              <div className="space-y-6 lg:col-span-2">
                
                {/* 4. TODAY'S ORDERS */}
                <AdminPanel title="Today's Orders" subtitle="Most recent orders" action={<button onClick={() => setActiveTab("orders")} className="text-xs font-bold text-[#A51D35] hover:underline">View all &rarr;</button>}>
                  <div className="divide-y divide-[#5A1824]/10 px-5">
                    {storeOrders.filter((order) => !order.archived).slice(0, 5).map((order) => (
                      <div key={order.id} className="flex flex-wrap items-center justify-between gap-4 py-3.5 text-sm">
                        <div className="flex flex-col">
                          <span className="font-bold text-[#5A1824]">{order.orderId}</span>
                          <span className="text-xs text-[#817875] mt-0.5">Dine-in/Takeout &middot; {order.time}</span>
                        </div>
                        <div className="min-w-[120px] flex-1">
                          <span className="text-xs font-medium text-[#2B2523]">{order.items}</span>
                        </div>
                        <span className="font-semibold text-[#2B2523]">₱{order.total}</span>
                        <span className={\`flex w-20 justify-center rounded-full px-2 py-1 text-[10px] font-bold capitalize \${
                          order.status === "completed" ? "bg-green-100 text-green-700" :
                          order.status === "cancelled" ? "bg-stone-100 text-stone-600" :
                          "bg-amber-100 text-amber-800"
                        }\`}>
                          {order.status}
                        </span>
                      </div>
                    ))}
                    {storeOrders.filter((order) => !order.archived).length === 0 && <p className="py-8 text-center text-sm text-[#817875]">No orders today.</p>}
                  </div>
                </AdminPanel>

                {/* 7. SALES OVERVIEW & 5. ORDER STATUS OVERVIEW */}
                <div className="grid gap-6 sm:grid-cols-2">
                  <AdminPanel title="Sales Today" subtitle="Current performance">
                    <div className="flex flex-col items-center justify-center py-8">
                      <p className="font-serif text-4xl font-bold text-[#5A1824]">₱{salesSummary.totalSales.toLocaleString()}</p>
                      <p className="mt-2 text-sm font-medium text-[#817875]">{salesSummary.totalOrders} total orders</p>
                    </div>
                  </AdminPanel>
                  
                  <AdminPanel title="Order Status" subtitle="Workload overview">
                    <div className="flex h-full flex-col justify-center px-6 py-4 gap-4">
                      {[
                        { label: "Pending", count: salesSummary.pendingOrders, color: "bg-amber-100 text-amber-800" },
                        { label: "Completed", count: salesSummary.completedOrders, color: "bg-green-100 text-green-700" }
                      ].map(s => (
                        <div key={s.label} className="flex items-center justify-between">
                          <span className="text-sm font-medium text-[#2B2523]">{s.label}</span>
                          <span className={\`rounded-full px-2.5 py-0.5 text-xs font-bold \${s.color}\`}>{s.count}</span>
                        </div>
                      ))}
                    </div>
                  </AdminPanel>
                </div>

              </div>

              {/* RIGHT COLUMN: NEEDS ATTENTION, INVENTORY, QUICK ACTIONS */}
              <div className="space-y-6">
                
                {/* 3. NEEDS ATTENTION */}
                <AdminPanel title="Needs Attention" subtitle="Handle immediately">
                  <div className="divide-y divide-[#5A1824]/10 px-5">
                    {salesSummary.pendingOrders > 0 && (
                      <div className="flex items-center justify-between py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-2 w-2 rounded-full bg-amber-500"></span>
                          <span className="text-sm font-semibold text-[#2B2523]">{salesSummary.pendingOrders} Pending Orders</span>
                        </div>
                        <button onClick={() => setActiveTab("orders")} className="text-xs font-bold text-[#A51D35] hover:underline">View &rarr;</button>
                      </div>
                    )}
                    {stockNotifications.length > 0 && (
                      <div className="flex items-center justify-between py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-2 w-2 rounded-full bg-[#A51D35]"></span>
                          <span className="text-sm font-semibold text-[#2B2523]">{stockNotifications.length} Low Stock Items</span>
                        </div>
                        <button onClick={() => setActiveTab("inventory")} className="text-xs font-bold text-[#A51D35] hover:underline">View &rarr;</button>
                      </div>
                    )}
                    {storeOrders.filter(o => !o.archived && o.status !== "completed" && !o.paid).length > 0 && (
                      <div className="flex items-center justify-between py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-2 w-2 rounded-full bg-amber-500"></span>
                          <span className="text-sm font-semibold text-[#2B2523]">{storeOrders.filter(o => !o.archived && o.status !== "completed" && !o.paid).length} Unpaid Orders</span>
                        </div>
                        <button onClick={() => setActiveTab("orders")} className="text-xs font-bold text-[#A51D35] hover:underline">View &rarr;</button>
                      </div>
                    )}
                    {salesSummary.pendingOrders === 0 && stockNotifications.length === 0 && storeOrders.filter(o => !o.archived && o.status !== "completed" && !o.paid).length === 0 && (
                      <p className="py-6 text-center text-sm text-[#817875]">Everything is caught up!</p>
                    )}
                  </div>
                </AdminPanel>

                {/* 6. INVENTORY ALERTS */}
                <AdminPanel title="Inventory Alerts" subtitle="Stock levels" action={<button onClick={() => setActiveTab("inventory")} className="text-xs font-bold text-[#A51D35] hover:underline">View all &rarr;</button>}>
                  <div className="divide-y divide-[#5A1824]/10 px-5">
                    {stockNotifications.slice(0, 3).map((alert) => (
                      <div key={alert.id} className="flex flex-col gap-1 py-3.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#2B2523] text-sm">{alert.title.replace("Low stock: ", "")}</span>
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">Critical</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#817875]">{alert.details.split(" (")[0]}</span>
                          <button onClick={() => setActiveTab("inventory")} className="text-[10px] font-bold text-[#A51D35] hover:underline">Restock</button>
                        </div>
                      </div>
                    ))}
                    {stockNotifications.length === 0 && <p className="py-6 text-center text-sm text-[#817875]">Stock is sufficient.</p>}
                  </div>
                </AdminPanel>

                {/* 8. QUICK ACTIONS */}
                <AdminPanel title="Quick Actions" subtitle="Shortcuts">
                  <div className="grid grid-cols-2 gap-3 px-5 py-4">
                    {[
                      { label: "New Order (POS)", action: () => setActiveTab("pos") },
                      { label: "View Orders", action: () => setActiveTab("orders") },
                      { label: "Add Menu Item", action: () => { setActiveTab("menu"); setTimeout(openAddMenu, 100); } },
                      { label: "Add Stock", action: () => setActiveTab("inventory") },
                    ].map((btn) => (
                      <button
                        key={btn.label}
                        onClick={btn.action}
                        className="flex flex-col items-center justify-center rounded-xl border border-[#5A1824]/10 bg-[#FAF7F2] p-3 text-xs font-semibold text-[#5A1824] transition-colors hover:bg-[#5A1824]/5"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </AdminPanel>

              </div>
            </div>

          </div>
        )}`;

let startIndex = -1;
let endIndex = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('{/* LEFT SIDEBAR */}')) {
    startIndex = i;
  }
  if (startIndex !== -1 && lines[i].includes('        {/* TAB 2: CUSTOMER ORDERS */}')) {
    endIndex = i;
    break;
  }
}

if (startIndex !== -1 && endIndex !== -1) {
  const newLines = [
    ...lines.slice(0, startIndex),
    newSidebarAndDashboard,
    ...lines.slice(endIndex)
  ];
  fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
  console.log('Successfully updated page.tsx');
} else {
  console.log('Failed to find start or end index', startIndex, endIndex);
}
