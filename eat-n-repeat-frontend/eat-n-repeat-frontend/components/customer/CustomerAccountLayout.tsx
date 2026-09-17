'use client';

import { CustomerHeader } from '@/components/customer/CustomerHeader';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { User, MapPin, Shield, Bell, Info, CircleHelp, LogOut } from 'lucide-react';

export function CustomerAccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const sidebarGroups = [
    {
      title: 'Account',
      links: [
        { href: '/customer/settings/account', label: 'Profile', icon: User },
        { href: '/customer/addresses', label: 'Saved Addresses', icon: MapPin },
      ]
    },
    {
      title: 'Settings',
      links: [
        { href: '/customer/settings/security', label: 'Security', icon: Shield },
        { href: '/customer/settings/notifications', label: 'Notifications', icon: Bell },
        { href: '/customer/settings/about', label: 'Privacy & About', icon: Info },
      ]
    },
    {
      title: 'Legal & Support', // Adjusted group name as Legal was in screenshot, Support in prompt
      links: [
        { href: '/customer/about', label: 'Help & Support', icon: CircleHelp },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#FFF8F0] flex flex-col">
      <CustomerHeader />
      
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 md:py-10 md:flex gap-8 items-start">
        {/* Mobile View: Render children directly (Sidebar hidden) */}
        <div className="w-full md:hidden">
          {children}
        </div>

        {/* Desktop View: Left Sidebar */}
        <aside className="hidden md:block w-[280px] shrink-0 sticky top-24">
          <div className="mb-6 px-2 flex items-center gap-2">
            <h1 className="text-xl font-black text-[#451a03]">&lt; Account Management</h1>
          </div>

          <nav className="space-y-6 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
            {sidebarGroups.map((group) => (
              <div key={group.title}>
                <h3 className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-2 px-3">
                  {group.title}
                </h3>
                <div className="space-y-0.5">
                  {group.links.map((link) => {
                    const isActive = pathname === link.href;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                          isActive
                            ? 'bg-red-50 text-[#B91C1C]'
                            : 'text-stone-700 hover:bg-stone-50 hover:text-[#B91C1C]'
                        }`}
                      >
                        <link.icon className={`w-4 h-4 ${isActive ? 'text-[#B91C1C]' : 'text-stone-400'}`} />
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Authentication Group */}
            {session?.user && (
              <div>
                <h3 className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-2 px-3 pt-5 border-t border-stone-100">
                  Authentication
                </h3>
                <div className="space-y-0.5">
                  <button
                    onClick={() => signOut({ callbackUrl: '/customer/login' })}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-stone-700 hover:bg-red-50 hover:text-red-700 transition-all duration-200 w-full text-left"
                  >
                    <LogOut className="w-4 h-4 text-stone-400" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </nav>
        </aside>

        {/* Desktop View: Right Content Area */}
        <main className="hidden md:block flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
