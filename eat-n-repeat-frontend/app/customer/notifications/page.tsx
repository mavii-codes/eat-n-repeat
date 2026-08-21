'use client';

import { CustomerHeader } from '@/components/customer/CustomerHeader';
import { useCustomerNotifications } from '@/context/CustomerNotificationContext';
import { Trash2, CheckCircle2, Bell, MailOpen } from 'lucide-react';

export default function NotificationsPage() {
  const { notifications, markAsRead, markAllAsRead, deleteNotification, clearAll } = useCustomerNotifications();

  return (
    <div className="min-h-screen bg-[#FFF8F0]">
      <CustomerHeader title="Notifications" subtitle="Stay updated with your orders" />
      
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[#451a03]">Recent Notifications</h2>
          
          <div className="flex gap-4">
            {notifications.some(n => !n.is_read) && (
              <button 
                onClick={markAllAsRead}
                className="text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark all as read
              </button>
            )}
            {notifications.length > 0 && (
              <button 
                onClick={clearAll}
                className="text-xs font-bold text-red-600 hover:text-red-800 flex items-center gap-1 transition"
              >
                <Trash2 className="w-4 h-4" />
                Clear all
              </button>
            )}
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-amber-200 shadow-sm">
            <div className="mb-4"><MailOpen className="w-10 h-10 text-stone-400 mx-auto" /></div>
            <h3 className="text-lg font-bold text-stone-800">No Notifications</h3>
            <p className="text-sm text-stone-500 mt-1">You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((note) => (
              <div 
                key={note.id}
                className={`p-5 rounded-2xl border transition-all ${
                  note.is_read 
                    ? 'bg-white border-stone-200 opacity-75' 
                    : 'bg-amber-50 border-amber-300 shadow-md ring-1 ring-amber-300'
                }`}
              >
                <div className="flex gap-4">
                  <div className="shrink-0 mt-1"><Bell className="w-5 h-5 text-amber-600" /></div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className={`text-sm ${note.is_read ? 'font-semibold text-stone-700' : 'font-extrabold text-[#451a03]'}`}>
                        {note.title}
                      </h4>
                      <span className="text-[10px] text-stone-400 font-medium whitespace-nowrap ml-4">
                        {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className={`text-xs leading-relaxed ${note.is_read ? 'text-stone-500' : 'text-stone-800 font-medium'}`}>
                      {note.description}
                    </p>
                    
                    <div className="flex gap-3 mt-3">
                      {!note.is_read && (
                        <button 
                          onClick={() => markAsRead(note.id)}
                          className="text-[11px] font-bold text-amber-700 hover:text-amber-900 transition"
                        >
                          Mark as read
                        </button>
                      )}
                      <button 
                        onClick={() => deleteNotification(note.id)}
                        className="text-[11px] font-bold text-red-600 hover:text-red-800 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
