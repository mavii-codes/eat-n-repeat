'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useAdminData } from '@/context/AdminDataContext';
import type { CustomerMenuItem } from './MenuCard';

export type CartItem = {
  menuItem: CustomerMenuItem;
  quantity: number;
  notes?: string;
};

type CartDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  fulfillmentType: 'delivery' | 'pickup' | 'dine-in';
  setFulfillmentType: (type: 'delivery' | 'pickup' | 'dine-in') => void;
};

export function CartDrawer({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  fulfillmentType,
  setFulfillmentType,
}: CartDrawerProps) {
  const { addDeliveryOrder, addStoreOrder } = useAdminData();
  const router = useRouter();
  const { data: session } = useSession();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleGoToCheckout = () => {
    if (!session?.user) {
      setShowAuthModal(true);
      return;
    }
    try {
      localStorage.setItem('eat-n-repeat-cart', JSON.stringify(cartItems));
    } catch {}
    onClose();
    router.push('/customer/checkout');
  };

  // Checkout states
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'gcash' | 'cod' | 'card'>('gcash');
  const [promoCode, setPromoCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Calculations
  const subtotal = cartItems.reduce((acc, item) => acc + item.menuItem.price * item.quantity, 0);
  const deliveryFee = fulfillmentType === 'delivery' ? (subtotal > 500 ? 0 : 49) : 0;
  const discount = (subtotal * discountPercent) / 100;
  const total = Math.max(0, subtotal + deliveryFee - discount);

  const handleApplyPromo = () => {
    if (promoCode.trim().toUpperCase() === 'EATREPEAT' || promoCode.trim().toUpperCase() === 'MANGBEST') {
      setDiscountPercent(15);
      setPromoApplied(true);
      setPromoError('');
    } else {
      setPromoError('Invalid code. Try "EATREPEAT" for 15% off!');
    }
  };

  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0) return;

    if (!customerName.trim()) {
      alert('Please enter your name');
      return;
    }

    if (fulfillmentType === 'delivery' && !address.trim()) {
      alert('Please enter a delivery address');
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      const orderItemsSummary = cartItems
        .map((ci) => `${ci.quantity}x ${ci.menuItem.name}`)
        .join(', ');

      const formattedItems = cartItems.map((ci) => ({
        menuItemId: ci.menuItem.id,
        name: ci.menuItem.name,
        quantity: ci.quantity,
        unitPrice: ci.menuItem.price,
      }));

      const newOrderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;

      if (fulfillmentType === 'delivery') {
        addDeliveryOrder({
          orderNumber: newOrderId,
          customerName: customerName.trim(),
          phone: phone.trim() || '09170000000',
          address: address.trim(),
          serviceAreaId: 'sa-1',
          items: orderItemsSummary,
          subtotal: subtotal,
          deliveryFee: deliveryFee,
          total: total,
          status: 'pending',
          orderedAt: new Date().toISOString(),
        });
      } else {
        addStoreOrder({
          orderId: newOrderId,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          items: `${customerName.trim()} (${fulfillmentType === 'dine-in' ? `Table ${tableNumber || '1'}` : 'Pick-Up'}): ${orderItemsSummary}`,
          total: total,
          status: 'pending',
          paid: paymentMethod !== 'cod',
        });
      }

      setIsSubmitting(false);
      setCompletedOrderId(newOrderId);
      onClearCart();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm transition-opacity animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="pointer-events-auto w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between">
          {/* Header */}
          <div className="p-4 sm:p-6 bg-rose-950 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-xl">
                🛒
              </div>
              <div>
                <h2 className="text-lg font-bold">Your Order Cart</h2>
                <p className="text-xs text-amber-200/80">Eat n' RepEat Café Cordova</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
            >
              ✕
            </button>
          </div>

          {/* Fulfillment Toggle Banner */}
          <div className="bg-amber-50 border-b border-amber-200/60 p-3 sm:px-6">
            <label className="text-xs font-bold text-rose-950 uppercase tracking-wider block mb-2">
              Fulfillment Type
            </label>
            <div className="grid grid-cols-3 gap-2 bg-white p-1 rounded-xl border border-amber-200 shadow-inner">
              <button
                type="button"
                onClick={() => setFulfillmentType('delivery')}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                  fulfillmentType === 'delivery'
                    ? 'bg-rose-900 text-white shadow-sm'
                    : 'text-stone-700 hover:bg-amber-100/50'
                }`}
              >
                🚚 Delivery
              </button>
              <button
                type="button"
                onClick={() => setFulfillmentType('pickup')}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                  fulfillmentType === 'pickup'
                    ? 'bg-rose-900 text-white shadow-sm'
                    : 'text-stone-700 hover:bg-amber-100/50'
                }`}
              >
                🛍️ Pick-Up
              </button>
              <button
                type="button"
                onClick={() => setFulfillmentType('dine-in')}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                  fulfillmentType === 'dine-in'
                    ? 'bg-rose-900 text-white shadow-sm'
                    : 'text-stone-700 hover:bg-amber-100/50'
                }`}
              >
                🍽️ Dine-In
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {completedOrderId ? (
              <div className="text-center py-10 space-y-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto border-4 border-emerald-200 animate-bounce">
                  ✓
                </div>
                <h3 className="text-2xl font-bold text-stone-900">Order Placed Successfully!</h3>
                <p className="text-sm text-stone-600">
                  Your Order ID is <span className="font-mono font-bold text-rose-900">{completedOrderId}</span>. Our kitchen is preparing your delicious meal!
                </p>
                <div className="pt-4 flex flex-col gap-2">
                  <Link
                    href="/customer/orders"
                    onClick={onClose}
                    className="w-full py-3 bg-rose-900 text-white rounded-xl font-bold text-sm shadow-md hover:bg-rose-950 transition text-center"
                  >
                    Track Order Status 📦
                  </Link>
                  <button
                    onClick={() => setCompletedOrderId(null)}
                    className="w-full py-2.5 text-stone-600 hover:text-stone-900 text-xs font-semibold"
                  >
                    Close Window
                  </button>
                </div>
              </div>
            ) : cartItems.length === 0 ? (
              <div className="text-center py-16 text-stone-500 space-y-3">
                <div className="text-5xl opacity-40">🛍️</div>
                <p className="font-semibold text-base text-stone-800">Your cart is empty</p>
                <p className="text-xs text-stone-500 max-w-xs mx-auto">
                  Browse our appetizing menu and click "+ Add to Order" to get started.
                </p>
              </div>
            ) : (
              <>
                {/* Cart Items */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-sm text-stone-900">Order Summary ({cartItems.length} items)</h3>
                    <button
                      onClick={onClearCart}
                      className="text-xs text-rose-700 hover:underline font-medium"
                    >
                      Clear All
                    </button>
                  </div>

                  {cartItems.map((item) => (
                    <div
                      key={item.menuItem.id}
                      className="flex gap-3 p-3 rounded-xl border border-stone-200 bg-stone-50/50 items-center justify-between"
                    >
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-stone-200 shrink-0">
                        <Image
                          src={item.menuItem.image || 'https://images.unsplash.com/photo-1541180464527-0245efded371?w=600&auto=format&fit=crop'}
                          alt={item.menuItem.name}
                          fill
                          className="object-cover"
                          unoptimized={item.menuItem.image?.startsWith('data:')}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs sm:text-sm text-stone-900 truncate">
                          {item.menuItem.name}
                        </h4>
                        <p className="text-xs font-bold text-amber-900 mt-0.5">
                          ₱{item.menuItem.price.toFixed(2)}
                        </p>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center border border-stone-300 rounded-lg bg-white overflow-hidden shadow-sm">
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.menuItem.id, -1)}
                            className="w-7 h-7 flex items-center justify-center text-stone-700 hover:bg-amber-100 transition font-bold"
                          >
                            -
                          </button>
                          <span className="w-7 text-center text-xs font-bold text-stone-900">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.menuItem.id, 1)}
                            className="w-7 h-7 flex items-center justify-center text-stone-700 hover:bg-amber-100 transition font-bold"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.menuItem.id)}
                          className="text-stone-400 hover:text-rose-600 p-1 text-sm transition"
                          title="Remove item"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Promo Code Strip */}
                <div className="pt-2 border-t border-stone-200">
                  <label className="text-xs font-bold text-stone-800 block mb-1">Promo Code</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. EATREPEAT"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      className="flex-1 px-3 py-2 border border-stone-300 rounded-xl text-xs uppercase font-mono focus:ring-2 focus:ring-rose-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      className="px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition"
                    >
                      Apply
                    </button>
                  </div>
                  {promoApplied && (
                    <p className="text-[11px] font-semibold text-emerald-600 mt-1">✓ Promo code applied! 15% discount.</p>
                  )}
                  {promoError && <p className="text-[11px] text-rose-600 mt-1">{promoError}</p>}
                </div>

                {/* Customer Checkout Form */}
                <form id="checkout-form" onSubmit={handleCheckout} className="space-y-3 pt-2 border-t border-stone-200">
                  <h3 className="font-bold text-sm text-stone-900">Customer & Delivery Details</h3>

                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Enter your name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">Mobile Phone *</label>
                    <input
                      type="tel"
                      required
                      placeholder="0917XXXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-900 focus:outline-none"
                    />
                  </div>

                  {fulfillmentType === 'delivery' && (
                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">Delivery Address *</label>
                      <textarea
                        required
                        rows={2}
                        placeholder="Complete street address, barangay, landmarks"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-900 focus:outline-none"
                      />
                    </div>
                  )}

                  {fulfillmentType === 'dine-in' && (
                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">Table Number</label>
                      <input
                        type="text"
                        placeholder="e.g. Table 4"
                        value={tableNumber}
                        onChange={(e) => setTableNumber(e.target.value)}
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-900 focus:outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">Payment Method</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('gcash')}
                        className={`py-2 px-1 rounded-xl text-xs font-bold border transition ${
                          paymentMethod === 'gcash'
                            ? 'border-blue-600 bg-blue-50 text-blue-800'
                            : 'border-stone-200 text-stone-600'
                        }`}
                      >
                        💙 GCash
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('cod')}
                        className={`py-2 px-1 rounded-xl text-xs font-bold border transition ${
                          paymentMethod === 'cod'
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                            : 'border-stone-200 text-stone-600'
                        }`}
                      >
                        💵 Cash
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('card')}
                        className={`py-2 px-1 rounded-xl text-xs font-bold border transition ${
                          paymentMethod === 'card'
                            ? 'border-purple-600 bg-purple-50 text-purple-800'
                            : 'border-stone-200 text-stone-600'
                        }`}
                      >
                        💳 Card
                      </button>
                    </div>
                  </div>
                </form>
              </>
            )}
          </div>

          {/* Footer Summary & Checkout Action */}
          {!completedOrderId && cartItems.length > 0 && (
            <div className="p-4 sm:p-6 border-t border-stone-200 bg-amber-50/50 space-y-3">
              <div className="space-y-1.5 text-xs text-stone-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-stone-900">₱{subtotal.toFixed(2)}</span>
                </div>

                {fulfillmentType === 'delivery' && (
                  <div className="flex justify-between">
                    <span>Delivery Fee</span>
                    <span className="font-semibold text-stone-900">
                      {deliveryFee === 0 ? <span className="text-emerald-600 font-bold">FREE</span> : `₱${deliveryFee.toFixed(2)}`}
                    </span>
                  </div>
                )}

                {discount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Discount (15%)</span>
                    <span>-₱{discount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm font-extrabold text-stone-900 pt-2 border-t border-stone-200">
                  <span>Total Payable</span>
                  <span className="text-rose-950 text-lg">₱{total.toFixed(2)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoToCheckout}
                className="w-full py-3.5 px-4 bg-[#B91C1C] text-white rounded-xl font-black text-sm shadow-md hover:bg-[#991B1B] active:scale-[0.99] transition flex items-center justify-center gap-2"
              >
                Proceed to Checkout (₱{total.toFixed(2)}) →
              </button>
            </div>
          )}
        </div>
      </div>

      {showAuthModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-amber-200/80 shadow-2xl space-y-6 text-center animate-in fade-in-50 zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-[#FFF1E0] text-[#B91C1C] rounded-full flex items-center justify-center text-3xl mx-auto shadow-2xs">
              🔑
            </div>
            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl font-black text-[#451a03]">You're almost there!</h3>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-semibold">
                Please sign in or create an account to place your order, track its status, and receive updates.
              </p>
            </div>
            
            <div className="space-y-3 pt-2">
              <Link
                href="/customer/login"
                onClick={() => {
                  try {
                    localStorage.setItem('eat-n-repeat-cart', JSON.stringify(cartItems));
                  } catch {}
                  setShowAuthModal(false);
                  onClose();
                }}
                className="block w-full py-3 bg-[#B91C1C] hover:bg-[#991B1B] text-white rounded-xl font-black text-sm shadow-md transition hover:scale-[1.02] active:scale-95 text-center"
              >
                Sign In
              </Link>
              <Link
                href="/customer/register"
                onClick={() => {
                  try {
                    localStorage.setItem('eat-n-repeat-cart', JSON.stringify(cartItems));
                  } catch {}
                  setShowAuthModal(false);
                  onClose();
                }}
                className="block w-full py-3 bg-white text-stone-850 border border-stone-300 hover:bg-stone-50 rounded-xl font-black text-sm transition hover:scale-[1.02] active:scale-95 text-center"
              >
                Create Account
              </Link>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="block w-full py-2.5 text-xs text-stone-500 hover:text-stone-800 font-extrabold hover:underline"
              >
                Continue Browsing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
