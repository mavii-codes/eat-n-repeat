'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

const bannerSlides = [
  {
    id: '1',
    image: '/hero-banner.png',
    alt: 'Eat n RepEat Cafe fresh coffee, pastries, and burger',
    tagline: 'GOOD FOOD GOOD MOOD ♥',
    title: 'Eat n RepEat',
    subtitle: 'Cafe',
    badge: 'FRESH & TASTY',
    cta: 'Order Now',
  },
  {
    id: '2',
    image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1400&auto=format&fit=crop',
    alt: 'Specialty Coffee & Fresh Bakers',
    tagline: 'BREWED FRESH DAILY ☕',
    title: 'Warm Bites & Coffee',
    subtitle: 'Cordova Special',
    badge: 'HANDCRAFTED',
    cta: 'View Menu',
  },
  {
    id: '3',
    image: 'https://images.unsplash.com/photo-1568901346735-0669a840692e?w=1400&auto=format&fit=crop',
    alt: 'Flame Grilled Rice Bowls & Burgers',
    tagline: 'SAVORY & DELICIOUS 🍔',
    title: 'Comfort Favorites',
    subtitle: 'Made to Order',
    badge: 'BESTSELLER',
    cta: 'Order Express',
  },
];

type HeroCarouselProps = {
  onSelectCategory?: (category: string) => void;
  onOrderNow?: () => void;
};

export function HeroCarousel({ onSelectCategory, onOrderNow }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % bannerSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const slide = bannerSlides[currentIndex];

  const handleCtaClick = () => {
    if (onOrderNow) {
      onOrderNow();
    } else if (onSelectCategory) {
      onSelectCategory('All');
    } else {
      const el = document.getElementById('menu-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="relative overflow-hidden rounded-[2.5rem] bg-[#FDF5EB] border border-[#F5E2CE] shadow-lg">
      <div className="relative min-h-[360px] sm:min-h-[420px] lg:min-h-[460px] w-full flex flex-col md:flex-row items-center justify-between">
        
        {/* Left Content Column */}
        <div className="w-full md:w-[48%] p-5 sm:p-10 lg:p-14 z-10 flex flex-col justify-between h-full">
          {/* Top Tagline with doodles */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-black text-[#8C6D58] uppercase tracking-widest bg-[#FFF0E0] px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full border border-[#F7D8BA]">
              <span>{slide.tagline}</span>
            </div>

            {/* Main Brand Title */}
            <div className="pt-2">
              <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-[#451a03] tracking-tight leading-tight sm:leading-none break-words" style={{ fontFamily: 'Georgia, serif' }}>
                {slide.title}
              </h1>
              <div className="flex items-center gap-2 sm:gap-3 mt-1">
                <span className="h-[2px] w-6 sm:w-8 bg-amber-800/40 rounded-full" />
                <span
                  className="text-lg sm:text-2xl md:text-3xl text-[#B91C1C] font-semibold italic"
                  style={{ fontFamily: 'var(--font-pacifico, cursive)' }}
                >
                  — {slide.subtitle} —
                </span>
                <span className="h-[2px] w-6 sm:w-8 bg-amber-800/40 rounded-full" />
              </div>
            </div>

            {/* Badge Banner */}
            <div className="pt-2 sm:pt-3">
              <div className="inline-block bg-gradient-to-r from-[#B91C1C] to-[#EF4444] text-white font-extrabold text-xs sm:text-sm md:text-base px-4 py-1.5 sm:px-6 sm:py-2 rounded-xl shadow-md tracking-wider uppercase transform -rotate-1">
                {slide.badge}
              </div>
            </div>

            {/* CTA button */}
            <div className="pt-3 sm:pt-4">
              <button
                type="button"
                onClick={handleCtaClick}
                className="inline-flex items-center gap-2 px-6 py-3 sm:px-8 sm:py-3.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white rounded-full font-black text-xs sm:text-base shadow-xl shadow-red-500/35 transition-all hover:scale-105 active:scale-95 border-2 border-white/40 group"
              >
                <span>{slide.cta}</span>
                <svg
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white transition-transform group-hover:translate-x-1 duration-200"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>

          {/* Bottom Icons Row & Indicators */}
          <div className="pt-6 sm:pt-8 flex items-center justify-between border-t border-[#F7E5D3] mt-6">
            {/* Feature Quick Icons */}
            <div className="flex items-center gap-3 text-stone-600">
              <div className="w-8 h-8 rounded-full bg-[#FFF1E0] flex items-center justify-center text-sm shadow-2xs">☕</div>
              <div className="w-8 h-8 rounded-full bg-[#FFF1E0] flex items-center justify-center text-sm shadow-2xs">🥐</div>
              <div className="w-8 h-8 rounded-full bg-[#FFF1E0] flex items-center justify-center text-sm shadow-2xs">♥</div>
              <div className="w-8 h-8 rounded-full bg-[#FFF1E0] flex items-center justify-center text-sm shadow-2xs">🍔</div>
            </div>

            {/* Carousel Dots */}
            <div className="flex items-center gap-2">
              {bannerSlides.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`transition-all duration-300 rounded-full ${
                    idx === currentIndex
                      ? 'w-7 h-2.5 bg-[#B91C1C]'
                      : 'w-2.5 h-2.5 bg-stone-300 hover:bg-stone-400'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right Food Showcase Photo (Matches Screenshot) */}
        <div className="w-full md:w-[52%] h-[300px] sm:h-[380px] md:h-[460px] relative overflow-hidden rounded-b-[2.5rem] md:rounded-b-none md:rounded-r-[2.5rem]">
          {bannerSlides.map((s, idx) => (
            <div
              key={s.id}
              className={`absolute inset-0 transition-opacity duration-700 ${
                idx === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
            >
              <Image
                src={s.image}
                alt={s.alt}
                fill
                priority={idx === 0}
                className="object-cover object-center"
                unoptimized
              />
              {/* Soft overlay gradient for perfect blend */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#FDF5EB] via-transparent to-transparent hidden md:block opacity-60" />
            </div>
          ))}

          {/* Daily! Sticker badge overlay (Matches screenshot) */}
          <div className="absolute top-6 right-6 z-20 bg-[#FFF8F0]/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-amber-200 shadow-md transform rotate-6">
            <span className="text-xs font-black text-[#451a03] tracking-wide" style={{ fontFamily: 'var(--font-pacifico, cursive)' }}>
              Daily! ✨
            </span>
          </div>

          {/* EAT WELL Orange Stamp Seal (Matches screenshot bottom right) */}
          <div className="absolute bottom-6 right-6 z-20 w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-[#B91C1C] text-white flex flex-col items-center justify-center shadow-lg border-2 border-white text-center leading-none transform -rotate-12">
            <span className="text-[9px] font-black uppercase tracking-tighter">EAT</span>
            <span className="text-[11px] font-black uppercase tracking-tighter">WELL</span>
          </div>
        </div>

      </div>
    </div>
  );
}

