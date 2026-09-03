'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Logo } from '@/components/brand/Logo';
import { useCustomerNotifications } from '@/context/CustomerNotificationContext';
import { CustomerNotificationPanel } from '@/components/customer/CustomerNotificationPanel';
import { 
  House, UtensilsCrossed, Receipt, Heart, Gift, Info, Bell, User, 
  Settings, CircleHelp, LogOut, LogIn, MapPin, Truck, ShoppingBag, Store, 
  X, Menu as MenuIcon, BellOff, ChevronDown, Search, Key
} from 'lucide-react';
import { useLocalMode } from '@/lib/customer/useLocalMode';

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
  { href: '/customer/menu', label: 'Menu' },
  { href: '/customer/orders', label: 'Orders' },
  { href: '/customer/favorites', label: 'Favorites' },
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
  const { unreadCount } = useCustomerNotifications();
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('Near Aby Road, Poblacion, Cordova');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showFulfillmentModal, setShowFulfillmentModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [drawerSearchQuery, setDrawerSearchQuery] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const isLocalMode = useLocalMode();

  const handleRestrictedNavClick = (e: React.MouseEvent, href: string) => {
    // In local mode, we allow access to orders without auth (since they are guest orders)
    // Wait, the user said "allow guest ordering". Tracking orders without an account is hard 
    // since we don't have an account, but the user explicitly said:
    // "No Sign In required. No Sign Up required." 
    // For now, let's just bypass auth modal for orders in local mode.
    if (href === '/customer/orders' && !session?.user && !isLocalMode) {
      e.preventDefault();
      setShowAuthModal(true);
      setIsMobileDrawerOpen(false); // Close mobile drawer if open
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#FFF8F0]/95 backdrop-blur-md border-b border-amber-100/80 shadow-xs w-full max-w-full">
        <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 w-full">
          {/* Top Header Row */}
          <div className="flex items-center justify-between gap-2 sm:gap-3 py-2.5 sm:py-3 w-full">
            
            {/* Left Section: Hamburger Button (Mobile) + Logo + Desktop Horizontal Nav Bar */}
            <div className="flex items-center gap-2 sm:gap-4 shrink-0 min-w-0">
              {/* Hamburger Button (Mobile only) */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileDrawerOpen(true);
                  setShowLocationModal(false);
                  setShowFulfillmentModal(false);
                }}
                className="md:hidden p-2 rounded-xl text-stone-800 hover:bg-amber-100/70 transition flex items-center justify-center border border-amber-200/60 shadow-2xs"
                aria-label="Open Navigation Menu"
              >
                <MenuIcon className="w-5 h-5 text-[#451a03]" />
              </button>

              {/* Brand Logo */}
              <div className="shrink-0 flex items-center">
                <Logo size="sm" variant="customer" href="/customer" />
              </div>

              {/* Desktop Horizontal Navigation Links Bar (Laptop / Desktop View) */}
              <nav className="hidden md:flex items-center gap-2 lg:gap-4 ml-6 lg:ml-8">
                {navLinks.map((link) => {
                  const isActive =
                    link.href === '/customer'
                      ? pathname === '/customer'
                      : pathname.startsWith(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={(e) => handleRestrictedNavClick(e, link.href)}
                      className={`flex items-center px-4 py-2.5 lg:px-5 lg:py-2.5 rounded-xl text-[15px] lg:text-base font-semibold whitespace-nowrap transition-all duration-200 ${
                        isActive
                          ? 'bg-[#B91C1C] text-white shadow-md shadow-red-500/20'
                          : 'text-stone-600 hover:bg-stone-100/80 hover:text-[#B91C1C]'
                      }`}
                    >
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>



            {/* Right Header Actions: Notifications + User Profile + Cart Pill */}
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              {/* Notification Bell Button & Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowNotificationPanel(!showNotificationPanel);
                    setShowProfileMenu(false);
                    setShowLocationModal(false);
                    setShowFulfillmentModal(false);
                  }}
                  className="relative p-2 sm:p-2.5 rounded-full bg-[#FFF1E0] hover:bg-[#FFE7CE] border border-[#FCD6B1] flex items-center justify-center text-[#451a03] shadow-2xs transition hover:scale-105"
                  aria-label="Notification Center"
                >
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-stone-600" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#B91C1C] text-white text-[10px] font-black w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                <CustomerNotificationPanel
                  isOpen={showNotificationPanel}
                  onClose={() => setShowNotificationPanel(false)}
                />
              </div>



              {/* Desktop Profile Icon & Dropdown */}
              {isLocalMode ? (
                <div className="hidden md:flex flex-col items-end mr-2">
                  <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">Local Mode</span>
                  <span className="text-[10px] text-stone-500 font-medium">Dine-in Only • Cash Only</span>
                </div>
              ) : session?.user ? (
                <div className="relative hidden md:block">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(!showProfileMenu);
                      setShowNotificationPanel(false);
                      setShowLocationModal(false);
                      setShowFulfillmentModal(false);
                    }}
                    className="p-2 sm:p-2.5 rounded-full bg-[#FFF1E0] hover:bg-[#FFE7CE] border border-[#FCD6B1] flex items-center justify-center text-[#451a03] shadow-2xs transition hover:scale-105"
                  >
                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-stone-600" />
                  </button>

                  {showProfileMenu && (
                    <div className="absolute top-full right-0 mt-3 w-56 bg-[#FFF8F0] rounded-2xl border border-amber-200/90 shadow-2xl overflow-hidden font-sans z-50 animate-in slide-in-from-top-2 fade-in duration-200">
                      <div className="px-4 py-3 border-b border-stone-200/60 bg-white">
                        <p className="text-[13px] font-black text-[#451a03] truncate">{session.user.name}</p>
                        <p className="text-[11px] text-stone-500 truncate">{session.user.email}</p>
                      </div>
                      <div className="p-2 space-y-0.5">
                        <Link href="/customer/settings/account" onClick={() => setShowProfileMenu(false)} className="flex items-center gap-3 px-3 py-2 text-xs font-semibold text-stone-700 hover:text-[#B91C1C] hover:bg-red-50 rounded-lg transition-colors">
                          <User className="w-4 h-4 text-[#B91C1C]" /> Profile
                        </Link>
                        <Link href="/customer/addresses" onClick={() => setShowProfileMenu(false)} className="flex items-center gap-3 px-3 py-2 text-xs font-semibold text-stone-700 hover:text-[#B91C1C] hover:bg-red-50 rounded-lg transition-colors">
                          <MapPin className="w-4 h-4 text-[#B91C1C]" /> Saved Addresses
                        </Link>
                        <Link href="/customer/orders" onClick={() => setShowProfileMenu(false)} className="flex items-center gap-3 px-3 py-2 text-xs font-semibold text-stone-700 hover:text-[#B91C1C] hover:bg-red-50 rounded-lg transition-colors">
                          <Receipt className="w-4 h-4 text-[#B91C1C]" /> Orders
                        </Link>
                        <Link href="/customer/favorites" onClick={() => setShowProfileMenu(false)} className="flex items-center gap-3 px-3 py-2 text-xs font-semibold text-stone-700 hover:text-[#B91C1C] hover:bg-red-50 rounded-lg transition-colors">
                          <Heart className="w-4 h-4 text-[#B91C1C]" /> Favorites
                        </Link>
                        <Link href="/customer/settings/notifications" onClick={() => setShowProfileMenu(false)} className="flex items-center gap-3 px-3 py-2 text-xs font-semibold text-stone-700 hover:text-[#B91C1C] hover:bg-red-50 rounded-lg transition-colors">
                          <Bell className="w-4 h-4 text-[#B91C1C]" /> Notifications
                        </Link>
                        <Link href="/customer/settings" onClick={() => setShowProfileMenu(false)} className="flex items-center gap-3 px-3 py-2 text-xs font-semibold text-stone-700 hover:text-[#B91C1C] hover:bg-red-50 rounded-lg transition-colors">
                          <Settings className="w-4 h-4 text-[#B91C1C]" /> Settings
                        </Link>
                        <div className="border-t border-stone-200/60 my-1"></div>
                        <Link href="/customer/about" onClick={() => setShowProfileMenu(false)} className="flex items-center gap-3 px-3 py-2 text-xs font-semibold text-stone-700 hover:text-[#B91C1C] hover:bg-red-50 rounded-lg transition-colors">
                          <Info className="w-4 h-4 text-[#B91C1C]" /> About
                        </Link>
                        <div className="border-t border-stone-200/60 my-1"></div>
                        <button onClick={() => { setShowProfileMenu(false); signOut({ callbackUrl: '/customer/login' }); }} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-stone-700 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors text-left">
                          <LogOut className="w-4 h-4 text-stone-400" /> Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link href="/customer/login" className="hidden md:flex items-center justify-center p-2 sm:p-2.5 rounded-full bg-[#FFF1E0] hover:bg-[#FFE7CE] border border-[#FCD6B1] text-[#451a03] shadow-2xs transition hover:scale-105">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-stone-600" />
                </Link>
              )}

              {/* Red Cart Pill Button */}
              <button
                type="button"
                onClick={onOpenCart}
                className="flex items-center gap-1 sm:gap-2 py-1.5 px-2.5 sm:py-2 sm:px-5 rounded-full bg-[#B91C1C] hover:bg-[#991B1B] text-white font-extrabold text-[11px] sm:text-sm shadow-md shadow-red-500/25 transition-all hover:scale-105 active:scale-95 shrink-0"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span>({cartCount})</span>
                <span className="hidden sm:inline">₱{cartSubtotal.toFixed(2)}</span>
              </button>
            </div>
          </div>


        </div>
      </header>

      {/* Mobile Adaptive Collapsible Drawer Navigation (Mobile View) */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          {/* Smooth Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 z-[90]"
            onClick={() => setIsMobileDrawerOpen(false)}
          />

          {/* Slide-out Sidebar Navigation Menu */}
          <div className="fixed inset-y-0 left-0 w-[85%] max-w-sm bg-white shadow-2xl flex flex-col justify-between z-[100] animate-in slide-in-from-left duration-300">
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto pb-6">
              
              {/* Header section */}
              <div className="bg-stone-50 px-6 pt-6 pb-5 border-b border-stone-100 relative">
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white border border-stone-200 shadow-sm flex items-center justify-center text-stone-500 hover:bg-stone-100 transition z-10"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-3 mb-6">
                  <Logo size="sm" variant="customer" href="/customer" />
                </div>

                {session?.user ? (
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full border-2 border-white shadow-md overflow-hidden bg-stone-100 shrink-0 flex items-center justify-center">
                      {(session.user as any).image ? (
                        <img src={(session.user as any).image} alt={session.user.name || 'User'} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-6 h-6 text-stone-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-bold text-stone-800 truncate">{session.user.name}</p>
                      <p className="text-xs text-stone-500 truncate">{session.user.email}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full border-2 border-white shadow-md overflow-hidden bg-stone-100 shrink-0 flex items-center justify-center">
                      <User className="w-6 h-6 text-stone-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-bold text-stone-800 truncate">Guest User</p>
                      <Link
                        href="/customer/login"
                        onClick={() => setIsMobileDrawerOpen(false)}
                        className="inline-block mt-1 text-xs font-bold text-[#B91C1C] hover:underline"
                      >
                        Sign In / Create Account
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 pt-5 space-y-6">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input 
                    type="text" 
                    placeholder="Search menu, orders, settings..." 
                    value={drawerSearchQuery}
                    onChange={(e) => setDrawerSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-700 focus:outline-none focus:ring-1 focus:ring-[#B91C1C] transition-shadow"
                  />
                  {drawerSearchQuery && (
                    <button 
                      onClick={() => setDrawerSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Link Groups */}
                <div className="space-y-6">
                  {/* We dynamically filter these lists inline */}
                  {(() => {
                    const navLinks = [
                      { href: '/customer', label: 'Home', icon: <House className="w-4 h-4" /> },
                      { href: '/customer/menu', label: 'Menu', icon: <UtensilsCrossed className="w-4 h-4" /> },
                      { href: '/customer/orders', label: 'Orders', icon: <Receipt className="w-4 h-4" /> },
                      { href: '/customer/favorites', label: 'Favorites', icon: <Heart className="w-4 h-4" /> }
                    ].filter(l => l.label.toLowerCase().includes(drawerSearchQuery.toLowerCase()));

                    const accLinks = [
                      { href: session?.user ? '/customer/settings' : '/customer/login', label: 'Profile', icon: <User className="w-4 h-4" /> },
                      { href: '/customer/addresses', label: 'Saved Addresses', icon: <MapPin className="w-4 h-4" /> },
                      { href: '/customer/notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" />, badge: unreadCount > 0 ? unreadCount : null }
                    ].filter(l => l.label.toLowerCase().includes(drawerSearchQuery.toLowerCase()));

                    const setLinks = [
                      { href: '/customer/settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
                      { href: '/customer/about', label: 'About Eat n\' RepEat', icon: <CircleHelp className="w-4 h-4" /> }
                    ].filter(l => l.label.toLowerCase().includes(drawerSearchQuery.toLowerCase()));

                    return (
                      <>
                        {navLinks.length > 0 && (
                          <div>
                            <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2 px-2">Navigation</h3>
                            <div className="space-y-0.5">
                              {navLinks.map(link => (
                                <Link key={link.label} href={link.href} onClick={(e) => {
                                  if (link.href === '/customer/orders' && !session?.user) {
                                    handleRestrictedNavClick(e, link.href);
                                  } else {
                                    setIsMobileDrawerOpen(false);
                                  }
                                }} className="flex items-center gap-4 px-2 py-2.5 text-xs font-semibold text-stone-700 hover:text-stone-900 hover:bg-stone-50 rounded-xl transition-colors">
                                  <span className="text-[#B91C1C]">{link.icon}</span> 
                                  <span>{link.label}</span>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                        {accLinks.length > 0 && (
                          <div>
                            <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2 px-2">Account</h3>
                            <div className="space-y-0.5">
                              {accLinks.map(link => (
                                <Link key={link.label} href={link.href} onClick={() => setIsMobileDrawerOpen(false)} className="flex items-center justify-between px-2 py-2.5 text-xs font-semibold text-stone-700 hover:text-stone-900 hover:bg-stone-50 rounded-xl transition-colors w-full">
                                  <div className="flex items-center gap-4">
                                    <span className="text-[#B91C1C]">{link.icon}</span>
                                    <span>{link.label}</span>
                                  </div>
                                  {link.badge && <span className="bg-[#B91C1C] text-white text-[10px] px-2 py-0.5 rounded-full font-black">{link.badge}</span>}
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                        {setLinks.length > 0 && (
                          <div>
                            <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2 px-2">Settings</h3>
                            <div className="space-y-0.5">
                              {setLinks.map(link => (
                                <Link key={link.label} href={link.href} onClick={() => setIsMobileDrawerOpen(false)} className="flex items-center gap-4 px-2 py-2.5 text-xs font-semibold text-stone-700 hover:text-stone-900 hover:bg-stone-50 rounded-xl transition-colors">
                                  <span className="text-[#B91C1C]">{link.icon}</span> 
                                  <span>{link.label}</span>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                        {navLinks.length === 0 && accLinks.length === 0 && setLinks.length === 0 && (
                          <div className="text-center py-6 text-stone-400 text-xs font-medium">
                            No results found for "{drawerSearchQuery}"
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-6 border-t border-stone-100 bg-stone-50/50">
              {session?.user && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    signOut({ callbackUrl: '/customer/login' });
                  }}
                  className="flex items-center gap-4 px-2 py-2 text-xs font-bold text-[#B91C1C] hover:text-[#991B1B] transition w-full mb-4"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              )}
              <div className="px-2 space-y-1">
                <p className="text-[10px] text-stone-400 font-medium">Version 1.0.4</p>
                <p className="text-[10px] text-stone-400 font-medium">Eat n' RepEat Café Cordova</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Guest Authentication Modal for Restricted Routes */}
      {showAuthModal && !isLocalMode && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-amber-200/80 shadow-2xl space-y-6 text-center animate-in fade-in-50 zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-[#FFF1E0] text-[#B91C1C] rounded-full flex items-center justify-center mx-auto shadow-2xs">
              <Key className="w-8 h-8 text-[#B91C1C]" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl font-black text-[#451a03]">Sign in to track orders</h3>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-semibold">
                You can browse and add items to your cart as a guest, but you need an account to view and track your orders.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <Link
                href="/customer/login?callbackUrl=/customer/orders"
                onClick={() => setShowAuthModal(false)}
                className="block w-full py-3 bg-[#B91C1C] hover:bg-[#991B1B] text-white rounded-xl font-black text-sm shadow-md transition hover:scale-[1.02] active:scale-95 text-center"
              >
                Sign In
              </Link>
              <Link
                href="/customer/register?callbackUrl=/customer/orders"
                onClick={() => setShowAuthModal(false)}
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
    </>
  );
}
