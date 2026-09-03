'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ShoppingCart, Truck, ShoppingBag, Utensils, Check, FileText, CreditCard, Banknote, Key, Package } from 'lucide-react';
import { useAdminData } from '@/context/AdminDataContext';
import { useNetworkStatus } from '@/context/NetworkStatusContext';
import { useLocalMode } from '@/lib/customer/useLocalMode';

export type CartItem = {
  menuItem: CustomerMenuItem;
  quantity: number;
  notes?: string;
  selectedSize?: { name: string; price: number };
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
  const { addDeliveryOrder, addStoreOrder, deliverySettings, serviceAreas } = useAdminData();
  const router = useRouter();
  const { data: session } = useSession();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const isLocalMode = useLocalMode();

  useEffect(() => {
    if (isLocalMode && fulfillmentType !== 'dine-in') {
      setFulfillmentType('dine-in');
    }
  }, [isLocalMode, fulfillmentType, setFulfillmentType]);

  const handleGoToCheckout = () => {
    if (!session?.user && !isLocalMode) {
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
  const [selectedServiceAreaId, setSelectedServiceAreaId] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'gcash' | 'cod' | null>(null);
  
  useEffect(() => {
    if (isLocalMode) {
      setPaymentMethod('cod'); // Force cash in local mode
    }
  }, [isLocalMode]);

  const [isPaymentExpanded, setIsPaymentExpanded] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<{ id: string; type: string; paymentMethod: string; orderNumber: string } | null>(null);

  // Calculations
  useEffect(() => {
    if (paymentMethod && !['gcash', 'cod'].includes(paymentMethod)) {
      setPaymentMethod(null);
    }
  }, [fulfillmentType, paymentMethod]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cartStateChange', { detail: isOpen }));
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cartStateChange', { detail: false }));
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const getCashDescription = () => {
    if (fulfillmentType === 'delivery') return 'Pay when your order arrives';
    if (fulfillmentType === 'pickup') return 'Pay when you pick up your order';
    if (fulfillmentType === 'dine-in') return 'Pay at the café';
    return 'Pay with cash';
  };

  const subtotal = cartItems.reduce((acc, item) => acc + (item.selectedSize ? item.selectedSize.price : item.menuItem.price) * item.quantity, 0);
  
  const selectedArea = serviceAreas.find(sa => sa.id === selectedServiceAreaId);
  const distanceKm = selectedArea?.distanceKm || 0;
  
  let deliveryFee = 0;
  let deliveryFeeRule = '';
  
  if (fulfillmentType === 'delivery' && selectedArea) {
    if (distanceKm <= (deliverySettings?.freeDeliveryRadiusKm || 0)) {
      deliveryFee = 0;
      deliveryFeeRule = `Cordova Free Delivery Area (≤ ${deliverySettings?.freeDeliveryRadiusKm || 0} km)`;
    } else {
      deliveryFee = (deliverySettings?.baseDeliveryFee || 0) + (distanceKm * (deliverySettings?.perKmFee || 0));
      deliveryFeeRule = `Distance-based (${distanceKm} km)`;
    }
  }

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

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0) return;

    // Prevent duplicate submissions
    if (isSubmitting) return;

    const finalCustomerName = isLocalMode ? (customerName.trim() || 'Local Guest') : customerName.trim();

    if (!finalCustomerName) {
      alert('Please enter your name');
      return;
    }

    if (fulfillmentType === 'delivery') {
      if (!selectedServiceAreaId) {
        alert('Please select your Delivery Area (Barangay/City)');
        return;
      }
      if (!address.trim()) {
        alert('Please enter a complete delivery address');
        return;
      }
    }

    if (!paymentMethod) {
      alert('Please select a payment method');
      return;
    }

    setIsSubmitting(true);

    try {
      const { getApiUrl } = await import('@/lib/config');
      const accessToken = (session as any)?.accessToken as string | undefined;

      const orderItemsSummary = cartItems
        .map((ci) => `${ci.quantity}x ${ci.menuItem.name}${ci.selectedSize ? ` (${ci.selectedSize.name})` : ''}`)
        .join(', ');

      const orderNumber = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;

      const orderDetails = {
        orderNumber,
        customerName: finalCustomerName,
        phone: phone.trim() || (isLocalMode ? 'LocalGuest' : '09170000000'),
        address: fulfillmentType === 'dine-in' ? (tableNumber || 'Counter') : (address.trim() || null),
        serviceAreaId: fulfillmentType === 'delivery' ? selectedServiceAreaId : null,
        type: fulfillmentType,
        items: orderItemsSummary,
        subtotal,
        deliveryFee,
        total,
        notes: cartItems.filter(ci => ci.notes).map(ci => `${ci.menuItem.name}: ${ci.notes}`).join('; ') || null,
        selectedAddons: [],
      };

      // Map frontend payment method to backend-expected values
      const backendPaymentMethod = paymentMethod === 'gcash' ? 'GCash' : 'Cash';

      const response = await fetch(`${getApiUrl()}/api/payments/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ orderDetails, paymentMethod: backendPaymentMethod }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to process checkout');
      }

      if (paymentMethod === 'gcash' && data.invoiceUrl) {
        onClearCart();
        window.location.href = data.invoiceUrl;
        return;
      }

      if (fulfillmentType === 'delivery') {
        addDeliveryOrder({
          orderNumber: data.orderNumber || orderNumber,
          customerName: finalCustomerName,
          phone: phone.trim() || '09170000000',
          address: address.trim(),
          serviceAreaId: selectedServiceAreaId || 'sa-1',
          items: orderItemsSummary,
          subtotal,
          deliveryFee,
          total,
          status: 'pending',
          orderedAt: new Date().toISOString(),
        });
      } else {
        addStoreOrder({
          orderId: data.orderNumber || orderNumber,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          items: `${isLocalMode ? '[GUEST] ' : ''}${finalCustomerName} (${fulfillmentType === 'dine-in' ? `Table ${tableNumber || '1'}` : 'Pick-Up'}): ${orderItemsSummary}`,
          total,
          status: fulfillmentType === 'dine-in' ? 'awaiting_payment' : 'pending',
          paid: false,
        });
      }

      setIsSubmitting(false);
      setCompletedOrder({
        id: data.orderId || orderNumber,
        orderNumber: data.orderNumber || orderNumber,
        type: fulfillmentType,
        paymentMethod: backendPaymentMethod
      });
      onClearCart();
    } catch (error: any) {
      console.error('Checkout error:', error);
      setIsSubmitting(false);
      alert(error.message || 'Something went wrong. Please try again.');
    }
  };


  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm transition-opacity animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="pointer-events-auto w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between">
          {/* Header */}
          <div className="p-4 sm:p-6 bg-rose-950 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-500">
                <ShoppingCart className="w-5 h-5" />
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
              {!isLocalMode && (
                <>
                  <button
                    type="button"
                    onClick={() => setFulfillmentType('delivery')}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                      fulfillmentType === 'delivery'
                        ? 'bg-rose-900 text-white shadow-sm'
                        : 'text-stone-700 hover:bg-amber-100/50'
                    }`}
                  >
                    <Truck className="w-4 h-4" /> Delivery
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
                    <ShoppingBag className="w-4 h-4" /> Pick-Up
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setFulfillmentType('dine-in')}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                  fulfillmentType === 'dine-in'
                    ? 'bg-rose-900 text-white shadow-sm'
                    : 'text-stone-700 hover:bg-amber-100/50'
                } ${isLocalMode ? 'col-span-3' : ''}`}
              >
                <Utensils className="w-4 h-4" /> Dine-In
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {completedOrder ? (
              completedOrder.type === 'dine-in' && completedOrder.paymentMethod !== 'GCash' ? (
                <div className="text-center py-6 space-y-4">
                  <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-3xl mx-auto border-4 border-rose-200">
                    <Banknote className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-stone-900 leading-tight">Order Reserved &mdash; Payment Required</h3>
                  
                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 shadow-sm text-left mx-auto max-w-sm space-y-1">
                    <div className="flex justify-between border-b border-stone-200 pb-2">
                      <span className="text-xs text-stone-500 font-bold uppercase">Order ID</span>
                      <span className="font-mono font-bold text-rose-900">{completedOrder.orderNumber}</span>
                    </div>
                    <div className="flex justify-between border-b border-stone-200 py-2">
                      <span className="text-xs text-stone-500 font-bold uppercase">Table</span>
                      <span className="font-bold">{tableNumber || 'Counter'}</span>
                    </div>
                    <div className="flex justify-between border-b border-stone-200 py-2">
                      <span className="text-xs text-stone-500 font-bold uppercase">Amount Due</span>
                      <span className="font-bold text-lg text-[#800000]">₱{total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-2">
                      <span className="text-xs text-stone-500 font-bold uppercase">Payment Method</span>
                      <span className="font-bold text-sm">Cash at Counter</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-900 shadow-sm text-left mx-auto max-w-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse"></div>
                      <h4 className="font-black text-sm uppercase">Awaiting Cash Payment</h4>
                    </div>
                    <p className="text-xs font-medium opacity-90 leading-relaxed mb-2">
                      Please proceed to the cashier and present your Order ID. Your order will only be sent to the kitchen after the cashier confirms your cash payment.
                    </p>
                    <p className="text-[11px] font-bold text-rose-700 bg-white/50 p-2 rounded border border-rose-100">
                      Your order is not yet being prepared. Payment must be confirmed by the cashier first.
                    </p>
                  </div>
                  
                  <div className="pt-2 flex flex-col gap-2">
                    {!isLocalMode && (
                      <button
                        onClick={() => { setCompletedOrder(null); onClose(); router.push('/customer/orders'); }}
                        className="w-full py-3 bg-stone-900 text-white rounded-xl font-bold text-sm shadow-md hover:bg-stone-950 transition text-center"
                      >
                        Track Order Status <Package className="w-4 h-4 inline ml-1" />
                      </button>
                    )}
                    <button
                      onClick={() => { setCompletedOrder(null); onClose(); }}
                      className={`w-full py-2.5 text-xs font-semibold ${isLocalMode ? 'bg-stone-900 text-white py-3 rounded-xl hover:bg-stone-950' : 'text-stone-600 hover:text-stone-900'}`}
                    >
                      Close Window
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 space-y-4">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto border-4 border-emerald-200 animate-bounce">
                    ✓
                  </div>
                  <h3 className="text-2xl font-bold text-stone-900">Order Placed Successfully!</h3>
                  <p className="text-sm text-stone-600">
                    Your Order ID is <span className="font-mono font-bold text-rose-900">{completedOrder.orderNumber}</span>. Our kitchen is preparing your delicious meal!
                  </p>
                  <div className="pt-4 flex flex-col gap-2">
                    <Link
                      href="/customer/orders"
                      onClick={() => { setCompletedOrder(null); onClose(); }}
                      className="w-full py-3 bg-rose-900 text-white rounded-xl font-bold text-sm shadow-md hover:bg-rose-950 transition text-center"
                    >
                      Track Order Status <Package className="w-4 h-4 inline" />
                    </Link>
                    <button
                      onClick={() => { setCompletedOrder(null); onClose(); }}
                      className="w-full py-2.5 text-stone-600 hover:text-stone-900 text-xs font-semibold"
                    >
                      Close Window
                    </button>
                  </div>
                </div>
              )
            ) : cartItems.length === 0 ? (
              <div className="text-center py-16 text-stone-500 space-y-3">
                <div className="opacity-40"><ShoppingBag className="w-12 h-12 text-stone-400 mx-auto" /></div>
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
                {session?.user || isLocalMode ? (
                <form id="checkout-form" onSubmit={handleCheckout} className="space-y-3 pt-2 border-t border-stone-200">
                  <h3 className="font-bold text-sm text-stone-900">Customer & Delivery Details</h3>

                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder={isLocalMode ? "Enter your name (Guest)" : "Enter your name"}
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-900 focus:outline-none"
                    />
                  </div>

                  {!isLocalMode && (
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
                  )}

                  {fulfillmentType === 'delivery' && (
                    <>
                      <div>
                        <label className="text-xs font-semibold text-stone-700 block mb-1">Delivery Area (Barangay/City) *</label>
                        <select
                          required
                          value={selectedServiceAreaId}
                          onChange={(e) => setSelectedServiceAreaId(e.target.value)}
                          className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-900 focus:outline-none bg-white"
                        >
                          <option value="" disabled>Select Delivery Area</option>
                          {serviceAreas.filter(area => area.active && !area.archived).map((area) => (
                            <option key={area.id} value={area.id}>
                              {area.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-stone-700 block mb-1">Delivery Address *</label>
                        <textarea
                          required
                          rows={2}
                          placeholder="Complete street address, barangay, landmarks"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-900 focus:outline-none mt-3"
                        />
                      </div>
                    </>
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

                  <div className="mt-4">
                    <label className="text-xs font-semibold text-stone-700 block mb-1">Payment Details</label>
                    <div className="border border-stone-200 rounded-xl bg-white shadow-sm overflow-hidden">
                      <div 
                        className="p-3 flex items-center justify-between cursor-pointer hover:bg-stone-50 transition-colors"
                        onClick={() => setIsPaymentExpanded(!isPaymentExpanded)}
                      >
                        <div className="flex items-center gap-3">
                          {!paymentMethod || isPaymentExpanded ? (
                            <>
                              <CreditCard className="w-5 h-5 text-stone-500" />
                              <span className="text-sm font-bold text-stone-800">Select Payment Method</span>
                            </>
                          ) : paymentMethod === 'gcash' ? (
                            <>
                              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-xs shadow-sm">G</div>
                              <div className="text-left">
                                <p className="text-sm font-bold text-stone-800">GCash</p>
                                <p className="text-[10px] text-stone-500 font-medium">Powered by Xendit</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="w-8 h-8 bg-rose-100 text-rose-700 rounded-lg flex items-center justify-center shadow-sm">
                                <Banknote className="w-4 h-4" />
                              </div>
                              <div className="text-left">
                                <p className="text-sm font-bold text-stone-800">Cash</p>
                                <p className="text-[10px] text-stone-500 font-medium">{getCashDescription()}</p>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!isPaymentExpanded && paymentMethod && <Check className="w-5 h-5 text-emerald-600" />}
                          <svg className={`w-5 h-5 text-stone-400 transition-transform ${isPaymentExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                      
                      {isPaymentExpanded && (
                        <div className="p-3 border-t border-stone-100 space-y-2 bg-stone-50/50">
                          <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-2 pl-1">Choose Payment Method</p>
                          {!isLocalMode && (
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); setPaymentMethod('gcash'); }}
                              className={`w-full p-3 border rounded-xl flex items-center justify-between transition-colors ${paymentMethod === 'gcash' ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600' : 'border-stone-200 hover:border-blue-300 bg-white'}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-xs shadow-sm">G</div>
                                <div className="text-left">
                                  <p className="text-sm font-bold text-stone-800">GCash</p>
                                  <p className="text-[10px] text-stone-500 font-medium">Powered by Xendit</p>
                                </div>
                              </div>
                              {paymentMethod === 'gcash' ? (
                                <div className="w-4 h-4 rounded-full border-[4px] border-blue-600 bg-white shadow-sm flex-shrink-0"></div>
                              ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-stone-300 flex-shrink-0"></div>
                              )}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); setPaymentMethod('cod'); }}
                            className={`w-full p-3 border rounded-xl flex items-center justify-between transition-colors ${paymentMethod === 'cod' ? 'border-rose-600 bg-rose-50/50 ring-1 ring-rose-600' : 'border-stone-200 hover:border-rose-300 bg-white'}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-rose-100 text-rose-700 rounded-lg flex items-center justify-center shadow-sm">
                                <Banknote className="w-4 h-4" />
                              </div>
                              <div className="text-left">
                                <p className="text-sm font-bold text-stone-800">Cash</p>
                                <p className="text-[10px] text-stone-500 font-medium">{getCashDescription()}</p>
                              </div>
                            </div>
                            {paymentMethod === 'cod' ? (
                              <div className="w-4 h-4 rounded-full border-[4px] border-rose-600 bg-white shadow-sm flex-shrink-0"></div>
                            ) : (
                              <div className="w-4 h-4 rounded-full border-2 border-stone-300 flex-shrink-0"></div>
                            )}
                          </button>

                          {paymentMethod && (
                            <div className="pt-2">
                              <button
                                type="button"
                                onClick={() => setIsPaymentExpanded(false)}
                                className={`w-full py-2.5 rounded-lg font-bold text-xs shadow-sm transition-colors text-white ${
                                  paymentMethod === 'gcash' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-rose-600 hover:bg-rose-700'
                                }`}
                              >
                                Confirm
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </form>
                ) : (
                  <div className="pt-6 pb-2 text-center border-t border-stone-200">
                    <p className="text-sm font-semibold text-stone-600 mb-1">Ready to order?</p>
                    <p className="text-xs text-stone-500">Sign in to provide delivery and payment details.</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer Summary & Checkout Action */}
          {!completedOrder && cartItems.length > 0 && (
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

              {session?.user || isLocalMode ? (
                <button
                  type="submit"
                  form="checkout-form"
                  disabled={isSubmitting}
                  className={`w-full py-3.5 px-4 text-white rounded-xl font-black text-sm shadow-md active:scale-[0.99] transition flex items-center justify-center gap-2 ${
                    isSubmitting 
                      ? 'bg-stone-400 cursor-not-allowed' 
                      : 'bg-[#B91C1C] hover:bg-[#991B1B]'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : paymentMethod === 'gcash' ? (
                    `Pay with GCash - ₱${total.toFixed(2)}`
                  ) : (
                    `Place Order - ₱${total.toFixed(2)}`
                  )}
                </button>

              ) : (
                <button
                  type="button"
                  onClick={() => setShowAuthModal(true)}
                  className="w-full py-3.5 px-4 bg-[#B91C1C] text-white rounded-xl font-black text-sm shadow-md hover:bg-[#991B1B] active:scale-[0.99] transition flex items-center justify-center gap-2"
                >
                  Proceed to Checkout
                </button>
              )}
            </div>
          )}
        </div>
      </div>


      {showAuthModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-amber-200/80 shadow-2xl space-y-6 text-center animate-in fade-in-50 zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-[#FFF1E0] text-[#B91C1C] rounded-full flex items-center justify-center text-3xl mx-auto shadow-2xs">
              <Key className="w-8 h-8" />
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
