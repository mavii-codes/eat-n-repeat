'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Coffee, Croissant, Heart, UtensilsCrossed } from 'lucide-react';

const bannerSlides = [
  {
    id: '1',
    image: '/eatnrepeat.jpg',
    alt: 'Eat n RepEat Cafe exterior with warm lights and wooden tables',
    tagline: 'YOUR COZY HANGOUT',
    title: 'Eat n RepEat',
    subtitle: 'Cafe & Bar',
    badge: 'CHILL VIBES',
    cta: 'Order Now',
  },
  {
    id: '2',
    image: '/eatnrepeatburger.jpg',
    alt: 'Loaded egg sandwich with signature sauce and herbs',
    tagline: 'HEARTY & DELICIOUS',
    title: 'Signature Sandwiches',
    subtitle: 'Made Fresh Daily',
    badge: 'MUST TRY',
    cta: 'View Menu',
  },
  {
    id: '3',
    image: '/drinks.jpg',
    alt: 'Iced chocolate frappe topped with whipped cream and cookies',
    tagline: 'RICH & INDULGENT',
    title: 'Decadent Frappes',
    subtitle: 'Perfectly Blended',
    badge: 'SWEET TREAT',
    cta: 'Order Express',
  },
];

type HeroCarouselProps = {
  onSelectCategory?: (category: string) => void;
  onOrderNow?: () => void;
};

export function HeroCarousel({ onSelectCategory, onOrderNow }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

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
    <div className="relative overflow-hidden rounded-2xl sm:rounded-[2.5rem] bg-[#FDF5EB] border border-[#F5E2CE] shadow-lg w-full max-w-full">
      <div className="relative w-full flex flex-col md:flex-row items-stretch justify-between">
        
        {/* Left Content Column */}
        <div className="w-full md:w-1/2 p-4 sm:p-8 lg:p-12 z-10 flex flex-col justify-between">
          {/* Top Tagline with doodles */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-black text-[#8C6D58] uppercase tracking-widest bg-[#FFF0E0] px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full border border-[#F7D8BA]">
              <span>{slide.tagline}</span>
            </div>

            {/* Main Brand Title */}
            <div className="pt-2">
              <h1 className="text-xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-[#451a03] tracking-tight leading-snug sm:leading-none break-words" style={{ fontFamily: 'Georgia, serif' }}>
                {slide.title}
              </h1>
              <div className="flex items-center gap-2 sm:gap-3 mt-1 flex-wrap">
                <span className="h-[2px] w-5 sm:w-8 bg-amber-800/40 rounded-full" />
                <span
                  className="text-base sm:text-2xl md:text-3xl text-[#B91C1C] font-semibold italic"
                  style={{ fontFamily: 'var(--font-pacifico, cursive)' }}
                >
                  — {slide.subtitle} —
                </span>
                <span className="h-[2px] w-5 sm:w-8 bg-amber-800/40 rounded-full" />
              </div>
            </div>

            {/* Badge Banner */}
            <div className="pt-2 sm:pt-3">
              <div className="inline-block bg-gradient-to-r from-[#B91C1C] to-[#EF4444] text-white font-extrabold text-[11px] sm:text-sm md:text-base px-3.5 py-1 sm:px-6 sm:py-2 rounded-xl shadow-md tracking-wider uppercase transform -rotate-1">
                {slide.badge}
              </div>
            </div>

            {/* CTA button */}
            <div className="pt-3 sm:pt-4">
              <button
                type="button"
                onClick={handleCtaClick}
                className="inline-flex items-center gap-2 px-5 py-2.5 sm:px-8 sm:py-3.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white rounded-full font-black text-xs sm:text-base shadow-xl shadow-red-500/35 transition-all hover:scale-105 active:scale-95 border-2 border-white/40 group"
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

          {/* Bottom Indicators */}
          <div className="pt-4 sm:pt-8 flex items-center justify-end border-t border-[#F7E5D3] mt-4 sm:mt-6 gap-2">

            {/* Carousel Dots */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {bannerSlides.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`transition-all duration-300 rounded-full ${
                    idx === currentIndex
                      ? 'w-6 sm:w-7 h-2 sm:h-2.5 bg-[#B91C1C]'
                      : 'w-2 sm:w-2.5 h-2 sm:h-2.5 bg-stone-300 hover:bg-stone-400'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right Food Showcase Photo (Matches Screenshot) */}
        <div className="w-full md:w-1/2 h-[190px] sm:h-[300px] md:h-[440px] relative overflow-hidden rounded-b-2xl md:rounded-b-none md:rounded-r-[2.5rem] shrink-0">
          {bannerSlides.map((s, idx) => (
            <div
              key={s.id}
              className={`absolute inset-0 transition-opacity duration-700 ${
                idx === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
            >
              <img
                src={failedImages[s.id] ? 'https://images.unsplash.com/photo-1541180464527-0245efded371?w=1200&auto=format&fit=crop' : s.image}
                alt={s.alt}
                className="absolute inset-0 w-full h-full object-cover object-center"
                onError={() => setFailedImages((prev) => ({ ...prev, [s.id]: true }))}
              />
              {/* Soft overlay gradient for perfect blend */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#FDF5EB] via-transparent to-transparent hidden md:block opacity-60" />
            </div>
          ))}

          {/* Daily! Sticker badge overlay (Matches screenshot) */}
          <div className="absolute top-3 right-3 sm:top-6 sm:right-6 z-20 bg-[#FFF8F0]/90 backdrop-blur-md px-2.5 py-0.5 sm:px-3.5 sm:py-1.5 rounded-full border border-amber-200 shadow-md transform rotate-6">
            <span className="text-[10px] sm:text-xs font-black text-[#451a03] tracking-wide" style={{ fontFamily: 'var(--font-pacifico, cursive)' }}>
              Daily!
            </span>
          </div>

          {/* EAT WELL Orange Stamp Seal (Matches screenshot bottom right) */}
          <div className="absolute bottom-3 right-3 sm:bottom-6 sm:right-6 z-20 w-11 h-11 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-amber-500 to-[#B91C1C] text-white flex flex-col items-center justify-center shadow-lg border-2 border-white text-center leading-none transform -rotate-12">
            <span className="text-[7px] sm:text-[9px] font-black uppercase tracking-tighter">EAT</span>
            <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-tighter">WELL</span>
          </div>
        </div>

      </div>
    </div>
  );
}

