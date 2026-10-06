'use client';

import { CustomerAccountLayout } from '@/components/customer/CustomerAccountLayout';
import { ArrowLeft, Info, FileText, CheckCircle2, HeadphonesIcon } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';

export default function AboutSettingsPage() {
  const policies = [
    { title: 'Privacy Policy', desc: 'Read how we protect and manage your personal data.' },
    { title: 'Terms & Conditions', desc: 'Rules and guidelines for using our services.' },
    { title: 'Data Collection Policy', desc: 'Details on how we use your usage data to improve the app.' },
  ];

  return (
    <CustomerAccountLayout>
      <div className="max-w-2xl space-y-6">
        <div className="mb-4">
          <Link href="/customer/settings" className="md:hidden inline-flex items-center gap-2 text-stone-500 hover:text-[#B91C1C] transition font-bold text-sm mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to Settings
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-amber-50 text-[#B91C1C] flex items-center justify-center">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#451a03]">Privacy & About</h1>
              <p className="text-stone-500 mt-1">Information about Eat n' RepEat Café</p>
            </div>
          </div>
        </div>

        {/* Cafe Information Card */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
          {/* Decorative Background */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-bl-full -z-0 opacity-50" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-6">
              <Logo size="md" variant="customer" />
              <div>
                <h2 className="text-lg font-black text-[#451a03]">Eat n' RepEat Café</h2>
                <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider mt-1">
                  <CheckCircle2 className="w-3 h-3" /> Official Application
                </span>
              </div>
            </div>

            <div className="space-y-4 text-sm text-stone-600">
              <div className="grid grid-cols-[100px_1fr] gap-2">
                <span className="font-bold text-stone-400">Version</span>
                <span className="font-semibold text-stone-800">1.0.4 (Customer Portal)</span>
              </div>
              <div className="grid grid-cols-[100px_1fr] gap-2">
                <span className="font-bold text-stone-400">Location</span>
                <span className="font-semibold text-stone-800">Near Aby Road, Poblacion, Cordova</span>
              </div>
              <div className="grid grid-cols-[100px_1fr] gap-2">
                <span className="font-bold text-stone-400">Hours</span>
                <span className="font-semibold text-stone-800">Mon - Sun (7:00 AM - 10:00 PM)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Support Card */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm flex items-center justify-between group cursor-pointer hover:border-amber-200 hover:shadow-md transition">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#FFF1E0] text-[#B91C1C] rounded-xl group-hover:scale-110 transition-transform">
              <HeadphonesIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-stone-800">Contact Support</p>
              <p className="text-xs text-stone-500 mt-0.5">support@eatnrepeat.ph • (032) 492-0000</p>
            </div>
          </div>
        </div>

        {/* Policies Section */}
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-stone-50 px-6 py-4 border-b border-stone-100">
            <h2 className="text-sm font-bold text-stone-800 uppercase tracking-wider">Legal & Policies</h2>
          </div>
          <div className="divide-y divide-stone-100">
            {policies.map((policy, idx) => (
              <div key={idx} className="p-6 flex items-start gap-4 hover:bg-stone-50 cursor-pointer transition group">
                <FileText className="w-5 h-5 text-stone-400 group-hover:text-[#B91C1C] shrink-0 mt-0.5 transition-colors" />
                <div>
                  <p className="text-sm font-bold text-stone-800 group-hover:text-[#B91C1C] transition-colors">{policy.title}</p>
                  <p className="text-xs text-stone-500 mt-1">{policy.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </CustomerAccountLayout>
  );
}
