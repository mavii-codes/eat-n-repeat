const fs = require('fs');
const path = require('path');

const filePath = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/app/staff/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add state variables if they don't exist
const stateVars = `
  // Orders Tab State
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [orderTypeFilter, setOrderTypeFilter] = useState("all");
  const [orderHistorySearch, setOrderHistorySearch] = useState("");
  const [orderHistoryStatusFilter, setOrderHistoryStatusFilter] = useState("all");
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any | null>(null);
`;
if (!content.includes('orderSearch, setOrderSearch')) {
    content = content.replace('const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);', 'const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);\n' + stateVars);
}

// 2. Add Lucide imports if missing
const icons = ['Search', 'Eye', 'X', 'Filter', 'MapPin', 'MessageCircle'];
for (const icon of icons) {
    if (!content.includes(`import { ${icon}`)) {
        if (content.includes('import { Bell } from "lucide-react";')) {
            content = content.replace('import { Bell } from "lucide-react";', `import { Bell, ${icon} } from "lucide-react";`);
        } else {
            // Find lucide-react import
            content = content.replace(/import \{(.*?)\} from "lucide-react";/, (match, p1) => {
                if (!p1.includes(icon)) {
                    return `import {${p1}, ${icon}} from "lucide-react";`;
                }
                return match;
            });
        }
    }
}

// 3. Replace the activeTab === "orders" block
const lines = content.split('\n');
let startIndex = -1;
let endIndex = -1;
let inOrdersBlock = false;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('{activeTab === "orders" && (')) {
        startIndex = i;
        inOrdersBlock = true;
    }
    
    if (inOrdersBlock && lines[i].includes('{activeTab === "menu" && (')) {
        endIndex = i;
        break;
    }
}

