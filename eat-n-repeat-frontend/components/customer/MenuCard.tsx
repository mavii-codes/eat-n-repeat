'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useReviews } from '@/context/ReviewsContext';
import { Star, Flame, Milk } from 'lucide-react';

export type CustomerMenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  category?: string;
  rating?: number;
  reviews?: number;
  badge?: string;
  available?: boolean;
  calories?: string;
  allergens?: string[];
  spiceLevel?: string;
  servingSize?: string;
  notes?: string;
  prepTime?: string;
  deliveryTime?: string;
  ingredients?: string[];
  categoryIcon?: string;
  customizations?: any; // We will use CustomizationConfig type where needed
};

type MenuCardProps = CustomerMenuItem & {
  onAddToCart?: (item: CustomerMenuItem) => void;
  onToggleFavorite?: (id: string) => void;
  onViewDetails?: (item: CustomerMenuItem) => void;
  isFavorite?: boolean;
};

export function MenuCard({
  id,
  name,
  description,
  price,
  image,
  category,
  rating: propRating = 4.8,
  reviews: propReviews = 32,
  badge,
  available = true,
  calories,
  allergens,
  spiceLevel,
  servingSize,
  onAddToCart,
  onToggleFavorite,
  onViewDetails,
  isFavorite = false,
  customizations,
}: MenuCardProps) {
  const { getAverageRating } = useReviews();
  const liveSummary = getAverageRating(id);
  
  // Use live review data if available, otherwise fall back to prop defaults
  const rating = liveSummary.totalReviews > 0 ? liveSummary.averageRating : propRating;
  const reviews = liveSummary.totalReviews > 0 ? liveSummary.totalReviews : propReviews;

  // Requirement: If average rating >= 4.5 with at least 10 reviews, auto show "Top Rated" badge
  const isAutoTopRated = rating >= 4.5 && reviews >= 10;
  const effectiveBadge = isAutoTopRated ? 'Top Rated' : badge;

  const [added, setAdded] = useState(false);

  const fallbackImage = 'https://images.unsplash.com/photo-1541180464527-0245efded371?w=600&auto=format&fit=crop';
  const initialDisplayImage = image && image.trim().length > 0 ? image : fallbackImage;
  const [imgSrc, setImgSrc] = useState(initialDisplayImage);

  useEffect(() => {
    setImgSrc(image && image.trim().length > 0 ? image : fallbackImage);
  }, [image]);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite(id);
    }
  };

  const handleCardClick = () => {
    if (onViewDetails) {
      onViewDetails({
        id,
        name,
        description,
        price,
        image: imgSrc,
        category,
        rating,
        reviews,
        badge: effectiveBadge,
        available,
        calories,
        allergens,
        spiceLevel,
        servingSize,
        customizations,
      });
    }
  };

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!available) return;
    handleCardClick();
  };

  return (
    <div
      onClick={handleCardClick}
      className={`group relative rounded-3xl overflow-hidden bg-white border transition-all duration-300 flex flex-col justify-between cursor-pointer ${
        available
          ? 'border-[#F2E1D0] hover:border-[#B91C1C]/50 hover:shadow-xl hover:shadow-red-500/10'
          : 'border-stone-200 opacity-75 grayscale-[0.2]'
      }`}
    >
      {/* Image Section */}
      <div>
        <div className="relative h-52 w-full overflow-hidden bg-[#FAF3EA]">
          <Image
            src={imgSrc}
            alt={name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
            unoptimized
            onError={() => setImgSrc(fallbackImage)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

          {/* Top Badges */}
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
            {effectiveBadge && (
              <span
                className={`text-white text-[11px] font-black px-3 py-1 rounded-full shadow-md uppercase tracking-wide flex items-center gap-1 ${
                  isAutoTopRated
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-amber-500/30 animate-pulse'
                    : 'bg-[#B91C1C]'
                }`}
              >
                <Star className="w-3 h-3 fill-current" />
                {effectiveBadge}
              </span>
            )}
            {category && (
              <span className="bg-[#451a03]/85 backdrop-blur-md text-amber-100 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border border-white/20">
                {category}
              </span>
            )}
          </div>

          {/* Favorite Button */}
          <button
            type="button"
            onClick={handleFavoriteClick}
            aria-label="Add to favorites"
            className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/90 backdrop-blur-md shadow-md flex items-center justify-center hover:bg-white hover:scale-110 transition-all duration-200"
          >
            <svg
              className={`w-5 h-5 transition-colors ${
                isFavorite ? 'fill-rose-600 text-rose-600' : 'text-stone-400 hover:text-stone-600'
              }`}
              fill={isFavorite ? 'currentColor' : 'none'}
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

          {/* Price Tag Overlay */}
          <div className="absolute bottom-3 left-3 z-10 bg-[#B91C1C] text-white text-sm font-extrabold px-3 py-1 rounded-xl shadow-lg border border-red-400/20">
            ₱{price.toFixed(2)}
          </div>
        </div>

        {/* Card Content */}
        <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="font-extrabold text-base sm:text-lg text-[#451a03] line-clamp-1 group-hover:text-[#B91C1C] transition-colors">
                {name}
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-stone-600 line-clamp-2 min-h-[2.5rem] leading-relaxed">
              {description}
            </p>

            {/* Quick Nutrition & Allergen Tags */}
            <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
              {calories && (
                <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-0.5">
                  <Flame className="w-3 h-3" /> {calories}
                </span>
              )}
              {allergens && allergens.length > 0 && (
                <span className="bg-amber-50 text-stone-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-md truncate max-w-[140px] flex items-center gap-0.5">
                  <Milk className="w-3 h-3" /> {allergens.join(', ')}
                </span>
              )}
              {spiceLevel && spiceLevel !== 'None' && (
                <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-0.5">
                  <svg className="w-3 h-3 text-rose-600 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18.8 6c-.4-.5-1-.7-1.7-.6-.8.1-1.6.5-2.2 1.1-.9.9-1.3 2.1-1.7 3.2-.3 1-.7 2-1.3 2.8-.7.9-1.6 1.7-2.7 2.1-1.2.4-2.5.3-3.6-.3-.6-.3-1.1-.8-1.5-1.4-.4-.6-.6-1.3-.7-2 0-.2-.1-.4-.2-.5-.1-.1-.3-.2-.5-.1-.2 0-.4.1-.5.2-.1.2-.1.4-.1.6.1 1 .4 1.9.9 2.7.5.8 1.2 1.4 2 1.8 1.4.7 3 .7 4.5.3 1.4-.4 2.6-1.3 3.5-2.4.8-1 1.3-2.1 1.7-3.3.4-1.2.9-2.3 1.8-3.2.7-.7 1.5-1.1 2.4-1.2.6-.1 1.1.1 1.4.5.3.3.4.8.2 1.2-.5 1-1.3 1.9-2.2 2.6-1.6 1.3-3.6 2.1-5.6 2.5-.5.1-.9.2-1.4.2-.2 0-.4.1-.5.3s-.1.4 0 .5c.1.2.3.3.5.3.6 0 1.1-.1 1.7-.2 2.2-.4 4.3-1.3 6.1-2.7 1.1-.8 2-1.9 2.5-3.2.3-.8.2-1.7-.4-2.3zM13 2c-.6 0-1 .4-1 1v2.1c-1.1.2-2.1.7-3 1.3l.8 1.3c.7-.4 1.4-.6 2.2-.7V3c0-.6.4-1 1-1zm0 3c-.6 0-1 .4-1 1v.1c.3 0 .6-.1.9-.1h.1V6c0-.6-.4-1-1-1z"/>
                  </svg>
                  {spiceLevel}
                </span>
              )}
            </div>

            {/* Rating Stars & Review Click indicator */}
            <div className="flex items-center gap-1.5 mt-3">
              <div className="flex text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className={`w-3.5 h-3.5 ${
                      i < Math.floor(rating) ? 'fill-amber-500 text-amber-500' : 'text-stone-300'
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-[11px] font-bold text-stone-700">{rating.toFixed(1)}</span>
              <span className="text-[11px] text-stone-400">({reviews})</span>
              <span className="text-[10px] text-[#B91C1C] font-semibold ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                Details &rarr;
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Button */}
      <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-1">
        <button
          type="button"
          disabled={!available}
          onClick={handleAddClick}
          className={`w-full py-2.5 px-4 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all duration-300 ${
            !available
              ? 'bg-stone-200 text-stone-500 cursor-not-allowed shadow-none'
              : added
              ? 'bg-emerald-600 text-white shadow-emerald-600/30 scale-95'
              : 'bg-[#B91C1C] hover:bg-[#991B1B] text-white hover:shadow-lg hover:shadow-red-500/25 active:scale-[0.98]'
          }`}
        >
          {!available ? (
            'Sold Out'
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View Details
            </>
          )}
        </button>
      </div>
    </div>
  );
}
