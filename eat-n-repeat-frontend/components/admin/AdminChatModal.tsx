"use client";

import { useEffect, useRef, useState } from "react";
import { AdminModal } from "./AdminModal";
import { AdminInput } from "./AdminForm";

type Message = {
  sender: "staff" | "customer";
  text: string;
  time: string;
};

type AdminChatModalProps = {
  open: boolean;
  onClose: () => void;
  customerName: string;
  orderId: string;
};

const customerResponses = [
  "Hello! Thank you for the update. Is my order on the way?",
  "Perfect, I am at the specified address. See you soon!",
  "Great service! Can the rider knock on the front door, please?",
  "Alright, thank you so much for notifying me.",
  "Okay, got it! Drive safe!",
  "Thank you! Looking forward to my coffee and cake!",
];

export function AdminChatModal({ open, onClose, customerName, orderId }: AdminChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize chat logs with greeting message when modal opens
  useEffect(() => {
    if (open) {
      setMessages([
        {
          sender: "customer",
          text: `Hi! I placed order #${orderId}. Just wanted to check if everything is correct?`,
          time: new Date(Date.now() - 1000 * 60 * 3).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
      setInputMessage("");
      setIsTyping(false);
    }
  }, [open, orderId]);

  // Scroll chat area to bottom when messages list updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const timeStr = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const userMsg: Message = {
      sender: "staff",
      text: inputMessage,
      time: timeStr,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");

    // Simulate customer typing and reply
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const replyText = customerResponses[Math.floor(Math.random() * customerResponses.length)];
      const replyMsg: Message = {
        sender: "customer",
        text: replyText,
        time: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, replyMsg]);
    }, 1500);
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
              disabled={isTyping}
            />
          </div>
          <button
            type="submit"
            disabled={!inputMessage.trim() || isTyping}
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
            Order Ticket: #{orderId}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col max-w-[80%] ${
                msg.sender === "staff" ? "ml-auto items-end" : "mr-auto items-start"
              }`}
            >
              <div
                className={`rounded-2xl px-4 py-2 text-sm shadow-sm ${
                  msg.sender === "staff"
                    ? "bg-[#800000] text-white rounded-tr-none"
                    : "bg-white text-ink border border-accent/10 rounded-tl-none"
                }`}
              >
                {msg.text}
              </div>
              <span className="text-[9px] text-muted mt-1 px-1">{msg.time}</span>
            </div>
          ))}
          {isTyping && (
            <div className="flex flex-col max-w-[80%] mr-auto items-start">
              <div className="rounded-2xl px-4 py-2 bg-white text-muted border border-accent/10 rounded-tl-none text-xs flex items-center gap-1">
                <span>{customerName} is typing</span>
                <span className="flex gap-0.5 mt-0.5">
                  <span className="h-1 w-1 bg-muted rounded-full animate-bounce"></span>
                  <span className="h-1 w-1 bg-muted rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="h-1 w-1 bg-muted rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </AdminModal>
  );
}
