'use client';

import { useState } from 'react';
import { CustomerHeader } from '@/components/customer/CustomerHeader';
import { MenuCard } from '@/components/customer/MenuCard';

// Mock favorite items
const favoriteItems = [
  {
    id: '1',
    name: 'Cappuccino',
    description: 'Creamy cappuccino with perfect foam',
    price: 4.50,
    image: 'https://images.unsplash.com/photo-1541180464527-0245efded371?w=400&h=300&fit=crop',
    category: 'Coffee',
    rating: 4.7,
    reviews: 38,
  },
  {
    id: '2',
    name: 'Croissant',
    description: 'Buttery French croissant, fresh baked daily',
    price: 3.99,
    image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop',
    category: 'Pastry',
    rating: 4.9,
    reviews: 52,
    badge: 'New',
  },
  {
    id: '3',
    name: 'Avocado Toast',
    description: 'Toasted bread with fresh avocado and egg',
    price: 6.50,
    image: 'https://images.unsplash.com/photo-1587016731348-f3246612efb3?w=400&h=300&fit=crop',
    category: 'Food',
    rating: 4.6,
    reviews: 34,
  },
];

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState(favoriteItems);

  const handleAddToCart = (item: typeof favoriteItems[0]) => {
    console.log('Added to cart:', item);
  };

  const handleRemoveFavorite = (id: string) => {
    setFavorites(favorites.filter(item => item.id !== id));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-amber-50">
      <CustomerHeader 
        title="Your Favorites" 
        subtitle="Quick access to your most loved items"
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {favorites.length > 0 ? (
          <>
            <div className="mb-8">
              <p className="text-sm text-amber-900/70">
                You have <span className="font-semibold">{favorites.length}</span> favorite item{favorites.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {favorites.map(item => (
                <div key={item.id} className="relative">
                  <MenuCard
                    {...item}
                    onAddToCart={handleAddToCart}
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">❤️</div>
            <h3 className="text-2xl font-bold text-amber-950 mb-2">No favorites yet</h3>
            <p className="text-amber-900/70 mb-6">
              Start adding items to your favorites to see them here!
            </p>
            <a
              href="/customer/menu"
              className="inline-block px-8 py-3 bg-amber-700 text-white rounded-full hover:bg-amber-800 transition font-semibold"
            >
              Browse Menu
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
