'use client';

import { useState } from 'react';
import { CustomerHeader } from '@/components/customer/CustomerHeader';
import { CartDrawer, type CartItem } from '@/components/customer/CartDrawer';
import Link from 'next/link';

export default function AboutPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'pickup' | 'dine-in'>('delivery');

  const totalCartCount = cartItems.reduce((acc, ci) => acc + ci.quantity, 0);
  const totalCartSubtotal = cartItems.reduce((acc, ci) => acc + ci.menuItem.price * ci.quantity, 0);

  return (
    <div className="min-h-screen bg-[#FFF8F0] text-stone-900 flex flex-col justify-between selection:bg-[#B91C1C] selection:text-white">
      <CustomerHeader
        cartCount={totalCartCount}
        cartSubtotal={totalCartSubtotal}
        onOpenCart={() => setIsCartOpen(true)}
        fulfillmentType={fulfillmentType}
        setFulfillmentType={setFulfillmentType}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 space-y-12">
        {/* Banner Hero */}
        <div className="bg-gradient-to-r from-[#451a03] to-[#6d2805] rounded-[2.5rem] p-8 sm:p-12 text-white shadow-xl relative overflow-hidden">
          <div className="max-w-2xl space-y-4 relative z-10">
            <span className="text-xs font-black uppercase tracking-widest text-amber-300 bg-white/10 px-3.5 py-1.5 rounded-full border border-white/20">
              Our Story &amp; Passion ♥
            </span>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
              Warm Bites, Better Coffee &amp; Good Times.
            </h1>
            <p className="text-sm sm:text-base text-amber-100/90 leading-relaxed">
              Located near Aby Road in Poblacion, Cordova, Eat n' RepEat Café brings you handcrafted coffee, boba teas, flame-grilled rice bowls, and fresh pastries made to order every day.
            </p>
            <div className="pt-2">
              <Link
                href="/customer"
                className="inline-flex items-center gap-2.5 px-8 py-3.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white rounded-full font-black text-sm sm:text-base shadow-xl shadow-red-500/35 transition hover:scale-105 group"
              >
                <span>Explore Menu &amp; Order Now</span>
                <svg
                  className="w-4 h-4 text-white transition-transform group-hover:translate-x-1 duration-200"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>

        {/* Core Values Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-amber-200/80 shadow-2xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-[#451a03] flex items-center justify-center text-2xl font-black">
              ☕
            </div>
            <h3 className="text-xl font-extrabold text-[#451a03]">Single-Origin Beans</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Every shot of espresso is pulled from premium roasted beans, delivering smooth, rich flavor profiles in every cup.
            </p>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-amber-200/80 shadow-2xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-[#B91C1C] flex items-center justify-center text-2xl font-black">
              🔥
            </div>
            <h3 className="text-xl font-extrabold text-[#451a03]">Flame-Grilled Goodness</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Our signature rice bowls feature authentic marinades and hot flame grilling for unforgettable Filipino comfort food.
            </p>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-amber-200/80 shadow-2xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-2xl font-black">
              🛵
            </div>
            <h3 className="text-xl font-extrabold text-[#451a03]">Fast Cordova Delivery</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Enjoy lightning-fast 30-minute delivery direct from kitchen to your door anywhere across Cordova!
            </p>
          </div>
        </section>
      </main>

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={(id, delta) => {
          setCartItems((prev) =>
            prev
              .map((ci) => (ci.menuItem.id === id ? { ...ci, quantity: ci.quantity + delta } : ci))
              .filter((ci) => ci.quantity > 0)
          );
        }}
        onRemoveItem={(id) => setCartItems((prev) => prev.filter((ci) => ci.menuItem.id !== id))}
        onClearCart={() => setCartItems([])}
        fulfillmentType={fulfillmentType}
        setFulfillmentType={setFulfillmentType}
      />
    </div>
  );
}
