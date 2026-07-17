'use client';

import { useState } from 'react';
import { CustomerHeader } from '@/components/customer/CustomerHeader';
import { MenuCard } from '@/components/customer/MenuCard';

// Mock menu items
const menuItems = [
  {
    id: '1',
    name: 'Espresso',
    description: 'Rich and bold single shot of premium espresso',
    price: 3.50,
    image: 'https://images.unsplash.com/photo-1510707577900-59ff2b60b381?w=400&h=300&fit=crop',
    category: 'Coffee',
    rating: 4.8,
    reviews: 45,
    badge: 'Popular',
  },
  {
    id: '2',
    name: 'Cappuccino',
    description: 'Creamy cappuccino with perfect foam',
    price: 4.50,
    image: 'https://images.unsplash.com/photo-1541180464527-0245efded371?w=400&h=300&fit=crop',
    category: 'Coffee',
    rating: 4.7,
    reviews: 38,
  },
  {
    id: '3',
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
    id: '4',
    name: 'Chocolate Cake',
    description: 'Rich and moist chocolate cake slice',
    price: 5.99,
    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop',
    category: 'Dessert',
    rating: 4.8,
    reviews: 67,
    badge: 'Bestseller',
  },
  {
    id: '5',
    name: 'Avocado Toast',
    description: 'Toasted bread with fresh avocado and egg',
    price: 6.50,
    image: 'https://images.unsplash.com/photo-1587016731348-f3246612efb3?w=400&h=300&fit=crop',
    category: 'Food',
    rating: 4.6,
    reviews: 34,
  },
  {
    id: '6',
    name: 'Iced Latte',
    description: 'Cold and refreshing iced latte with smooth milk',
    price: 4.99,
    image: 'https://images.unsplash.com/photo-1517668808822-9ebb02ae2a0e?w=400&h=300&fit=crop',
    category: 'Coffee',
    rating: 4.7,
    reviews: 41,
  },
  {
    id: '7',
    name: 'Berry Muffin',
    description: 'Blueberry muffin with a crispy top',
    price: 3.99,
    image: 'https://images.unsplash.com/photo-1607920591413-264ec466e81f?w=400&h=300&fit=crop',
    category: 'Pastry',
    rating: 4.5,
    reviews: 28,
  },
  {
    id: '8',
    name: 'Caesar Salad',
    description: 'Fresh greens with homemade Caesar dressing',
    price: 7.99,
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop',
    category: 'Food',
    rating: 4.4,
    reviews: 22,
  },
];

const categories = ['All', 'Coffee', 'Pastry', 'Dessert', 'Food'];

export default function MenuPage() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleAddToCart = (item: typeof menuItems[0]) => {
    console.log('Added to cart:', item);
    // Toast notification would go here
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-amber-50">
      <CustomerHeader title="Our Menu" subtitle="Browse our carefully curated selection of fresh items" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Search & Filter Section */}
        <div className="mb-12 space-y-6">
          {/* Search Bar */}
          <div className="relative">
            <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-amber-900/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search for your favorite item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-full border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-transparent bg-white shadow-sm"
            />
          </div>

          {/* Category Filter */}
          <div className="flex gap-3 overflow-x-auto pb-2">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-6 py-2 rounded-full font-semibold whitespace-nowrap transition ${
                  selectedCategory === category
                    ? 'bg-amber-700 text-white shadow-lg'
                    : 'bg-white border-2 border-amber-200 text-amber-900 hover:border-amber-300'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Results Info */}
        <div className="mb-8">
          <p className="text-sm text-amber-900/70">
            Showing <span className="font-semibold">{filteredItems.length}</span> item{filteredItems.length !== 1 ? 's' : ''}
            {selectedCategory !== 'All' && ` in ${selectedCategory}`}
          </p>
        </div>

        {/* Menu Grid */}
        {filteredItems.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {filteredItems.map(item => (
              <MenuCard
                key={item.id}
                {...item}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-2xl font-bold text-amber-950 mb-2">No items found</h3>
            <p className="text-amber-900/70">Try adjusting your search or filter criteria</p>
          </div>
        )}
      </main>
    </div>
  );
}