const newOrdersBlock = `        {activeTab === "orders" && (() => {
          // Process data
          const allOrders = [...storeOrders, ...deliveryOrders.map(d => ({
              ...d,
              id: d.id,
              orderId: d.orderNumber,
              time: d.orderedAt,
              orderType: "delivery",
              paid: true, // assume paid for delivery in this mock unless stated
              customerName: d.customerName,
              subtotal: d.subtotal,
              deliveryFee: d.deliveryFee
          }))];

          const activeOrders = allOrders.filter(o => !o.archived && o.status !== "completed" && o.status !== "cancelled");
          const historyOrders = allOrders.filter(o => o.status === "completed" || o.status === "cancelled");

          // Summary Counts
          const summary = {
            total: activeOrders.length,
            pending: activeOrders.filter(o => o.status === "pending").length,
            preparing: activeOrders.filter(o => o.status === "preparing").length,
            ready: activeOrders.filter(o => o.status === "ready" || o.status === "ready_for_delivery").length,
            completed: historyOrders.filter(o => o.status === "completed").length,
            cancelled: historyOrders.filter(o => o.status === "cancelled").length,
          };

          // Filter active
          const filteredActive = activeOrders.filter(o => {
            const matchesSearch = o.orderId?.toLowerCase().includes(orderSearch.toLowerCase()) || 
                                  o.customerName?.toLowerCase().includes(orderSearch.toLowerCase());
            const matchesStatus = orderStatusFilter === "all" || o.status === orderStatusFilter;
            const matchesType = orderTypeFilter === "all" || (o.orderType || "dine-in") === orderTypeFilter;
            return matchesSearch && matchesStatus && matchesType;
          }).sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime());

          // Filter history
          const filteredHistory = historyOrders.filter(o => {
            const matchesSearch = o.orderId?.toLowerCase().includes(orderHistorySearch.toLowerCase()) || 
                                  o.customerName?.toLowerCase().includes(orderHistorySearch.toLowerCase());
            const matchesStatus = orderHistoryStatusFilter === "all" || o.status === orderHistoryStatusFilter;
            return matchesSearch && matchesStatus;
          }).sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime());

          return (
            <div className="space-y-6">
              {/* HEADER */}
              <div>
                <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold capitalize text-accent border border-accent/10">Operations</span>
                <h1 className="font-serif text-3xl font-bold tracking-tight text-[#800000] mt-1.5">In-store Orders</h1>
                <p className="text-sm text-muted">Manage customer orders, update workflow status, and confirm payments.</p>
              </div>

              {/* SUMMARY ROW */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {[
                  { label: "Total Active", value: summary.total, color: "text-[#800000]" },
                  { label: "Pending", value: summary.pending, color: "text-amber-600" },
                  { label: "Preparing", value: summary.preparing, color: "text-blue-600" },
                  { label: "Ready", value: summary.ready, color: "text-indigo-600" },
                  { label: "Completed", value: summary.completed, color: "text-green-700" },
                  { label: "Cancelled", value: summary.cancelled, color: "text-red-600" },
                ].map(stat => (
                  <div key={stat.label} className="bg-white/80 backdrop-blur-md rounded-xl p-3 border border-white/40 shadow-sm flex flex-col items-center justify-center">
                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider">{stat.label}</p>
                    <p className={\`text-xl font-bold font-serif mt-1 \${stat.color}\`}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* ACTIVE ORDERS PANEL */}
              <AdminPanel title="Active Orders Tickets" subtitle="Currently processing">
                {/* FILTERS */}
                <div className="p-4 border-b border-accent/10 bg-white/40 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                    <input 
                      type="text" 
                      placeholder="Search ID or customer..." 
                      className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-accent/20 bg-white focus:outline-none focus:ring-2 focus:ring-accent/50"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <select 
                      className="py-2 px-3 text-sm rounded-lg border border-accent/20 bg-white focus:outline-none text-[#2B2523] font-medium"
                      value={orderTypeFilter}
                      onChange={(e) => setOrderTypeFilter(e.target.value)}
                    >
                      <option value="all">All Types</option>
                      <option value="dine-in">Dine-in</option>
                      <option value="takeout">Takeout</option>
                      <option value="delivery">Delivery</option>
                    </select>
                    <select 
                      className="py-2 px-3 text-sm rounded-lg border border-accent/20 bg-white focus:outline-none text-[#2B2523] font-medium"
                      value={orderStatusFilter}
                      onChange={(e) => setOrderStatusFilter(e.target.value)}
                    >
                      <option value="all">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="preparing">Preparing</option>
                      <option value="ready">Ready</option>
                    </select>
                  </div>
                </div>

                {/* DESKTOP TABLE / MOBILE CARDS */}
                <div className="p-2 bg-white/40 backdrop-blur-sm rounded-b-xl">
                  {filteredActive.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="h-12 w-12 rounded-full bg-accent/5 flex items-center justify-center mb-3">
                        <Filter className="h-6 w-6 text-accent/40" />
                      </div>
                      <p className="text-[#800000] font-bold">No Active Orders</p>
                      <p className="text-sm text-muted mt-1 max-w-xs">New customer orders will appear here when they are placed.</p>
                    </div>
                  ) : (
                    <>
                      {/* DESKTOP TABLE */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="text-muted border-b border-accent/10">
                              <th className="px-4 py-3 font-medium">Order ID</th>
                              <th className="px-4 py-3 font-medium">Customer</th>
                              <th className="px-4 py-3 font-medium">Type</th>
                              <th className="px-4 py-3 font-medium">Items</th>
                              <th className="px-4 py-3 font-medium">Total</th>
                              <th className="px-4 py-3 font-medium">Payment</th>
                              <th className="px-4 py-3 font-medium">Status</th>
                              <th className="px-4 py-3 font-medium text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredActive.map((order) => (
                              <tr key={order.id} className="border-b border-accent/5 hover:bg-accent-light/10">
                                <td className="px-4 py-3 font-bold text-[#800000]">{order.orderId}</td>
                                <td className="px-4 py-3 font-medium">{order.customerName || "Walk-in"}</td>
                                <td className="px-4 py-3">
                                  <span className="inline-flex rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-gray-600 border border-accent/10 shadow-sm">
                                    {order.orderType || "dine-in"}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-xs text-muted max-w-[150px] truncate">{order.items}</td>
                                <td className="px-4 py-3 font-bold">₱{order.total?.toFixed(2) || (order.subtotal + (order.deliveryFee||0)).toFixed(2)}</td>
                                <td className="px-4 py-3">
                                  {order.paid ? (
                                    <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700 border border-green-200">Confirmed Paid</span>
                                  ) : (
                                    <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">Pending</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <AdminSelect
                                    value={order.status}
                                    onChange={(e) => {
                                      if (order.orderType === 'delivery') {
                                        updateDeliveryStatus(order.id, e.target.value as any);
                                      } else {
                                        updateStoreOrderStatus(order.id, e.target.value as any);
                                      }
                                    }}
                                    className="!py-1.5 !text-xs max-w-[120px] shadow-sm font-medium"
                                  >
                                    <option value="pending">Pending</option>
                                    <option value="confirmed">Confirmed</option>
                                    <option value="preparing">Preparing</option>
                                    <option value="ready">Ready</option>
                                    {order.orderType === 'delivery' && <option value="out_for_delivery">Out for Delivery</option>}
                                    <option value="completed">Completed</option>
                                    <option value="cancelled">Cancelled</option>
                                  </AdminSelect>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={() => setSelectedOrderDetails(order)}
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:underline bg-white px-3 py-1.5 rounded-lg border border-accent/10 shadow-sm"
                                  >
                                    <Eye className="h-3.5 w-3.5" /> Details
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* MOBILE CARDS */}
                      <div className="md:hidden flex flex-col gap-3 p-2">
                        {filteredActive.map((order) => (
                          <div key={order.id} className="bg-white rounded-xl border border-accent/10 p-4 shadow-sm flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-bold text-[#800000]">{order.orderId}</h3>
                                <p className="text-sm font-medium">{order.customerName || "Walk-in"}</p>
                              </div>
                              <span className="inline-flex rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-600 border border-gray-200">
                                {order.orderType || "dine-in"}
                              </span>
                            </div>
                            
                            <div className="flex justify-between items-center text-sm border-y border-accent/5 py-2">
                              <span className="text-muted truncate max-w-[60%]">{order.items}</span>
                              <span className="font-bold text-lg">₱{order.total?.toFixed(2) || (order.subtotal + (order.deliveryFee||0)).toFixed(2)}</span>
                            </div>

                            <div className="flex flex-col gap-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-semibold text-muted">Status:</span>
                                <AdminSelect
                                  value={order.status}
                                  onChange={(e) => {
                                    if (order.orderType === 'delivery') {
                                      updateDeliveryStatus(order.id, e.target.value as any);
                                    } else {
                                      updateStoreOrderStatus(order.id, e.target.value as any);
                                    }
                                  }}
                                  className="!py-1 !text-xs w-32 shadow-sm"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="confirmed">Confirmed</option>
                                  <option value="preparing">Preparing</option>
                                  <option value="ready">Ready</option>
                                  {order.orderType === 'delivery' && <option value="out_for_delivery">Out for Delivery</option>}
                                  <option value="completed">Completed</option>
                                  <option value="cancelled">Cancelled</option>
                                </AdminSelect>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-semibold text-muted">Payment:</span>
                                {order.paid ? (
                                  <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">Confirmed Paid</span>
                                ) : (
                                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">Pending</span>
                                )}
                              </div>
                            </div>

                            <button
                              onClick={() => setSelectedOrderDetails(order)}
                              className="w-full mt-1 py-2 bg-white text-accent font-bold text-sm rounded-lg border border-accent/10 shadow-sm flex items-center justify-center gap-2"
                            >
                              <Eye className="h-4 w-4" /> View Details
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </AdminPanel>

              {/* ORDER HISTORY */}
              <AdminPanel title="Customer Order History" subtitle="Fulfilled or cancelled records">
                <div className="p-4 border-b border-accent/10 bg-white/40 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                    <input 
                      type="text" 
                      placeholder="Search history..." 
                      className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-accent/20 bg-white focus:outline-none focus:ring-2 focus:ring-accent/50"
                      value={orderHistorySearch}
                      onChange={(e) => setOrderHistorySearch(e.target.value)}
                    />
                  </div>
                  <select 
                    className="py-2 px-3 text-sm rounded-lg border border-accent/20 bg-white focus:outline-none text-[#2B2523] font-medium w-full md:w-auto"
                    value={orderHistoryStatusFilter}
                    onChange={(e) => setOrderHistoryStatusFilter(e.target.value)}
                  >
                    <option value="all">All Statuses</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="p-2 bg-white/40 backdrop-blur-sm rounded-b-xl overflow-x-auto">
                  {filteredHistory.length === 0 ? (
                    <div className="text-center py-12 text-muted flex flex-col items-center">
                      <div className="h-12 w-12 rounded-full bg-accent/5 flex items-center justify-center mb-3">
                        <Filter className="h-6 w-6 text-accent/40" />
                      </div>
                      <p className="font-medium text-[#800000]">No history found.</p>
                    </div>
                  ) : (
                    <>
                      {/* DESKTOP TABLE */}
                      <div className="hidden md:block">
                        <table className="w-full text-left text-sm min-w-[640px]">
                          <thead>
                            <tr className="text-muted border-b border-accent/10">
                              <th className="px-4 py-3 font-medium">Order ID</th>
                              <th className="px-4 py-3 font-medium">Customer</th>
                              <th className="px-4 py-3 font-medium">Time</th>
                              <th className="px-4 py-3 font-medium">Type</th>
                              <th className="px-4 py-3 font-medium">Total</th>
                              <th className="px-4 py-3 font-medium">Final Status</th>
                              <th className="px-4 py-3 font-medium text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredHistory.map((order) => (
                              <tr key={order.id} className="border-b border-accent/5 hover:bg-accent-light/10 text-[#2B2523]">
                                <td className="px-4 py-3 font-bold">{order.orderId}</td>
                                <td className="px-4 py-3 font-medium">{order.customerName || "Walk-in"}</td>
                                <td className="px-4 py-3 text-xs text-muted">{order.time}</td>
                                <td className="px-4 py-3">
                                  <span className="inline-flex rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-500 border border-gray-200">
                                    {order.orderType || "dine-in"}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-semibold">₱{order.total?.toFixed(2) || (order.subtotal + (order.deliveryFee||0)).toFixed(2)}</td>
                                <td className="px-4 py-3">
                                  <span className={\`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase \${order.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'} border\`}>
                                    {order.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={() => setSelectedOrderDetails(order)}
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:underline bg-white px-3 py-1.5 rounded-lg border border-accent/10 shadow-sm"
                                  >
                                    <Eye className="h-3.5 w-3.5" /> Details
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      {/* MOBILE HISTORY CARDS */}
                      <div className="md:hidden flex flex-col gap-3 p-2">
                        {filteredHistory.map((order) => (
                          <div key={order.id} className="bg-white rounded-xl border border-accent/10 p-4 shadow-sm flex flex-col gap-3 opacity-90">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-bold text-[#800000]">{order.orderId}</h3>
                                <p className="text-sm font-medium">{order.customerName || "Walk-in"}</p>
                              </div>
                              <span className={\`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase \${order.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'} border\`}>
                                {order.status}
                              </span>
                            </div>
                            
                            <div className="flex justify-between items-center text-sm border-y border-accent/5 py-2">
                              <span className="text-muted text-xs">{order.time}</span>
                              <span className="font-bold text-lg">₱{order.total?.toFixed(2) || (order.subtotal + (order.deliveryFee||0)).toFixed(2)}</span>
                            </div>

                            <button
                              onClick={() => setSelectedOrderDetails(order)}
                              className="w-full mt-1 py-2 bg-white text-accent font-bold text-sm rounded-lg border border-accent/10 shadow-sm flex items-center justify-center gap-2"
                            >
                              <Eye className="h-4 w-4" /> View Details
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </AdminPanel>

              {/* ORDER DETAILS MODAL */}
              {selectedOrderDetails && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
                  <div className="bg-[#FFF8F0] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    {/* Header */}
                    <div className="flex justify-between items-center p-5 border-b border-accent/10 bg-white">
                      <div>
                        <h2 className="font-serif text-2xl font-bold text-[#800000]">Order {selectedOrderDetails.orderId}</h2>
                        <span className="inline-flex rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-600 mt-1 border border-gray-200 shadow-sm">
                          {selectedOrderDetails.orderType || "Dine-in"}
                        </span>
                      </div>
                      <button 
                        onClick={() => setSelectedOrderDetails(null)}
                        className="p-2 text-muted hover:bg-gray-100 hover:text-[#2B2523] rounded-full transition-colors"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    
                    {/* Body */}
                    <div className="p-5 overflow-y-auto space-y-6">
                      
                      {/* Customer Info */}
                      <div className="bg-white p-5 rounded-xl shadow-sm border border-accent/5 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-accent"></div>
                        <h3 className="text-[10px] font-bold uppercase text-muted tracking-wider mb-4">Customer Details</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted text-[10px] uppercase font-bold tracking-wide">Name</p>
                            <p className="font-medium mt-1">{selectedOrderDetails.customerName || "Walk-in Customer"}</p>
                          </div>
                          {selectedOrderDetails.phone && (
                            <div>
                              <p className="text-muted text-[10px] uppercase font-bold tracking-wide">Contact</p>
                              <p className="font-medium mt-1">{selectedOrderDetails.phone}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-muted text-[10px] uppercase font-bold tracking-wide">Date & Time</p>
                            <p className="font-medium mt-1">{selectedOrderDetails.time}</p>
                          </div>
                          <div>
                            <p className="text-muted text-[10px] uppercase font-bold tracking-wide">Status</p>
                            <p className="font-bold text-accent capitalize mt-1">{selectedOrderDetails.status}</p>
                          </div>
                        </div>
                        {selectedOrderDetails.orderType === 'delivery' && selectedOrderDetails.address && (
                          <div className="mt-5 pt-4 border-t border-accent/5">
                            <p className="text-muted text-[10px] uppercase font-bold tracking-wide mb-1.5 flex items-center gap-1.5"><MapPin className="h-3 w-3 text-accent" /> Delivery Address</p>
                            <p className="font-medium text-sm bg-gray-50 p-3 rounded-lg border border-gray-100">{selectedOrderDetails.address}</p>
                            <button
                              onClick={() => { setSelectedOrderDetails(null); handleOpenChat(selectedOrderDetails.customerName, selectedOrderDetails.orderId); }}
                              className="mt-4 flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 bg-accent/5 text-accent font-bold text-sm rounded-lg border border-accent/10 hover:bg-accent/10 hover:shadow-sm transition-all"
                            >
                              <MessageCircle className="h-4 w-4" /> Chat with Customer
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Order Items */}
                      <div>
                        <h3 className="text-[10px] font-bold uppercase text-muted tracking-wider mb-3 px-1">Order Summary</h3>
                        <div className="bg-white rounded-xl shadow-sm border border-accent/5 overflow-hidden">
                          <div className="p-5 space-y-4">
                            <div className="flex flex-col gap-2 text-sm text-[#2B2523] font-medium leading-relaxed">
                              {selectedOrderDetails.items}
                            </div>
                          </div>
                          
                          <div className="bg-accent-light/30 p-5 border-t border-accent/10 space-y-3 text-sm">
                            {selectedOrderDetails.orderType === 'delivery' && (
                              <>
                                <div className="flex justify-between text-muted font-medium">
                                  <span>Subtotal</span>
                                  <span>₱{selectedOrderDetails.subtotal?.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-muted font-medium">
                                  <span>Delivery Fee</span>
                                  <span>₱{selectedOrderDetails.deliveryFee?.toFixed(2)}</span>
                                </div>
                                <div className="h-px bg-accent/10 w-full my-2"></div>
                              </>
                            )}
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-[#800000]">Total</span>
                              <span className="font-serif font-bold text-2xl text-[#2B2523]">₱{selectedOrderDetails.total?.toFixed(2) || (selectedOrderDetails.subtotal + (selectedOrderDetails.deliveryFee||0)).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Payment Status */}
                      <div className="flex justify-between items-center p-5 bg-white rounded-xl shadow-sm border border-accent/5">
                        <span className="text-sm font-bold text-[#2B2523] uppercase tracking-wide">Payment Status</span>
                        {selectedOrderDetails.paid ? (
                          <span className="px-4 py-1.5 bg-green-50 text-green-700 font-bold text-xs rounded-full border border-green-200 shadow-sm flex items-center gap-1.5">
                            <div className="h-1.5 w-1.5 rounded-full bg-green-500"></div> Confirmed Paid
                          </span>
                        ) : (
                          <span className="px-4 py-1.5 bg-amber-50 text-amber-700 font-bold text-xs rounded-full border border-amber-200 shadow-sm flex items-center gap-1.5">
                            <div className="h-1.5 w-1.5 rounded-full bg-amber-500"></div> Pending Payment
                          </span>
                        )}
                      </div>

                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
`;

if (startIndex !== -1 && endIndex !== -1) {
    const newContent = [
        ...lines.slice(0, startIndex),
        newOrdersBlock,
        ...lines.slice(endIndex)
    ].join('\n');
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log("Successfully replaced Customer Orders tab!");
} else {
    console.log("Failed to find Orders block boundaries. startIndex:", startIndex, "endIndex:", endIndex);
}
