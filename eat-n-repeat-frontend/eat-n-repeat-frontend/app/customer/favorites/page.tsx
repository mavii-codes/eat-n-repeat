'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { CustomerHeader } from '@/components/customer/CustomerHeader';
import { MenuCard, type CustomerMenuItem } from '@/components/customer/MenuCard';
import { CartDrawer, type CartItem } from '@/components/customer/CartDrawer';
import { useAdminData } from '@/context/AdminDataContext';
import { useReviews } from '@/context/ReviewsContext';
import { Heart } from 'lucide-react';
import Link from 'next/link';

export default function FavoritesPage() {
  const { menuItems, menuCategories } = useAdminData();
  const { getAverageRating } = useReviews();
  const { data: session, status } = useSession();
  const accessToken = (session as any)?.accessToken as string | undefined;

  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'pickup' | 'dine-in'>('delivery');
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize cart from localStorage on mount
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

  // Sync cart changes back to localStorage
  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
      localStorage.setItem('eat-n-repeat-cart', JSON.stringify(cartItems));
    }
  }, [cartItems, isInitialized]);

  useEffect(() => {
    if (session?.user && accessToken) {
      import('@/lib/config').then(({ getApiUrl }) => {
        fetch(`${getApiUrl()}/api/customer-favorites`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
          .then((res) => res.json())
          .then((data) => {
            if (Array.isArray(data)) setFavoriteIds(data);
          })
          .catch(console.error);
      });
    } else {
      setFavoriteIds([]);
    }
  }, [session, accessToken]);

  const favorites = useMemo(() => {
    return favoriteIds.map((id) => {
      const item = menuItems.find(m => m.id === id);
      if (!item) return null;
      
      const categoryObj = menuCategories.find((c) => c.id === item.categoryId);
      const categoryName = categoryObj?.name || 'General';
      const liveSummary = getAverageRating(item.id);
      
      return {
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        image: item.image,
        category: categoryName,
        rating: liveSummary.averageRating,
        reviews: liveSummary.totalReviews,
        available: item.available
      };
    }).filter(Boolean) as CustomerMenuItem[];
  }, [favoriteIds, menuItems, menuCategories, getAverageRating]);

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

  const handleToggleFavorite = async (id: string) => {
    setFavoriteIds((prev) => prev.filter((favId) => favId !== id));
    try {
      const { getApiUrl } = await import('@/lib/config');
      await fetch(`${getApiUrl()}/api/customer-favorites/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
    } catch (error) {
      console.error('Failed to remove favorite', error);
      setFavoriteIds((prev) => [...prev, id]);
    }
  };

  const totalCartCount = cartItems.reduce((acc, ci) => acc + ci.quantity, 0);
  const totalCartSubtotal = cartItems.reduce((acc, ci) => acc + ci.menuItem.price * ci.quantity, 0);

  return (
    <div className="min-h-screen bg-[#FFF8F0] text-stone-900 flex flex-col justify-between">
      <CustomerHeader
        cartCount={totalCartCount}
        cartSubtotal={totalCartSubtotal}
        onOpenCart={() => setIsCartOpen(true)}
        favoritesCount={favorites.length}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 space-y-8">
        <div className="border-b border-amber-200/60 pb-4">
          <h1 className="text-3xl font-black text-[#451a03] flex items-center gap-3">
            Your Favorite Items <Heart className="w-7 h-7 text-[#B91C1C] fill-current" />
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Quick access to the meals and drinks you love most.
          </p>
        </div>

        {status === 'loading' ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          </div>
        ) : !session?.user ? (
          <div className="text-center py-24 px-4 bg-white rounded-3xl border border-amber-100 shadow-sm max-w-2xl mx-auto">
            <div className="mx-auto w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <Heart className="w-10 h-10 fill-current" />
            </div>
            <h2 className="text-2xl font-black text-[#451a03] mb-3">Sign in to view favorites</h2>
            <p className="text-stone-500 max-w-sm mx-auto mb-8 font-medium">
              Create an account or sign in to save your favorite menu items and access them anytime.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/customer/login"
                className="w-full sm:w-auto px-8 py-3.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white rounded-xl font-bold transition shadow-sm"
              >
                Sign In
              </Link>
              <Link
                href="/customer/register"
                className="w-full sm:w-auto px-8 py-3.5 bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 rounded-xl font-bold transition"
              >
                Create Account
              </Link>
            </div>
          </div>
        ) : favorites.length > 0 ? (
          <>
            <div className="text-xs font-bold text-stone-600">
              You have <span className="font-extrabold text-[#B91C1C]">{favorites.length}</span> saved item{favorites.length !== 1 ? 's' : ''}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {favorites.map((item) => (
                <MenuCard
                  key={item.id}
                  {...item}
                  isFavorite={true}
                  onAddToCart={handleAddToCart}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-20 px-4 bg-white rounded-3xl border border-amber-100 shadow-sm">
            <div className="mx-auto w-20 h-20 bg-stone-50 text-stone-400 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <Heart className="w-10 h-10 stroke-[1.5]" />
            </div>
            <h2 className="text-2xl font-black text-[#451a03] mb-3">No favorites yet</h2>
            <p className="text-stone-500 max-w-sm mx-auto mb-8 font-medium">
              Tap the heart on a menu item to save it here.
            </p>
            <Link
              href="/customer/menu"
              className="inline-flex items-center justify-center px-8 py-3.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white rounded-xl font-bold transition shadow-sm"
            >
              Browse Menu
            </Link>
          </div>
        )}
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
