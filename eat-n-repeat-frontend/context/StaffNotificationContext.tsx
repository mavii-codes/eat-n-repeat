"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/config";


export type StaffNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  related_order_id: string | null;
  is_read: boolean;
  created_at: string;
};

type StaffNotificationContextType = {
  notifications: StaffNotification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
};

const StaffNotificationContext = createContext<StaffNotificationContextType | undefined>(undefined);

export function StaffNotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<StaffNotification[]>([]);

  const refreshNotifications = async () => {
    if (!user || user.role !== "staff") return;

    try {
      const response = await fetch(`${getApiUrl()}/api/staff-notifications`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setNotifications(data.notifications);
        }
      }
    } catch (error) {
      console.error("Failed to fetch staff notifications:", error);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      await fetch(`${getApiUrl()}/api/staff-notifications/${id}/read`, {
        method: "POST"
      });
    } catch (error) {
      console.error("Failed to mark staff notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      await fetch(`${getApiUrl()}/api/staff-notifications/read-all`, {
        method: "POST"
      });
    } catch (error) {
      console.error("Failed to mark all staff notifications as read:", error);
    }
  };

  useEffect(() => {
    if (user?.role === "staff") {
      refreshNotifications();
      const interval = setInterval(refreshNotifications, 15000); // Polling every 15s
      return () => clearInterval(interval);
    }
  }, [user]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <StaffNotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, refreshNotifications }}>
      {children}
    </StaffNotificationContext.Provider>
  );
}

export function useStaffNotifications() {
  const context = useContext(StaffNotificationContext);
  if (context === undefined) {
    throw new Error("useStaffNotifications must be used within a StaffNotificationProvider");
  }
  return context;
}
