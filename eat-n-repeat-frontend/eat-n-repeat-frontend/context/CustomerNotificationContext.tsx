// @ts-nocheck
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAdminData } from '@/context/AdminDataContext';
import { useSession } from 'next-auth/react';
import { CheckCircle2, ChefHat, Truck, Package, XCircle, Megaphone, Bell } from 'lucide-react';
import React from 'react';
import { getApiUrl } from "@/lib/config";


export type NotificationCategory = 'order' | 'account' | 'general';

export type CustomerNotification = {
  id: string;
  type: NotificationCategory;
  title: string;
  description: string;
  is_read: boolean;
  created_at: string;
  icon?: React.ReactNode;
};

const API_BASE = `${getApiUrl()}/api`;

type CustomerNotificationContextValue = {
  notifications: CustomerNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;
  addNotification: (
    title: string,
    description: string,
    type?: NotificationCategory
  ) => void;
};

const CustomerNotificationContext =
  createContext<CustomerNotificationContextValue | null>(null);

function getIconForTitle(title: string, type: NotificationCategory): React.ReactNode {
  const iconProps = { className: "w-5 h-5" };
  if (title.includes('Confirmed')) return <CheckCircle2 {...iconProps} />;
  if (title.includes('Preparing')) return <ChefHat {...iconProps} />;
  if (title.includes('Out for Delivery')) return <Truck {...iconProps} />;
  if (title.includes('Delivered')) return <Package {...iconProps} />;
  if (title.includes('Cancelled')) return <XCircle {...iconProps} />;
  if (type === 'promo' || type === 'general') return <Megaphone {...iconProps} />;
  return <Bell {...iconProps} />;
}

export function CustomerNotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const accessToken = (session as any)?.accessToken as string | undefined;
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const { deliveryOrders } = useAdminData();
  const [prevOrderStatusMap, setPrevOrderStatusMap] = useState<Record<string, string>>({});

  const fetchNotifications = useCallback(async () => {
    if (!userId || !accessToken) {
      setNotifications([]);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/customer-notifications`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.map((n: any) => ({ ...n, icon: getIconForTitle(n.title, n.type) })));
      }
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    }
  }, [userId, accessToken]);

  // Fetch on mount / auth state change
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Automated notification generator whenever Admin updates delivery order status locally
  useEffect(() => {
    if (!deliveryOrders || deliveryOrders.length === 0 || !userId) return;

    const newStatusMap: Record<string, string> = {};
    let hasNewNote = false;

    deliveryOrders.forEach((o) => {
      newStatusMap[o.id] = o.status;
      const prevStatus = prevOrderStatusMap[o.id];

      if (prevStatus && prevStatus !== o.status) {
        let title = '';
        let message = '';

        switch (o.status) {
          case 'assigned':
            title = 'Order Confirmed';
            message = `Order #${o.orderNumber} assigned by kitchen. Preparation starting!`;
            break;
          case 'preparing':
            title = 'Kitchen Preparing Order';
            message = `Chefs are handcrafting your meal for Order #${o.orderNumber}.`;
            break;
          case 'out_for_delivery':
            title = 'Out for Delivery';
            message = `Rider is on the way with your Order #${o.orderNumber}!`;
            break;
          case 'delivered':
            title = 'Order Delivered';
            message = `Order #${o.orderNumber} delivered to ${o.address || 'your address'}. Enjoy!`;
            break;
          case 'cancelled':
            title = 'Order Cancelled';
            message = `Order #${o.orderNumber} has been cancelled.`;
            break;
          default:
            title = 'Order Update';
            message = `Order #${o.orderNumber} status changed to ${o.status}.`;
        }

        // Fire and forget POST to DB
        fetch(`${API_BASE}/customer-notifications`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ type: 'order', title, description: message })
        }).then(() => {
          hasNewNote = true;
        });
      }
    });

    setPrevOrderStatusMap(newStatusMap);

    if (hasNewNote) {
      // Re-fetch after a slight delay to allow DB insert
      setTimeout(fetchNotifications, 500);
    }
  }, [deliveryOrders, userId, fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    if (!userId || !accessToken) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    try {
      await fetch(`${API_BASE}/customer-notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
    } catch {}
  }, [userId, accessToken]);

  const markAllAsRead = useCallback(async () => {
    if (!userId || !accessToken) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await fetch(`${API_BASE}/customer-notifications/read-all`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
    } catch {}
  }, [userId, accessToken]);

  const deleteNotification = useCallback(async (id: string) => {
    if (!userId || !accessToken) return;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await fetch(`${API_BASE}/customer-notifications/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
    } catch {}
  }, [userId, accessToken]);

  const clearAll = useCallback(async () => {
    if (!userId || !accessToken) return;
    setNotifications([]);
    try {
      await fetch(`${API_BASE}/customer-notifications/clear-all`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
    } catch {}
  }, [userId, accessToken]);

  const addNotification = useCallback(
    async (
      title: string,
      description: string,
      type: NotificationCategory = 'general'
    ) => {
      if (!userId || !accessToken) return;
      try {
        await fetch(`${API_BASE}/customer-notifications`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ type, title, description })
        });
        fetchNotifications();
      } catch {}
    },
    [userId, accessToken, fetchNotifications]
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      clearAll,
      addNotification,
    }),
    [
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      clearAll,
      addNotification,
    ]
  );

  return (
    <CustomerNotificationContext.Provider value={value}>
      {children}
    </CustomerNotificationContext.Provider>
  );
}

export function useCustomerNotifications() {
  const ctx = useContext(CustomerNotificationContext);
  if (!ctx) {
    throw new Error(
      'useCustomerNotifications must be used within a CustomerNotificationProvider'
    );
  }
  return ctx;
}
