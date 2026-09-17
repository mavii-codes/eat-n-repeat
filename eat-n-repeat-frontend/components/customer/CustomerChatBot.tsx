'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Coffee, MessageSquare, Bot, Send } from 'lucide-react';

type MessageSender = 'bot' | 'user' | 'system';

type Message = {
  id: string;
  sender: MessageSender;
  text: string;
  timestamp: string;
  recommendations?: Array<{
    name: string;
    price: number;
    badge?: string;
    category?: string;
  }>;
};

const SUGGESTION_CHIPS = [
  'Best Sellers',
  'Recommend Coffee',
  'Meals under ₱200',
  'Branch & Hours',
  'Delivery Details',
];

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    sender: 'bot',
    text: "Maji! Welcome to Eat n' RepEat Café! I'm your Barista AI assistant. Looking for handcrafted coffee, flame-grilled rice bowls, or anything else? Ask me anything!",
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  },
];

export function CustomerChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleCartState = (e: any) => setIsCartOpen(e.detail);
    if (typeof window !== 'undefined') {
      window.addEventListener('cartStateChange', handleCartState);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('cartStateChange', handleCartState);
      }
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isTyping]);

  const handleSendMessage = (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query) return;

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: query,
      timestamp: now,
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInput('');
    setIsTyping(true);

    setTimeout(() => {
      // Standard AI Response
      const response = generateBotResponse(query);
      setMessages((prev) => [...prev, response]);
      setIsTyping(false);
    }, 700);
  };

  const generateBotResponse = (userText: string): Message => {
    const text = userText.toLowerCase();
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (text.includes('order') || text.includes('cart') || text.includes('my items') || text.includes('what') && text.includes('in') && (text.includes('cart') || text.includes('order'))) {
      try {
        const savedCart = window.localStorage.getItem('eat-n-repeat-cart');
        if (savedCart) {
          const cartItems = JSON.parse(savedCart);
          if (cartItems.length > 0) {
            let total = 0;
            const itemsList = cartItems.map((item: any) => {
              const itemTotal = item.menuItem.price * item.quantity;
              total += itemTotal;
              return `* ${item.menuItem.name} × ${item.quantity}`;
            }).join('\n');
            
            return {
              id: Date.now().toString(),
              sender: 'bot',
              text: `Your current order contains:\n\n${itemsList}\n\nTotal: ₱${total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
              timestamp: now,
            };
          }
        }
      } catch (e) {
        // Fallback to default message if localStorage fails or is empty
      }
      return {
        id: Date.now().toString(),
        sender: 'bot',
        text: "Your cart is currently empty. Want me to recommend some of our best sellers?",
        timestamp: now,
      };
    }

    if (text.includes('coffee') || text.includes('drink') || text.includes('latte') || text.includes('brew')) {
      return {
        id: Date.now().toString(),
        sender: 'bot',
        text: "Here are our top handcrafted drinks! Our House Special Latte is freshly espresso-brewed daily with rich velvety milk.",
        timestamp: now,
        recommendations: [
          { name: 'House Special Latte', price: 145.00, badge: 'Bestseller', category: 'Coffee' },
          { name: 'Brown Sugar Boba Milk', price: 149.00, badge: 'Popular', category: 'Boba' },
          { name: 'Spanish Iced Latte', price: 155.00, badge: 'Chef Pick', category: 'Coffee' },
        ],
      };
    }

    if (text.includes('best seller') || text.includes('bestseller') || text.includes('popular') || text.includes('recommend')) {
      return {
        id: Date.now().toString(),
        sender: 'bot',
        text: "These are Cordova's most loved dishes at Eat n' RepEat Café! Prepared fresh to order with house recipes:",
        timestamp: now,
        recommendations: [
          { name: 'Signature Chicken Inasal Rice Bowl', price: 189.00, badge: 'Must Try', category: 'Rice Bowls' },
          { name: 'House Special Latte', price: 145.00, badge: 'Bestseller', category: 'Coffee' },
          { name: 'Spam & Egg Comfort Bowl', price: 165.00, badge: 'Favorite', category: 'Comfort Food' },
        ],
      };
    }

    if (text.includes('rice') || text.includes('meal') || text.includes('food') || text.includes('eat') || text.includes('under') || text.includes('200')) {
      return {
        id: Date.now().toString(),
        sender: 'bot',
        text: "Looking for a filling meal under ₱200? Check out these savory rice bowls and sides:",
        timestamp: now,
        recommendations: [
          { name: 'Signature Chicken Inasal Rice Bowl', price: 189.00, badge: 'Hot Seller', category: 'Meals' },
          { name: 'Spam & Egg Comfort Bowl', price: 165.00, badge: 'Comfort', category: 'Meals' },
          { name: 'Garlic Parmesan Truffle Fries', price: 109.00, badge: 'Side', category: 'Snacks' },
        ],
      };
    }

    if (text.includes('hour') || text.includes('open') || text.includes('location') || text.includes('address') || text.includes('where') || text.includes('branch')) {
      return {
        id: Date.now().toString(),
        sender: 'bot',
        text: "[Store Location]: Near Aby Road, Poblacion, Cordova, Cebu.\n[Operating Hours]: Open Monday to Sunday, 7:00 AM – 10:00 PM. Drop by or order online for fast pickup & delivery!",
        timestamp: now,
      };
    }

    if (text.includes('delivery') || text.includes('ship') || text.includes('rider') || text.includes('fee') || text.includes('time')) {
      return {
        id: Date.now().toString(),
        sender: 'bot',
        text: "[Express Delivery Service]: We deliver direct to your doorstep anywhere in Cordova area within 20–30 minutes! Enjoy FREE delivery on orders over ₱599.",
        timestamp: now,
      };
    }

    return {
      id: Date.now().toString(),
      sender: 'bot',
      text: "Thanks for reaching out! You can ask me about coffee brews, rice bowls, or our best sellers.",
      timestamp: now,
    };
  };

  return (
    <>
      {/* Floating Widget Trigger Button */}
      <div 
        className={`fixed z-[60] transition-all duration-500 ease-in-out ${
          isCartOpen 
            ? 'bottom-[240px] right-4 sm:bottom-6 sm:right-[472px]' 
            : 'bottom-4 right-4 sm:bottom-6 sm:right-6'
        }`}
      >
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Open Barista AI Assistant"
          className="group relative flex items-center gap-2.5 bg-gradient-to-r from-[#B91C1C] via-[#D97706] to-[#B91C1C] text-white p-3 sm:px-5 sm:py-3.5 rounded-full shadow-2xl shadow-red-600/40 hover:scale-105 active:scale-95 transition-all duration-300 border-2 border-white/40"
        >
          {/* Animated Glow pulse */}
          <span className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-amber-400 to-red-600 blur-xs opacity-60 group-hover:opacity-100 transition animate-pulse" />
          
          <div className="relative flex items-center gap-2">
            <span className="text-xl sm:text-2xl flex items-center">
               <Coffee className="w-5 h-5 text-white" />
            </span>
            <span className="hidden sm:inline font-black text-xs uppercase tracking-wider">
              {isOpen ? 'Close Chat' : 'Barista AI'}
            </span>
          </div>
        </button>
      </div>

      {/* Chat Box Modal / Drawer */}
      {isOpen && (
        <div 
          className={`fixed inset-x-3 bottom-20 sm:bottom-24 sm:left-auto sm:w-[390px] h-[540px] max-h-[82vh] bg-[#FFF8F0] rounded-3xl border border-amber-200/90 shadow-2xl z-50 flex flex-col overflow-hidden animate-slide-up transition-all duration-500 ease-in-out ${
            isCartOpen 
              ? 'sm:right-[472px]' 
              : 'sm:right-6'
          }`}
        >
          
          {/* Header */}
          <div className="bg-gradient-to-r from-[#451a03] via-[#3D1703] to-[#451a03] text-white px-4 py-3 flex items-center justify-between border-b border-amber-900/40 shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="relative w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-[#B91C1C] flex items-center justify-center text-base border-2 border-amber-300/40 shadow-sm shrink-0">
                <Coffee className="w-4 h-4 text-white" />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-stone-900 bg-emerald-500" />
              </div>
              <div className="min-w-0">
                <h3 className="font-black text-xs sm:text-sm text-amber-200 flex items-center gap-1.5 truncate">
                  <span>Barista AI Assistant</span>
                </h3>
                <p className="text-[10px] text-amber-100/70 font-medium truncate">
                  Eat n' RepEat Café Cordova
                </p>
              </div>
            </div>

            {/* Right Header Actions: Close */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-amber-100 text-xs transition"
                aria-label="Close Chat Window"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] px-3.5 py-2.5 rounded-2xl leading-relaxed shadow-2xs ${
                    msg.sender === 'user'
                      ? 'bg-[#B91C1C] text-white rounded-br-none font-medium'
                      : msg.sender === 'system'
                      ? 'bg-stone-200 text-stone-800 rounded-xl font-medium border border-stone-300 text-center w-full'
                      : 'bg-white text-stone-800 rounded-bl-none border border-amber-200/80 font-normal'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.text}</p>

                  {/* Recommendation Cards inside Chat */}
                  {msg.recommendations && msg.recommendations.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-amber-100 space-y-2">
                      {msg.recommendations.map((rec) => (
                        <div
                          key={rec.name}
                          className="bg-[#FFFDF9] p-2.5 rounded-xl border border-amber-200/80 flex items-center justify-between gap-2 shadow-2xs hover:border-[#B91C1C] transition"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              {rec.badge && (
                                <span className="text-[9px] bg-red-100 text-[#B91C1C] font-black px-1.5 py-0.5 rounded-full uppercase">
                                  {rec.badge}
                                </span>
                              )}
                              <span className="font-extrabold text-[#451a03] truncate text-[11px]">{rec.name}</span>
                            </div>
                            <span className="text-[10px] text-stone-500 font-bold block mt-0.5">
                              ₱{rec.price.toFixed(2)}
                            </span>
                          </div>
                          <Link
                            href="/customer"
                            onClick={() => setIsOpen(false)}
                            className="bg-[#B91C1C] hover:bg-[#991B1B] text-white text-[10px] font-extrabold px-2.5 py-1 rounded-lg shrink-0 shadow-2xs"
                          >
                            Order
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-stone-400 mt-1 px-1">{msg.timestamp}</span>
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-2xl rounded-bl-none border border-amber-200/80 w-max">
                <span className="text-sm animate-spin text-stone-500">
                  <Coffee className="w-3 h-3" />
                </span>
                <span className="text-[11px] font-bold text-stone-500">
                  Barista AI is typing...
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          <div className="px-3 py-2 bg-[#FFF1E0]/70 border-t border-amber-200/60 flex gap-1.5 overflow-x-auto no-scrollbar">
            {SUGGESTION_CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => handleSendMessage(chip)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold whitespace-nowrap shadow-2xs transition shrink-0 border bg-white hover:bg-amber-100 border-amber-200 text-[#451a03]`}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Chat Input Field */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-2.5 bg-white border-t border-amber-200/80 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Barista AI..."
              className="flex-1 bg-[#FFF8F0] border border-amber-200/90 rounded-full px-3.5 py-2 text-xs text-stone-800 focus:outline-none focus:border-[#B91C1C] focus:ring-1 focus:ring-[#B91C1C] placeholder:text-stone-400 font-medium"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="w-8 h-8 rounded-full bg-[#B91C1C] hover:bg-[#991B1B] disabled:opacity-40 text-white flex items-center justify-center text-xs shadow-md transition shrink-0"
              aria-label="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

        </div>
      )}
    </>
  );
}
