'use client';

import { useState } from 'react';
import { CustomerHeader } from '@/components/customer/CustomerHeader';
import { MenuCard, type CustomerMenuItem } from '@/components/customer/MenuCard';
import { CartDrawer, type CartItem } from '@/components/customer/CartDrawer';
import Link from 'next/link';

const favoriteItems: CustomerMenuItem[] = [
  {
    id: '1',
    name: 'House Special Latte',
    description: 'Silky double shot espresso with velvety steamed milk and vanilla bean',
    price: 145,
    image: 'https://images.unsplash.com/photo-1541180464527-0245efded371?w=600&auto=format&fit=crop',
    category: 'Coffee',
    rating: 4.8,
    reviews: 38,
    badge: '⭐ Bestseller',
  },
  {
    id: '2',
    name: 'Signature Chicken Inasal Rice Bowl',
    description: 'Flame-grilled marinated chicken thigh with annatto rice and spiced vinegar',
    price: 189,
    image: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=600&auto=format&fit=crop',
    category: 'Meals',
    rating: 4.9,
    reviews: 52,
    badge: '⭐ Bestseller',
  },
  {
    id: '3',
    name: 'Uji Matcha Milktea',
    description: 'Creamy authentic Japanese matcha topped with cheese foam',
    price: 139,
    image: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&auto=format&fit=crop',
    category: 'Milktea',
    rating: 4.7,
    reviews: 34,
  },
];

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<CustomerMenuItem[]>(favoriteItems);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'pickup' | 'dine-in'>('delivery');

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

  const handleToggleFavorite = (id: string) => {
    setFavorites((prev) => prev.filter((item) => item.id !== id));
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
          <h1 className="text-3xl font-black text-[#451a03]">Your Favorite Items ❤️</h1>
          <p className="text-sm text-stone-600 mt-1">
            Quick access to the meals and drinks you love most.
          </p>
        </div>

        {favorites.length > 0 ? (
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
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-amber-300 p-8 shadow-2xs">
            <div className="text-5xl mb-4">❤️</div>
            <h3 className="text-xl font-extrabold text-[#451a03] mb-1">No favorites saved yet</h3>
            <p className="text-sm text-stone-600 mb-6">
              Click the heart icon on any food item to quickly access it here!
            </p>
            <Link
              href="/customer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#B91C1C] text-white rounded-xl text-xs font-black hover:bg-[#991B1B] transition shadow-md hover:scale-105 group"
            >
              <span>Browse Menu &amp; Order Now</span>
              <svg
                className="w-3.5 h-3.5 text-white transition-transform group-hover:translate-x-1 duration-200"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
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
