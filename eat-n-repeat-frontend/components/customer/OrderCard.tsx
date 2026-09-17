'use client';

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
  pending: { color: 'bg-amber-100 text-amber-800', icon: '⏳', label: 'Pending' },
  confirmed: { color: 'bg-blue-100 text-blue-800', icon: '✓', label: 'Confirmed' },
  preparing: { color: 'bg-orange-100 text-orange-800', icon: '👨‍🍳', label: 'Preparing' },
  ready: { color: 'bg-emerald-100 text-emerald-800', icon: '✓✓', label: 'Ready for Pick-Up' },
  out_for_delivery: { color: 'bg-purple-100 text-purple-800', icon: '🛵', label: 'Out for Delivery' },
  delivered: { color: 'bg-emerald-100 text-emerald-800', icon: '✓✓✓', label: 'Delivered' },
  cancelled: { color: 'bg-rose-100 text-rose-800', icon: '✗', label: 'Cancelled' },
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
  const config = statusConfig[status] || statusConfig.pending;
  const isActive = !['delivered', 'cancelled'].includes(status);

  return (
    <div className="group relative rounded-3xl border border-amber-200/80 bg-white hover:shadow-xl transition-all duration-300 overflow-hidden">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-black text-[#451a03]">Order #{orderNumber}</p>
            <p className="text-xs text-stone-500 font-semibold mt-1">{date}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-black ${config.color}`}>
            {config.icon} {config.label}
          </span>
        </div>

        {/* Delivery Type Badge */}
        <div className="mb-4">
          <span className="inline-block text-xs font-extrabold px-3 py-1 rounded-full bg-amber-100/80 text-[#451a03]">
            {deliveryType === 'dine-in' ? '🍽️ Dine-In' : '🛵 Express Delivery'}
            {estimatedTime && ` • Est. ${estimatedTime}`}
          </span>
        </div>

        {/* Items Preview */}
        <div className="mb-4 pb-4 border-b border-amber-100/80">
          {items.slice(0, 3).map((item, idx) => (
            <div key={idx} className="flex justify-between text-xs sm:text-sm mb-2">
              <span className="text-stone-700 font-semibold">
                {item.name} <span className="text-[#B91C1C] font-black">×{item.quantity}</span>
              </span>
              <span className="font-extrabold text-stone-900">₱{(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          {items.length > 3 && (
            <p className="text-xs text-[#B91C1C] font-bold">+{items.length - 3} more items</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-extrabold text-stone-500 uppercase tracking-wider">Total Amount</p>
            <p className="text-2xl font-black text-[#B91C1C]">₱{total.toFixed(2)}</p>
          </div>
          <div className={`px-5 py-2.5 rounded-full font-black text-xs text-white transition ${
            isActive
              ? 'bg-[#B91C1C] shadow-md shadow-red-500/25'
              : 'bg-stone-400'
          }`}>
            {isActive ? 'Live Tracking Active' : 'Completed'}
          </div>
        </div>

        {/* Progress Bar for Active Orders */}
        {isActive && (
          <div className="mt-4 pt-4 border-t border-amber-100/80">
            <div className="flex justify-between text-xs text-stone-600 font-bold mb-2">
              <span>Kitchen Progress</span>
              <span className="text-[#B91C1C]">
                {status === 'pending' ? '25%' : status === 'confirmed' ? '50%' : status === 'preparing' ? '75%' : '90%'}
              </span>
            </div>
            <div className="w-full h-2.5 bg-amber-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#B91C1C] to-red-500 rounded-full transition-all duration-500"
                style={{
                  width: status === 'pending' ? '25%' : status === 'confirmed' ? '50%' : status === 'preparing' ? '75%' : '90%',
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
