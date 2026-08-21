"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Check, X, Circle } from "lucide-react";
import { useStaffNotifications } from "@/context/StaffNotificationContext";

export function StaffNotificationPanel({ onNavigateToOrder }: { onNavigateToOrder: (type: string, orderId: string) => void }) {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useStaffNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);
    setIsOpen(false);
    if (notification.related_order_id) {
      onNavigateToOrder(notification.type, notification.related_order_id);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
        title="Staff Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow ring-2 ring-[#500f17]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 z-[100] overflow-hidden flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-4 py-3">
            <h3 className="font-bold text-stone-800">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  markAllAsRead();
                }}
                className="text-xs font-semibold text-accent hover:text-accent-hover transition-colors flex items-center gap-1"
              >
                <Check className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1 p-2 space-y-1">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-stone-500">
                <Bell className="mx-auto h-8 w-8 text-stone-300 mb-2" />
                No notifications yet.
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`relative flex cursor-pointer items-start gap-3 rounded-xl p-3 transition-colors ${
                    !notification.is_read ? "bg-red-50/50 hover:bg-red-50" : "hover:bg-stone-50"
                  }`}
                >
                  {!notification.is_read && (
                    <span className="absolute left-1.5 top-5 h-2 w-2 rounded-full bg-red-500" />
                  )}
                  <div className="flex-1 min-w-0 pl-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm ${!notification.is_read ? "font-bold text-stone-900" : "font-semibold text-stone-700"}`}>
                        {notification.title}
                      </p>
                      <span className="shrink-0 text-[10px] font-medium text-stone-400 whitespace-nowrap mt-0.5">
                        {new Date(notification.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-stone-600 line-clamp-3 whitespace-pre-line leading-relaxed">
                      {notification.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
