const fs = require('fs');
let file = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/app/staff/page.tsx';
let c = fs.readFileSync(file, 'utf8');

const searchTarget = `        {/* TAB 4: INVENTORY */}
        {activeTab === "inventory" && (
          <InventoryTab />
        )}

                  {profileError && (`;

const replaceTarget = `        {/* TAB 4: INVENTORY */}
        {activeTab === "inventory" && (
          <InventoryTab />
        )}

        {/* TAB 5: DELIVERY ORDERS */}
        {activeTab === "delivery" && (
          <div className="space-y-6">
            <div>
              <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold capitalize text-accent border border-accent/10">Deliveries</span>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-[#800000] mt-1.5">Delivery Orders</h1>
              <p className="text-sm text-muted">View delivery addresses, item manifests, and update progress status.</p>
            </div>

            <div className="mb-6 p-4 bg-white/60 backdrop-blur-md rounded-2xl border border-accent/10 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
              <div>
                <h3 className="text-sm font-bold text-accent uppercase tracking-wider mb-1">Today's Delivery Coverage</h3>
                <p className="text-xs font-semibold text-muted">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</p>
              </div>
              <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-stone-200">
                {(new Date().getDay() === 0 || new Date().getDay() === 6) ? (
                  <>
                    <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/></svg>
                    </div>
                    <div>
                      <p className="font-bold text-emerald-800">Delivery Rider</p>
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Available weekends only</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <div>
                      <p className="font-bold text-amber-800">Café Owner</p>
                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Handling deliveries today</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <AdminPanel title="Active Deliveries Queue" subtitle="Monitoring café home-deliveries">
              <div className="bg-white/80 rounded-b-xl">
                <DeliveryOrdersTable 
                  orders={deliveryOrders.filter(o => !o.archived)}
                  getServiceAreaName={getServiceAreaName}
                  showStatusControl={true}
                  onStatusChange={updateDeliveryStatus}
                  onDeliveryPersonChange={updateDeliveryPerson}
                  onChat={(order) => handleOpenChat(order.customerName, order.orderNumber)}
                />
              </div>
            </AdminPanel>
          </div>
        )}

        {/* TAB 6: PROFILE */}
        {activeTab === "profile" && (
          <div className="space-y-6">
            <div>
              <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold capitalize text-accent border border-accent/10">Profile</span>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-[#800000] mt-1.5">My Account Settings</h1>
              <p className="text-sm text-muted">Update your staff profile credentials and password.</p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <AdminPanel title="Profile Details" subtitle="Full Name and contact details">
                <form onSubmit={handleProfileUpdate} className="space-y-4 px-6 py-5">
                  {profileError && (`;

c = c.replace(searchTarget, replaceTarget);
fs.writeFileSync(file, c, 'utf8');
console.log('Fixed Staff page layout.');
