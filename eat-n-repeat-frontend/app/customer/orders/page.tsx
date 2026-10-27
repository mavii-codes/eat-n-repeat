'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { CustomerHeader } from '@/components/customer/CustomerHeader';
import { OrderCard, type OrderCardProps } from '@/components/customer/OrderCard';
import { CartDrawer, type CartItem, type CustomerMenuItem } from '@/components/customer/CartDrawer';
import { useAdminData } from '@/context/AdminDataContext';
import { Package, Bike, CheckCircle2, XCircle, RefreshCw, Search } from 'lucide-react';

type OrderFilterStatus = 'all' | 'active' | 'completed' | 'cancelled';

function parseCustomerOrderItems(rawItems: unknown, subtotal: number): Array<{ name: string; quantity: number; price: number }> {
  if (!rawItems) {
    return [{ name: 'Signature Menu Items', quantity: 1, price: subtotal || 0 }];
  }

  if (Array.isArray(rawItems)) {
    return rawItems.map((item: any) => ({
      name: item.name || item.title || 'Item',
      quantity: Number(item.quantity) || 1,
      price: Number(item.price) || (subtotal / (rawItems.length || 1)),
    }));
  }

  if (typeof rawItems === 'string') {
    const trimmed = rawItems.trim().replace(/^,\s*/, '');
    if (!trimmed) {
      return [{ name: 'Signature Menu Items', quantity: 1, price: subtotal || 0 }];
    }

    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: any) => ({
            name: item.name || item.title || 'Item',
            quantity: Number(item.quantity) || 1,
            price: Number(item.price) || (subtotal / (parsed.length || 1)),
          }));
        } else if (parsed && typeof parsed === 'object') {
          return [{
            name: parsed.name || parsed.title || 'Item',
            quantity: Number(parsed.quantity) || 1,
            price: Number(parsed.price) || subtotal || 0,
          }];
        }
      } catch {
        // Not valid JSON, continue to string parsing
      }
    }

    const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      const parsedList = parts.map((part) => {
        const prefixMatch = part.match(/^(\d+)\s*[xX]\s*(.+)$/);
        if (prefixMatch) {
          return {
            quantity: parseInt(prefixMatch[1], 10),
            name: prefixMatch[2].trim(),
            price: 0,
          };
        }
        const suffixMatch = part.match(/^(.+?)\s*[xX]\s*(\d+)$/);
        if (suffixMatch) {
          return {
            name: suffixMatch[1].trim(),
            quantity: parseInt(suffixMatch[2], 10),
            price: 0,
          };
        }
        const parenMatch = part.match(/^(.+?)\s*\((?:qty:\s*)?(\d+)\)$/i);
        if (parenMatch) {
          return {
            name: parenMatch[1].trim(),
            quantity: parseInt(parenMatch[2], 10),
            price: 0,
          };
        }
        return {
          name: part,
          quantity: 1,
          price: 0,
        };
      });

      const totalQty = parsedList.reduce((sum, item) => sum + item.quantity, 0) || 1;
      const unitAvg = subtotal > 0 ? subtotal / totalQty : 0;
      return parsedList.map((item) => ({
        ...item,
        price: item.price > 0 ? item.price : unitAvg,
      }));
    }
  }

  return [{ name: String(rawItems), quantity: 1, price: subtotal || 0 }];
}

function OrdersPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedStatus, setSelectedStatus] = useState<OrderFilterStatus>('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'pickup' | 'dine-in'>('delivery');

  // Mount-gated hydration: false on server + first client render (matches SSR),
  // then reconciles to real session after useEffect commits. Prevents React
  // #310 hydration mismatch when session.data is null on server but populated
  // on client initial render.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Payment redirect banner state
  const [paymentBanner, setPaymentBanner] = useState<{
    type: 'success' | 'failed';
    orderNumber: string;
  } | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Detect Xendit redirect query params (?success=true/false&order=ORD-XXXX)
  useEffect(() => {
    const success = searchParams.get('success');
    const orderNumber = searchParams.get('order') ?? searchParams.get('orderNumber');
    if (success && orderNumber) {
      setPaymentBanner({
        type: success === 'true' ? 'success' : 'failed',
        orderNumber,
      });
      // Clean the URL so refreshing doesn't re-show the banner
      window.history.replaceState({}, '', '/customer/orders');
    }
  }, [searchParams]);

  // Retry failed GCash payment — session accessed only after hydration
  const handleRetryPayment = async (orderNumber: string) => {
    if (!hydrated) return;
    setIsRetrying(true);
    try {
      const { getApiUrl } = await import('@/lib/config');
      const accessToken = (session as any)?.accessToken as string | undefined;

      const response = await fetch(`${getApiUrl()}/api/payments/retry/${orderNumber}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create retry payment');
      }

      if (data.invoiceUrl) {
        window.location.href = data.invoiceUrl;
        return;
      }
    } catch (error: any) {
      console.error('Payment retry error:', error);
      alert(error.message || 'Failed to retry payment. Please try again.');
    }
    setIsRetrying(false);
  };
  
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/customer/login?callbackUrl=/customer/orders');
    }
  }, [status, router]);

  const { menuItems } = useAdminData();
  const [liveOrders, setLiveOrders] = useState<OrderCardProps[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  // Distinguishes "API loaded, customer genuinely has no orders" (show the
  // real empty state) from "API unreachable/failed" (keep the legacy demo
  // fallback so the page never renders a broken blank). Demo rows must never
  // stand in for a successful empty response.
  const [ordersFetchFailed, setOrdersFetchFailed] = useState(false);

  // Cancellation state — must be before early return to keep hook order stable
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  // Manual refresh trigger for the offline retry button below.
  const [retryTick, setRetryTick] = useState(0);

  // Fetch real customer orders from the backend
  useEffect(() => {
    if (status !== 'authenticated') return;
    if (!hydrated) return;

    let mounted = true;
    const fetchOrders = async () => {
      try {
        const { getApiUrl } = await import('@/lib/config');
        const accessToken = (session as any)?.accessToken as string | undefined;
        
        const response = await fetch(`${getApiUrl()}/api/customer-orders`, {
          headers: {
            ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.orders) {
            // Map backend orders to OrderCardProps
            const mappedOrders: OrderCardProps[] = data.orders.map((o: any) => {
              const isCompleted = o.status === 'delivered' || o.status === 'completed';
              const isCancel = o.status === 'cancelled';
              const isPending = o.status === 'pending_payment' || o.status === 'pending';
              const isAwaitingPayment = o.status === 'awaiting_payment';
              // Legacy value kept for old rows; the backend writes 'confirmed'.
              const isConfirmed = o.status === 'assigned';
              const isBackendConfirmed = o.status === 'confirmed';
              const isPreparing = o.status === 'preparing';

              let mappedStatus: OrderCardProps['status'] = 'preparing';
              if (isCompleted) mappedStatus = 'delivered';
              else if (isCancel) mappedStatus = 'cancelled';
              else if (isAwaitingPayment) mappedStatus = 'awaiting_payment';
              else if (isPending) mappedStatus = 'pending';
              else if (isBackendConfirmed) mappedStatus = 'confirmed';
              else if (isConfirmed) mappedStatus = 'preparing';
              else if (isPreparing) mappedStatus = 'preparing';
              else if (o.status === 'out_for_delivery') mappedStatus = 'out_for_delivery';

              return {
                id: o.id,
                orderNumber: o.orderNumber,
                date: new Date(o.orderedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
                status: mappedStatus,
                subtotal: o.subtotal,
                deliveryFee: o.deliveryFee,
                total: o.total,
                // Real promo snapshot (backend maps legacy rows to zero).
                discount: Number(o.discount) || 0,
                promoCode: o.promoCode ?? null,
                subtotalBeforeDiscount:
                  o.subtotalBeforeDiscount != null
                    ? Number(o.subtotalBeforeDiscount)
                    : Number(o.subtotal) || 0,
                paymentMethod: o.paymentMethod || 'Unknown',
                paymentStatus: o.paymentStatus ?? null,
                customerName: o.customerName || 'Valued Customer',
                customerPhone: o.phone || '',
                customerAddress: o.address || '',
                deliveredAt: o.deliveredAt ? new Date(o.deliveredAt).toISOString() : undefined,
                // Pick-Up / Take-Out details (null for delivery/dine-in and
                // legacy pickup rows; OrderCard falls back to customerName).
                pickupName: o.pickupName ?? null,
                pickupAt: o.pickupAt ?? null,
                items: parseCustomerOrderItems(o.items, o.subtotal),
                deliveryType: o.type === 'dine-in' ? 'dine-in' : o.type === 'pickup' ? 'pickup' : 'delivery',
              };
            });
            if (mounted) {
              setLiveOrders(mappedOrders);
              setOrdersFetchFailed(false);
              setIsLoadingOrders(false);
            }
          } else {
            // Backend answered without usable data — treat as failed load
            // (demo fallback), not as an empty order history.
            if (mounted) {
              setOrdersFetchFailed(true);
              setIsLoadingOrders(false);
            }
          }
        } else {
          // HTTP failure — keep the legacy demo fallback, never blank.
          if (mounted) {
            setOrdersFetchFailed(true);
            setIsLoadingOrders(false);
          }
        }
      } catch (error) {
        console.error('Failed to fetch orders:', error);
        if (mounted) {
          setOrdersFetchFailed(true);
          setIsLoadingOrders(false);
        }
      }
    };

    fetchOrders();
    // Fast 4-second poll interval for realtime status & payment updates
    const interval = setInterval(fetchOrders, 4000);

    const handleFocusOrVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchOrders();
      }
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, [status, session, retryTick]);

  if (status === 'loading' || status === 'unauthenticated' || isLoadingOrders) {
    return (
      <div className="min-h-screen bg-[#FFF8F0] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#B91C1C]/30 border-t-[#B91C1C] rounded-full animate-spin"></div>
      </div>
    );
  }

  // Orders come ONLY from the backend. When the API is unreachable the
  // page shows an honest offline notice (never demo/fallback rows that
  // could be mistaken for the customer's real history).
  const allOrdersList = liveOrders;

  const filteredOrders = allOrdersList.filter((order) => {
    const q = orderSearch.trim().toLowerCase();
    if (q) {
      const matchesSearch =
        order.orderNumber.toLowerCase().includes(q) ||
        order.items.some((item) => item.name.toLowerCase().includes(q));
      if (!matchesSearch) return false;
    }
    if (selectedStatus === 'all') return true;
    if (selectedStatus === 'active') return !['delivered', 'cancelled'].includes(order.status);
    if (selectedStatus === 'completed') return order.status === 'delivered';
    if (selectedStatus === 'cancelled') return order.status === 'cancelled';
    return true;
  });

  const stats = {
    active: allOrdersList.filter((o) => !['delivered', 'cancelled'].includes(o.status)).length,
    completed: allOrdersList.filter((o) => o.status === 'delivered').length,
    total: allOrdersList.reduce((sum, o) => sum + o.total, 0),
  };

  // RepEat Order Handler: adds all items from a past order to cart
  const handleReorder = (items: { name: string; quantity: number; price: number }[]) => {
    setCartItems((prev) => {
      let updated = [...prev];
      items.forEach((item, idx) => {
        const matched = menuItems.find((mi) => mi.name.toLowerCase() === item.name.toLowerCase());
        const menuItemId = matched ? matched.id : `mi-repeat-${idx}`;

        const existing = updated.find((ci) => ci.menuItem.id === menuItemId);
        if (existing) {
          updated = updated.map((ci) =>
            ci.menuItem.id === menuItemId
              ? { ...ci, quantity: ci.quantity + item.quantity }
              : ci
          );
        } else {
          updated.push({
            menuItem: {
              id: menuItemId,
              name: item.name,
              description: 'Customer favorite item',
              price: item.price,
              available: true,
            },
            quantity: item.quantity,
          });
        }
      });
      return updated;
    });

    setIsCartOpen(true);
  };

  // Order Cancellation Handler — customer-owned endpoint (pending orders
  // only, ownership enforced server-side). Strict: the UI flips to Cancelled
  // only after the backend confirms; failures keep Pending with an alert.
  // Offline cancels are refused outright (nothing is journaled — a queued
  // cancel could never be ordered safely against later server state).
  const handleCancelOrder = async (orderId: string) => {
    if (cancellingId) return;
    setCancellingId(orderId);
    try {
      const { getApiUrl } = await import('@/lib/config');
      const accessToken = (session as any)?.accessToken as string | undefined;
      const response = await fetch(
        `${getApiUrl()}/api/customer-orders/${encodeURIComponent(orderId)}/cancel`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
          },
        },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Cancellation was not accepted by the server.');
      }
      setLiveOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'cancelled' as const } : o)),
      );
    } catch (error: any) {
      alert(error?.message || 'Could not cancel this order. Please try again.');
    } finally {
      setCancellingId(null);
    }
  };

  const handleUpdateQuantity = (id: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((ci) => {
          if (ci.menuItem.id === id) {
            const newQty = ci.quantity + delta;
            return newQty > 0 ? { ...ci, quantity: newQty } : null;
          }
          return ci;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveItem = (id: string) => {
    setCartItems((prev) => prev.filter((ci) => ci.menuItem.id !== id));
  };

  const handleClearCart = () => setCartItems([]);

  const handleAddToCart = (item: CustomerMenuItem) => {
    const incoming = `addon-${item.id}::${item.id}::`;
    setCartItems((prev) => {
      const existing = prev.find((ci) => ci.menuItem.id === item.id);
      if (existing) {
        return prev.map((ci) =>
          ci.menuItem.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      return [...prev, { menuItem: item, quantity: 1 }];
    });
  };

  const totalCartCount = cartItems.reduce((acc, ci) => acc + ci.quantity, 0);
  const totalCartSubtotal = cartItems.reduce((acc, ci) => acc + ci.menuItem.price * ci.quantity, 0);

  return (
    <div className="min-h-screen bg-[#FFF8F0] text-stone-900 flex flex-col justify-between selection:bg-[#B91C1C] selection:text-white">
      <div>
        <CustomerHeader
          onOpenCart={() => setIsCartOpen(true)}
          cartCount={totalCartCount}
          cartSubtotal={totalCartSubtotal}
          fulfillmentType={fulfillmentType}
          setFulfillmentType={setFulfillmentType}
        />

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          {/* Hero Banner */}
          <div className="relative overflow-hidden bg-gradient-to-r from-[#1c1917] to-[#44403c] text-white rounded-[2.5rem] p-8 sm:p-12 shadow-xl mb-8 border border-stone-800">
            <div className="relative z-10 max-w-2xl">
              <span className="inline-block px-3 py-1 bg-stone-700/50 border border-stone-600/50 text-stone-200 text-xs font-black uppercase tracking-widest rounded-full mb-4">
                Order Dashboard
              </span>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">
                My Orders &amp; Real-Time Tracking
              </h1>
              <p className="text-stone-300 text-sm sm:text-base leading-relaxed">
                Track active kitchen preparation, view detailed order histories, download official receipts, and re-order your past favorites in just one click.
              </p>
            </div>
            
            {/* Decorative Elements */}
            <div className="absolute -bottom-10 -right-10 opacity-[0.07] rotate-[-15deg] pointer-events-none select-none">
              <Package className="w-28 h-28 text-white" />
            </div>
            <div className="absolute top-10 right-24 opacity-10 rotate-[15deg] pointer-events-none select-none">
              <Bike className="w-14 h-14 text-white" />
            </div>
          </div>

          {/* Payment Status Banner from Xendit redirect */}
          {paymentBanner && (
            <div className={`rounded-2xl p-5 sm:p-6 mb-8 border shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4 ${
              paymentBanner.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              <div className="flex items-center gap-3 flex-1">
                {paymentBanner.type === 'success' ? (
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-8 h-8 text-rose-600 shrink-0" />
                )}
                <div>
                  <h3 className="text-sm sm:text-base font-black">
                    {paymentBanner.type === 'success'
                      ? `Payment Successful!`
                      : `Payment Failed / Cancelled`}
                  </h3>
                  <p className="text-xs sm:text-sm font-medium opacity-80 mt-0.5">
                    {paymentBanner.type === 'success'
                      ? `Your GCash payment for Order #${paymentBanner.orderNumber} has been received. Your order is now being prepared!`
                      : `The payment for Order #${paymentBanner.orderNumber} was not completed. You can retry the payment below.`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {paymentBanner.type === 'failed' && (
                  <button
                    onClick={() => handleRetryPayment(paymentBanner.orderNumber)}
                    disabled={isRetrying}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black shadow-sm flex items-center gap-2 transition ${
                      isRetrying
                        ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                        : 'bg-rose-600 text-white hover:bg-rose-700'
                    }`}
                  >
                    {isRetrying ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Retrying...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        Retry Payment
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => setPaymentBanner(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/60 hover:bg-white border border-current/10 transition"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
            <div className="p-6 rounded-3xl bg-white border border-amber-200/80 shadow-2xs">
              <p className="text-xs font-black text-stone-500 uppercase tracking-wider">Active Orders</p>
              <p className="text-3xl font-black text-[#B91C1C] mt-1">{stats.active}</p>
            </div>
            <div className="p-6 rounded-3xl bg-white border border-amber-200/80 shadow-2xs">
              <p className="text-xs font-black text-stone-500 uppercase tracking-wider">Completed Orders</p>
              <p className="text-3xl font-black text-emerald-700 mt-1">{stats.completed}</p>
            </div>
            <div className="p-6 rounded-3xl bg-white border border-amber-200/80 shadow-2xs">
              <p className="text-xs font-black text-stone-500 uppercase tracking-wider">Total Spent</p>
              <p className="text-3xl font-black text-[#451a03] mt-1">₱{stats.total.toFixed(2)}</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-md mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <input
              type="text"
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              placeholder="Search by order number or item..."
              aria-label="Search orders"
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-amber-200/80 bg-white text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-[#B91C1C] transition shadow-sm"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 sm:gap-3 mb-8 overflow-x-auto no-scrollbar pb-2">
            {(['all', 'active', 'completed', 'cancelled'] as const).map((status) => {
              const isActive = selectedStatus === status;
              return (
                <button
                  key={status}
                  onClick={() => setSelectedStatus(status)}
                  className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-extrabold transition-all duration-200 shadow-2xs border ${
                    isActive
                      ? 'bg-[#B91C1C] text-white border-[#B91C1C] shadow-red-500/20 scale-105'
                      : 'bg-white text-stone-700 border-amber-200/80 hover:bg-amber-50'
                  }`}
                >
                  {status === 'all' && 'All Orders'}
                  {status === 'active' && 'Active Kitchen Prep'}
                  {status === 'completed' && 'Delivered / Completed'}
                  {status === 'cancelled' && 'Cancelled'}
                </button>
              );
            })}
          </div>

          {/* Offline notice — the list below only ever shows real
              backend orders; when the API is unreachable we say so instead
              of rendering placeholder rows. */}
          {ordersFetchFailed && (
            <div className="rounded-2xl p-5 mb-6 border shadow-sm bg-amber-50 border-amber-200 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <RefreshCw className="w-6 h-6 text-amber-600 shrink-0" />
                <div>
                  <h3 className="text-sm font-black">You&apos;re offline</h3>
                  <p className="text-xs font-medium opacity-80 mt-0.5">
                    Couldn&apos;t reach the server, so your orders can&apos;t be shown right now. New orders you place are saved on this device and sync automatically.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsLoadingOrders(true);
                  setOrdersFetchFailed(false);
                  setRetryTick((t) => t + 1);
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-amber-600 text-white hover:bg-amber-700 shadow-sm transition shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* Orders List */}
          {filteredOrders.length > 0 ? (
            <div className="space-y-6 mb-12">
              {filteredOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  {...order}
                  onReorder={handleReorder}
                  onCancelOrder={handleCancelOrder}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-amber-300 p-8 shadow-2xs">
              <Package className="w-12 h-12 text-stone-400 mx-auto mb-4" />
              <h3 className="text-xl font-extrabold text-[#451a03] mb-1">No orders found</h3>
              <p className="text-xs sm:text-sm text-stone-600 mb-6">
                {orderSearch.trim() && 'No orders match your search.'}
                {!orderSearch.trim() && selectedStatus === 'active' && "You don't have any active orders right now."}
                {!orderSearch.trim() && selectedStatus === 'completed' && "You haven't completed any orders yet."}
                {!orderSearch.trim() && selectedStatus === 'cancelled' && "You don't have any cancelled orders."}
                {!orderSearch.trim() && selectedStatus === 'all' && 'Start by exploring our handcrafted menu!'}
              </p>
              {orderSearch.trim() && (
                <button
                  type="button"
                  onClick={() => setOrderSearch('')}
                  className="inline-block px-8 py-3 mb-4 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-full font-black text-xs sm:text-sm transition"
                >
                  Clear Search
                </button>
              )}
              <Link
                href="/customer"
                className="inline-block px-8 py-3 bg-[#B91C1C] hover:bg-[#991B1B] text-white rounded-full font-black text-xs sm:text-sm shadow-md transition hover:scale-105"
              >
                Browse Menu &amp; Order
              </Link>
            </div>
          )}
        </main>
      </div>

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        onAddRecommendedAddon={(addon) => {
          const addonMenuItem: CustomerMenuItem = {
            id: `addon-${addon.id}`,
            name: addon.name,
            description: '',
            price: addon.price,
            image: addon.image || '',
            category: 'Add-ons',
            rating: 5,
            reviews: 0,
            available: true,
          };
          handleAddToCart(addonMenuItem);
        }}
        fulfillmentType={fulfillmentType}
        setFulfillmentType={setFulfillmentType}
      />
    </div>
  );
}

// Wrap in Suspense boundary — required by Next.js when using useSearchParams()
export default function OrdersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FFF8F0] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#B91C1C]/30 border-t-[#B91C1C] rounded-full animate-spin"></div>
      </div>
    }>
      <OrdersPageContent />
    </Suspense>
  );
}
