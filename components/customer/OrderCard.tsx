'use client';

import Image from 'next/image';
import Link from 'next/link';

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';

type OrderCardProps = {
  id: string;
  orderNumber: string;
  date: string;
  status: OrderStatus;
  total: number;
  items: {
    name: string;
    quantity: number;
    price: number;
  }[];
  estimatedTime?: string;
  deliveryType: 'dine-in' | 'delivery';
};

const statusConfig: Record<OrderStatus, { color: string; icon: string; label: string }> = {
  pending: { color: 'bg-gray-100 text-gray-700', icon: '⏳', label: 'Pending' },
  confirmed: { color: 'bg-blue-100 text-blue-700', icon: '✓', label: 'Confirmed' },
  preparing: { color: 'bg-yellow-100 text-yellow-700', icon: '👨‍🍳', label: 'Preparing' },
  ready: { color: 'bg-green-100 text-green-700', icon: '✓✓', label: 'Ready' },
  out_for_delivery: { color: 'bg-purple-100 text-purple-700', icon: '🚗', label: 'Out for Delivery' },
  delivered: { color: 'bg-emerald-100 text-emerald-700', icon: '✓✓✓', label: 'Delivered' },
  cancelled: { color: 'bg-red-100 text-red-700', icon: '✗', label: 'Cancelled' },
};

export function OrderCard({
  id,
  orderNumber,
  date,
  status,
  total,
  items,
  estimatedTime,
  deliveryType,
}: OrderCardProps) {
  const config = statusConfig[status];
  const isActive = !['delivered', 'cancelled'].includes(status);

  return (
    <Link href={`/customer/orders/${id}`}>
      <div className="group relative rounded-2xl border border-amber-100/30 hover:border-amber-300/50 bg-white hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-amber-700">Order #{orderNumber}</p>
              <p className="text-xs text-amber-900/60 mt-1">{date}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${config.color}`}>
              {config.icon} {config.label}
            </span>
          </div>

          {/* Delivery Type Badge */}
          <div className="mb-4">
            <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-900">
              {deliveryType === 'dine-in' ? '🍽️ Dine-in' : '🚗 Delivery'}
              {estimatedTime && ` • ${estimatedTime}`}
            </span>
          </div>

          {/* Items Preview */}
          <div className="mb-4 pb-4 border-b border-amber-100/30">
            {items.slice(0, 2).map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm mb-2">
                <span className="text-amber-900">
                  {item.name} <span className="text-amber-700">×{item.quantity}</span>
                </span>
                <span className="font-semibold text-amber-950">${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            {items.length > 2 && (
              <p className="text-xs text-amber-700 font-medium">+{items.length - 2} more items</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-amber-900/60">Total Amount</p>
              <p className="text-2xl font-bold text-amber-700">${total.toFixed(2)}</p>
            </div>
            <div className={`px-4 py-2 rounded-lg font-semibold text-white transition ${
              isActive
                ? 'bg-amber-700 group-hover:bg-amber-800'
                : 'bg-gray-400'
            }`}>
              {isActive ? 'Track' : 'View'} →
            </div>
          </div>

          {/* Progress Bar for Active Orders */}
          {isActive && (
            <div className="mt-4 pt-4 border-t border-amber-100/30">
              <div className="flex justify-between text-xs text-amber-900/60 mb-2">
                <span>Progress</span>
                <span>{Math.floor((Object.keys(statusConfig).indexOf(status) / Object.keys(statusConfig).length) * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-amber-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-700 rounded-full transition-all duration-300"
                  style={{ width: `${(Object.keys(statusConfig).indexOf(status) / Object.keys(statusConfig).length) * 100}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
