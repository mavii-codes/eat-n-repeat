'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { CustomerHeader } from '@/components/customer/CustomerHeader';
import { MenuCard, type CustomerMenuItem } from '@/components/customer/MenuCard';
import { MenuItemDetailsModal } from '@/components/customer/MenuItemDetailsModal';
import { CartDrawer, type CartItem } from '@/components/customer/CartDrawer';
import { useAdminData } from '@/context/AdminDataContext';
import { useReviews } from '@/context/ReviewsContext';
import { Heart, Search, Coffee, UtensilsCrossed } from 'lucide-react';

type SortOption = 'rating' | 'price-asc' | 'price-desc' | 'name';

export default function MenuPage() {
  const { menuItems, menuCategories, stockItems } = useAdminData();
  const { getAverageRating } = useReviews();

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('rating');
  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'pickup' | 'dine-in'>('delivery');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
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

  const activeCategories = useMemo(() => {
    const categoryList = menuCategories.filter((c) => !c.archived).map((c) => c.name);
    return ['All', ...categoryList];
  }, [menuCategories]);

  const formattedMenuItems = useMemo<CustomerMenuItem[]>(() => {
    const activeItems = menuItems.filter((item) => !item.archived);
    if (activeItems.length === 0) return [];

    return activeItems.map((item, index) => {
      const categoryObj = menuCategories.find((c) => c.id === item.categoryId);
      const categoryName = categoryObj?.name || 'General';

      const liveSummary = getAverageRating(item.id);
      const rating = liveSummary.averageRating;
      const reviews = liveSummary.totalReviews;

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

      // Check linked ingredient stock status
      const linkedStock = stockItems?.find(
        (s) =>
          s.id === item.stockItemId ||
          item.name.toLowerCase().includes(s.name.toLowerCase()) ||
          s.name.toLowerCase().includes(item.name.toLowerCase())
      );
      const isOutOfStock = linkedStock ? linkedStock.quantity <= 0 : false;
      const effectiveAvailable = item.available && !isOutOfStock;

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
        available: effectiveAvailable,
      };
    });
  }, [menuItems, menuCategories, stockItems, getAverageRating]);

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
    // Optimistic UI update
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
    <div className="min-h-screen bg-[#FFF8F0] text-stone-900 flex flex-col justify-between">
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 space-y-8">
        {/* Hero Section & Search Bar */}
        <div className="relative overflow-hidden bg-gradient-to-r from-[#451a03] to-[#782c06] text-white rounded-[2.5rem] p-8 sm:p-12 shadow-xl border border-[#451a03]/50">
          <div className="relative z-10 max-w-2xl">
            <span className="inline-block px-3 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-black uppercase tracking-widest rounded-full mb-4">
              Eat n' RepEat Café
            </span>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
              Explore Our Full Menu
            </h1>
            <p className="text-amber-100/90 text-sm sm:text-base leading-relaxed mb-8">
              From single-origin espresso to our signature flame-grilled rice bowls. Find your new favorite today.
            </p>
            
            {/* Search Bar */}
            <div className="relative max-w-md">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="w-5 h-5 text-amber-100/70" />
              </div>
              <input
                type="text"
                placeholder="Search for coffee, rice bowls, or snacks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white placeholder-amber-100/50 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white/20 transition-all font-medium text-sm sm:text-base"
              />
            </div>
          </div>
          
          {/* Decorative Elements */}
          <div className="absolute -bottom-12 -right-12 opacity-10 rotate-[-15deg] pointer-events-none select-none">
            <Coffee className="w-28 h-28 text-white" />
          </div>
          <div className="absolute top-10 right-20 opacity-10 rotate-[15deg] pointer-events-none select-none">
            <UtensilsCrossed className="w-14 h-14 text-white" />
          </div>
        </div>

        <div className="border-b border-amber-200/60 pb-4 flex flex-col sm:flex-row justify-between sm:items-end gap-4 mt-8">
          <div>
            <h2 className="text-xl font-black text-[#451a03]">Categories</h2>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-xs font-bold text-stone-600 bg-white px-4 py-2 rounded-full border border-amber-200/80 shadow-2xs">
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

        {/* Category Tabs Strip */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-2 no-scrollbar">
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

        {/* Food Grid */}
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
            <Search className="w-12 h-12 text-stone-400 mx-auto mb-4" />
            <h3 className="text-xl font-extrabold text-[#451a03] mb-1">No matching menu items</h3>
            <p className="text-sm text-stone-600 mb-6">
              Try adjusting your search query or selecting a different category.
            </p>
            <button
              onClick={() => {
                setSelectedCategory('All');
                setSearchQuery('');
              }}
              className="px-6 py-2.5 bg-[#B91C1C] text-white rounded-xl text-xs font-extrabold hover:bg-[#991B1B] transition shadow-md"
            >
              Show All Menu Items
            </button>
          </div>
        )}
      </main>

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
