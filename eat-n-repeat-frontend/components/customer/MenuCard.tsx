'use client';

import Image from 'next/image';
import { useState } from 'react';

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
};

type MenuCardProps = CustomerMenuItem & {
  onAddToCart?: (item: CustomerMenuItem) => void;
  onToggleFavorite?: (id: string) => void;
  isFavorite?: boolean;
};

export function MenuCard({
  id,
  name,
  description,
  price,
  image,
  category,
  rating = 4.8,
  reviews = 32,
  badge,
  available = true,
  onAddToCart,
  onToggleFavorite,
  isFavorite = false,
}: MenuCardProps) {
  const [favorite, setFavorite] = useState(isFavorite);
  const [added, setAdded] = useState(false);

  const fallbackImage = 'https://images.unsplash.com/photo-1541180464527-0245efded371?w=600&auto=format&fit=crop';
  const displayImage = image && image.trim().length > 0 ? image : fallbackImage;

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorite(!favorite);
    if (onToggleFavorite) {
      onToggleFavorite(id);
    }
  };

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!available) return;
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
    if (onAddToCart) {
      onAddToCart({ id, name, description, price, image: displayImage, category, rating, reviews, badge, available });
    }
  };

  return (
    <div
      className={`group relative rounded-3xl overflow-hidden bg-white border transition-all duration-300 flex flex-col justify-between ${
        available
          ? 'border-[#F2E1D0] hover:border-[#B91C1C]/50 hover:shadow-xl hover:shadow-red-500/10'
          : 'border-stone-200 opacity-75 grayscale-[0.2]'
      }`}
    >
      {/* Image Section */}
      <div>
        <div className="relative h-52 w-full overflow-hidden bg-[#FAF3EA]">
          <Image
            src={displayImage}
            alt={name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
            unoptimized={displayImage.startsWith('data:')}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

          {/* Top Badges */}
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
            {badge && (
              <span className="bg-[#B91C1C] text-white text-[11px] font-black px-3 py-1 rounded-full shadow-md uppercase tracking-wide">
                {badge}
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
                favorite ? 'fill-rose-600 text-rose-600' : 'text-stone-400 hover:text-stone-600'
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

            {/* Rating Stars */}
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
          ) : added ? (
            <>
              <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
              Added to Cart!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              + Add to Order
            </>
          )}
        </button>
      </div>
    </div>
  );
}

