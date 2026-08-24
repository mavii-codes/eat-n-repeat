const fs = require('fs');
const path = require('path');

const filePath = path.join('c:', 'Eat n RepEat Cafe', 'eat-n-repeat-frontend', 'app', 'staff', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const newSidebarAndDashboard = `      {/* MOBILE OVERLAY */}
      {isMobileSidebarOpen && <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden" onClick={() => setIsMobileSidebarOpen(false)} />}
      
      {/* LEFT SIDEBAR */}
      <aside className={\`admin-sidebar fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-y-auto text-white shadow-xl transition-transform duration-300 md:translate-x-0 \${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}\`}>
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
              onClick={() => { setActiveTab(tab.id); setIsMobileSidebarOpen(false); }}
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
      <main className="relative z-10 md:pl-64 flex-1 mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        
        {/* TAB 1: DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            
            {/* 1. HEADER / WELCOME AREA */}
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-[#5A1824]/10 pb-4 mb-2">
              <div>
                <div className="flex items-center gap-4 mb-2 md:hidden">
                   <button onClick={() => setIsMobileSidebarOpen(true)} className="p-2 text-[#5A1824] bg-white rounded-lg shadow-sm border border-[#5A1824]/10">
                     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
                   </button>
                   <Logo size="sm" showText={false} />
                   <span className="font-script text-lg text-[#5A1824]">Eat n&apos; Repeat</span>
                </div>
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#5A1824]">STAFF WORKSPACE</p>
                <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight text-[#5A1824] sm:text-4xl">Good afternoon!</h1>
                <p className="mt-2 text-sm text-[#817875]">Here&apos;s what&apos;s happening at Eat n&apos; Repeat today.</p>
              </div>
              <div className="flex flex-col items-start sm:items-end text-sm font-medium text-[#2B2523]">
                <p className="text-[#817875] mb-2 hidden sm:block">
                  {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </p>
                <div className="flex items-center gap-2 rounded-full border border-[#5A1824]/10 bg-white/70 px-3 py-1.5 shadow-sm backdrop-blur-sm">
                  <span className="text-xl font-bold text-[#5A1824]">( ! )</span>
                  <span className="text-xs font-bold text-[#5A1824]">Notifications</span>
                  {stockNotifications.length > 0 && <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#A51D35] px-1 text-[9px] font-bold text-white">{stockNotifications.length}</span>}
                </div>
              </div>
            </header>

            {/* 2. SUMMARY / KPI SECTION */}
            <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              {[
                { label: "ORDERS", value: salesSummary.totalOrders, color: "text-[#5A1824]" },
                { label: "PENDING", value: salesSummary.pendingOrders, color: "text-[#A51D35]" },
                { label: "SALES", value: \`₱\${salesSummary.totalSales.toLocaleString()}\`, color: "text-[#2B2523]" },
                { label: "COMPLETED", value: salesSummary.completedOrders, color: "text-green-700" },
                { label: "LOW STOCK", value: stockNotifications.length, color: "text-[#A51D35]" },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col items-center justify-center rounded-2xl border border-white/40 bg-white/80 p-5 shadow-sm backdrop-blur-md">
                  <p className="text-[10px] font-bold text-[#817875] tracking-widest">{stat.label}</p>
                  <p className={\`mt-2 font-serif text-3xl font-bold \${stat.color}\`}>{stat.value}</p>
                </div>
              ))}
            </section>

            {/* MAIN GRID */}
            <div className="grid gap-6 lg:grid-cols-2">
              
              {/* LEFT COLUMN: CUSTOMER ORDERS & ACTIVITY */}
              <div className="space-y-6">
                
                {/* 4. CUSTOMER ORDERS */}
                <AdminPanel title="CUSTOMER ORDERS" action={<button onClick={() => setActiveTab("orders")} className="text-xs font-bold text-[#A51D35] hover:underline">View all customer orders &rarr;</button>}>
                  <div className="divide-y divide-[#5A1824]/10 px-5 bg-white/40 backdrop-blur-sm rounded-b-xl">
                    {storeOrders.filter((order) => !order.archived).slice(0, 5).map((order) => (
                      <div key={order.id} className="flex flex-wrap items-center justify-between gap-4 py-3.5 text-sm">
                        <div className="flex flex-col">
                          <span className="font-bold text-[#5A1824]">{order.orderId}</span>
                          <span className="text-xs text-[#817875] mt-0.5">{order.time}</span>
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
                    {storeOrders.filter((order) => !order.archived).length === 0 && <p className="py-8 text-center text-sm text-[#817875]">No active customer orders.</p>}
                  </div>
                </AdminPanel>

                {/* 5. CUSTOMER ORDER STATUS SUMMARY */}
                <AdminPanel title="ORDER STATUS SUMMARY">
                  <div className="flex h-full flex-col justify-center px-6 py-4 gap-4 bg-white/40 backdrop-blur-sm rounded-b-xl">
                    {[
                      { label: "Pending", count: salesSummary.pendingOrders, color: "bg-amber-100 text-amber-800" },
                      { label: "Preparing", count: storeOrders.filter(o => o.status === "preparing").length, color: "bg-blue-100 text-blue-800" },
                      { label: "Ready", count: storeOrders.filter(o => o.status === "ready").length, color: "bg-purple-100 text-purple-800" },
                      { label: "Completed", count: salesSummary.completedOrders, color: "bg-green-100 text-green-700" }
                    ].map(s => (
                      <div key={s.label} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[#2B2523]">{s.label}</span>
                        <span className={\`rounded-full px-2.5 py-0.5 text-xs font-bold \${s.color}\`}>{s.count}</span>
                      </div>
                    ))}
                  </div>
                </AdminPanel>
                
                {/* 6. CUSTOMER ACTIVITY */}
                <AdminPanel title="CUSTOMER ACTIVITY" action={<button onClick={() => setActiveTab("reviews")} className="text-xs font-bold text-[#A51D35] hover:underline">View all &rarr;</button>}>
                  <div className="divide-y divide-[#5A1824]/10 px-5 bg-white/40 backdrop-blur-sm rounded-b-xl">
                    {/* Recent Orders (Simulation of activity) */}
                    {storeOrders.filter((order) => !order.archived).slice(0, 2).map(order => (
                      <div key={\`act-ord-\${order.id}\`} className="flex flex-col gap-1 py-3.5">
                        <span className="text-sm font-bold text-[#2B2523]">New order</span>
                        <span className="text-xs text-[#817875]">{order.orderId} &middot; {order.time}</span>
                      </div>
                    ))}
                    {storeOrders.filter(o => !o.paid && !o.archived).slice(0, 1).map(order => (
                       <div key={\`act-pay-\${order.id}\`} className="flex flex-col gap-1 py-3.5">
                         <span className="text-sm font-bold text-amber-600">Waiting for confirmation</span>
                         <span className="text-xs text-[#817875]">{order.orderId} is awaiting payment &middot; {order.time}</span>
                       </div>
                    ))}
                    {/* Recent Reviews */}
                    {reviews && reviews.slice(0, 2).map(review => (
                      <div key={\`act-rev-\${review.id}\`} className="flex flex-col gap-1 py-3.5">
                        <span className="text-sm font-bold text-[#2B2523]">New customer review</span>
                        <div className="flex items-center gap-2">
                           <span className="text-[#A51D35] text-xs">{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</span>
                           <span className="text-xs text-[#817875]">&middot; {new Date(review.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                    {storeOrders.length === 0 && (!reviews || reviews.length === 0) && <p className="py-6 text-center text-sm text-[#817875]">No recent activity.</p>}
                  </div>
                </AdminPanel>

              </div>

              {/* RIGHT COLUMN: NEEDS ATTENTION, INVENTORY, QUICK ACTIONS */}
              <div className="space-y-6">
                
                {/* 3. NEEDS ATTENTION */}
                <AdminPanel title="NEEDS ATTENTION" action={<button onClick={() => setActiveTab("orders")} className="text-xs font-bold text-[#A51D35] hover:underline">View all &rarr;</button>}>
                  <div className="divide-y divide-[#5A1824]/10 px-5 bg-white/40 backdrop-blur-sm rounded-b-xl">
                    {salesSummary.pendingOrders > 0 && (
                      <div className="flex items-center justify-between py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-[#2B2523]">({salesSummary.pendingOrders}) Pending Orders</span>
                        </div>
                      </div>
                    )}
                    {stockNotifications.length > 0 && (
                      <div className="flex items-center justify-between py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-[#2B2523]">({stockNotifications.length}) Low Stock Items</span>
                        </div>
                      </div>
                    )}
                    {storeOrders.filter(o => !o.archived && o.status !== "completed" && !o.paid).length > 0 && (
                      <div className="flex items-center justify-between py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-[#2B2523]">({storeOrders.filter(o => !o.archived && o.status !== "completed" && !o.paid).length}) Delivery Updates / Unpaid</span>
                        </div>
                      </div>
                    )}
                    {salesSummary.pendingOrders === 0 && stockNotifications.length === 0 && storeOrders.filter(o => !o.archived && o.status !== "completed" && !o.paid).length === 0 && (
                      <p className="py-6 text-center text-sm text-[#817875]">Everything is caught up!</p>
                    )}
                  </div>
                </AdminPanel>

                {/* 6. INVENTORY ALERTS */}
                <AdminPanel title="INVENTORY ALERTS" action={<button onClick={() => setActiveTab("inventory")} className="text-xs font-bold text-[#A51D35] hover:underline">Open Stock &rarr;</button>}>
                  <div className="divide-y divide-[#5A1824]/10 px-5 bg-white/40 backdrop-blur-sm rounded-b-xl">
                    {stockNotifications.slice(0, 3).map((alert) => (
                      <div key={alert.id} className="flex flex-col gap-1 py-3.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#2B2523] text-sm">{alert.title.replace("Low stock: ", "")}</span>
                          <span className={\`rounded px-1.5 py-0.5 text-[10px] font-bold \${alert.details.includes("0 ") ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}\`}>{alert.details.includes("0 ") ? "Critical" : "Low"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#817875]">{alert.details.split(" (")[0]}</span>
                        </div>
                      </div>
                    ))}
                    {stockNotifications.length === 0 && <p className="py-6 text-center text-sm text-[#817875]">Stock is sufficient.</p>}
                  </div>
                </AdminPanel>

                {/* 8. QUICK ACTIONS */}
                <AdminPanel title="QUICK ACTIONS">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-5 py-4 bg-white/40 backdrop-blur-sm rounded-b-xl">
                    {[\
                      { label: "Add Menu", action: () => { setActiveTab("menu"); setTimeout(() => setMenuModalOpen(true), 100); } },
                      { label: "Add Stock", action: () => setActiveTab("inventory") },
                      { label: "Customer Orders", action: () => setActiveTab("orders") },
                      { label: "POS", action: () => setActiveTab("pos") },
                    ].map((btn) => (
                      <button
                        key={btn.label}
                        onClick={btn.action}
                        className="flex flex-col items-center justify-center text-center rounded-xl border border-[#5A1824]/20 bg-white/60 p-3 text-xs font-semibold text-[#5A1824] transition-colors hover:bg-white/90"
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
