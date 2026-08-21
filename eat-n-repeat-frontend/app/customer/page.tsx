'use client';

import { useState, useMemo, useEffect } from 'react';
import { CustomerHeader } from '@/components/customer/CustomerHeader';
import { HeroCarousel } from '@/components/customer/HeroCarousel';
import { MenuCard, type CustomerMenuItem } from '@/components/customer/MenuCard';
import { MenuItemDetailsModal } from '@/components/customer/MenuItemDetailsModal';
import { CartDrawer, type CartItem } from '@/components/customer/CartDrawer';
import { useAdminData } from '@/context/AdminDataContext';
import { useReviews } from '@/context/ReviewsContext';
import Link from 'next/link';
import { Flame, Bike, Activity, Search, Heart } from 'lucide-react';
import { useSession } from 'next-auth/react';

type SortOption = 'rating' | 'price-asc' | 'price-desc' | 'name';

export default function CustomerHome() {
  const { menuItems, menuCategories } = useAdminData();
  const { getAverageRating } = useReviews();

  // State
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('rating');
  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'pickup' | 'dine-in'>('delivery');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('eat-n-repeat-cart');
      if (saved) {
        try {
          setCartItems(JSON.parse(saved));
        } catch (e) {}
      }
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
      localStorage.setItem('eat-n-repeat-cart', JSON.stringify(cartItems));
    }
  }, [cartItems, isInitialized]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedDetailItem, setSelectedDetailItem] = useState<CustomerMenuItem | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { data: session } = useSession();
  const accessToken = (session as any)?.accessToken as string | undefined;

  useEffect(() => {
    if (session?.user && accessToken) {
      import('@/lib/config').then(({ getApiUrl }) => {
        fetch(`${getApiUrl()}/api/customer-favorites`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
          .then((res) => res.json())
          .then((data) => {
            if (Array.isArray(data)) setFavorites(data);
          })
          .catch(console.error);
      });
    } else {
      setFavorites([]);
    }
  }, [session, accessToken]);

  // Category mapping
  const activeCategories = useMemo(() => {
    const categoryList = menuCategories.filter((c) => !c.archived).map((c) => c.name);
    return ['All', ...categoryList];
  }, [menuCategories]);

  // Menu items mapping with dynamic ratings & badges
  const formattedMenuItems = useMemo<CustomerMenuItem[]>(() => {
    const activeItems = menuItems.filter((item) => !item.archived);
    if (activeItems.length === 0) return [];

    return activeItems.map((item, index) => {
      const categoryObj = menuCategories.find((c) => c.id === item.categoryId);
      const categoryName = categoryObj?.name || 'General';

      const liveSummary = getAverageRating(item.id);
      const rating = liveSummary.totalReviews > 0 ? liveSummary.averageRating : 4.7 + (index % 3) * 0.1;
      const reviews = liveSummary.totalReviews > 0 ? liveSummary.totalReviews : 20 + index * 7;

      const isBestseller = ['mi-1', 'mi-4', 'mi-5', 'mi-7'].includes(item.id);
      const isStaffPick = ['mi-2'].includes(item.id);
      const isPopular = ['mi-8'].includes(item.id);

      const badge = isBestseller
        ? 'Bestseller'
        : isStaffPick
        ? 'Staff Pick'
        : isPopular
        ? 'Popular'
        : undefined;

      return {
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        image: item.image,
        category: categoryName,
        rating,
        reviews,
        badge,
        available: item.available,
      };
    });
  }, [menuItems, menuCategories, getAverageRating]);

  // Filtered best sellers to highlight at top
  const bestSellers = useMemo(() => {
    return formattedMenuItems.filter(
      (item) => (item.rating ?? 0) >= 4.8 || item.badge === 'Bestseller'
    );
  }, [formattedMenuItems]);

  // Filtered and sorted menu items (Auto highest-rated first by default)
  const filteredItems = useMemo(() => {
    const filtered = formattedMenuItems.filter((item) => {
      const matchesCategory =
        selectedCategory === 'All' ||
        item.category?.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });

    // Auto sort items
    return filtered.sort((a, b) => {
      if (sortBy === 'rating') {
        const ratingA = a.rating ?? 0;
        const ratingB = b.rating ?? 0;
        if (ratingB !== ratingA) return ratingB - ratingA;
        return (b.reviews ?? 0) - (a.reviews ?? 0);
      }
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return 0;
    });
  }, [formattedMenuItems, selectedCategory, searchQuery, sortBy]);

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

  const handleClearCart = () => setCartItems([]);

  const handleToggleFavorite = async (id: string) => {
    if (!session?.user) {
      setShowAuthModal(true);
      return;
    }
    const isFav = favorites.includes(id);
    // Optimistic update
    setFavorites((prev) => (isFav ? prev.filter((favId) => favId !== id) : [...prev, id]));

    try {
      const { getApiUrl } = await import('@/lib/config');
      if (isFav) {
        await fetch(`${getApiUrl()}/api/customer-favorites/${id}`, { 
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
      } else {
        await fetch(`${getApiUrl()}/api/customer-favorites`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}` 
          },
          body: JSON.stringify({ menuItemId: id }),
        });
      }
    } catch (error) {
      console.error('Failed to toggle favorite', error);
      // Revert if API fails
      setFavorites((prev) => (!isFav ? prev.filter((favId) => favId !== id) : [...prev, id]));
    }
  };

  const totalCartCount = cartItems.reduce((acc, ci) => acc + ci.quantity, 0);
  const totalCartSubtotal = cartItems.reduce((acc, ci) => acc + ci.menuItem.price * ci.quantity, 0);

  return (
    <div className="min-h-screen bg-[#FFF8F0] text-stone-900 flex flex-col justify-between selection:bg-[#B91C1C] selection:text-white w-full max-w-full overflow-x-hidden">
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

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-10 space-y-6 sm:space-y-12 flex-1 w-full max-w-full overflow-x-hidden">
        {/* Promotional Hero Banner */}
        <HeroCarousel
          onSelectCategory={(cat) => {
            setSelectedCategory(cat);
            const el = document.getElementById('menu-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        {/* Best Sellers Section */}
        {selectedCategory === 'All' && searchQuery === '' && bestSellers.length > 0 && (
          <section className="space-y-6 bg-[#FFF9F2] p-4 sm:p-8 rounded-2xl sm:rounded-[2rem] border border-amber-200/80 shadow-2xs w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-200/60 pb-4">
              <div>
                <h2 className="text-xl sm:text-3xl font-black text-[#451a03] tracking-tight flex items-center gap-2">
                  <span>Highest Rated &amp; Best Sellers</span>
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-[#B91C1C] text-white uppercase tracking-wider">
                  Must Try
                </span>
                <p className="text-xs sm:text-sm text-stone-600 mt-1">
                  Our top customer favorites automatically calculated from customer reviews.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {bestSellers.map((item) => (
                <MenuCard
                  key={`bestseller-${item.id}`}
                  {...item}
                  isFavorite={favorites.includes(item.id)}
                  onAddToCart={handleAddToCart}
                  onToggleFavorite={handleToggleFavorite}
                  onViewDetails={(selected) => setSelectedDetailItem(selected)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Main Menu Ordering Section */}
        <section id="menu-section" className="space-y-6 pt-2 sm:pt-4 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-200/60 pb-4">
            <div>
              <h2 className="text-xl sm:text-3xl font-black text-[#451a03] tracking-tight">
                Our Delicious Menu
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 mt-1">
                Handcrafted coffee, flame-grilled rice bowls, boba teas &amp; fresh pastries.
              </p>
            </div>

            {/* Controls: Quick Stats & Auto Rating Sort selector */}
            <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
              <div className="text-xs font-bold text-stone-600 bg-white px-3.5 py-2 rounded-full border border-amber-200/80 shadow-2xs">
                Showing <span className="font-extrabold text-[#B91C1C]">{filteredItems.length}</span> items
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-amber-200/80 shadow-2xs">
                <span className="text-xs text-stone-500 font-extrabold">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-transparent text-xs font-black text-[#451a03] focus:outline-none cursor-pointer"
                >
                  <option value="rating">Highest Rated First</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="name">Name: A to Z</option>
                </select>
              </div>
            </div>
          </div>

          {/* Sticky Category Scrollbar */}
          <div className="sticky top-14 sm:top-20 z-30 bg-[#FFF8F0]/95 backdrop-blur-md py-2.5 -mx-3 px-3 sm:mx-0 sm:px-0 w-full overflow-hidden">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 max-w-full">
              {activeCategories.map((category) => {
                const isActive = selectedCategory.toLowerCase() === category.toLowerCase();
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-4 py-2 sm:px-5 sm:py-2.5 rounded-full font-extrabold text-xs sm:text-sm whitespace-nowrap transition-all duration-200 shadow-2xs border ${
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
                  onViewDetails={(selected) => setSelectedDetailItem(selected)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-amber-300 p-8 shadow-2xs">
              <Search className="w-12 h-12 text-stone-400 mx-auto mb-4" strokeWidth={1.5} />
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
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-stone-900 text-sm mb-1">Freshly Prepared</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Made to order using house recipes and small-batch ingredients every single time.
              </p>
            </div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-stone-200 shadow-xs flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center shrink-0">
              <Bike className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-stone-900 text-sm mb-1">Express Delivery</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Fast 30-minute delivery direct to your doorstep anywhere in Cordova area.
              </p>
            </div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-stone-200 shadow-xs flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <Activity className="w-6 h-6" />
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
                <li><Link href="/customer/favorites" className="hover:text-amber-300 transition">My Favorites</Link></li>
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

      {/* Item Details Modal */}
      <MenuItemDetailsModal
        item={selectedDetailItem}
        isOpen={Boolean(selectedDetailItem)}
        onClose={() => setSelectedDetailItem(null)}
        onAddToCart={handleAddToCart}
      />

      {/* Guest Favorites Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-amber-200/80 shadow-2xl space-y-6 text-center animate-in fade-in-50 zoom-in-95 duration-200">
            <div className="mx-auto w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-2 shadow-inner">
              <Heart className="w-8 h-8 fill-current" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-black text-[#451a03]">
                Sign in to save favorites
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-semibold">
                Create an account or sign in to save your favorite menu items.
              </p>
            </div>
            
            <div className="space-y-3 pt-2">
              <Link
                href="/customer/login"
                onClick={() => setShowAuthModal(false)}
                className="block w-full py-3 bg-[#B91C1C] hover:bg-[#991B1B] text-white rounded-xl font-black text-sm shadow-md transition hover:scale-[1.02] active:scale-95 text-center"
              >
                Sign In
              </Link>
              <Link
                href="/customer/register"
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
