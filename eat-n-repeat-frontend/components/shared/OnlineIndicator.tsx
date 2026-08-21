'use client';

import { useNetworkStatus } from '@/context/NetworkStatusContext';

export function OnlineIndicator() {
  const { isOffline } = useNetworkStatus();
  const isOnline = !isOffline;

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
      <span className="text-[11px] font-black uppercase tracking-wider">
        {isOnline ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}

