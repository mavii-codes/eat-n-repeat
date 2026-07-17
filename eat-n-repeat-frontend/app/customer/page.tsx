'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Logo } from '@/components/brand/Logo';

export default function CustomerHome() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-amber-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-amber-100/20">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
            <Logo size="md" showText={true} />
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <Link href="/customer/menu" className="text-amber-900 hover:text-amber-700 font-medium transition">
              Menu
            </Link>
            <Link href="/customer/orders" className="text-amber-900 hover:text-amber-700 font-medium transition">
              Orders
            </Link>
            <Link href="/customer/favorites" className="text-amber-900 hover:text-amber-700 font-medium transition">
              Favorites
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative w-10 h-10 rounded-full hover:bg-amber-100 transition flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <Link 
              href="/customer/profile" 
              className="px-6 py-2 bg-amber-700 text-white rounded-full hover:bg-amber-800 transition font-medium shadow-lg hover:shadow-xl"
            >
              Sign In
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              <div className="inline-block bg-amber-100/50 backdrop-blur px-4 py-2 rounded-full border border-amber-200">
                <p className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                  <span className="text-lg">☕</span>
                  WARM BITES · BETTER COFFEE
                </p>
              </div>

              <h1 className="text-5xl md:text-6xl font-bold text-amber-950 leading-tight">
                Order your <span className="italic text-amber-700">comfort,</span> delivered warm.
              </h1>

              <p className="text-lg text-amber-900/70 leading-relaxed max-w-md">
                Browse a menu built from house recipes and small-batch beans. Dine-in or delivery, real-time tracking, and a friendly AI to help you pick.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link 
                  href="/customer/menu" 
                  className="px-8 py-4 bg-amber-700 text-white rounded-full hover:bg-amber-800 transition font-bold text-center shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  Browse the menu
                </Link>
                <Link 
                  href="/customer/orders" 
                  className="px-8 py-4 bg-white text-amber-700 border-2 border-amber-200 rounded-full hover:bg-amber-50 transition font-bold text-center shadow-md hover:shadow-lg"
                >
                  Track my order
                </Link>
              </div>

              {/* Info Badges */}
              <div className="flex flex-col sm:flex-row gap-6 pt-8 border-t border-amber-100/50">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-xl">🍽️</div>
                  <div>
                    <p className="font-semibold text-amber-950">Dine-in ready</p>
                    <p className="text-sm text-amber-700">Now available</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-xl">🚗</div>
                  <div>
                    <p className="font-semibold text-amber-950">Delivery in 30 min</p>
                    <p className="text-sm text-amber-700">Fast & reliable</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Image */}
            <div className="relative hidden md:block">
              <div className="relative w-full aspect-square rounded-3xl overflow-hidden shadow-2xl">
                <Image
                  src="https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=500&h=500&fit=crop"
                  alt="Coffee and pastry"
                  fill
                  className="object-cover"
                  priority
                />
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-amber-900/20 to-transparent"></div>
              </div>
              
              {/* Floating cards */}
              <div className="absolute -bottom-8 -left-8 bg-white rounded-2xl shadow-xl p-6 max-w-xs backdrop-blur-sm border border-white/50">
                <p className="text-sm font-semibold text-amber-700 mb-2">⭐ 4.8 Rating</p>
                <p className="text-gray-700">"Best coffee in the city! Love the delivery service."</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 bg-white/50 backdrop-blur">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-amber-950 mb-16">Why Choose Eat n' RepEat?</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-8 rounded-2xl bg-gradient-to-br from-amber-50 to-white border border-amber-100/50 hover:shadow-xl transition">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-bold text-amber-950 mb-3">Fresh & Quality</h3>
              <p className="text-amber-900/70">
                All items prepared fresh using house recipes and premium small-batch ingredients.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 rounded-2xl bg-gradient-to-br from-amber-50 to-white border border-amber-100/50 hover:shadow-xl transition">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-bold text-amber-950 mb-3">Real-Time Tracking</h3>
              <p className="text-amber-900/70">
                Track your order from preparation to delivery with live updates and notifications.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 rounded-2xl bg-gradient-to-br from-amber-50 to-white border border-amber-100/50 hover:shadow-xl transition">
              <div className="text-4xl mb-4">🤖</div>
              <h3 className="text-xl font-bold text-amber-950 mb-3">AI Assistant</h3>
              <p className="text-amber-900/70">
                Get personalized recommendations from our friendly AI chatbot available 24/7.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-amber-950 mb-6">
            Ready to savor something warm?
          </h2>
          <p className="text-lg text-amber-900/70 mb-8 max-w-2xl mx-auto">
            Start your order now and enjoy fast delivery or a cozy dine-in experience.
          </p>
          <Link 
            href="/customer/menu"
            className="inline-block px-10 py-4 bg-amber-700 text-white rounded-full hover:bg-amber-800 transition font-bold shadow-lg hover:shadow-xl transform hover:scale-105 text-lg"
          >
            Explore Our Menu
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-amber-100/30 bg-gradient-to-t from-amber-50 to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <Logo size="md" showText={true} />
              <p className="text-sm text-amber-900/70 mt-4">Warm bites, better coffee.</p>
            </div>
            <div>
              <h4 className="font-bold text-amber-950 mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm text-amber-900/70">
                <li><Link href="/customer/menu" className="hover:text-amber-900">Menu</Link></li>
                <li><Link href="/customer/orders" className="hover:text-amber-900">Orders</Link></li>
                <li><Link href="/customer/favorites" className="hover:text-amber-900">Favorites</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-amber-950 mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-amber-900/70">
                <li><a href="#" className="hover:text-amber-900">Contact Us</a></li>
                <li><a href="#" className="hover:text-amber-900">FAQ</a></li>
                <li><a href="#" className="hover:text-amber-900">Feedback</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-amber-950 mb-4">Follow</h4>
              <div className="flex gap-4">
                <a href="#" className="text-amber-700 hover:text-amber-900">Facebook</a>
                <a href="#" className="text-amber-700 hover:text-amber-900">Instagram</a>
              </div>
            </div>
          </div>
          
          <div className="border-t border-amber-100/50 pt-8 text-center text-sm text-amber-900/60">
            <p>&copy; 2024 Eat n' RepEat Café. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
