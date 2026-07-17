'use client';

import { useState } from 'react';
import { CustomerHeader } from '@/components/customer/CustomerHeader';
import { OrderCard } from '@/components/customer/OrderCard';

// Mock orders
const mockOrders = [
  {
    id: '1',
    orderNumber: '20240716001',
    date: 'July 16, 2024 • 10:30 AM',
    status: 'ready' as const,
    total: 12.50,
    items: [
      { name: 'Cappuccino', quantity: 2, price: 4.50 },
      { name: 'Croissant', quantity: 1, price: 3.99 },
    ],
    estimatedTime: '10 min',
    deliveryType: 'dine-in' as const,
  },
  {
    id: '2',
    orderNumber: '20240715002',
    date: 'July 15, 2024 • 2:45 PM',
    status: 'delivered' as const,
    total: 18.99,
    items: [
      { name: 'Espresso', quantity: 1, price: 3.50 },
      { name: 'Chocolate Cake', quantity: 2, price: 5.99 },
      { name: 'Iced Latte', quantity: 1, price: 4.99 },
    ],
    deliveryType: 'delivery' as const,
  },
  {
    id: '3',
    orderNumber: '20240714003',
    date: 'July 14, 2024 • 8:20 AM',
    status: 'delivered' as const,
    total: 16.48,
    items: [
      { name: 'Avocado Toast', quantity: 1, price: 6.50 },
      { name: 'Berry Muffin', quantity: 2, price: 3.99 },
      { name: 'Cappuccino', quantity: 1, price: 4.50 },
    ],
    deliveryType: 'delivery' as const,
  },
  {
    id: '4',
    orderNumber: '20240713004',
    date: 'July 13, 2024 • 12:00 PM',
    status: 'cancelled' as const,
    total: 9.99,
    items: [
      { name: 'Caesar Salad', quantity: 1, price: 7.99 },
    ],
    deliveryType: 'dine-in' as const,
  },
  {
    id: '5',
    orderNumber: '20240712005',
    date: 'July 12, 2024 • 3:30 PM',
    status: 'delivered' as const,
    total: 14.49,
    items: [
      { name: 'Iced Latte', quantity: 2, price: 4.99 },
      { name: 'Croissant', quantity: 1, price: 3.99 },
    ],
    deliveryType: 'delivery' as const,
  },
];

type OrderStatus = 'all' | 'active' | 'completed' | 'cancelled';

export default function OrdersPage() {
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>('all');

  const filteredOrders = mockOrders.filter(order => {
    if (selectedStatus === 'all') return true;
    if (selectedStatus === 'active') return !['delivered', 'cancelled'].includes(order.status);
    if (selectedStatus === 'completed') return order.status === 'delivered';
    if (selectedStatus === 'cancelled') return order.status === 'cancelled';
    return true;
  });

  const stats = {
    active: mockOrders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length,
    completed: mockOrders.filter(o => o.status === 'delivered').length,
    total: mockOrders.reduce((sum, o) => sum + o.total, 0),
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-amber-50">
      <CustomerHeader 
        title="Your Orders" 
        subtitle="Track and manage all your orders in one place"
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
            <p className="text-sm font-semibold text-blue-900">Active Orders</p>
            <p className="text-3xl font-bold text-blue-700 mt-2">{stats.active}</p>
          </div>
          <div className="p-6 rounded-2xl bg-gradient-to-br from-green-50 to-green-100 border border-green-200">
            <p className="text-sm font-semibold text-green-900">Completed Orders</p>
            <p className="text-3xl font-bold text-green-700 mt-2">{stats.completed}</p>
          </div>
          <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200">
            <p className="text-sm font-semibold text-amber-900">Total Spent</p>
            <p className="text-3xl font-bold text-amber-700 mt-2">${stats.total.toFixed(2)}</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-4 mb-8 border-b border-amber-100/30 pb-4">
          {(['all', 'active', 'completed', 'cancelled'] as const).map(status => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`px-4 py-2 font-semibold transition relative ${
                selectedStatus === status
                  ? 'text-amber-700'
                  : 'text-amber-900/60 hover:text-amber-900'
              }`}
            >
              {status === 'all' && 'All Orders'}
              {status === 'active' && 'Active'}
              {status === 'completed' && 'Completed'}
              {status === 'cancelled' && 'Cancelled'}
              {selectedStatus === status && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-700 rounded-t"></div>
              )}
            </button>
          ))}
        </div>

        {/* Orders List */}
        {filteredOrders.length > 0 ? (
          <div className="space-y-4 mb-12">
            {filteredOrders.map(order => (
              <OrderCard key={order.id} {...order} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-2xl font-bold text-amber-950 mb-2">No orders found</h3>
            <p className="text-amber-900/70 mb-6">
              {selectedStatus === 'active' && "You don't have any active orders"}
              {selectedStatus === 'completed' && "You haven't completed any orders yet"}
              {selectedStatus === 'cancelled' && "You don't have any cancelled orders"}
              {selectedStatus === 'all' && 'Start by placing your first order!'}
            </p>
            <a
              href="/customer/menu"
              className="inline-block px-8 py-3 bg-amber-700 text-white rounded-full hover:bg-amber-800 transition font-semibold"
            >
              Browse Menu
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
