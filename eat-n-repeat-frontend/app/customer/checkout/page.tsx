'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useAdminData } from '@/context/AdminDataContext';
import { useLocalMode } from '@/lib/customer/useLocalMode';

type CartCheckoutItem = {
  id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
};

const defaultCheckoutItems: CartCheckoutItem[] = [
  {
    id: 'mi-5',
    name: 'Signature Chicken Inasal Rice Bowl',
    price: 189,
    image: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=600&auto=format&fit=crop',
    quantity: 1,
  },
  {
    id: 'mi-1',
    name: 'House Special Latte',
    price: 145,
    image: 'https://images.unsplash.com/photo-1541180464527-0245efded371?w=600&auto=format&fit=crop',
    quantity: 1,
  },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { addDeliveryOrder, addStoreOrder } = useAdminData();
  const { data: session, status } = useSession();
  const isLocalMode = useLocalMode();

  // Cart State
  const [items, setItems] = useState<CartCheckoutItem[]>(defaultCheckoutItems);
  
  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('+63 ');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'gcash' | 'card' | 'maya'>('cod');
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);

  // Validation state
  const [touched, setTouched] = useState({
    firstName: false,
    lastName: false,
    email: false,
    mobileNumber: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  // Load from local storage if available
  useEffect(() => {
    try {
      const storedCart = localStorage.getItem('eat-n-repeat-cart');
      if (storedCart) {
        const parsed = JSON.parse(storedCart);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const formatted = parsed.map((item: any) => ({
            id: item.menuItem?.id || item.id || 'item-1',
            name: item.menuItem?.name || item.name || 'Delicious Item',
            price: item.menuItem?.price || item.price || 100,
            image: item.menuItem?.image || item.image || 'https://images.unsplash.com/photo-1541180464527-0245efded371?w=600&auto=format&fit=crop',
            quantity: item.quantity || 1,
          }));
          setItems(formatted);
        }
      }
    } catch {
      // Fall back to default mock checkout items
    }
  }, []);

  // Sync to local storage
  const updateItems = (newItems: CartCheckoutItem[]) => {
    setItems(newItems);
    try {
      localStorage.setItem(
        'eat-n-repeat-cart',
        JSON.stringify(
          newItems.map((it) => ({
            menuItem: { id: it.id, name: it.name, price: it.price, image: it.image },
            quantity: it.quantity,
          }))
        )
      );
    } catch {
      // ignore
    }
  };

  const handleUpdateQuantity = (id: string, delta: number) => {
    const updated = items
      .map((it) => {
        if (it.id === id) {
          const newQty = it.quantity + delta;
          return newQty > 0 ? { ...it, quantity: newQty } : null;
        }
        return it;
      })
      .filter(Boolean) as CartCheckoutItem[];
    updateItems(updated);
  };

  const handleRemoveItem = (id: string) => {
    const updated = items.filter((it) => it.id !== id);
    updateItems(updated);
  };

  const subtotal = items.reduce((acc, it) => acc + it.price * it.quantity, 0);
  const total = subtotal;

  const isFirstNameError = (submitted || touched.firstName) && !firstName.trim();
  const isLastNameError = (submitted || touched.lastName) && !lastName.trim();
  const isEmailError = (submitted || touched.email) && !email.trim();
  const isMobileError = (submitted || touched.mobileNumber) && (!mobileNumber.trim() || mobileNumber.trim() === '+63');

  const handlePlaceOrder = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSubmitted(true);

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !mobileNumber.trim() || mobileNumber.trim() === '+63') {
      return;
    }

    if (items.length === 0) {
      alert('Your cart is empty. Please add items to order!');
      return;
    }

    // Process order
    const orderItemsSummary = items.map((it) => `${it.quantity}x ${it.name}`).join(', ');
    
    if (isLocalMode) {
      addStoreOrder({
        id: `local-${Date.now()}`,
        orderId: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
        customerName: `${firstName.trim()} ${lastName.trim()}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        items: orderItemsSummary,
        total,
        status: 'awaiting_payment',
        paid: false,
        paymentMethod: 'cash',
        orderType: 'dine-in'
      });
    } else {
      addDeliveryOrder({
        orderNumber: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
        customerName: `${firstName.trim()} ${lastName.trim()}`,
        phone: mobileNumber.trim(),
        address: 'Near Aby Road, Poblacion, Cordova, Cebu',
        serviceAreaId: 'sa-2',
        items: orderItemsSummary,
        subtotal,
        deliveryFee: 0,
        total,
        status: 'pending',
        orderedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    }

    localStorage.removeItem('eat-n-repeat-cart');
    setOrderSuccess(true);
  };

  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full border border-stone-200 shadow-xl text-center space-y-4">
          <div className="w-16 h-16 bg-[#FFF1E0] text-[#B91C1C] rounded-full flex items-center justify-center text-3xl mx-auto">
            ✓
          </div>
          <h2 className="text-2xl font-black text-stone-900">
            {isLocalMode ? 'Payment Required' : 'Order Placed Successfully!'}
          </h2>
          <p className="text-sm text-stone-600">
            {isLocalMode ? (
              <>
                Thank you, <strong className="text-stone-900">{firstName}</strong>! Your order totaling{' '}
                <strong className="text-[#B91C1C] font-black">₱{total.toFixed(2)}</strong> has been received. <br /><br />
                <strong className="text-stone-900 text-base">Please proceed to the cashier to complete your payment.</strong>
              </>
            ) : (
              <>
                Thank you, <strong className="text-stone-900">{firstName}</strong>! Your order totaling{' '}
                <strong className="text-[#B91C1C] font-black">₱{total.toFixed(2)}</strong> has been received by our Cordova kitchen.
              </>
            )}
          </p>
          <div className="pt-4 space-y-2">
            <Link
              href="/customer/orders"
              className="block w-full py-3 bg-[#B91C1C] hover:bg-[#991B1B] text-white rounded-xl font-bold text-sm shadow-md transition"
            >
              Track Order Status 📦
            </Link>
            <Link
              href="/customer"
              className="block w-full py-3 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl font-bold text-sm transition"
            >
              Return to Menu 🍽️
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-stone-900 flex flex-col font-sans selection:bg-[#B91C1C] selection:text-white">
      {/* Top Header Bar matching Mang Inasal Screenshot */}
      <header className="sticky top-0 z-40 bg-white border-b border-stone-200 shadow-2xs py-3.5 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link
            href="/customer"
            className="flex items-center gap-2 text-stone-800 hover:text-[#B91C1C] font-extrabold text-sm sm:text-base transition"
          >
            <span className="text-lg">‹</span>
            <span>Checkout - Near Aby Road, Poblacion, Cordova</span>
          </Link>

          <button
            type="button"
            onClick={() => handlePlaceOrder()}
            className="bg-[#B91C1C] hover:bg-[#991B1B] text-white font-extrabold text-xs sm:text-sm px-5 py-2.5 rounded-lg shadow-sm transition hover:scale-[1.02] active:scale-95"
          >
            Place Order - ₱{total.toFixed(2)}
          </button>
        </div>
      </header>

      {/* Main Checkout Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Form Cards */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Card 1: Checkout as Guest / Customer Details */}
            <div className="bg-white rounded-xl p-6 sm:p-8 border border-red-200/80 shadow-xs space-y-6">
              <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                Checkout as guest
              </h2>

              <form onSubmit={handlePlaceOrder} className="space-y-5">
                {/* First & Last Name row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* First Name */}
                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1.5">
                      First name<span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Your first name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      onBlur={() => setTouched((prev) => ({ ...prev, firstName: true }))}
                      className={`w-full px-4 py-3 text-sm rounded-xl border transition outline-none ${
                        isFirstNameError
                          ? 'border-red-500 bg-red-50/20 text-stone-900 focus:ring-2 focus:ring-red-500/20'
                          : 'border-stone-300 focus:border-[#B91C1C] focus:ring-2 focus:ring-[#B91C1C]/20'
                      }`}
                    />
                    {isFirstNameError && (
                      <p className="text-xs text-red-600 font-semibold mt-1">This field cannot be empty</p>
                    )}
                  </div>

                  {/* Last Name */}
                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1.5">
                      Last name<span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Your last name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      onBlur={() => setTouched((prev) => ({ ...prev, lastName: true }))}
                      className={`w-full px-4 py-3 text-sm rounded-xl border transition outline-none ${
                        isLastNameError
                          ? 'border-red-500 bg-red-50/20 text-stone-900 focus:ring-2 focus:ring-red-500/20'
                          : 'border-stone-300 focus:border-[#B91C1C] focus:ring-2 focus:ring-[#B91C1C]/20'
                      }`}
                    />
                    {isLastNameError && (
                      <p className="text-xs text-red-600 font-semibold mt-1">This field cannot be empty</p>
                    )}
                  </div>
                </div>

                {/* Email Field */}
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1.5">
                    Email<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                    className={`w-full px-4 py-3 text-sm rounded-xl border transition outline-none ${
                      isEmailError
                        ? 'border-red-500 bg-red-50/20 text-stone-900 focus:ring-2 focus:ring-red-500/20'
                        : 'border-stone-300 focus:border-[#B91C1C] focus:ring-2 focus:ring-[#B91C1C]/20'
                    }`}
                  />
                  {isEmailError && (
                    <p className="text-xs text-red-600 font-semibold mt-1">This field cannot be empty</p>
                  )}
                </div>

                {/* Mobile Number Field */}
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1.5">
                    Mobile number<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="+63 000-000-0000"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    onBlur={() => setTouched((prev) => ({ ...prev, mobileNumber: true }))}
                    className={`w-full px-4 py-3 text-sm rounded-xl border transition outline-none ${
                      isMobileError
                        ? 'border-red-500 bg-red-50/20 text-stone-900 focus:ring-2 focus:ring-red-500/20'
                        : 'border-stone-300 focus:border-[#B91C1C] focus:ring-2 focus:ring-[#B91C1C]/20'
                    }`}
                  />
                  {isMobileError && (
                    <p className="text-xs text-red-600 font-semibold mt-1">This field cannot be empty</p>
                  )}
                </div>
              </form>
            </div>

            {/* Card 2: Payment Details */}
            <div className="bg-white rounded-xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-4">
              <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                Payment details
              </h2>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowPaymentOptions(!showPaymentOptions)}
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-stone-200 bg-stone-50/50 hover:bg-stone-50 transition text-left text-sm font-extrabold text-stone-800"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">💳</span>
                    <span>
                      {isLocalMode
                        ? 'Cash (Pay at Cashier)'
                        : paymentMethod === 'cod'
                        ? 'Cash on Delivery (COD)'
                        : paymentMethod === 'gcash'
                        ? 'GCash E-Wallet'
                        : paymentMethod === 'maya'
                        ? 'Maya E-Wallet'
                        : 'Credit / Debit Card'}
                    </span>
                  </div>
                  <span className="text-[#B91C1C] text-base font-bold">›</span>
                </button>

                {showPaymentOptions && (
                  <div className="mt-2 bg-white rounded-xl border border-stone-200 shadow-lg p-2 space-y-1">
                    {isLocalMode ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMethod('cod');
                          setShowPaymentOptions(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-bold transition bg-rose-50 text-[#B91C1C]`}
                      >
                        💵 Cash (Pay at Cashier)
                      </button>
                    ) : (
                      [
                        { id: 'cod', label: '💵 Cash on Delivery (COD)' },
                        { id: 'gcash', label: '📱 GCash E-Wallet' },
                        { id: 'maya', label: '📱 Maya E-Wallet' },
                        { id: 'card', label: '💳 Credit / Debit Card' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setPaymentMethod(opt.id as any);
                            setShowPaymentOptions(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-bold transition ${
                            paymentMethod === opt.id
                              ? 'bg-rose-50 text-[#B91C1C]'
                              : 'hover:bg-stone-50 text-stone-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary Sidebar matching Screenshot */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl p-6 border border-stone-200 shadow-xs space-y-6 sticky top-24">
              
              {/* Sidebar Header */}
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <h3 className="text-xl font-black text-stone-900">My order</h3>
                <Link
                  href="/customer"
                  className="text-xs font-bold text-[#B91C1C] hover:underline"
                >
                  Add Items
                </Link>
              </div>

              {/* Items List */}
              {items.length > 0 ? (
                <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-3 pb-4 border-b border-stone-100 last:border-0 last:pb-0">
                      {/* Image Thumbnail */}
                      <div className="w-16 h-16 relative rounded-xl overflow-hidden bg-stone-100 shrink-0">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>

                      {/* Item Details */}
                      <div className="flex-1 flex flex-col justify-between">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-extrabold text-stone-900 line-clamp-2 leading-tight">
                            {item.name}
                          </h4>
                          <span className="text-xs font-black text-stone-900 shrink-0">
                            ₱{item.price.toFixed(2)}
                          </span>
                        </div>

                        {/* Controls: Edit & Quantity counter */}
                        <div className="flex items-center justify-between pt-2">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-[11px] font-extrabold text-[#B91C1C] hover:underline"
                          >
                            Edit
                          </button>

                          <div className="flex items-center gap-2 bg-stone-100 px-2 py-1 rounded-lg">
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item.id, -1)}
                              className="text-xs font-bold text-stone-600 hover:text-stone-900 w-4 h-4 flex items-center justify-center"
                            >
                              −
                            </button>
                            <span className="text-xs font-extrabold text-stone-900 w-4 text-center">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item.id, 1)}
                              className="text-xs font-bold text-stone-600 hover:text-stone-900 w-4 h-4 flex items-center justify-center"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-stone-500">
                  No items in order. <Link href="/customer" className="text-[#B91C1C] font-bold underline">Browse Menu</Link>
                </div>
              )}

              {/* Total Row */}
              <div className="border-t border-stone-200 pt-4 flex items-center justify-between">
                <span className="text-base font-black text-stone-900">Total</span>
                <span className="text-lg font-black text-stone-900">₱{total.toFixed(2)}</span>
              </div>

              {/* Terms disclaimer */}
              <p className="text-[11px] text-stone-500 leading-relaxed">
                By placing your order, you agree to our{' '}
                <a href="#" className="text-[#B91C1C] font-bold hover:underline">
                  Terms and Conditions
                </a>{' '}
                and{' '}
                <a href="#" className="text-[#B91C1C] font-bold hover:underline">
                  Privacy Notice
                </a>
                .
              </p>

              {/* Main Submit Button */}
              <button
                type="button"
                onClick={() => handlePlaceOrder()}
                className="w-full py-3.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white font-extrabold text-sm rounded-lg shadow-md transition hover:scale-[1.01] active:scale-95"
              >
                Place Order - ₱{total.toFixed(2)}
              </button>
            </div>
          </div>

        </div>
      </main>

      {status === 'unauthenticated' && !isLocalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-amber-200/80 shadow-2xl space-y-6 text-center animate-in fade-in-50 zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-[#FFF1E0] text-[#E85A1C] rounded-full flex items-center justify-center text-3xl mx-auto shadow-2xs">
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
                className="block w-full py-3 bg-[#E85A1C] hover:bg-[#D44D12] text-white rounded-xl font-black text-sm shadow-md transition hover:scale-[1.02] active:scale-95 text-center"
              >
                Sign In
              </Link>
              <Link
                href="/customer/register"
                className="block w-full py-3 bg-white text-stone-850 border border-stone-300 hover:bg-stone-50 rounded-xl font-black text-sm transition hover:scale-[1.02] active:scale-95 text-center"
              >
                Create Account
              </Link>
              <button
                type="button"
                onClick={() => router.push('/customer')}
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
