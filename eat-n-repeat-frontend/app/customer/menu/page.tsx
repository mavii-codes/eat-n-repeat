'use client';

import { useState, useMemo } from 'react';
import { CustomerHeader } from '@/components/customer/CustomerHeader';
import { MenuCard, type CustomerMenuItem } from '@/components/customer/MenuCard';
import { CartDrawer, type CartItem } from '@/components/customer/CartDrawer';
import { useAdminData } from '@/context/AdminDataContext';

export default function MenuPage() {
  const { menuItems, menuCategories } = useAdminData();

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'pickup' | 'dine-in'>('delivery');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [favorites, setFavorites] = useState<string[]>([]);

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
        reviews: 24 + index * 5,
        badge,
        available: item.available,
      };
    });
  }, [menuItems, menuCategories]);

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

  const handleToggleFavorite = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((favId) => favId !== id) : [...prev, id]
    );
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
        {/* Title */}
        <div className="border-b border-amber-200/60 pb-4 flex flex-col sm:flex-row justify-between sm:items-end gap-4">
          <div>
            <h1 className="text-3xl font-black text-[#451a03]">Explore Our Full Menu</h1>
            <p className="text-sm text-stone-600 mt-1">
              Select items below and add to cart for instant delivery or pick-up.
            </p>
          </div>

          <div className="text-xs font-extrabold text-stone-600 bg-white px-4 py-2 rounded-full border border-amber-200/80 shadow-2xs">
            Showing <span className="font-extrabold text-[#B91C1C]">{filteredItems.length}</span> items
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
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-amber-300 p-8 shadow-2xs">
            <div className="text-5xl mb-4">🔍</div>
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
