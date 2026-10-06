'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

/**
 * Café QR entry card (Staff Portal).
 *
 * One STATIC printed QR cannot serve both environments: a URL either
 * resolves through internet DNS (online domain — dead without internet) or
 * through the café LAN (LAN IP — unreachable outside the café's Wi-Fi).
 * Faking single-QR auto-detection is technically impossible, so this card
 * carries the two honest entry points side by side instead:
 *
 *   1. ONLINE — fixed public URL, works anywhere with internet.
 *   2. CAFÉ WI-FI — http://<this-device's-LAN-IP>:3000/customer, derived at
 *      runtime from the hostname the staff browser itself used, so it is
 *      never hardcoded and never localhost (phones cannot reach localhost).
 *      Shown only when this page was opened via a LAN IP; otherwise a
 *      guidance note explains how to reveal it.
 *
 * No backend calls, no auth changes, no ordering logic. The Electron
 * launcher's own LAN QR is untouched and remains the offline fallback.
 */

// Public entry URL. Overridable for staging via env; the default is the
// canonical production customer portal (NOT a localhost/LAN address).
const ONLINE_CUSTOMER_URL =
  process.env.NEXT_PUBLIC_ONLINE_CUSTOMER_URL ||
  'https://www.eatnrepeat.online/customer';

function getLanHostname(): string | null {
  if (typeof window === 'undefined') return null;
  const h = window.location.hostname.trim();
  if (
    h.startsWith('192.168.') ||
    h.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  ) {
    return h;
  }
  return null;
}

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
  // SSR-safe: hostname is client-only, so the LAN block resolves after mount
  // (avoids hydration mismatch; online QR renders immediately).
  const [lanHost, setLanHost] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLanHost(getLanHostname());
    setMounted(true);
  }, []);

  const lanUrl = lanHost
    ? `http://${lanHost}:${window.location.port || '3000'}/customer`
    : null;

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
          One card, two entries: online for customers with internet, café Wi-Fi for offline ordering.
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

      {/* Print area: café name + codes only — no staff/admin navigation or secrets. */}
      <div id="cafe-qr-print" className="rounded-3xl border border-amber-200/80 bg-[#FFF8F0] p-6 sm:p-10 shadow-2xs">
        <div className="text-center mb-6">
          <h2 className="font-serif text-3xl sm:text-4xl font-black text-[#451a03]">
            Eat n&rsquo; RepEat Cafe
          </h2>
          <p className="mt-2 text-sm sm:text-base font-bold text-stone-700">Scan to Order</p>
          <p className="mt-1 text-xs text-stone-500 font-medium">
            Connect to the Caf&eacute; Wi-Fi when using the local ordering system.
          </p>
        </div>

        <div
          className={`grid gap-6 ${
            mounted && lanUrl ? 'md:grid-cols-2' : 'md:grid-cols-1 max-w-md mx-auto'
          }`}
        >
          <QrBlock
            title="Online Ordering"
            description="Scan with internet access — works on mobile data or any Wi-Fi, inside or outside the café."
            url={ONLINE_CUSTOMER_URL}
          />
          {mounted &&
            (lanUrl ? (
              <QrBlock
                title="Café Wi-Fi Ordering"
                description="No internet? Join the café Wi-Fi and scan — orders go straight to the local system."
                url={lanUrl}
              />
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-amber-300 bg-white/60 p-6 text-center">
                <h3 className="font-black text-sm text-[#451a03] uppercase tracking-wider">
                  Café Wi-Fi QR unavailable here
                </h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  This page was not opened through the café&rsquo;s LAN address, so no
                  local QR can be generated (a localhost code would not scan on
                  customer phones). Open the Staff Portal via the café&rsquo;s LAN IP
                  (e.g. http://192.168.1.23:3000/staff) to reveal the offline code.
                </p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
