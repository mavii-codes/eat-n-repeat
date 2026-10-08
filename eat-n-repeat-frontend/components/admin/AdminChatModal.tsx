"use client";

import { useEffect, useRef, useState } from "react";
import { AdminModal } from "./AdminModal";
import { AdminInput } from "./AdminForm";
import { X } from "lucide-react";
import { getApiUrl } from "@/lib/config-shared";
import { MessageList } from "./MessageList";

type Message = {
  id: string;
  orderId: string;
  senderId: string;
  senderRole: "customer" | "staff";
  message: string;
  isRead: boolean;
  createdAt: string;
};

type AdminChatModalProps = {
  open: boolean;
  onClose: () => void;
  customerName: string;
  /** Database order id used for the chat API. */
  orderId: string;
  /** Human-friendly order number shown in the header. Defaults to orderId. */
  orderNumber?: string;
};

function formatTime(isoString: string): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function getStaffToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("eat-n-repeat-admin-token") ||
    localStorage.getItem("eat-n-repeat-staff-token")
  );
}

export function AdminChatModal({ open, onClose, customerName, orderId, orderNumber }: AdminChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const displayOrderNumber = orderNumber ?? orderId;

  // Single SSE connection per open session. Refs (not state) track the
  // connection so state updates can never retrigger the effect loop.
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

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
      const token = getStaffToken();
      if (!token) {
        if (!cancelled) {
          setLoadError("Not signed in as staff. Please log in again.");
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
          } else if (response.status === 404) {
            setLoadError("This order hasn't synced to the server yet, so chat isn't available.");
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
      const token = getStaffToken();
      if (!token || !openRef.current || eventSourceRef.current) return;
      const url =
        `/api/events/order-chat/${encodeURIComponent(orderId)}/stream` +
        `?token=${encodeURIComponent(token)}`;
      const es = new EventSource(url);
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
        // Reconnect once after a pause; the guard above prevents duplicates.
        if (!reconnectTimerRef.current && openRef.current) {
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            connectSSE();
          }, 5000);
        }
      };
    };

    const markRead = () => {
      const token = getStaffToken();
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
  }, [open, orderId]);

  // Scroll chat area to bottom when messages list updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!inputMessage.trim() || isSending) return;
    const token = getStaffToken();
    if (!token) {
      setLoadError("Not signed in as staff. Please log in again.");
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
    <AdminModal
      open={open}
      title={`Chat with ${customerName}`}
      onClose={onClose}
      footer={
        <form onSubmit={handleSend} className="flex w-full items-center gap-2">
          <div className="flex-1">
            <AdminInput
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={`Message ${customerName}...`}
              className="w-full text-ink focus:outline-none"
              disabled={isSending}
            />
          </div>
          <button
            type="submit"
            disabled={!inputMessage.trim() || isSending}
            className="rounded-xl bg-gradient-to-r from-accent to-accent-dark px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
          >
            Send
          </button>
        </form>
      }
    >
      <div className="flex flex-col h-[320px] bg-accent-light/30 rounded-2xl p-4 border border-accent/5">
        <div className="text-center pb-2 mb-2 border-b border-accent/10">
          <p className="text-[10px] uppercase font-bold tracking-widest text-muted">
            Order Ticket: #{displayOrderNumber}
          </p>
          <p className={`text-[10px] font-semibold mt-1 ${isConnected ? "text-emerald-600" : "text-amber-600"}`}>
            {isConnected ? "Connected" : "Connecting..."}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          ) : loadError && messages.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted">
              <p className="font-semibold text-ink">Chat unavailable</p>
              <p className="text-xs mt-1">{loadError}</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted">
              <p className="font-semibold text-ink">No messages yet</p>
              <p className="text-xs mt-1">Start the conversation with {customerName}.</p>
            </div>
          ) : (
            <MessageList messages={messages} customerName={customerName} formatTime={formatTime} />
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </AdminModal>
  );
}
