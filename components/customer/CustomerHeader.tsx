'use client';

import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';

type CustomerHeaderProps = {
  title?: string;
  subtitle?: string;
};

export function CustomerHeader({ title, subtitle }: CustomerHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-amber-100/20 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4">
          {/* Logo */}
          <Link href="/customer" className="flex items-center gap-2 hover:opacity-80 transition">
            <Logo size="sm" showText={false} />
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-amber-900">Eat n' RepEat</p>
              <p className="text-xs text-amber-700">Warm Bites, Better Coffee</p>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <Link 
              href="/customer/menu" 
              className="text-amber-900 hover:text-amber-700 font-medium transition relative group"
            >
              Menu
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-amber-700 group-hover:w-full transition-all"></span>
            </Link>
            <Link 
              href="/customer/orders" 
              className="text-amber-900 hover:text-amber-700 font-medium transition relative group"
            >
              Orders
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-amber-700 group-hover:w-full transition-all"></span>
            </Link>
            <Link 
              href="/customer/favorites" 
              className="text-amber-900 hover:text-amber-700 font-medium transition relative group"
            >
              Favorites
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-amber-700 group-hover:w-full transition-all"></span>
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3 md:gap-4">
            <button className="relative p-2 text-amber-900 hover:bg-amber-100 rounded-full transition">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            <button className="p-2 text-amber-900 hover:bg-amber-100 rounded-full transition">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="absolute top-1 right-1 w-2 h-2 bg-amber-700 rounded-full text-xs flex items-center justify-center text-white text-xs"></span>
            </button>

            <Link 
              href="/customer/profile" 
              className="hidden sm:inline-block px-6 py-2 bg-amber-700 text-white rounded-full hover:bg-amber-800 transition font-semibold text-sm"
            >
              Profile
            </Link>
          </div>
        </div>

        {/* Title Section */}
        {title && (
          <div className="pb-6 border-t border-amber-100/20 mt-4 pt-4">
            <h1 className="text-3xl font-bold text-amber-950">{title}</h1>
            {subtitle && <p className="text-amber-900/70 mt-1">{subtitle}</p>}
          </div>
        )}
      </div>
    </header>
  );
}
