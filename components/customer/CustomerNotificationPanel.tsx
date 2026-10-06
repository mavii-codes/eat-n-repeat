// @ts-nocheck
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import {
  useCustomerNotifications,
  type NotificationCategory,
} from '@/context/CustomerNotificationContext';

type TabFilter = 'all' | 'unread' | 'order_update' | 'promo';

type CustomerNotificationPanelProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function CustomerNotificationPanel({
  isOpen,
  onClose,
}: CustomerNotificationPanelProps) {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useCustomerNotifications();

  const [activeFilter, setActiveFilter] = useState<TabFilter>('all');

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (activeFilter === 'unread') return !n.read;
      if (activeFilter === 'order_update') return n.category === 'order_update';
      if (activeFilter === 'promo') return n.category === 'promo';
      return true;
    });
  }, [notifications, activeFilter]);

  if (!isOpen) return null;

  return (
    <div className="absolute top-full right-0 mt-3 z-50 w-80 sm:w-96 bg-[#FFF8F0] rounded-3xl border border-amber-200/90 shadow-2xl overflow-hidden font-sans">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#451a03] to-[#3D1703] p-4 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-400" />
          <h3 className="font-black text-sm tracking-tight">Notification Center</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-[#B91C1C] text-white text-[10px] font-black">
              {unreadCount} new
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="text-[11px] font-bold text-amber-300 hover:text-amber-100 transition"
              title="Mark all as read"
            >
              Check all
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
            aria-label="Close"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-2 bg-amber-100/60 border-b border-amber-200/60 overflow-x-auto no-scrollbar">
        {[
          { key: 'all', label: `All (${notifications.length})` },
          { key: 'unread', label: `Unread (${unreadCount})` },
          { key: 'order_update', label: 'Orders' },
          { key: 'promo', label: 'Promos' },
        ].map((tab) => {
          const isActive = activeFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveFilter(tab.key as TabFilter)}
              className={`px-3 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-[#B91C1C] text-white shadow-2xs'
                  : 'bg-white/80 text-stone-700 hover:bg-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Notifications Scroll List */}
      <div className="max-h-96 overflow-y-auto divide-y divide-amber-200/50 p-2 space-y-1">
        {filteredNotifications.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-3xl mb-2">🔕</div>
            <p className="text-xs font-bold text-stone-600">No notifications here</p>
            <p className="text-[11px] text-stone-400 mt-0.5">
              {activeFilter === 'unread'
                ? 'You are all caught up!'
                : 'Check back later for order updates and promo deals.'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((note) => (
            <div
              key={note.id}
              onClick={() => markAsRead(note.id)}
              className={`group relative p-3 rounded-2xl transition-all cursor-pointer border ${
                note.read
                  ? 'bg-white/60 border-stone-200/60 opacity-80 hover:opacity-100 hover:bg-white'
                  : 'bg-white border-amber-300 shadow-2xs hover:shadow-xs'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Icon Circle */}
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center text-base shrink-0 shadow-2xs ${
                    note.category === 'promo'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-[#451a03]'
                  }`}
                >
                  {note.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <h4 className="text-xs font-black text-[#451a03] truncate">
                      {note.title}
                    </h4>
                    {!note.read && (
                      <span className="w-2 h-2 rounded-full bg-[#B91C1C] shrink-0" title="Unread" />
                    )}
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed line-clamp-2 font-medium">
                    {note.message}
                  </p>
                  <div className="flex items-center justify-between mt-1.5 text-[10px]">
                    <span className="text-stone-400 font-bold">{note.timestamp}</span>
                    {note.orderId && (
                      <Link
                        href="/customer/orders"
                        onClick={onClose}
                        className="text-[#B91C1C] font-extrabold hover:underline"
                      >
                        Track Order &rarr;
                      </Link>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(note.id);
                    }}
                    className="p-1 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition"
                    title="Delete notification"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Clear Bar */}
      {notifications.length > 0 && (
        <div className="p-2.5 bg-amber-50 border-t border-amber-200/60 flex items-center justify-between text-[11px]">
          <span className="text-stone-500 font-semibold">
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={clearAll}
            className="text-stone-500 hover:text-rose-600 font-bold transition"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
