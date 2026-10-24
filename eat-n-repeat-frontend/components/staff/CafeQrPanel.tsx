'use client';

import { QRCodeSVG } from 'qrcode.react';

// Public entry URL. Overridable for staging via env; the default is the
// canonical production customer portal (NOT a localhost/LAN address).
const ONLINE_CUSTOMER_URL =
  process.env.NEXT_PUBLIC_ONLINE_CUSTOMER_URL ||
  'https://www.eatnrepeat.online/customer';

function QrBlock({
  title,
  description,
  url,
}: {
  title: string;
  description: string;
  url: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-accent/10 bg-white p-6 shadow-sm">
      <h3 className="font-black text-sm text-[#451a03] uppercase tracking-wider">{title}</h3>
      <div className="rounded-xl border-2 border-[#B91C1C]/20 bg-white p-3">
        <QRCodeSVG value={url} size={180} level="M" fgColor="#451a03" />
      </div>
      <p className="text-xs font-bold text-stone-700 break-all text-center">{url}</p>
      <p className="text-[11px] text-stone-500 text-center leading-relaxed">{description}</p>
    </div>
  );
}

export function CafeQrPanel() {
  return (
    <div className="space-y-6">
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #cafe-qr-print, #cafe-qr-print * { visibility: visible !important; }
        #cafe-qr-print { position: absolute !important; inset: 0 !important; margin: 0 !important; }
        @page { size: auto; margin: 12mm; }
      }`}</style>

      <div>
        <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold capitalize text-accent border border-accent/10">
          Customer entry
        </span>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-[#800000] mt-1.5">
          Café QR Code
        </h1>
        <p className="text-sm text-muted">
          Online Customer Portal QR code for customer mobile menu & ordering.
        </p>
      </div>

      <div className="flex justify-end print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white text-sm font-bold rounded-xl shadow transition"
        >
          Print QR
        </button>
      </div>

      {/* Print area: café name + code only — no staff/admin navigation or secrets. */}
      <div id="cafe-qr-print" className="rounded-3xl border border-amber-200/80 bg-[#FFF8F0] p-6 sm:p-10 shadow-2xs">
        <div className="text-center mb-6">
          <h2 className="font-serif text-3xl sm:text-4xl font-black text-[#451a03]">
            Eat n&rsquo; RepEat Cafe
          </h2>
          <p className="mt-2 text-sm sm:text-base font-bold text-stone-700">Scan to Order</p>
          <p className="mt-1 text-xs text-stone-500 font-medium">
            Scan to view the menu and place your order online.
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <QrBlock
            title="Online Ordering"
            description="Scan with internet access — works on mobile data or any Wi-Fi."
            url={ONLINE_CUSTOMER_URL}
          />
        </div>
      </div>
    </div>
  );
}
