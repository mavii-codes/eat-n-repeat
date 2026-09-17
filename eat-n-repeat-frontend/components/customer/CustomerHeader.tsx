'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Logo } from '@/components/brand/Logo';

type CustomerHeaderProps = {
  cartCount?: number;
  cartSubtotal?: number;
  onOpenCart?: () => void;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
  fulfillmentType?: 'delivery' | 'pickup' | 'dine-in';
  setFulfillmentType?: (type: 'delivery' | 'pickup' | 'dine-in') => void;
  favoritesCount?: number;
  title?: string;
  subtitle?: string;
};

const navLinks = [
  { href: '/customer', label: 'Menu' },
  { href: '/customer/orders', label: 'Orders' },
  { href: '/customer/about', label: 'About' },
];

export function CustomerHeader({
  cartCount = 0,
  cartSubtotal = 0,
  onOpenCart,
  fulfillmentType = 'delivery',
  setFulfillmentType,
}: CustomerHeaderProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('Near Aby Road, Poblacion, Cordova');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showFulfillmentModal, setShowFulfillmentModal] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[#FFF8F0]/95 backdrop-blur-md border-b border-amber-100/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-3 py-3">
          {/* Logo */}
          <div className="shrink-0 flex items-center">
            <Logo size="sm" variant="customer" href="/customer" />
          </div>

          {/* Location & Delivery Pills (Center) */}
          <div className="hidden md:flex items-center gap-3 flex-1 justify-center max-w-xl">
            {/* Location Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLocationModal(!showLocationModal)}
                className="flex items-center gap-2 bg-[#FFF1E0] hover:bg-[#FFE7CE] border border-[#FCD6B1] px-4 py-2 rounded-full text-xs font-bold text-[#451a03] transition-all shadow-2xs group"
              >
                <span className="text-amber-600 text-sm">📍</span>
                <span>{selectedLocation}</span>
                <svg
                  className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-600 transition"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showLocationModal && (
                <div className="absolute left-0 top-full mt-2 w-72 bg-white rounded-2xl border border-amber-200 shadow-xl p-3 z-50">
                  <p className="text-[11px] font-extrabold text-stone-500 uppercase tracking-wider mb-2">Store Branch Location</p>
                  {['Near Aby Road, Poblacion, Cordova'].map((loc) => (
                    <button
                      key={loc}
                      onClick={() => {
                        setSelectedLocation(loc);
                        setShowLocationModal(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition ${
                        selectedLocation === loc
                          ? 'bg-red-50 text-[#B91C1C] font-bold'
                          : 'hover:bg-amber-50 text-stone-700'
                      }`}
                    >
                      📍 {loc}
                      <span className="text-[10px] text-amber-700 block font-normal mt-0.5">Sole Branch (Cordova, Cebu)</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Delivery / Order Mode Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowFulfillmentModal(!showFulfillmentModal)}
                className="flex items-center gap-2 bg-[#FFF1E0] hover:bg-[#FFE7CE] border border-[#FCD6B1] px-4 py-2 rounded-full text-xs font-bold text-[#451a03] transition-all shadow-2xs group"
              >
                <span className="text-amber-600 text-sm">
                  {fulfillmentType === 'delivery' ? '🚚' : fulfillmentType === 'pickup' ? '🛍️' : '🍽️'}
                </span>
                <span className="capitalize">
                  {fulfillmentType === 'delivery' ? 'Deliver · ASAP' : fulfillmentType === 'pickup' ? 'Pick-Up · ASAP' : 'Dine-In Table'}
                </span>
                <svg
                  className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-600 transition"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showFulfillmentModal && (
                <div className="absolute left-0 top-full mt-2 w-56 bg-white rounded-2xl border border-amber-200 shadow-xl p-3 z-50">
                  <p className="text-[11px] font-extrabold text-stone-500 uppercase tracking-wider mb-2">Dining Preference</p>
                  {[
                    { id: 'delivery', label: '🚚 Deliver · ASAP' },
                    { id: 'pickup', label: '🛍️ Pick-Up · ASAP' },
                    { id: 'dine-in', label: '🍽️ Dine-In Table' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => {
                        if (setFulfillmentType) setFulfillmentType(mode.id as any);
                        setShowFulfillmentModal(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition ${
                        fulfillmentType === mode.id
                          ? 'bg-red-50 text-[#B91C1C] font-bold'
                          : 'hover:bg-amber-50 text-stone-700'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Header Actions: User Profile/Sign-in + Cart Pill */}
          <div className="flex items-center gap-3 shrink-0">
            {/* User Profile / Sign in Pill Button (Matches Screenshot 1) */}
            <div className="relative">
              {session?.user?.name ? (
                <button
                  type="button"
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="w-10 h-10 rounded-full bg-[#FFF1E0] hover:bg-[#FFE7CE] border border-[#FCD6B1] flex items-center justify-center text-[#451a03] shadow-2xs transition hover:scale-105"
                  aria-label="Account Profile"
                >
                  <span className="text-xs font-extrabold text-[#451a03]">
                    {session.user.name.charAt(0).toUpperCase()}
                  </span>
                </button>
              ) : (
                <Link
                  href="/customer/login"
                  className="flex items-center gap-1.5 bg-[#FFF1E0] hover:bg-[#FFE7CE] border border-[#FCD6B1] px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs font-extrabold text-[#451a03] transition-all shadow-2xs hover:scale-105"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#451a03]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Sign in</span>
                </Link>
              )}

              {showProfileMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl border border-amber-100 shadow-xl z-50 py-2 overflow-hidden">
                    {session?.user ? (
                      <div className="px-4 py-2 border-b border-stone-100">
                        <p className="text-xs font-bold text-[#451a03] truncate">{session.user.name}</p>
                        <p className="text-[10px] text-stone-500 truncate">{session.user.email}</p>
                      </div>
                    ) : (
                      <div className="px-4 py-2 border-b border-stone-100">
                        <p className="text-xs font-bold text-[#451a03]">Welcome Guest</p>
                        <p className="text-[10px] text-stone-500">Sign in for rewards &amp; discounts</p>
                      </div>
                    )}
                    <Link
                      href="/customer/profile"
                      onClick={() => setShowProfileMenu(false)}
                      className="block px-4 py-2 text-xs font-bold text-stone-700 hover:bg-amber-50 hover:text-[#B91C1C]"
                    >
                      👤 My Profile
                    </Link>
                    <Link
                      href="/customer/orders"
                      onClick={() => setShowProfileMenu(false)}
                      className="block px-4 py-2 text-xs font-bold text-stone-700 hover:bg-amber-50 hover:text-[#B91C1C]"
                    >
                      📦 My Orders
                    </Link>
                    <Link
                      href="/customer/favorites"
                      onClick={() => setShowProfileMenu(false)}
                      className="block px-4 py-2 text-xs font-bold text-stone-700 hover:bg-amber-50 hover:text-[#B91C1C]"
                    >
                      ❤️ Saved Favorites
                    </Link>
                    {session?.user ? (
                      <button
                        type="button"
                        onClick={() => signOut({ callbackUrl: '/customer/login' })}
                        className="w-full text-left px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50"
                      >
                        🚪 Sign Out
                      </button>
                    ) : (
                      <Link
                        href="/customer/login"
                        onClick={() => setShowProfileMenu(false)}
                        className="block px-4 py-2 text-xs font-bold text-amber-600 hover:bg-amber-50"
                      >
                        🔑 Sign In / Register
                      </Link>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Red Cart Pill Button */}
            <button
              type="button"
              onClick={onOpenCart}
              className="flex items-center gap-1.5 sm:gap-2 py-1.5 px-3 sm:py-2 sm:px-5 rounded-full bg-[#B91C1C] hover:bg-[#991B1B] text-white font-extrabold text-xs sm:text-sm shadow-md shadow-red-500/25 transition-all hover:scale-105 active:scale-95 shrink-0"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <span>({cartCount})</span>
              <span>₱{cartSubtotal.toFixed(2)}</span>
            </button>
          </div>
        </div>

        {/* Mobile Location & Fulfillment Sub-bar */}
        <div className="flex md:hidden items-center justify-between gap-2 pb-2 pt-0.5 border-t border-amber-100/60">
          <button
            type="button"
            onClick={() => setShowLocationModal(!showLocationModal)}
            className="flex items-center gap-1.5 bg-[#FFF1E0] border border-[#FCD6B1] px-3 py-1 rounded-full text-[11px] font-bold text-[#451a03] truncate max-w-[60%]"
          >
            <span className="text-amber-600">📍</span>
            <span className="truncate">{selectedLocation}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowFulfillmentModal(!showFulfillmentModal)}
            className="flex items-center gap-1.5 bg-[#FFF1E0] border border-[#FCD6B1] px-3 py-1 rounded-full text-[11px] font-bold text-[#451a03] shrink-0"
          >
            <span className="text-amber-600">
              {fulfillmentType === 'delivery' ? '🚚' : fulfillmentType === 'pickup' ? '🛍️' : '🍽️'}
            </span>
            <span className="capitalize">
              {fulfillmentType === 'delivery' ? 'Deliver' : fulfillmentType === 'pickup' ? 'Pick-Up' : 'Dine-In'}
            </span>
          </button>
        </div>

        {/* Bottom Navigation Links Bar */}
        <nav className="flex items-center gap-2 sm:gap-3 py-2 overflow-x-auto no-scrollbar border-t border-amber-200/50">
          {navLinks.map((link) => {
            const isActive =
              link.href === '/customer'
                ? pathname === '/customer'
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center px-4 py-2 rounded-full text-xs sm:text-sm font-extrabold whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? 'bg-[#B91C1C] text-white shadow-md shadow-red-500/20 scale-105'
                    : 'text-stone-700 bg-white/60 hover:bg-amber-100/70 hover:text-[#451a03] border border-amber-100/80 hover:border-amber-300/80'
                }`}
              >
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
