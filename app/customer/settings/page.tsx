'use client';

import { CustomerAccountLayout } from '@/components/customer/CustomerAccountLayout';
import { useSession } from 'next-auth/react';
import { User, Shield, Bell, Info, ChevronRight, LogOut } from 'lucide-react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';

export default function SettingsDashboard() {
  const { data: session } = useSession();

  const settingsCards = [
    {
      href: '/customer/settings/account',
      icon: User,
      title: 'Account Information',
      description: 'Update your name, email, and phone number',
    },
    {
      href: '/customer/settings/security',
      icon: Shield,
      title: 'Password & Security',
      description: 'Manage passwords and verified devices',
    },
    {
      href: '/customer/settings/notifications',
      icon: Bell,
      title: 'Notifications',
      description: 'Choose what you want to be notified about',
    },
    {
      href: '/customer/settings/about',
      icon: Info,
      title: 'Privacy & About',
      description: 'Read policies and application details',
    },
  ];

  return (
    <CustomerAccountLayout>
      <main className="max-w-2xl mx-auto px-4 py-8 md:py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-[#451a03]">Settings</h1>
          <p className="text-stone-500 mt-1">Manage your Eat n' RepEat Café account</p>
        </div>

        <div className="space-y-4">
          {settingsCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="flex items-center justify-between p-5 bg-white border border-stone-200 rounded-2xl shadow-sm hover:shadow-md hover:border-amber-200 hover:-translate-y-0.5 transition-all duration-200 group"
            >
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-full bg-amber-50 text-[#B91C1C] flex items-center justify-center shrink-0 group-hover:bg-[#B91C1C] group-hover:text-white transition-colors">
                  <card.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-800">{card.title}</h3>
                  <p className="text-xs sm:text-sm text-stone-500 mt-0.5">{card.description}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-[#B91C1C] transition-colors shrink-0" />
            </Link>
          ))}
        </div>

        {/* Log Out Button */}
        {session?.user && (
          <div className="mt-12 pt-8 border-t border-stone-200/60">
            <button
              onClick={() => signOut({ callbackUrl: '/customer/login' })}
              className="flex items-center justify-center gap-3 w-full py-4 rounded-xl bg-white border border-stone-200 text-stone-700 hover:text-red-700 hover:border-red-200 hover:bg-red-50 font-bold transition shadow-sm"
            >
              <LogOut className="w-5 h-5" /> Log out of your account
            </button>
          </div>
        )}
      </main>
    </CustomerAccountLayout>
  );
}
