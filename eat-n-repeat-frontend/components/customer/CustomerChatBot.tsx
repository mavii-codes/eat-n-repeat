'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Coffee, MessageSquare, Bot, Send } from 'lucide-react';
import { useAdminData } from '@/context/AdminDataContext';
import { useLocalMode } from '@/lib/customer/useLocalMode';

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
    timestamp: '12:00 AM', // deterministic placeholder; overwritten on client after mount
  },
];

// ── Barista intent engine (local, offline-safe, no keys) ─────────────────────
// Word-boundary patterns so "great" never matches "eat", etc.
type BotMenuItem = {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  available?: boolean;
  archived?: boolean;
};
type BotMenuCategory = { id: string; name: string };

const INTENT_PATTERNS: { id: string; patterns: RegExp[] }[] = [
  { id: 'cart', patterns: [/\border\b/, /\bcart\b/, /my items/, /\bcheckout\b/] },
  { id: 'price', patterns: [/how much/, /\bprice\b/, /\bcost\b/, /magkano/, /how-much/] },
  { id: 'coffee', patterns: [/\bcoffee\b/, /\bdrinks?\b/, /\blatte\b/, /\bbrew\b/, /\bboba\b/, /milk tea/, /\bespresso\b/, /\bmatcha\b/, /\bfrappe\b/] },
  { id: 'recommend', patterns: [/best ?seller/, /\bpopular\b/, /recommend/, /signature/, /must try/, /favorites?/] },
  { id: 'meals', patterns: [/\bmeals?\b/, /\brice\b/, /\bfood\b/, /\bulam\b/, /\bbudget\b/, /under \d+/, /below \d+/] },
  { id: 'hours', patterns: [/\bhours?\b/, /\bopen\b/, /\blocation\b/, /\baddress\b/, /\bwhere\b/, /\bbranch\b/, /aby road/] },
  { id: 'delivery', patterns: [/\bdelivery\b/, /\bdeliver\b/, /\brider\b/, /shipping fee/, /\bdelivery fee\b/] },
];

// Priority order doubles as tie-break (first wins ties).
const INTENT_PRIORITY = ['cart', 'hours', 'delivery', 'coffee', 'recommend', 'meals', 'price'];

function detectIntent(text: string): string {
  let best = 'fallback';
  let bestScore = 0;
  for (const id of INTENT_PRIORITY) {
    const def = INTENT_PATTERNS.find((d) => d.id === id)!;
    let score = 0;
    for (const p of def.patterns) {
      if (p.test(text)) score += 1;
    }
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  }
  return best;
}

function activeMenuItems(menuItems: BotMenuItem[]): BotMenuItem[] {
  return (menuItems || []).filter((m) => !m.archived && m.available !== false);
}

function categoryName(cats: BotMenuCategory[], id: string): string {
  return cats.find((c) => c.id === id)?.name ?? 'Menu';
}

function peso(n: number): string {
  return `₱${Number(n).toFixed(2)}`;
}

function findMenuItem(text: string, menu: BotMenuItem[]): BotMenuItem | undefined {
  const fullHits = menu
    .filter((m) => m.name.length >= 4 && text.includes(m.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length);
  if (fullHits[0]) return fullHits[0];
  // Token overlap: "spam egg comfort bowl" still finds "Spam & Egg Comfort Bowl".
  const STOP = new Set(['and', 'the', 'of', 'with', 'for', 'our', 'its', 'a', 'an', 'to']);
  const words = (s: string) =>
    s.toLowerCase().replace(/&/g, 'and').split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));
  const textWords = new Set(words(text));
  const partial = menu
    .map((m) => ({ m, hits: words(m.name).filter((w) => textWords.has(w)).length, total: words(m.name).length }))
    .filter((c) => c.total >= 2 && c.hits === c.total)
    .sort((a, b) => b.total - a.total);
  return partial[0]?.m;
}

