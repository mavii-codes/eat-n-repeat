'use client';

import Image from 'next/image';
import { Plus, Check } from 'lucide-react';
import { resolveMenuImage } from '@/lib/menu-image';

export type AddonCardItem = {
  id: string;
  name: string;
  price: number;
  image?: string | null;
  available?: boolean;
};

type AddonCardsProps = {
  addons: AddonCardItem[];
  selected: { name: string }[];
  onToggle: (addon: AddonCardItem) => void;
};

/**
 * Compact horizontal add-on strip (recommendation-style): photo, name,
 * price, and a green circular + button. Desktop shows a row; mobile
 * swipe-scrolls. Selection state is owned by the caller (details modal),
 * so totals, cart lines, checkout, and staff views reuse existing paths.
 */
export function AddonCards({ addons, selected, onToggle }: AddonCardsProps) {
  const visible = (addons ?? []).filter((a) => a && a.name && a.available !== false);
  if (visible.length === 0) return null;

  return (
    <div
      className="flex gap-2.5 overflow-x-auto pb-1.5 -mx-0.5 px-0.5 snap-x"
      role="group"
      aria-label="Add-ons"
    >
      {visible.map((addon) => {
        const isSelected = selected.some((s) => s.name === addon.name);
        return (
          <div
            key={addon.id ?? addon.name}
            className={`snap-start shrink-0 w-[104px] rounded-2xl border bg-white p-2 flex flex-col items-center text-center transition shadow-2xs ${
              isSelected
                ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                : 'border-stone-200 hover:border-amber-300'
            }`}
          >
            <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-stone-100 shrink-0">
              <Image
                src={resolveMenuImage(addon.image)}
                alt={addon.name}
                fill
                sizes="64px"
                className="object-cover"
                unoptimized={typeof addon.image === 'string' && addon.image.startsWith('data:')}
              />
            </div>
            <p className="mt-1.5 text-[11px] font-bold text-stone-800 leading-tight line-clamp-2 min-h-[28px]">
              {addon.name}
            </p>
            <p className="text-[11px] font-black text-[#B91C1C]">
              ₱{Number(addon.price).toFixed(2)}
            </p>
            <button
              type="button"
              onClick={() => onToggle(addon)}
              aria-pressed={isSelected}
              aria-label={isSelected ? `Remove ${addon.name}` : `Add ${addon.name}`}
              title={isSelected ? `Remove ${addon.name}` : `Add ${addon.name}`}
              className={`mt-1.5 w-7 h-7 rounded-full flex items-center justify-center text-white shadow-sm transition active:scale-95 ${
                isSelected
                  ? 'bg-emerald-700 hover:bg-emerald-800'
                  : 'bg-emerald-500 hover:bg-emerald-600'
              }`}
            >
              {isSelected ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
        );
      })}
    </div>
  );
}
