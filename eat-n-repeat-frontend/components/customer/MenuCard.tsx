'use client';

import Image from 'next/image';
import { useState } from 'react';

type MenuCardProps = {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  rating?: number;
  reviews?: number;
  badge?: string;
  onAddToCart?: (item: MenuCardProps) => void;
};

export function MenuCard({
  id,
  name,
  description,
  price,
  image,
  category,
  rating = 4.5,
  reviews = 24,
  badge,
  onAddToCart,
}: MenuCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  return (
    <div
      className="group relative rounded-2xl overflow-hidden bg-white border border-amber-100/30 hover:border-amber-300/50 transition-all duration-300 hover:shadow-xl"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image Container */}
      <div className="relative h-48 overflow-hidden bg-gradient-to-br from-amber-100 to-amber-50">
        <Image
          src={image}
          alt={name}
          fill
          className="object-cover group-hover:scale-110 transition-transform duration-300"
        />

        {/* Badge */}
        {badge && (
          <div className="absolute top-4 left-4 bg-amber-700 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
            {badge}
          </div>
        )}

        {/* Favorite Button */}
        <button
          onClick={() => setIsFavorite(!isFavorite)}
          className="absolute top-4 right-4 bg-white/90 backdrop-blur rounded-full p-2 hover:bg-white transition shadow-lg"
        >
          <svg
            className={`w-5 h-5 transition-colors ${
              isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'
            }`}
            fill={isFavorite ? 'currentColor' : 'none'}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>

        {/* Category Tag */}
        <div className="absolute bottom-4 left-4">
          <span className="inline-block bg-amber-700/90 text-white text-xs font-semibold px-3 py-1 rounded-full backdrop-blur">
            {category}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="font-bold text-lg text-amber-950 line-clamp-2">{name}</h3>

        <p className="text-sm text-amber-900/60 mt-2 line-clamp-2">
          {description}
        </p>

        {/* Rating */}
        <div className="flex items-center gap-2 mt-3">
          <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
              <svg
                key={i}
                className={`w-4 h-4 ${
                  i < Math.floor(rating) ? 'text-amber-400' : 'text-amber-200'
                }`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <span className="text-sm font-semibold text-amber-950">{rating}</span>
          <span className="text-xs text-amber-700/60">({reviews})</span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-amber-100/30">
          <div>
            <p className="text-2xl font-bold text-amber-700">${price.toFixed(2)}</p>
          </div>

          <button
            onClick={() => onAddToCart?.({ id, name, description, price, image, category })}
            className={`px-4 py-2 rounded-lg font-semibold text-white transition-all ${
              isHovered
                ? 'bg-amber-700 hover:bg-amber-800 shadow-lg'
                : 'bg-amber-600'
            }`}
          >
            <svg className="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
