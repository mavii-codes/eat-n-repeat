const fs = require('fs');
let file = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/app/staff/page.tsx';
let c = fs.readFileSync(file, 'utf8');

// 1. Fix state variable from isMobileMenuOpen to isMobileSidebarOpen if it exists
c = c.replace(/isMobileMenuOpen/g, 'isMobileSidebarOpen');
c = c.replace(/setIsMobileMenuOpen/g, 'setIsMobileSidebarOpen');

// If neither exist, let's add it
if (!c.includes('isMobileSidebarOpen')) {
  c = c.replace(
    'const [activeTab, setActiveTab] = useState<StaffTab>("dashboard");',
    'const [activeTab, setActiveTab] = useState<StaffTab>("dashboard");\n  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);'
  );
}

// 2. Change the header text to exactly match user prompt
c = c.replace('>Good afternoon!</h1', '>Good day, {user.name}!</h1');
c = c.replace('>Here&apos;s what&apos;s happening at Eat n&apos; Repeat today.</p', ">Here's your café pulse for today.</p");

// 3. Fix the Delivery tab
if (!c.includes('DeliveryOrdersTable')) {
  c = c.replace('import { CustomerOrdersTab } from "@/components/admin/CustomerOrdersTab";', 'import { CustomerOrdersTab } from "@/components/admin/CustomerOrdersTab";\nimport { DeliveryOrdersTable } from "@/components/admin/DeliveryOrdersTable";');
}

if (!c.includes('getServiceAreaName,')) {
  c = c.replace('updateDeliveryStatus,', 'updateDeliveryStatus,\n    updateDeliveryPerson,\n    getServiceAreaName,');
}

const startStr = '        {/* TAB 5: DELIVERY ORDERS */}\n        {activeTab === "delivery" && (';
const endStr = '        {/* TAB 6: PROFILE */}';

const startIndex = c.indexOf(startStr);
const endIndex = c.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = [
    '        {/* TAB 5: DELIVERY ORDERS */}',
    '        {activeTab === "delivery" && (',
    '          <div className="space-y-6">',
    '            <div>',
    '              <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold capitalize text-accent border border-accent/10">Deliveries</span>',
    '              <h1 className="font-serif text-3xl font-bold tracking-tight text-[#800000] mt-1.5">Delivery Orders</h1>',
    '              <p className="text-sm text-muted">View delivery addresses, item manifests, and update progress status.</p>',
    '            </div>',
    '',
    '            <div className="mb-6 p-4 bg-white/60 backdrop-blur-md rounded-2xl border border-accent/10 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">',
    '              <div>',
    '                <h3 className="text-sm font-bold text-accent uppercase tracking-wider mb-1">Today\\'s Delivery Coverage</h3>',
    '                <p className="text-xs font-semibold text-muted">{new Date().toLocaleDateString(\'en-US\', { weekday: \'long\', month: \'long\', day: \'numeric\' }).toUpperCase()}</p>',
    '              </div>',
    '              <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-stone-200">',
    '                {(new Date().getDay() === 0 || new Date().getDay() === 6) ? (',
    '                  <>',
    '                    <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center">',
    '                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/></svg>',
    '                    </div>',
    '                    <div>',
    '                      <p className="font-bold text-emerald-800">Delivery Rider</p>',
    '                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Available weekends only</p>',
    '                    </div>',
    '                  </>',
    '                ) : (',
    '                  <>',
    '                    <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center">',
    '                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    '                    </div>',
    '                    <div>',
    '                      <p className="font-bold text-amber-800">Café Owner</p>',
    '                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Handling deliveries today</p>',
    '                    </div>',
    '                  </>',
    '                )}',
    '              </div>',
    '            </div>',
    '',
    '            <AdminPanel title="Active Deliveries Queue" subtitle="Monitoring café home-deliveries">',
    '              <div className="bg-white/80 rounded-b-xl">',
    '                <DeliveryOrdersTable ',
    '                  orders={deliveryOrders.filter(o => !o.archived)}',
    '                  getServiceAreaName={getServiceAreaName}',
    '                  showStatusControl={true}',
    '                  onStatusChange={updateDeliveryStatus}',
    '                  onDeliveryPersonChange={updateDeliveryPerson}',
    '                  onChat={(order) => handleOpenChat(order.customerName, order.orderNumber)}',
    '                />',
    '              </div>',
    '            </AdminPanel>',
    '          </div>',
    '        )}\n\n'
  ].join('\n');
  
  c = c.substring(0, startIndex) + replacement + c.substring(endIndex);
  fs.writeFileSync(file, c, 'utf8');
  console.log('Successfully finalized the Staff dashboard restoration!');
} else {
  fs.writeFileSync(file, c, 'utf8');
  console.log('Finalized without modifying delivery tab (not found)');
}
