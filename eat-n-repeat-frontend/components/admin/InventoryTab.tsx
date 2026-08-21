"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useAdminData } from "@/context/AdminDataContext";
import { useAuth } from "@/context/AuthContext";
import { AdminPanel, AdminField, AdminTextarea } from "@/components/admin/AdminForm";
import { AdminModal } from "@/components/admin/AdminModal";
import { 
  Search, 
  Package, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  BarChart3,
  MessageSquare,
  Clock,
  Check,
  Send
} from "lucide-react";
import type { StockItem, StockRequest } from "@/lib/admin/types";

export function InventoryTab() {
  const { stockItems, stockCategories, stockRequests, addStockRequest } = useAdminData();
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");

  // Contact Admin Modal State
  const [toastMessage, setToastMessage] = useState<{title: string, desc: string} | null>(null);
  const prevRequestsRef = useRef<typeof stockRequests>([]);

  useEffect(() => {
    if (!user) return;
    const currentMyRequests = (stockRequests || []).filter(req => req.staffId === user.id);
    const prevMyRequests = prevRequestsRef.current.filter(req => req.staffId === user.id);

    currentMyRequests.forEach(currentReq => {
      const prevReq = prevMyRequests.find(r => r.id === currentReq.id);
      if (prevReq && prevReq.status === "Pending" && currentReq.status !== "Pending") {
        setToastMessage({
          title: `Restock request ${currentReq.status.toLowerCase()}`,
          desc: `The Admin has ${currentReq.status.toLowerCase()} your request for ${currentReq.ingredientName}.`
        });
        setTimeout(() => setToastMessage(null), 5000);
      }
    });
    prevRequestsRef.current = stockRequests || [];
  }, [stockRequests, user]);

  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [selectedItemForRequest, setSelectedItemForRequest] = useState<StockItem | null>(null);
  const [requestMessage, setRequestMessage] = useState("");

  // KPI Calculations
  const { totalItems, lowStock, outOfStock, optimalStock } = useMemo(() => {
    let low = 0;
    let out = 0;
    let optimal = 0;
    
    stockItems.forEach(item => {
      if (item.quantity <= 0) out++;
      else if (item.quantity <= item.lowStockThreshold) low++;
      else optimal++;
    });

    return {
      totalItems: stockItems.length,
      lowStock: low,
      outOfStock: out,
      optimalStock: optimal
    };
  }, [stockItems]);

  const alertItems = useMemo(() => {
    return stockItems.filter(item => item.quantity <= item.lowStockThreshold);
  }, [stockItems]);

  const filteredItems = useMemo(() => {
    return stockItems.filter(item => {
      if (selectedCategoryId !== "all" && item.categoryId !== selectedCategoryId) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!item.name.toLowerCase().includes(term)) {
          return false;
        }
      }
      return true;
    });
  }, [stockItems, searchTerm, selectedCategoryId]);

  const myRequests = useMemo(() => {
    if (!user) return [];
    return (stockRequests || []).filter(req => req.staffId === user.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [stockRequests, user]);

  const getCategoryName = (id: string) => {
    return stockCategories.find(c => c.id === id)?.name || "Unknown";
  };

  const getStockStatus = (quantity: number, threshold: number) => {
    if (quantity <= 0) return { label: "Out of Stock", color: "text-red-700", bg: "bg-red-50", border: "border-red-200", indicator: "bg-red-500" };
    if (quantity <= threshold) return { label: "Low Stock", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", indicator: "bg-amber-500" };
    return { label: "Optimal", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", indicator: "bg-emerald-500" };
  };

  const openContactAdminModal = (item: StockItem) => {
    setSelectedItemForRequest(item);
    setRequestMessage(`${item.name} is running low. Current stock is ${item.quantity} ${item.unit}. Please restock this ingredient.`);
    setIsContactModalOpen(true);
  };

  const handleSendRequest = () => {
    if (!selectedItemForRequest || !user) return;
    
    // Prevent duplicate request submission if already pending
    const isAlreadyPending = (stockRequests || []).some(req => req.ingredientId === selectedItemForRequest.id && req.status === "Pending");
    if (isAlreadyPending) {
      setToastMessage({
        title: "Request Already Pending",
        desc: `A restock request for ${selectedItemForRequest.name} is already awaiting admin approval.`
      });
      setIsContactModalOpen(false);
      setSelectedItemForRequest(null);
      return;
    }
    
    addStockRequest({
      staffId: user.id,
      staffName: user.name || user.username,
      ingredientId: selectedItemForRequest.id,
      ingredientName: selectedItemForRequest.name,
      currentQuantity: selectedItemForRequest.quantity,
      threshold: selectedItemForRequest.lowStockThreshold,
      unit: selectedItemForRequest.unit,
      message: requestMessage
    });
    
    setIsContactModalOpen(false);
    setSelectedItemForRequest(null);
    setToastMessage({
      title: "Restock request sent",
      desc: `The Admin has been notified about ${selectedItemForRequest.name}.`
    });
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="inline-flex rounded-full bg-[#fce7db] px-2.5 py-0.5 text-xs font-semibold capitalize text-[#5A1824] border border-[#5A1824]/10">Inventory</span>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#5A1824] mt-1.5">Stock Levels</h1>
          <p className="text-sm text-[#817875] mt-1">Monitor ingredient levels and request restocking when needed.</p>
        </div>
      </div>

      {/* KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/60 backdrop-blur-md rounded-2xl p-5 border border-[#5A1824]/10 shadow-sm flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#5A1824]/5 flex items-center justify-center shrink-0 mb-2 sm:mb-0">
            <Package className="w-5 h-5 text-[#5A1824]" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#817875]">Total Items</p>
            <p className="text-xl sm:text-2xl font-black text-[#5A1824] mt-0.5 sm:mt-1">{totalItems}</p>
          </div>
        </div>
        <div className="bg-white/60 backdrop-blur-md rounded-2xl p-5 border border-emerald-200 shadow-sm flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 mb-2 sm:mb-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-800">Optimal</p>
            <p className="text-xl sm:text-2xl font-black text-emerald-700 mt-0.5 sm:mt-1">{optimalStock}</p>
          </div>
        </div>
        <div className="bg-white/60 backdrop-blur-md rounded-2xl p-5 border border-amber-200 shadow-sm flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 mb-2 sm:mb-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-800">Low Stock</p>
            <p className="text-xl sm:text-2xl font-black text-amber-700 mt-0.5 sm:mt-1">{lowStock}</p>
          </div>
        </div>
        <div className="bg-white/60 backdrop-blur-md rounded-2xl p-5 border border-red-200 shadow-sm flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0 mb-2 sm:mb-0">
            <XCircle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-red-800">Out of Stock</p>
            <p className="text-xl sm:text-2xl font-black text-red-700 mt-0.5 sm:mt-1">{outOfStock}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* STOCK ALERTS PANEL */}
          <AdminPanel title="Stock Alerts" subtitle="Ingredients requiring attention">
            <div className="p-4 grid gap-3 grid-cols-1 sm:grid-cols-2 bg-white/40 backdrop-blur-md">
              {alertItems.length === 0 ? (
                <div className="col-span-full py-6 flex flex-col items-center justify-center text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
                  <p className="text-sm font-semibold text-emerald-700">All stock levels are healthy.</p>
                </div>
              ) : (
                alertItems.map(item => {
                  const isOut = item.quantity <= 0;
                  return (
                    <div key={item.id} className={`p-4 rounded-xl border ${isOut ? 'bg-red-50/50 border-red-200' : 'bg-amber-50/50 border-amber-200'} flex flex-col justify-between gap-3`}>
                      <div className="flex gap-3 items-start">
                        <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${isOut ? 'text-red-500' : 'text-amber-500'}`} />
                        <div>
                          <h4 className={`font-bold text-sm ${isOut ? 'text-red-800' : 'text-amber-800'}`}>{item.name}</h4>
                          <p className={`text-xs mt-1 font-medium ${isOut ? 'text-red-600' : 'text-amber-700'}`}>
                            {item.quantity} {item.unit} remaining
                          </p>
                          <p className={`text-[10px] mt-0.5 uppercase tracking-wider font-bold ${isOut ? 'text-red-400' : 'text-amber-500'}`}>
                            Threshold: {item.lowStockThreshold} {item.unit}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => openContactAdminModal(item)}
                        className={`mt-2 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-colors ${isOut ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-200' : 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm shadow-amber-200'}`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> Contact Admin
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </AdminPanel>
        </div>

        <div className="lg:col-span-1">
          {/* STAFF REQUEST HISTORY */}
          <AdminPanel title="Restock Requests" subtitle="Your previous requests">
            <div className="p-4 bg-white/40 backdrop-blur-md max-h-[300px] overflow-y-auto">
              {myRequests.length === 0 ? (
                 <div className="py-6 text-center text-[#817875] text-xs">No restock requests found.</div>
              ) : (
                 <div className="space-y-3">
                   {myRequests.map(req => (
                      <div key={req.id} className="bg-white/80 p-3 rounded-xl border border-stone-200 shadow-sm flex items-start gap-3">
                         <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${req.status === 'Approved' ? 'bg-emerald-500' : req.status === 'Rejected' ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                         <div className="flex-1 min-w-0">
                           <h4 className="font-bold text-stone-700 text-sm truncate">{req.ingredientName}</h4>
                           <div className="flex justify-between items-center mt-1">
                              <p className="text-[10px] text-stone-500 font-semibold">{req.currentQuantity} remaining</p>
                              <p className="text-[10px] font-bold text-stone-400">{new Date(req.createdAt).toLocaleDateString()}</p>
                           </div>
                           <span className={`inline-flex mt-2 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${req.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : req.status === 'Rejected' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                             {req.status}
                           </span>
                         </div>
                      </div>
                   ))}
                 </div>
              )}
            </div>
          </AdminPanel>
        </div>
      </div>

      <AdminPanel title="Inventory Ledger" subtitle="Real-time stock quantities linked to order processing">
        
        {/* SEARCH & FILTERS */}
        <div className="p-4 border-b border-[#5A1824]/10 bg-white/40 backdrop-blur-md space-y-4">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#817875]" />
            <input 
              type="text" 
              placeholder="Search ingredients..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2.5 text-sm bg-white/80 border border-[#5A1824]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5A1824]/30 w-full transition-all shadow-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button 
              onClick={() => setSelectedCategoryId("all")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${selectedCategoryId === "all" ? "bg-[#5A1824] text-white shadow-md" : "bg-white/80 text-[#817875] border border-[#5A1824]/10 hover:bg-stone-100"}`}
            >
              All Items
            </button>
            {stockCategories.map(cat => (
              <button 
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${selectedCategoryId === cat.id ? "bg-[#5A1824] text-white shadow-md" : "bg-white/80 text-[#817875] border border-[#5A1824]/10 hover:bg-stone-100"}`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* DESKTOP TABLE VIEW */}
        <div className="hidden md:block overflow-x-auto bg-white/60 backdrop-blur-md">
          <table className="w-full text-left text-sm table-fixed">
            <thead>
              <tr className="bg-stone-50/50 text-[#817875] text-[11px] uppercase tracking-wider border-b border-[#5A1824]/10">
                <th className="px-6 py-4 font-bold w-[22%] min-w-[180px]">Ingredient</th>
                <th className="px-4 py-4 font-bold w-[15%]">Category</th>
                <th className="px-4 py-4 font-bold w-[20%]">Remaining Quantity</th>
                <th className="px-4 py-4 font-bold w-[15%]">Status</th>
                <th className="px-4 py-4 font-bold w-[13%]">Alert Threshold</th>
                <th className="px-6 py-4 font-bold text-right w-[15%]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#5A1824]/5">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#817875]">No ingredients found.</td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const status = getStockStatus(item.quantity, item.lowStockThreshold);
                  const maxBar = Math.max(item.quantity, item.lowStockThreshold * 2, 1);
                  const fillPercent = Math.min(100, Math.max(0, (item.quantity / maxBar) * 100));
                  const showContact = item.quantity <= item.lowStockThreshold;
                  
                  return (
                    <tr key={item.id} className="hover:bg-white/50 transition-colors">
                      <td className="px-6 py-4 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center shrink-0">
                            <BarChart3 className="w-4 h-4 text-stone-400" />
                          </div>
                          <h3 className="font-bold text-[#5A1824] text-sm break-words whitespace-normal">{item.name}</h3>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <span className="inline-flex bg-stone-100 border border-stone-200 text-[#817875] px-2.5 py-1 rounded-lg text-xs font-semibold">
                          {getCategoryName(item.categoryId)}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-middle">
                         <div className="flex flex-col gap-1.5 pr-4 w-11/12">
                            <span className="font-black text-[#2B2523]">{item.quantity} <span className="text-xs font-bold text-[#817875] uppercase">{item.unit}</span></span>
                            <div className="h-1.5 w-full bg-stone-200 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${status.indicator}`} style={{ width: `${fillPercent}%` }}></div>
                            </div>
                         </div>
                      </td>
                      <td className="px-4 py-4 align-middle">
                         <span className={`inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider border w-24 ${status.bg} ${status.color} ${status.border}`}>
                           <span className={`w-1.5 h-1.5 rounded-full ${status.indicator}`}></span>
                           {status.label}
                         </span>
                      </td>
                      <td className="px-4 py-4 align-middle text-xs font-bold text-[#817875]">
                         {item.lowStockThreshold} {item.unit}
                      </td>
                      <td className="px-6 py-4 align-middle text-right">
                        {showContact ? (
                          <button 
                            onClick={() => openContactAdminModal(item)}
                            className="inline-flex items-center justify-center gap-1.5 w-32 px-3 py-2 bg-white border border-stone-200 text-stone-700 rounded-lg text-xs font-bold hover:bg-stone-50 hover:text-[#5A1824] hover:border-[#5A1824]/20 transition-colors shadow-sm"
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> Contact Admin
                          </button>
                        ) : (
                          <div className="w-32 inline-flex justify-center text-[#817875] font-black">—</div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARD VIEW */}
        <div className="md:hidden divide-y divide-[#5A1824]/5 bg-white/40 backdrop-blur-md">
          {filteredItems.length === 0 ? (
             <div className="py-12 text-center text-[#817875] text-sm">No ingredients found.</div>
          ) : (
            filteredItems.map(item => {
              const status = getStockStatus(item.quantity, item.lowStockThreshold);
              const maxBar = Math.max(item.quantity, item.lowStockThreshold * 2, 1);
              const fillPercent = Math.min(100, Math.max(0, (item.quantity / maxBar) * 100));
              const showContact = item.quantity <= item.lowStockThreshold;

              return (
                <div key={item.id} className="p-4 hover:bg-white/50 transition-colors">
                   <div className="flex justify-between items-start mb-2">
                     <h3 className="font-bold text-[#5A1824] text-base truncate">{item.name}</h3>
                     <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border shrink-0 ${status.bg} ${status.color} ${status.border}`}>
                       <span className={`w-1.5 h-1.5 rounded-full ${status.indicator}`}></span>
                       {status.label}
                     </span>
                   </div>
                   
                   <p className="text-xs text-[#817875] font-semibold mb-3">{getCategoryName(item.categoryId)}</p>
                   
                   <div className="bg-stone-50/50 p-3 rounded-xl border border-stone-100">
                     <p className="text-[10px] uppercase font-bold text-[#817875] tracking-wider mb-1">Remaining</p>
                     <div className="flex items-center justify-between mb-2">
                        <span className="font-black text-[#2B2523] text-lg">{item.quantity} <span className="text-xs font-bold text-[#817875] uppercase">{item.unit}</span></span>
                     </div>
                     <div className="h-2 w-full bg-stone-200 rounded-full overflow-hidden mb-3">
                        <div className={`h-full rounded-full transition-all ${status.indicator}`} style={{ width: `${fillPercent}%` }}></div>
                     </div>
                     <p className="text-[10px] font-bold text-[#817875]">Threshold: {item.lowStockThreshold} {item.unit}</p>
                   </div>
                   
                   {showContact && (
                     <button 
                       onClick={() => openContactAdminModal(item)}
                       className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white border border-stone-200 text-stone-700 rounded-xl text-sm font-bold hover:bg-stone-50 transition-colors shadow-sm"
                     >
                       <MessageSquare className="w-4 h-4" /> Contact Admin
                     </button>
                   )}
                </div>
              )
            })
          )}
        </div>
      </AdminPanel>

      {/* CONTACT ADMIN MODAL */}
      <AdminModal
        open={isContactModalOpen}
        onClose={() => {
          setIsContactModalOpen(false);
          setSelectedItemForRequest(null);
        }}
        title="Contact Admin"
      >
        {selectedItemForRequest && (() => {
          const status = getStockStatus(selectedItemForRequest.quantity, selectedItemForRequest.lowStockThreshold);
          return (
            <div className="space-y-6">
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
                <p className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Stock Alert</p>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-white border border-stone-200 rounded-lg flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5 text-stone-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-stone-700 text-lg leading-tight">{selectedItemForRequest.name}</h3>
                    <p className="text-sm font-medium text-stone-500 mt-1">{selectedItemForRequest.quantity} {selectedItemForRequest.unit} remaining</p>
                    <p className="text-xs font-bold text-stone-400 mt-0.5">Threshold: {selectedItemForRequest.lowStockThreshold} {selectedItemForRequest.unit}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-stone-200 flex items-center gap-2">
                   <p className="text-xs font-bold text-stone-500">Status:</p>
                   <span className={`inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider border w-24 ${status.bg} ${status.color} ${status.border}`}>
                     <span className={`w-1.5 h-1.5 rounded-full ${status.indicator}`}></span>
                     {status.label}
                   </span>
                </div>
              </div>

              <AdminField label="Message">
                <AdminTextarea
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  rows={4}
                  className="w-full text-sm"
                  placeholder="Type your message to the Admin here..."
                />
              </AdminField>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsContactModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-[#5A1824]/20 text-[#5A1824] rounded-xl font-bold hover:bg-[#5A1824]/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendRequest}
                  className="flex-1 px-4 py-2.5 bg-[#5A1824] text-white rounded-xl font-bold hover:bg-[#5A1824]/90 transition-colors shadow-md shadow-[#5A1824]/20"
                >
                  Send Request
                </button>
              </div>
            </div>
          )
        })()}
      </AdminModal>
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#5A1824]/10 p-6 flex flex-col items-center max-w-sm w-full mx-4 text-center transform animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
              <Check className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-[#5A1824] mb-2">{toastMessage.title}</h3>
            <p className="text-sm text-[#817875] mb-6">{toastMessage.desc}</p>
            <button 
              onClick={() => setToastMessage(null)}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors shadow-md shadow-emerald-600/20"
            >
              Okay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
