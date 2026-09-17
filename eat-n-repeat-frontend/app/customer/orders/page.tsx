'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CustomerHeader } from '@/components/customer/CustomerHeader';
import { OrderCard } from '@/components/customer/OrderCard';
import { CartDrawer } from '@/components/customer/CartDrawer';
import { useAdminData } from '@/context/AdminDataContext';

// Fallback Cebu Cordova orders
const fallbackOrders = [
  {
    id: '1',
    orderNumber: '20240716001',
    date: 'Today • 10:30 AM',
    status: 'ready' as const,
    total: 334.00,
    items: [
      { name: 'Signature Chicken Inasal Rice Bowl', quantity: 1, price: 189.00 },
      { name: 'House Special Latte', quantity: 1, price: 145.00 },
    ],
    estimatedTime: '10 min',
    deliveryType: 'delivery' as const,
  },
  {
    id: '2',
    orderNumber: '20240715002',
    date: 'Yesterday • 2:45 PM',
    status: 'delivered' as const,
    total: 423.00,
    items: [
      { name: 'Spam & Egg Comfort Bowl', quantity: 1, price: 165.00 },
      { name: 'Brown Sugar Boba Milk', quantity: 1, price: 149.00 },
      { name: 'Garlic Parmesan Truffle Fries', quantity: 1, price: 109.00 },
    ],
    deliveryType: 'delivery' as const,
  },
];

type OrderFilterStatus = 'all' | 'active' | 'completed' | 'cancelled';

export default function OrdersPage() {
  const [selectedStatus, setSelectedStatus] = useState<OrderFilterStatus>('all');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'pickup' | 'dine-in'>('delivery');
  const { deliveryOrders } = useAdminData();

  // Map live orders from AdminDataContext if available, otherwise use fallbackOrders
  const liveMappedOrders = deliveryOrders.map((o) => ({
    id: o.id || o.orderNumber,
    orderNumber: o.orderNumber,
    date: new Date(o.orderedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
    status: (o.status === 'delivered' ? 'delivered' : o.status === 'cancelled' ? 'cancelled' : 'preparing') as any,
    total: o.total,
    items: [
      { name: o.items || 'Menu items', quantity: 1, price: o.total },
    ],
    deliveryType: 'delivery' as const,
  }));

  const allOrdersList = liveMappedOrders.length > 0 ? liveMappedOrders : fallbackOrders;

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

  return (
    <div className="min-h-screen bg-[#FFF8F0] text-stone-900 flex flex-col justify-between selection:bg-[#B91C1C] selection:text-white">
      <div>
        <CustomerHeader 
          onOpenCart={() => setIsCartOpen(true)}
          fulfillmentType={fulfillmentType}
          setFulfillmentType={setFulfillmentType}
        />

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          {/* Header Banner */}
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-black text-[#451a03] tracking-tight">
              My Orders &amp; Tracking
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 mt-1">
              Track active kitchen preparation and view your order history for Cordova.
            </p>
          </div>

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
                  {status === 'completed' && 'Delivered'}
                  {status === 'cancelled' && 'Cancelled'}
                </button>
              );
            })}
          </div>

          {/* Orders List */}
          {filteredOrders.length > 0 ? (
            <div className="space-y-6 mb-12">
              {filteredOrders.map((order) => (
                <OrderCard key={order.id} {...order} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-amber-300 p-8 shadow-2xs">
              <div className="text-5xl mb-4">📦</div>
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
        cartItems={[]}
        onUpdateQuantity={() => {}}
        onRemoveItem={() => {}}
        onClearCart={() => {}}
        fulfillmentType={fulfillmentType}
        setFulfillmentType={setFulfillmentType}
      />
    </div>
  );
}
