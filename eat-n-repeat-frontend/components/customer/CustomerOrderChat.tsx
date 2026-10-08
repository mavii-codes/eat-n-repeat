"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, X, Loader2, Check } from "lucide-react";
import { useSession } from "next-auth/react";
import { getApiUrl } from "@/lib/config-shared";
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openRef = useRef(isOpen);
  openRef.current = isOpen;
  // Session is stable per login; capture the token once per open session so
  // re-renders can never retrigger the connection effect below.
  const sessionToken = ((session as any)?.accessToken as string | undefined) ?? null;
  const sessionTokenRef = useRef<string | null>(null);

  // Single SSE connection per open session. Refs (not state) track the
  // connection so state updates can never retrigger the effect loop.
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    sessionTokenRef.current = sessionToken;

    const closeConnection = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (!cancelled) setIsConnected(false);
    };

    const loadMessages = async () => {
      const token = sessionTokenRef.current;
      if (!token) {
        if (!cancelled) {
          setLoadError("Please sign in to view this conversation.");
          setIsLoading(false);
        }
        return;
      }
      try {
        setIsLoading(true);
        setLoadError(null);
        const response = await fetch(
          `${getApiUrl()}/api/order-chat/${encodeURIComponent(orderId)}/messages`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await response.json().catch(() => null);
        if (!cancelled) {
          if (response.ok && data?.success && Array.isArray(data.messages)) {
            setMessages(data.messages);
          } else {
            setLoadError(data?.message || "Could not load messages.");
          }
        }
      } catch (error) {
        console.error("Failed to load chat messages:", error);
        if (!cancelled) setLoadError("Could not reach the server.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    const connectSSE = () => {
      const token = sessionTokenRef.current;
      if (!token || !openRef.current || eventSourceRef.current) return;
      const es = new EventSource(
        `/api/events/order-chat/${encodeURIComponent(orderId)}/stream?token=${encodeURIComponent(token)}`
      );
      eventSourceRef.current = es;

      es.onopen = () => {
        if (!cancelled) setIsConnected(true);
      };
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.type === "NEW_MESSAGE" && data.message) {
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
        if (cancelled) return;
        setIsConnected(false);
        eventSourceRef.current = null;
        if (!reconnectTimerRef.current && openRef.current) {
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            connectSSE();
          }, 5000);
        }
      };
    };

    const markRead = () => {
      const token = sessionTokenRef.current;
      if (!token) return;
      fetch(`${getApiUrl()}/api/order-chat/${encodeURIComponent(orderId)}/messages/read`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }).catch((error) => console.error("Failed to mark messages as read:", error));
    };

    setMessages([]);
    setInputMessage("");
    setLoadError(null);
    loadMessages();
    connectSSE();
    markRead();

    return () => {
      cancelled = true;
      closeConnection();
      setMessages([]);
    };
  }, [isOpen, orderId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!inputMessage.trim() || isSending) return;
    const token = sessionTokenRef.current;
    if (!token) {
      setLoadError("Please sign in to send messages.");
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch(
        `${getApiUrl()}/api/order-chat/${encodeURIComponent(orderId)}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ message: inputMessage.trim() }),
        }
      );
      const data = await response.json().catch(() => null);
      if (response.ok && data?.success && data.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        setInputMessage("");
      } else {
        alert(data?.message || "Failed to send message");
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

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
            ) : loadError && messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-stone-500">
                <MessageSquare className="w-10 h-10 text-stone-300 mb-2" />
                <p className="font-medium text-stone-700">Chat unavailable</p>
                <p className="text-xs text-stone-500 mt-1">{loadError}</p>
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
                disabled={isSending}
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isSending}
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
