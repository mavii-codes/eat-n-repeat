"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MessageSquare, Send, X, Loader2, Check, Wifi, WifiOff } from "lucide-react";
import { useSession } from "next-auth/react";
import { getApiUrl } from "@/lib/config";
import { CustomerMessageList } from "./CustomerMessageList";

type ChatMessage = {
  id: string;
  orderId: string;
  senderId: string;
  senderRole: "customer" | "staff";
  message: string;
  isRead: boolean;
  createdAt: string;
};

type CustomerOrderChatProps = {
  orderId: string;
  orderNumber: string;
  isOpen: boolean;
  onClose: () => void;
};

function formatTime(isoString: string): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export function CustomerOrderChat({ orderId, orderNumber, isOpen, onClose }: CustomerOrderChatProps) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadMessages = useCallback(async () => {
    if (!session?.user) return;
    try {
      setIsLoading(true);
      const { getApiUrl } = await import("@/lib/config");
      const accessToken = (session as any)?.accessToken as string | undefined;
      const response = await fetch(`${getApiUrl()}/api/order-chat/${orderId}/messages`, {
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.messages) {
          setMessages(data.messages);
        }
      }
    } catch (error) {
      console.error("Failed to load chat messages:", error);
    } finally {
      setIsLoading(false);
    }
  }, [orderId, session]);

  const connectSSE = useCallback(() => {
    if (!session?.user) return;
    const { getApiUrl } = require("@/lib/config");
    const accessToken = (session as any)?.accessToken as string | undefined;
    const url = `${getApiUrl()}/api/events/order-chat/${orderId}/stream${accessToken ? `?token=${accessToken}` : ""}`;
    
    const es = new EventSource(url);
    setEventSource(es);

    es.onopen = () => {
      setIsConnected(true);
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "NEW_MESSAGE" && data.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        }
      } catch (error) {
        console.error("Failed to parse SSE message:", error);
      }
    };

    es.onerror = () => {
      setIsConnected(false);
      // Auto-reconnect after 5 seconds
      setTimeout(() => {
        if (isOpen) connectSSE();
      }, 5000);
    };

    setEventSource(es);
  }, [orderId, session, isOpen]);

  // Load messages and connect SSE when chat opens
  useEffect(() => {
    if (isOpen) {
      loadMessages();
      connectSSE();
    } else {
      if (eventSource) {
        eventSource.close();
        setEventSource(null);
      }
      setIsConnected(false);
    }
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [isOpen, loadMessages, connectSSE, eventSource]);

  // Mark messages as read when chat opens
  useEffect(() => {
    if (isOpen && session?.user) {
      const { getApiUrl } = require("@/lib/config");
      const accessToken = (session as any)?.accessToken as string | undefined;
      fetch(`${getApiUrl()}/api/order-chat/${orderId}/messages/read`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      }).catch(console.error);
    }
  }, [isOpen, orderId, session]);

  const handleSend = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isSending || !session?.user) return;

    setIsSending(true);
    try {
      const { getApiUrl } = await import("@/lib/config");
      const accessToken = (session as any)?.accessToken as string | undefined;
      const response = await fetch(`${getApiUrl()}/api/order-chat/${orderId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ message: inputMessage }),
      });
      if (response.ok) {
        setInputMessage("");
      } else {
        const data = await response.json().catch(() => ({}));
        alert(data.message || "Failed to send message");
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  }, [orderId, session, isSending]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <>
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity animate-fade-in ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      >
        <div
          className="pointer-events-auto w-full max-w-md bg-white rounded-3xl shadow-2xl flex flex-col animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#B91C1C] to-[#D97706] text-white px-4 py-3 rounded-t-3xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              <div>
                <h3 className="font-bold text-sm">Delivery Chat</h3>
                <p className="text-[10px] text-amber-100">Order #{orderNumber}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`flex items-center gap-1 text-[10px] font-medium ${isConnected ? "text-emerald-300" : "text-amber-300"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                {isConnected ? "Connected" : "Connecting..."}
              </span>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
                aria-label="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[400px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-[#B91C1C] animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-stone-500">
                <MessageSquare className="w-10 h-10 text-stone-300 mb-2" />
                <p className="font-medium text-stone-700">No messages yet</p>
                <p className="text-xs text-stone-500 mt-1">Start the conversation with your delivery rider</p>
              </div>
            ) : (
              <CustomerMessageList messages={messages} formatTime={formatTime} />
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-4 border-t border-amber-200/50 bg-white rounded-b-3xl">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2.5 bg-stone-50 border border-amber-200 rounded-xl text-sm text-stone-900 focus:outline-none focus:border-[#B91C1C] focus:ring-1 focus:ring-[#B91C1C] placeholder:text-stone-400"
                disabled={isSending || !isConnected}
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isSending || !isConnected}
                className="w-10 h-10 rounded-xl bg-[#B91C1C] hover:bg-[#991B1B] disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center justify-center transition shadow-sm"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
