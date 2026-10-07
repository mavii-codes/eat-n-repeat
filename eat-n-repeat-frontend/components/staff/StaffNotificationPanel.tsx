"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Check, Circle, AlertCircle, Package, Bike, Utensils, ShoppingBag, CreditCard, AlertTriangle } from "lucide-react";
import { useStaffNotifications } from "@/context/StaffNotificationContext";

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function getNotificationIcon(type: string): React.ReactNode {
  switch (type) {
    case "delivery":
      return <Bike className="h-4 w-4 text-blue-500" />;
    case "dine-in":
      return <Utensils className="h-4 w-4 text-amber-500" />;
    case "pickup":
    case "takeout":
      return <ShoppingBag className="h-4 w-4 text-green-500" />;
    case "payment":
      return <CreditCard className="h-4 w-4 text-emerald-500" />;
    case "stock":
    case "low_stock":
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    default:
      return <Package className="h-4 w-4 text-stone-500" />;
  }
}

export function StaffNotificationPanel({ 
  onNavigateToOrder,
  theme = "light"
}: { 
  onNavigateToOrder: (type: string, orderId: string) => void;
  theme?: "dark" | "light";
}) {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useStaffNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

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

  const handleMarkAllRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    markAllAsRead();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={bellRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-xl transition-colors cursor-pointer ${
          theme === "dark" 
            ? "bg-white/10 text-white hover:bg-white/20" 
            : "bg-stone-100 text-stone-700 hover:bg-stone-200"
        }`}
        title="Staff Notifications"
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "No unread notifications"}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className={`absolute -top-1 -right-1 flex h-5 w-5 min-w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow ring-2 ${
            theme === "dark" ? "ring-[#500f17]" : "ring-white"
          }`}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 z-[100] overflow-hidden flex flex-col max-h-[480px]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-4 py-3">
            <h3 className="font-bold text-stone-800">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
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
                <p className="font-medium text-stone-700">No notifications</p>
                <p className="text-xs text-stone-500 mt-0.5">You're all caught up.</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const icon = getNotificationIcon(notification.type);
                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`relative flex cursor-pointer items-start gap-3 rounded-xl p-3 transition-colors ${
                      !notification.is_read ? "bg-red-50/50 hover:bg-red-50" : "hover:bg-stone-50"
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {icon}
                    </div>
                    {!notification.is_read && (
                      <span className="absolute top-3 right-2.5 h-2 w-2 rounded-full bg-red-500" />
                    )}
                    <div className="flex-1 min-w-0 pl-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm ${!notification.is_read ? "font-bold text-stone-900" : "font-semibold text-stone-700"}`}>
                          {notification.title}
                        </p>
                        <span className="shrink-0 text-[10px] font-medium text-stone-400 whitespace-nowrap mt-0.5">
                          {formatTime(notification.created_at)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-stone-600 line-clamp-3 whitespace-pre-line leading-relaxed">
                        {notification.message}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
