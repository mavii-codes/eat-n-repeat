'use client';

import { useState, useMemo } from 'react';
import { CustomerHeader } from '@/components/customer/CustomerHeader';
import { HeroCarousel } from '@/components/customer/HeroCarousel';
import { InfoCards } from '@/components/customer/InfoCards';
import { MenuCard, type CustomerMenuItem } from '@/components/customer/MenuCard';
import { CartDrawer, type CartItem } from '@/components/customer/CartDrawer';
import { useAdminData } from '@/context/AdminDataContext';
import Link from 'next/link';

export default function CustomerHome() {
  const { menuItems, menuCategories } = useAdminData();

  // State
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'pickup' | 'dine-in'>('delivery');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [favorites, setFavorites] = useState<string[]>([]);

  // Category mapping
  const activeCategories = useMemo(() => {
    const categoryList = menuCategories.filter((c) => !c.archived).map((c) => c.name);
    return ['All', ...categoryList];
  }, [menuCategories]);

  // Menu items mapping from AdminDataContext with fallbacks
  const formattedMenuItems = useMemo<CustomerMenuItem[]>(() => {
    const activeItems = menuItems.filter((item) => !item.archived);
    if (activeItems.length === 0) return [];

    return activeItems.map((item, index) => {
      const categoryObj = menuCategories.find((c) => c.id === item.categoryId);
      const categoryName = categoryObj?.name || 'General';
      
      // Designate specific popular items across different categories as Bestsellers by ID
      const isBestseller = ['mi-1', 'mi-4', 'mi-5', 'mi-7'].includes(item.id);
      const isStaffPick = ['mi-2'].includes(item.id);
      const isPopular = ['mi-8'].includes(item.id);

      const badge = isBestseller
        ? '⭐ Bestseller'
        : isStaffPick
        ? '🔥 Staff Pick'
        : isPopular
        ? '🍟 Popular'
        : undefined;

      return {
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        image: item.image,
        category: categoryName,
        rating: 4.7 + (index % 3) * 0.1,
        reviews: 20 + index * 7,
        badge,
        available: item.available,
      };
    });
  }, [menuItems, menuCategories]);

  // Filtered best sellers to highlight at the top of the portal
  const bestSellers = useMemo(() => {
    return formattedMenuItems.filter((item) => item.badge === '⭐ Bestseller');
  }, [formattedMenuItems]);

  // Filtered menu items
  const filteredItems = useMemo(() => {
    return formattedMenuItems.filter((item) => {
      const matchesCategory =
        selectedCategory === 'All' ||
        item.category?.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [formattedMenuItems, selectedCategory, searchQuery]);

  // Cart operations
  const handleAddToCart = (item: CustomerMenuItem) => {
    setCartItems((prev) => {
      const existing = prev.find((ci) => ci.menuItem.id === item.id);
      if (existing) {
        return prev.map((ci) =>
          ci.menuItem.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      return [...prev, { menuItem: item, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (id: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((ci) => {
          if (ci.menuItem.id === id) {
            const newQty = ci.quantity + delta;
            return newQty > 0 ? { ...ci, quantity: newQty } : null;
          }
          return ci;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveItem = (id: string) => {
    setCartItems((prev) => prev.filter((ci) => ci.menuItem.id !== id));
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  const handleToggleFavorite = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((favId) => favId !== id) : [...prev, id]
    );
  };

  const totalCartCount = cartItems.reduce((acc, ci) => acc + ci.quantity, 0);
  const totalCartSubtotal = cartItems.reduce((acc, ci) => acc + ci.menuItem.price * ci.quantity, 0);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col justify-between selection:bg-rose-900 selection:text-white">
      {/* Header */}
      <CustomerHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        fulfillmentType={fulfillmentType}
        setFulfillmentType={setFulfillmentType}
        cartCount={totalCartCount}
        cartSubtotal={totalCartSubtotal}
        onOpenCart={() => setIsCartOpen(true)}
        favoritesCount={favorites.length}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8 sm:space-y-12 flex-1">
        {/* Promotional Hero Banner */}
        <HeroCarousel
          onSelectCategory={(cat) => {
            setSelectedCategory(cat);
            const el = document.getElementById('menu-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        {/* 4 Info Badges matching Screenshot (Ready In, Free Delivery, Rated, Loved By) */}
        <InfoCards />

        {/* Fulfillment Status Banner on Mobile */}
        <div className="md:hidden bg-white p-3.5 rounded-2xl border border-amber-200 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">
              {fulfillmentType === 'delivery' ? '🚚' : fulfillmentType === 'pickup' ? '🛍️' : '🍽️'}
            </span>
            <span className="text-xs font-extrabold capitalize text-[#451a03]">
              {fulfillmentType} Mode
            </span>
          </div>
          <div className="flex bg-[#FFF1E0] p-1 rounded-xl">
            <button
              onClick={() => setFulfillmentType('delivery')}
              className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition ${
                fulfillmentType === 'delivery' ? 'bg-[#B91C1C] text-white' : 'text-[#451a03]'
              }`}
            >
              Delivery
            </button>
            <button
              onClick={() => setFulfillmentType('pickup')}
              className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition ${
                fulfillmentType === 'pickup' ? 'bg-[#B91C1C] text-white' : 'text-[#451a03]'
              }`}
            >
              Pick-Up
            </button>
            <button
              onClick={() => setFulfillmentType('dine-in')}
              className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition ${
                fulfillmentType === 'dine-in' ? 'bg-[#B91C1C] text-white' : 'text-[#451a03]'
              }`}
            >
              Dine-In
            </button>
          </div>
        </div>

        {/* Best Sellers Section */}
        {selectedCategory === 'All' && searchQuery === '' && bestSellers.length > 0 && (
          <section className="space-y-6 bg-[#FFF9F2] p-6 sm:p-8 rounded-[2rem] border border-amber-200/80 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-200/60 pb-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-[#451a03] tracking-tight flex items-center gap-2">
                  <span>🔥 Best Sellers</span>
                  <span className="text-[10px] bg-[#B91C1C] text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider font-extrabold animate-pulse">
                    Must Try
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-stone-600 mt-1">
                  Our most popular and highly-rated items loved by Cordova.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {bestSellers.map((item) => (
                <MenuCard
                  key={`bestseller-${item.id}`}
                  {...item}
                  isFavorite={favorites.includes(item.id)}
                  onAddToCart={handleAddToCart}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
          </section>
        )}

        {/* Main Menu Ordering Section */}
        <section id="menu-section" className="space-y-6 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-200/60 pb-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-[#451a03] tracking-tight">
                Our Delicious Menu
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 mt-1">
                Handcrafted coffee, flame-grilled rice bowls, boba teas &amp; fresh pastries.
              </p>
            </div>

            {/* Quick Stats Pill */}
            <div className="text-xs font-bold text-stone-600 bg-white px-4 py-2 rounded-full border border-amber-200/80 shadow-2xs self-start sm:self-auto">
              Showing <span className="font-extrabold text-[#B91C1C]">{filteredItems.length}</span> items
              {selectedCategory !== 'All' && ` in ${selectedCategory}`}
            </div>
          </div>

          {/* Sticky Category Scrollbar (Warm Cafe Style Category Tabs) */}
          <div className="sticky top-20 z-30 bg-[#FFF8F0]/95 backdrop-blur-md py-3 -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-1">
              {activeCategories.map((category) => {
                const isActive = selectedCategory.toLowerCase() === category.toLowerCase();
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-5 py-2.5 rounded-full font-extrabold text-xs sm:text-sm whitespace-nowrap transition-all duration-200 shadow-2xs border ${
                      isActive
                        ? 'bg-[#B91C1C] text-white border-[#B91C1C] shadow-red-500/20 scale-105'
                        : 'bg-white text-stone-700 border-amber-200/80 hover:border-amber-400 hover:bg-amber-50/50'
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Food Cards Grid */}
          {filteredItems.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredItems.map((item) => (
                <MenuCard
                  key={item.id}
                  {...item}
                  isFavorite={favorites.includes(item.id)}
                  onAddToCart={handleAddToCart}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-amber-300 p-8 shadow-2xs">
              <div className="text-5xl mb-4">🔍</div>
              <h3 className="text-xl font-extrabold text-[#451a03] mb-1">No items found</h3>
              <p className="text-sm text-stone-600 mb-6">
                Try searching for a different item or switch category tabs.
              </p>
              <button
                onClick={() => {
                  setSelectedCategory('All');
                  setSearchQuery('');
                }}
                className="px-6 py-2.5 bg-[#B91C1C] text-white rounded-xl text-xs font-extrabold hover:bg-[#991B1B] transition shadow-md"
              >
                Reset Filters
              </button>
            </div>
          )}
        </section>

        {/* Feature Highlights Section */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-stone-200">
          <div className="p-6 bg-white rounded-2xl border border-stone-200 shadow-xs flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-2xl shrink-0">
              🔥
            </div>
            <div>
              <h4 className="font-bold text-stone-900 text-sm mb-1">Freshly Prepared</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Made to order using house recipes and small-batch ingredients every single time.
              </p>
            </div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-stone-200 shadow-xs flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center text-2xl shrink-0">
              🛵
            </div>
            <div>
              <h4 className="font-bold text-stone-900 text-sm mb-1">Express Delivery</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Fast 30-minute delivery direct to your doorstep anywhere in Cordova area.
              </p>
            </div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-stone-200 shadow-xs flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-2xl shrink-0">
              ✨
            </div>
            <div>
              <h4 className="font-bold text-stone-900 text-sm mb-1">Real-Time Tracking</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Live order status updates from kitchen prep to rider delivery.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#3D1703] text-white border-t border-[#592205] mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="space-y-3">
              <h3 className="text-xl font-black text-amber-400" style={{ fontFamily: 'Georgia, serif' }}>Eat n' RepEat Café</h3>
              <p className="text-xs text-amber-100/80 leading-relaxed">
                Warm bites, better coffee, and flame-grilled Filipino comfort favorites in Cordova.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-widest text-red-400 mb-3">Quick Navigation</h4>
              <ul className="space-y-2 text-xs text-amber-100/80 font-medium">
                <li><Link href="/customer" className="hover:text-amber-300 transition">Online Menu &amp; Order</Link></li>
                <li><Link href="/customer/orders" className="hover:text-amber-300 transition">Track My Orders</Link></li>
                <li><Link href="/customer/favorites" className="hover:text-amber-300 transition">My Rewards &amp; Favorites</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-widest text-red-400 mb-3">Store Location</h4>
              <p className="text-xs text-amber-100/80 leading-relaxed">
                Branch Location: Near Aby Road, Poblacion, Cordova, Cebu<br />
                Open: Mon - Sun (7:00 AM - 10:00 PM)
              </p>
            </div>
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-widest text-red-400 mb-3">Customer Care</h4>
              <p className="text-xs text-amber-100/80 leading-relaxed">
                Hotline: (032) 492-0000<br />
                Email: support@eatnrepeat.ph
              </p>
            </div>
          </div>
          <div className="border-t border-[#592205] pt-6 text-center text-xs text-amber-200/50">
            © {new Date().getFullYear()} Eat n' RepEat Café Cordova. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Slide-over Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        fulfillmentType={fulfillmentType}
        setFulfillmentType={setFulfillmentType}
      />
    </div>
  );
}
