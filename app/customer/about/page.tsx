'use client';

import { useState } from 'react';
import { CustomerHeader } from '@/components/customer/CustomerHeader';
import { CartDrawer, type CartItem } from '@/components/customer/CartDrawer';
import Link from 'next/link';
import { Target, Eye, MapPin, Star, Phone, Smartphone, Mail } from 'lucide-react';

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

        {/* Split Section: Mission/Vision & About */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-[2rem] border border-amber-200/80 shadow-sm space-y-6">
            <div>
              <h2 className="text-2xl font-black text-[#451a03] mb-2 flex items-center gap-2">
                <span><Target className="w-5 h-5 text-[#B91C1C] inline" /></span> Our Mission
              </h2>
              <p className="text-stone-600 leading-relaxed text-sm">
                To serve Cordova with the most comforting meals and expertly brewed coffee, creating a warm, welcoming space where every bite and sip brings people together.
              </p>
            </div>
            <div className="h-px w-full bg-amber-100" />
            <div>
              <h2 className="text-2xl font-black text-[#451a03] mb-2 flex items-center gap-2">
                <span><Eye className="w-5 h-5 text-[#B91C1C] inline" /></span> Our Vision
              </h2>
              <p className="text-stone-600 leading-relaxed text-sm">
                To become the premier neighborhood café in Cebu, known for uncompromising quality, lightning-fast delivery, and a menu that perfectly balances modern tastes with beloved Filipino classics.
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#FFF1E0] to-[#FFE7CE] p-8 rounded-[2rem] border border-[#FCD6B1] shadow-sm flex flex-col justify-center">
            <h2 className="text-3xl font-black text-[#451a03] mb-4">
              More Than Just a Café.
            </h2>
            <p className="text-stone-700 leading-relaxed mb-6 font-medium">
              We started with a simple idea: comfort food shouldn't mean compromising on quality. 
              We use 100% premium Arabica beans for our espresso, source fresh local produce daily, and marinate our meats overnight to guarantee flavor in every single bite.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/60 p-4 rounded-xl border border-[#FCD6B1]/50">
                <p className="text-3xl font-black text-[#B91C1C]">10k+</p>
                <p className="text-xs font-bold text-stone-600 uppercase tracking-wider mt-1">Bowls Served</p>
              </div>
              <div className="bg-white/60 p-4 rounded-xl border border-[#FCD6B1]/50">
                <p className="text-3xl font-black text-[#B91C1C] flex items-center gap-1">4.8 <Star className="w-7 h-7 fill-amber-500 text-amber-500" /></p>
                <p className="text-xs font-bold text-stone-600 uppercase tracking-wider mt-1">Average Rating</p>
              </div>
            </div>
          </div>
        </section>

        {/* Info Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-3xl border border-amber-200/80 shadow-sm">
            <h3 className="text-sm font-black text-stone-400 uppercase tracking-widest mb-4">
              Business Hours
            </h3>
            <ul className="space-y-3 text-sm font-medium text-stone-700">
              <li className="flex justify-between items-center pb-2 border-b border-amber-100">
                <span>Mon - Fri</span>
                <span className="font-bold text-[#451a03]">8:00 AM - 10:00 PM</span>
              </li>
              <li className="flex justify-between items-center pb-2 border-b border-amber-100">
                <span>Saturday</span>
                <span className="font-bold text-[#451a03]">9:00 AM - 11:00 PM</span>
              </li>
              <li className="flex justify-between items-center">
                <span>Sunday</span>
                <span className="font-bold text-[#B91C1C]">Closed</span>
              </li>
            </ul>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-amber-200/80 shadow-sm">
            <h3 className="text-sm font-black text-stone-400 uppercase tracking-widest mb-4">
              Get in Touch
            </h3>
            <ul className="space-y-4 text-sm font-medium text-stone-700">
              <li className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center"><Phone className="w-4 h-4" /></span>
                <span>(032) 492-0000<br/><span className="text-xs text-stone-400">Order Hotline</span></span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center"><Smartphone className="w-4 h-4" /></span>
                <span>0917 123 4567<br/><span className="text-xs text-stone-400">Mobile / GCash</span></span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center"><Mail className="w-4 h-4" /></span>
                <span>hello@eatnrepeat.com<br/><span className="text-xs text-stone-400">Feedback &amp; Inquiries</span></span>
              </li>
            </ul>
          </div>
        </section>

        {/* Customer Reviews Highlight */}
        <section className="bg-white p-8 rounded-[2rem] border border-amber-200/80 shadow-sm text-center">
          <span className="flex items-center justify-center gap-1 mb-3">{[...Array(5)].map((_, i) => <Star key={i} className="w-7 h-7 fill-amber-500 text-amber-500" />)}</span>
          <h2 className="text-2xl font-black text-[#451a03] mb-6">
            Loved by Cordova Locals
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
            <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200">
              <div className="flex text-amber-500 text-xs mb-2">★★★★★</div>
              <p className="text-sm text-stone-700 italic mb-4">
                "The Flame-Grilled Chicken is out of this world! Delivery was incredibly fast to Suba-Basbas. Highly recommended."
              </p>
              <p className="text-xs font-black text-[#451a03]">- Maria S.</p>
            </div>
            <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200">
              <div className="flex text-amber-500 text-xs mb-2">★★★★★</div>
              <p className="text-sm text-stone-700 italic mb-4">
                "Best coffee spot in Poblacion. Their dirty matcha is my daily go-to before work. The app makes ordering so easy!"
              </p>
              <p className="text-xs font-black text-[#451a03]">- John D.</p>
            </div>
            <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200">
              <div className="flex text-amber-500 text-xs mb-2">★★★★★</div>
              <p className="text-sm text-stone-700 italic mb-4">
                "The spam &amp; egg bowl always hits the spot when I'm craving comfort food. The packaging is always so neat too."
              </p>
              <p className="text-xs font-black text-[#451a03]">- Kristine V.</p>
            </div>
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