export function CustomerChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { menuItems, menuCategories } = useAdminData();
  const isLocalMode = useLocalMode();

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

  // Replace deterministic placeholder timestamp with real time after hydration
  useEffect(() => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === '1'
          ? { ...m, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
          : m,
      ),
    );
  }, []);

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

    const menu = activeMenuItems(menuItems as BotMenuItem[]);
    const cats = (menuCategories ?? []) as BotMenuCategory[];
    const botText = (text: string, recommendations?: Message['recommendations']) => ({
      id: Date.now().toString(),
      sender: 'bot' as const,
      text,
      timestamp: now,
      ...(recommendations ? { recommendations } : {}),
    });

    let intent = detectIntent(text);
    // A specifically-named menu item beats a generic category intent.
    if (
      (intent === 'coffee' || intent === 'recommend' || intent === 'meals' || intent === 'fallback') &&
      findMenuItem(text, menu)
    ) {
      intent = 'price';
    }

    if (intent === 'coffee') {
      const picks = menu
        .filter(
          (m) =>
            /coffee|drink|beverage|boba|milk tea|matcha|espresso/i.test(categoryName(cats, m.categoryId)) ||
            /latte|coffee|boba|milk|brew|espresso|matcha|choco|frappe/i.test(m.name),
        )
        .slice(0, 3);
      if (picks.length === 0) {
        return botText('Our drinks menu is being updated right now — please check the Menu page for what is brewing today.');
      }
      return botText(
        `Here are our handcrafted drinks, made fresh to order:\n\n${picks.map((m) => `* ${m.name} — ${peso(m.price)}`).join('\n')}`,
        picks.map((m) => ({ name: m.name, price: m.price, category: categoryName(cats, m.categoryId) })),
      );
    }

    if (intent === 'recommend') {
      const coffees = menu.filter((m) => /coffee|drink|beverage|boba/i.test(categoryName(cats, m.categoryId)));
      const rest = menu.filter((m) => !coffees.includes(m));
      const picks = [coffees[0], rest[0], coffees[1] ?? rest[1]].filter((m): m is BotMenuItem => Boolean(m)).slice(0, 3);
      if (picks.length === 0) {
        return botText("Our menu is being updated right now — please check the Menu page for today's lineup.");
      }
      return botText(
        `These are crowd favorites at Eat n' RepEat Café, prepared fresh to order:\n\n${picks.map((m) => `* ${m.name} — ${peso(m.price)}`).join('\n')}`,
        picks.map((m) => ({ name: m.name, price: m.price, category: categoryName(cats, m.categoryId) })),
      );
    }

    if (intent === 'meals') {
      const capMatch = text.match(/(?:under|below|max)\s*(\d+)|(\d+)\s*(?:pesos|php|₱)/);
      const cap = capMatch ? Number(capMatch[1] ?? capMatch[2]) : 200;
      const picks = menu
        .filter((m) => m.price <= cap)
        .sort((a, b) => b.price - a.price)
        .slice(0, 3);
      if (picks.length === 0) {
        return botText(`Nothing on the menu sits under ${peso(cap)} right now — try asking for our best sellers instead.`);
      }
      return botText(
        `Filling picks under ${peso(cap)}:\n\n${picks.map((m) => `* ${m.name} — ${peso(m.price)}`).join('\n')}`,
        picks.map((m) => ({ name: m.name, price: m.price, category: categoryName(cats, m.categoryId) })),
      );
    }

    if (intent === 'price') {
      const hit = findMenuItem(text, menu);
      if (hit) {
        return botText(
          `The ${hit.name} is ${peso(hit.price)} (${categoryName(cats, hit.categoryId)}). It's available today — tap Order on its menu card to add it to your cart.`,
          [{ name: hit.name, price: hit.price, category: categoryName(cats, hit.categoryId) }],
        );
      }
      const picks = [...menu].sort((a, b) => b.price - a.price).slice(0, 3);
      return botText(
        'Which item did you mean? Here are some popular picks and their prices — tap one to order:',
        picks.map((m) => ({ name: m.name, price: m.price, category: categoryName(cats, m.categoryId) })),
      );
    }

    if (intent === 'hours') {
      return botText(
        "[Store Location]: Near Aby Road, Poblacion, Cordova, Cebu.\n[Operating Hours]: Open Monday to Sunday, 7:00 AM – 10:00 PM. Drop by or order online for fast pickup & delivery!",
      );
    }

    if (intent === 'delivery') {
      if (isLocalMode) {
        return botText(
          "We're serving in-café right now: connect to the café Wi-Fi, scan the QR code, and order as a guest — we'll call your name when it's ready. Cash and dine-in only in Local Café Mode.",
        );
      }
      return botText(
        '[Express Delivery Service]: We deliver direct to your doorstep anywhere in Cordova area within 20–30 minutes! Enjoy FREE delivery on orders over ₱599.',
      );
    }

    return botText(
      'Thanks for reaching out! You can ask me about coffee brews, rice bowls, prices, or our best sellers. Try: Best Sellers, Meals under ₱200, or Branch & Hours.',
    );
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
