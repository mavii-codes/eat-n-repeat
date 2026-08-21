// @ts-nocheck
'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import type { CustomerMenuItem } from './MenuCard';
import { ReviewsSection } from './ReviewsSection';
import { useReviews } from '@/context/ReviewsContext';
import type { CustomizationOption } from '@/lib/admin/types';
import { Coffee, CupSoda, Croissant, Utensils, Sandwich, Settings, FileText, Star } from 'lucide-react';

type MenuItemDetailsModalProps = {
  item: CustomerMenuItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart?: (item: CustomerMenuItem) => void;
  onToggleFavorite?: (id: string) => void;
  isFavorite?: boolean;
};

function getCategoryIcon(cat?: string): React.ReactNode {
  if (!cat) return <Utensils className="w-4 h-4" />;
  const lower = cat.toLowerCase();
  if (lower.includes('coffee') || lower.includes('espresso')) return <Coffee className="w-4 h-4" />;
  if (lower.includes('milktea') || lower.includes('boba') || lower.includes('tea')) return <CupSoda className="w-4 h-4" />;
  if (lower.includes('rice') || lower.includes('meal')) return <Utensils className="w-4 h-4" />;
  if (lower.includes('pastr') || lower.includes('dessert') || lower.includes('bakery')) return <Croissant className="w-4 h-4" />;
  if (lower.includes('side') || lower.includes('bites') || lower.includes('fry') || lower.includes('fries')) return <Utensils className="w-4 h-4" />;
  if (lower.includes('burger')) return <Sandwich className="w-4 h-4" />;
  return <Utensils className="w-4 h-4" />;
}

function getDefaultIngredients(item: CustomerMenuItem): string[] {
  if (item.ingredients && item.ingredients.length > 0) return item.ingredients;
  const name = item.name.toLowerCase();
  if (name.includes('latte') || name.includes('coffee')) return ['Single Origin Arabica Beans', 'Steamed Farm Milk', 'Vanilla Bean Syrup'];
  if (name.includes('cold brew')) return ['16-Hour Cold Steeped Coffee', 'Filtered Water', 'Crystal Ice'];
  if (name.includes('matcha')) return ['Uji Grade Japanese Matcha', 'Fresh Whole Milk', 'Salted Cheese Foam'];
  if (name.includes('boba') || name.includes('sugar')) return ['Slow-Cooked Tapioca Pearls', 'Muscovado Sugar', 'Fresh Whole Milk'];
  if (name.includes('inasal') || name.includes('chicken')) return ['Marinated Chicken Thigh', 'Annatto Oil', 'Steamed Rice', 'Spiced Vinegar'];
  if (name.includes('spam') || name.includes('egg')) return ['Premium Spam Slice', 'Farm Fresh Egg', 'Garlic Fried Rice'];
  if (name.includes('croissant')) return ['French Butter', 'Multi-Layered Pastry Flour', 'Pure Honey Glaze'];
  if (name.includes('fries')) return ['Skin-On Potato Cut', 'Parmesan Cheese', 'Truffle Oil', 'Garlic Herbs'];
  return ['Fresh Ingredients', 'Handcrafted Seasonings'];
}

