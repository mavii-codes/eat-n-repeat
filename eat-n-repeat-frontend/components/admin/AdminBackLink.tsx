"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/* ══════════════════════════════════════════════════════════════
   AdminBackLink — the "← Back to Inventory" control shared by the
   Inventory sub-pages (stock-in, adjust, history).

   Plain muted text once read as page texture on the parent
   section's light blurred-photo hero, so this renders as an
   unmissable chip instead: frosted white fill + stone border +
   soft shadow for contrast, maroon arrow + maroon hover state,
   40px tap height for touch, and a visible maroon focus ring for
   keyboard users. The arrow nudges left on hover to underline the
   "go back" affordance.

   Defaults pick the section root; props stay overridable so other
   admin sections can reuse it without restyling.
   ══════════════════════════════════════════════════════════════ */

export function AdminBackLink({
  href = "/admin/inventory",
  label = "Back to Inventory",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="group inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-xl border border-stone-300/80 bg-white/85 px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm backdrop-blur-sm transition-all hover:border-accent/40 hover:bg-accent-light hover:text-[#800000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#800000]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:translate-y-px"
    >
      <ArrowLeft className="h-4 w-4 shrink-0 text-[#800000] transition-transform duration-200 group-hover:-translate-x-0.5" />
      {label}
    </Link>
  );
}
