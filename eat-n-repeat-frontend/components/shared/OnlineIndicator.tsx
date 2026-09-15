'use client';

import { useEffect, useState } from 'react';
import { useLocalMode } from '@/lib/customer/useLocalMode';
import { useNetworkStatus } from '@/context/NetworkStatusContext';

export function OnlineIndicator() {
  const { isOffline } = useNetworkStatus();
  const isLocalMode = useLocalMode();
  const isOnline = !isOffline;
  // Two-pass render: server HTML and the client's first render must be
  // IDENTICAL or hydration crashes (a client-only initial value renders a
  // different tree — amber vs emerald — and React bails out). The real badge
  // appears one frame after mount; a dead-effects tab honestly shows the
  // neutral placeholder instead of a lying Online pill.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className="fixed bottom-4 left-4 sm:top-4 sm:right-4 sm:bottom-auto sm:left-auto z-50 flex items-center gap-2 rounded-full border px-3 py-1.5 backdrop-blur-sm pointer-events-auto shadow-md transition-all duration-200 bg-stone-50 border-stone-200/80 text-stone-500"
        role="status"
        aria-label="Checking connection status"
      >
        <span className="h-2 w-2 rounded-full bg-stone-400 animate-pulse" />
        <span className="text-[11px] font-bold uppercase tracking-wider">
          Connecting
        </span>
      </div>
    );
  }

  // In Local Mode, we prioritize displaying "LOCAL CAFÉ" regardless of internet connection.
  // suppressHydrationWarning: the hook initializes from the URL synchronously
  // on the client (SSR has no window), so first render may legitimately differ.
  if (isLocalMode) {
    return (
      <div
        className="fixed bottom-4 left-4 sm:top-4 sm:right-4 sm:bottom-auto sm:left-auto z-50 flex items-center gap-2 rounded-full border px-3 py-1.5 backdrop-blur-sm pointer-events-auto shadow-md transition-all duration-200 bg-amber-50 border-amber-200/80 text-amber-800"
        role="status"
        aria-label="Connected to café local network — Local Café Mode"
      >
        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-[11px] font-bold uppercase tracking-wider" suppressHydrationWarning>
          Local Café Mode
        </span>
      </div>
    );
  }

  return (
    <div
      className={`fixed bottom-4 left-4 sm:top-4 sm:right-4 sm:bottom-auto sm:left-auto z-50 flex items-center gap-2 rounded-full border px-3 py-1.5 backdrop-blur-sm pointer-events-auto shadow-md transition-all duration-200 ${
        isOnline
          ? 'bg-emerald-50 border-emerald-200/80 text-emerald-800'
          : 'bg-red-50 border-red-200/80 text-red-800'
      }`}
      role="status"
      aria-label={isOnline ? 'You are online' : 'You are offline'}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
        }`}
      />
      <span className="text-[11px] font-black uppercase tracking-wider" suppressHydrationWarning>
        {isOnline ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}