export function MenuItemDetailsModal({
  item,
  isOpen,
  onClose,
  onAddToCart,
  onToggleFavorite,
  isFavorite = false,
}: MenuItemDetailsModalProps) {
  const { getAverageRating } = useReviews();

  // Customization States
  const [favorite, setFavorite] = useState(isFavorite);
  const [quantity, setQuantity] = useState(1);
  const [itemNotes, setItemNotes] = useState('');
  const [showReviewsAccordion, setShowReviewsAccordion] = useState(false);
  const [added, setAdded] = useState(false);

  const [selectedSpiceLevel, setSelectedSpiceLevel] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<any | null>(null);
  const [selectedSugarLevel, setSelectedSugarLevel] = useState<string | null>(null);
  const [selectedIceLevel, setSelectedIceLevel] = useState<string | null>(null);
  const [selectedRiceOption, setSelectedRiceOption] = useState<CustomizationOption | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<CustomizationOption[]>([]);

  useEffect(() => {
    setFavorite(isFavorite);
    setQuantity(1);
    setItemNotes('');
    setShowReviewsAccordion(false);
    
    // Reset customizations
    const customizations = item?.customizations;
    if (customizations?.enabled) {
      setSelectedSpiceLevel(customizations.spiceLevels?.[0] || null);
      
      setSelectedSugarLevel(customizations.sugarLevels?.[0] || null);
      setSelectedIceLevel(customizations.iceLevels?.[0] || null);
      setSelectedRiceOption(customizations.riceOptions?.[0] || null);
    } else {
      setSelectedSpiceLevel(null);
      
      setSelectedSugarLevel(null);
      setSelectedIceLevel(null);
      setSelectedRiceOption(null);
    }
    setSelectedAddOns([]);
    setSelectedSize(null);
  }, [isOpen, item, isFavorite]);

  if (!isOpen || !item) return null;

  const liveSummary = getAverageRating(item.id);
  const rating = liveSummary.totalReviews > 0 ? liveSummary.averageRating : (item.rating ?? 4.8);
  const reviews = liveSummary.totalReviews > 0 ? liveSummary.totalReviews : (item.reviews ?? 0);
  const isAutoTopRated = rating >= 4.5 && reviews >= 10;
  const effectiveBadge = isAutoTopRated ? 'Top Rated' : item.badge;
  const isAvailable = item.available !== false;
  const categoryIcon = item.categoryIcon || getCategoryIcon(item.category);
  const ingredientsList = getDefaultIngredients(item);

  const customizations = item.customizations;

  // Dynamic Price Calculation
  const addOnsTotal = selectedAddOns.reduce((sum, addOn) => sum + addOn.price, 0);
  const drinkSizeExtra = selectedSize?.price || 0;
  const riceExtraPrice = selectedRiceOption?.price || 0;
  
  const unitPrice = item.price + addOnsTotal + drinkSizeExtra + riceExtraPrice;
  const totalPrice = unitPrice * quantity;

  const handleToggleAddOn = (addOn: CustomizationOption) => {
    setSelectedAddOns((prev) => {
      const exists = prev.find((a) => a.name === addOn.name);
      if (exists) {
        return prev.filter((a) => a.name !== addOn.name);
      }
      return [...prev, addOn];
    });
  };

  const handleFavoriteClick = () => {
    setFavorite(!favorite);
    if (onToggleFavorite) {
      onToggleFavorite(item.id);
    }
  };

  const handleAdd = () => {
    if (!isAvailable) return;
    if (item.sizes && item.sizes.filter(s=>s.available).length > 0 && !selectedSize) {
      alert("Please select a size before adding to order.");
      return;
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);

    // Build custom notes string from selections
    const customNotes: string[] = [];
    if (selectedSpiceLevel) customNotes.push(`Spice: ${selectedSpiceLevel}`);
    /* Size is now explicitly passed in payload, not just notes */
    if (selectedSugarLevel) customNotes.push(`Sugar: ${selectedSugarLevel}`);
    if (selectedIceLevel) customNotes.push(`Ice: ${selectedIceLevel}`);
    if (selectedRiceOption && selectedRiceOption.price > 0) {
      customNotes.push(`Rice: ${selectedRiceOption.name} (+₱${selectedRiceOption.price})`);
    } else if (selectedRiceOption) {
      customNotes.push(`Rice: ${selectedRiceOption.name}`);
    }
    
    if (selectedAddOns.length > 0) {
      const names = selectedAddOns.map(a => a.name).join(', ');
      customNotes.push(`Add-ons: ${names}`);
    }
    if (itemNotes.trim()) {
      customNotes.push(`Note: ${itemNotes.trim()}`);
    }

    const compiledNotes = customNotes.join(' | ');

    if (onAddToCart) {
      for (let i = 0; i < quantity; i++) {
        onAddToCart({
          ...item,
          price: unitPrice,
          notes: compiledNotes || undefined,
          ...(selectedSize ? { selectedSize } : {})
        } as any);
      }
    }
  };

  const fallbackImage = 'https://images.unsplash.com/photo-1541180464527-0245efded371?w=600&auto=format&fit=crop';
  const displayImage = item.image && item.image.trim().length > 0 ? item.image : fallbackImage;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 overflow-y-auto font-sans selection:bg-[#B91C1C] selection:text-white">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-2xl bg-[#FFF8F0] rounded-3xl border border-amber-200/90 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header Bar with Hero Image */}
        <div className="relative h-60 sm:h-72 w-full shrink-0 bg-[#FAF3EA]">
          <Image
            src={displayImage}
            alt={item.name}
            fill
            sizes="(max-width: 768px) 100vw, 600px"
            className="object-cover object-center"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

          {/* Close & Favorite Top Controls */}
          <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
            <button
              type="button"
              onClick={handleFavoriteClick}
              aria-label="Toggle Favorite"
              className="w-9 h-9 rounded-full bg-white/90 hover:bg-white text-stone-700 backdrop-blur-md flex items-center justify-center shadow-md transition-all hover:scale-110"
            >
              <svg
                className={`w-5 h-5 transition-colors ${
                  favorite ? 'fill-rose-600 text-rose-600' : 'text-stone-400'
                }`}
                fill={favorite ? 'currentColor' : 'none'}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md flex items-center justify-center transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Category & Status Badges */}
          <div className="absolute top-4 left-4 flex flex-wrap gap-2 z-10">
            {effectiveBadge && (
              <span className="bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-black px-3.5 py-1 rounded-full shadow-md uppercase tracking-wide border border-amber-300/30 animate-pulse">
                {effectiveBadge}
              </span>
            )}
            {item.category && (
              <span className="bg-[#451a03]/85 backdrop-blur-md text-amber-100 text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-full border border-white/20 flex items-center gap-1">
                {categoryIcon} {item.category}
              </span>
            )}
            <span
              className={`text-xs font-black px-3 py-1 rounded-full border shadow-xs ${
                isAvailable
                  ? 'bg-emerald-500/90 text-white border-emerald-300'
                  : 'bg-rose-600/90 text-white border-rose-400'
              }`}
            >
              {isAvailable ? '● In Stock & Ready' : '○ Out of Stock'}
            </span>
          </div>

          <div className="absolute bottom-4 left-4 right-4 z-10 text-white">
            <h2 className="text-2xl sm:text-3xl font-black drop-shadow-md tracking-tight">{item.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className={`w-4 h-4 ${
                      i < Math.floor(rating) ? 'fill-amber-400 text-amber-400' : 'text-stone-400'
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-sm font-extrabold">{rating.toFixed(1)}</span>
              <span className="text-xs text-stone-200 font-medium">({reviews} customer reviews)</span>
            </div>
          </div>
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Price & Description */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black text-stone-400 uppercase tracking-wider mb-1">Description</p>
              <p className="text-sm text-stone-700 leading-relaxed font-medium">{item.description}</p>
            </div>
            <div className="text-right shrink-0 bg-white px-4 py-2.5 rounded-2xl border border-amber-200/80 shadow-2xs">
              <span className="text-[10px] font-bold text-stone-400 block uppercase tracking-wider">Base Price</span>
              <span className="text-2xl font-black text-[#B91C1C]">₱{item.price.toFixed(2)}</span>
            </div>
          </div>

          {/* DYNAMIC CUSTOMIZATION OPTIONS */}
          {customizations?.enabled && (
            <div className="p-4 rounded-2xl bg-white border border-amber-200/90 shadow-2xs space-y-4">
              <h4 className="text-xs font-black text-[#451a03] uppercase tracking-wider flex items-center gap-1.5 border-b border-amber-100 pb-2">
                <Settings className="w-4 h-4" /> Customize Your Order
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Native Sizes */}
                {item.sizes && item.sizes.length > 0 && (
                  <div className="col-span-1 sm:col-span-2">
                    <label className="text-xs font-extrabold text-stone-700 block mb-1.5">Choose Size <span className="text-[#B91C1C]">*</span></label>
                    <div className="grid grid-cols-2 gap-2">
                      {item.sizes.filter(s => s.available).map((size) => (
                        <button
                          key={size.name}
                          type="button"
                          onClick={() => setSelectedSize(size)}
                          className={`py-2.5 px-3 rounded-xl text-sm font-bold transition border flex justify-between items-center ${
                            selectedSize?.name === size.name
                              ? 'bg-[#B91C1C] text-white border-[#B91C1C] shadow-md'
                              : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-amber-50'
                          }`}
                        >
                          <span>{size.name}</span>
                          <span className={`text-xs ${selectedSize?.name === size.name ? 'opacity-90' : 'opacity-60'}`}>
                            ₱{size.price.toFixed(2)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Sugar Level */}
                {customizations.sugarLevels && customizations.sugarLevels.length > 0 && (
                  <div>
                    <label className="text-xs font-extrabold text-stone-700 block mb-1.5">Sweetness Level</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {customizations.sugarLevels.map((lvl: any) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setSelectedSugarLevel(lvl)}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold transition border ${
                            selectedSugarLevel === lvl
                              ? 'bg-[#B91C1C] text-white border-[#B91C1C] shadow-2xs'
                              : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-amber-50'
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ice Level */}
                {customizations.iceLevels && customizations.iceLevels.length > 0 && (
                  <div>
                    <label className="text-xs font-extrabold text-stone-700 block mb-1.5">Ice Level</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {customizations.iceLevels.map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setSelectedIceLevel(lvl)}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold transition border ${
                            selectedIceLevel === lvl
                              ? 'bg-[#B91C1C] text-white border-[#B91C1C] shadow-2xs'
                              : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-amber-50'
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Spice Level */}
                {customizations.spiceLevels && customizations.spiceLevels.length > 0 && (
                  <div>
                    <label className="text-xs font-extrabold text-stone-700 block mb-1.5">Spice Level</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {customizations.spiceLevels.map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setSelectedSpiceLevel(lvl)}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold transition border ${
                            selectedSpiceLevel === lvl
                              ? 'bg-[#B91C1C] text-white border-[#B91C1C] shadow-2xs'
                              : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-amber-50'
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rice Options */}
                {customizations.riceOptions && customizations.riceOptions.length > 0 && (
                  <div className="col-span-1 sm:col-span-2">
                    <label className="text-xs font-extrabold text-stone-700 block mb-1.5">Choose Rice Option</label>
                    <div className="grid grid-cols-3 gap-2">
                      {customizations.riceOptions.map((rice: any) => (
                        <button
                          key={rice.name}
                          type="button"
                          onClick={() => setSelectedRiceOption(rice)}
                          className={`py-2 px-2.5 rounded-xl text-xs font-bold transition border flex flex-col items-center ${
                            selectedRiceOption?.name === rice.name
                              ? 'bg-[#451a03] text-white border-[#451a03] shadow-2xs'
                              : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-amber-50'
                          }`}
                        >
                          <span>{rice.name}</span>
                          <span className="text-[10px] opacity-80">{rice.price > 0 ? `+₱${rice.price}` : 'Included'}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Add-ons */}
              {customizations.addons && customizations.addons.length > 0 && (
                <div className="pt-2">
                  <label className="text-xs font-extrabold text-stone-700 block mb-1.5">Select Extra Add-ons</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {customizations.addons.map((addon: any) => {
                      const checked = selectedAddOns.find(a => a.name === addon.name);
                      return (
                        <button
                          key={addon.name}
                          type="button"
                          onClick={() => handleToggleAddOn(addon)}
                          className={`p-2.5 rounded-xl text-xs font-bold transition border flex items-center justify-between ${
                            checked
                              ? 'bg-amber-100 text-[#451a03] border-amber-300 shadow-2xs'
                              : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-amber-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center text-[10px] ${checked ? 'bg-[#451a03] text-white border-[#451a03]' : 'bg-white border-stone-300'}`}>
                              {checked ? '✓' : ''}
                            </div>
                            <span>{addon.name}</span>
                          </div>
                          <span className="text-[#B91C1C] font-black">+₱{addon.price}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SPECIAL INSTRUCTIONS */}
          {(!customizations || customizations.enableSpecialInstructions) && (
            <div className="p-4 rounded-2xl bg-white border border-amber-200/90 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="item-notes" className="text-xs font-black text-[#451a03] uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4" /> Special Instructions (Optional)
                </label>
                <span className="text-[10px] font-bold text-stone-400">{itemNotes.length}/200 characters</span>
              </div>
              <textarea
                id="item-notes"
                rows={2}
                maxLength={200}
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
                placeholder="Example: No onions, extra sauce, call when you arrive."
                className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:border-[#B91C1C] focus:ring-1 focus:ring-[#B91C1C] outline-none text-stone-800 placeholder:text-stone-400 resize-none transition bg-stone-50/50"
              />
            </div>
          )}

          {/* QUANTITY & ADD BUTTON */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#451a03] to-[#3D1703] text-white shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-amber-300 uppercase tracking-widest">Select Quantity</p>
                <p className="text-xs font-semibold text-stone-200">₱{unitPrice.toFixed(2)} each</p>
              </div>
              <div className="flex items-center gap-3 bg-white/10 p-1.5 rounded-2xl border border-white/20">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 text-white font-black text-base flex items-center justify-center transition"
                >
                  −
                </button>
                <span className="text-base font-black w-6 text-center">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 text-white font-black text-base flex items-center justify-center transition"
                >
                  +
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!isAvailable}
              className={`w-full py-3.5 px-6 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
                !isAvailable
                  ? 'bg-stone-400 text-stone-200 cursor-not-allowed shadow-none'
                  : added
                  ? 'bg-emerald-600 text-white shadow-emerald-600/30 scale-[0.99]'
                  : 'bg-[#B91C1C] hover:bg-[#991B1B] text-white shadow-red-500/25 hover:scale-[1.01] active:scale-[0.99]'
              }`}
            >
              {!isAvailable ? 'Out of Stock' : added ? (
                <>
                  <svg className="w-5 h-5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> Added {quantity} to Order!
                </>
              ) : (item.sizes && item.sizes.filter(s=>s.available).length > 0 && !selectedSize) ? (
                'Select Size to Add'
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg> Add to Order • ₱{totalPrice.toFixed(2)}
                </>
              )}
            </button>
          </div>

          <div className="pt-2 border-t border-amber-200/60">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-black text-[#451a03] uppercase tracking-wider flex items-center gap-1.5">
                <Star className="w-4 h-4" /> Customer Reviews ({reviews})
              </h4>
              <button
                type="button"
                onClick={() => setShowReviewsAccordion(!showReviewsAccordion)}
                className="text-xs font-extrabold text-[#B91C1C] hover:underline transition"
              >
                {showReviewsAccordion ? 'Hide Reviews ▲' : 'View All Reviews ▼'}
              </button>
            </div>
            {showReviewsAccordion && (
              <div className="mt-3">
                <ReviewsSection menuItemId={item.id} maxReviews={10} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
