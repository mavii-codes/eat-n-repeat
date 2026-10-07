"use client";

import { useMemo } from "react";

type Message = {
  id: string;
  orderId: string;
  senderId: string;
  senderRole: "customer" | "staff";
  message: string;
  isRead: boolean;
  createdAt: string;
};

type MessageListProps = {
  messages: Message[];
  customerName: string;
  formatTime: (isoString: string) => string;
};

export function MessageList({ messages, customerName, formatTime }: MessageListProps) {
  const renderedMessages = useMemo(() => {
    return messages.map((msg, idx) => {
      const isStaff = msg.senderRole === "staff";
      const alignmentClass = isStaff ? "ml-auto items-end" : "mr-auto items-start";
      const bubbleClass = isStaff
        ? "bg-[#800000] text-white rounded-tr-none"
        : "bg-stone-100 text-stone-900 border border-stone-200 rounded-tl-none";
      const senderLabel = isStaff ? "Staff" : customerName;

      return (
        <div key={msg.id || idx} className={`flex flex-col max-w-[80%] ${alignmentClass}`}>
          <div className={`rounded-2xl px-4 py-2 text-sm shadow-sm ${isStaff ? "bg-[#800000] text-white rounded-tr-none" : "bg-stone-100 text-stone-900 border border-stone-200 rounded-tl-none"}`}>
            {msg.message}
          </div>
          <div className="flex items-center gap-1 mt-1 px-1">
            <span className="text-[9px] text-stone-400 font-medium">{formatTime(msg.createdAt)}</span>
            <span className="text-[9px] text-stone-400">{isStaff ? "Staff" : customerName}</span>
          </div>
        </div>
      );
    });
  }, [messages, customerName, formatTime]);

  return <>{renderedMessages}</>;
}