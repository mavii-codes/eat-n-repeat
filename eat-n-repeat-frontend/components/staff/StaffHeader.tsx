'use client';

import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';

type StaffHeaderProps = {
  title?: string;
  subtitle?: string;
};

export function StaffHeader({ title, subtitle }: StaffHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-linear-to-r from-gray-900 via-gray-800 to-gray-900 border-b border-white/10 shadow-lg backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4">
          {/* Logo */}
          <Link
            href="/staff"
            className="flex items-center gap-2 hover:opacity-80 transition"
          >
            <Logo size="sm" showText={false} />
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-white">Eat n' RepEat</p>
              <p className="text-xs text-white/70">Staff Portal</p>
            </div>
          </Link>
        </div>

        {/* Title Section */}
        {title && (
          <div className="pb-6 border-t border-white/10 mt-4 pt-4">
            <h1 className="text-3xl font-bold text-white">{title}</h1>
            {subtitle && <p className="text-white/70 mt-1">{subtitle}</p>}
          </div>
        )}
      </div>
    </header>
  );
}
