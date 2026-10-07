"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";

type ChatMessage = {
  id: string;
  orderId: string;
  senderId: string;
  senderRole: "customer" | "staff";
  message: string;
  isRead: boolean;
  createdAt: string;
};

type CustomerMessageListProps = {
  messages: ChatMessage[];
  formatTime: (isoString: string) => string;
};

export function CustomerMessageList({ messages, formatTime }: CustomerMessageListProps) {
  const renderedMessages = useMemo(() => {
    return messages.map((msg) => {
      const isCustomer = msg.senderRole === "customer";
      const alignmentClass = isCustomer ? "ml-auto items-end" : "mr-auto items-start";
      const bubbleClass = isCustomer
        ? "bg-[#B91C1C] text-white rounded-tr-none"
        : "bg-white text-stone-900 border border-amber-200/50 rounded-tl-none";

      return (
        <div key={msg.id} className={`flex flex-col max-w-[80%] ${alignmentClass}`}>
          <div className={`rounded-2xl px-4 py-2 text-sm shadow-sm ${bubbleClass}`}>
            {msg.message}
          </div>
          <div className="flex items-center gap-1 mt-1 px-1">
            <span className="text-[9px] text-stone-400 font-medium">{formatTime(msg.createdAt)}</span>
            {isCustomer ? (
              <Check className={`w-3 h-3 ${msg.isRead ? "text-emerald-500" : "text-stone-300"}`} />
            ) : null}
          </div>
        </div>
      );
    });
  }, [messages, formatTime]);

  return <>{renderedMessages}</>;
}