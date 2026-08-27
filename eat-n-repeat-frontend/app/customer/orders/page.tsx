'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { CustomerHeader } from '@/components/customer/CustomerHeader';
import { OrderCard, type OrderCardProps } from '@/components/customer/OrderCard';
import { CartDrawer, type CartItem } from '@/components/customer/CartDrawer';
import { useAdminData } from '@/context/AdminDataContext';
import { Package, Bike, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

// Realistic sample orders for Cordova branch customer portal
const fallbackOrders: OrderCardProps[] = [
  {
    id: 'ord-101',
    orderNumber: '20240716001',
    date: 'Today • 10:30 AM',
    status: 'pending',
    subtotal: 334.00,
    deliveryFee: 45.00,
    discount: 0,
    total: 379.00,
    paymentMethod: 'Cash on Delivery',
    customerName: 'Maria Santos',
    customerPhone: '0917 123 4567',
    customerAddress: 'Suba-Basbas, Cordova, Cebu',
    items: [
      { name: 'Signature Chicken Inasal Rice Bowl', quantity: 1, price: 189.00 },
      { name: 'House Special Latte', quantity: 1, price: 145.00 },
    ],
    estimatedTime: '~30-40 mins',
    deliveryType: 'delivery',
  },
  {
    id: 'ord-102',
    orderNumber: '20240716002',
    date: 'Today • 9:15 AM',
    status: 'preparing',
    subtotal: 274.00,
    deliveryFee: 45.00,
    discount: 0,
    total: 319.00,
    paymentMethod: 'GCash e-Wallet',
    customerName: 'Juan Dela Cruz',
    customerPhone: '0922 987 6543',
    customerAddress: 'Poblacion, Cordova, Cebu',
    items: [
      { name: 'Uji Matcha Milktea', quantity: 1, price: 165.00 },
      { name: 'Garlic Parmesan Truffle Fries', quantity: 1, price: 109.00 },
    ],
    estimatedTime: '~15-20 mins',
    deliveryType: 'delivery',
  },
  {
    id: 'ord-103',
    orderNumber: '20240715002',
    date: 'Yesterday • 2:45 PM',
    status: 'delivered',
    subtotal: 423.00,
    deliveryFee: 0,
    discount: 30.00,
    total: 393.00,
    paymentMethod: 'Cash on Delivery',
    customerName: 'Maria Santos',
    customerPhone: '0917 123 4567',
    customerAddress: 'Suba-Basbas, Cordova, Cebu',
    items: [
      { name: 'Spam & Egg Comfort Bowl', quantity: 1, price: 165.00 },
      { name: 'Brown Sugar Boba Milk', quantity: 1, price: 149.00 },
      { name: 'Garlic Parmesan Truffle Fries', quantity: 1, price: 109.00 },
    ],
    deliveryType: 'delivery',
  },
];

type OrderFilterStatus = 'all' | 'active' | 'completed' | 'cancelled';

function OrdersPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedStatus, setSelectedStatus] = useState<OrderFilterStatus>('all');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'pickup' | 'dine-in'>('delivery');

  // Payment redirect banner state
  const [paymentBanner, setPaymentBanner] = useState<{
    type: 'success' | 'failed';
    orderNumber: string;
  } | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Detect Xendit redirect query params (?success=true/false&order=ORD-XXXX)
  useEffect(() => {
    const success = searchParams.get('success');
    const orderNumber = searchParams.get('order');
    if (success && orderNumber) {
      setPaymentBanner({
        type: success === 'true' ? 'success' : 'failed',
        orderNumber,
      });
      // Clean the URL so refreshing doesn't re-show the banner
      window.history.replaceState({}, '', '/customer/orders');
    }
  }, [searchParams]);

  // Retry failed GCash payment
  const handleRetryPayment = async (orderNumber: string) => {
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

  const { updateDeliveryStatus, menuItems } = useAdminData();
  const [liveOrders, setLiveOrders] = useState<OrderCardProps[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);

  // Fetch real customer orders from the backend
  useEffect(() => {
    if (status !== 'authenticated') return;

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
              const isConfirmed = o.status === 'assigned';
              const isPreparing = o.status === 'preparing';

              let mappedStatus: OrderCardProps['status'] = 'preparing';
              if (isCompleted) mappedStatus = 'delivered';
              else if (isCancel) mappedStatus = 'cancelled';
              else if (isPending) mappedStatus = 'pending';
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
                paymentMethod: o.paymentMethod || 'Unknown',
                customerName: o.customerName || 'Valued Customer',
                customerPhone: o.phone || '',
                customerAddress: o.address || '',
                items: o.items ? JSON.parse(o.items) : [],
                deliveryType: o.type === 'dine-in' ? 'dine-in' : o.type === 'pickup' ? 'pickup' : 'delivery',
              };
            });
            if (mounted) {
              setLiveOrders(mappedOrders);
              setIsLoadingOrders(false);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch orders:', error);
        if (mounted) setIsLoadingOrders(false);
      }
    };

    fetchOrders();
    // Refresh orders every 10 seconds to keep tracking updated
    const interval = setInterval(fetchOrders, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [status, session]);

  if (status === 'loading' || status === 'unauthenticated' || isLoadingOrders) {
    return (
      <div className="min-h-screen bg-[#FFF8F0] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#B91C1C]/30 border-t-[#B91C1C] rounded-full animate-spin"></div>
      </div>
    );
  }

  const allOrdersList = liveOrders.length > 0 ? liveOrders : fallbackOrders;

  const filteredOrders = allOrdersList.filter((order) => {
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

  // Order Cancellation Handler
  const handleCancelOrder = (orderId: string) => {
    updateDeliveryStatus(orderId, 'cancelled');
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
                {selectedStatus === 'active' && "You don't have any active orders right now."}
                {selectedStatus === 'completed' && "You haven't completed any orders yet."}
                {selectedStatus === 'cancelled' && "You don't have any cancelled orders."}
                {selectedStatus === 'all' && 'Start by exploring our handcrafted menu!'}
              </p>
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
