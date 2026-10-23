"use client";

/* Promo Codes — admin page: the discount-code sheet (create / edit / pause /
   activate / delete) plus who redeemed what. Self-contained module under
   components/admin/promos/; no AdminDataContext involvement. */

import { useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import PromoListTab from "@/components/admin/promos/PromoListTab";
import RedemptionsTab from "@/components/admin/promos/RedemptionsTab";

const TABS = [
  { key: "codes", label: "Promo Codes" },
  { key: "redemptions", label: "Redemptions" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function PromosPage() {
  const [tab, setTab] = useState<TabKey>("codes");

  return (
    <>
      <AdminPageHeader
        badge="Marketing"
        title="Promo Codes"
        subtitle="Create and control discount codes for online orders and the POS counter. Everything here takes effect immediately, end to end."
      />

      {/* Tab switcher — same rounded-2xl panel language as the page below. */}
      <div className="mb-6" role="tablist" aria-label="Promo Code sections">
        <div className="inline-flex flex-wrap gap-1 rounded-2xl border border-accent/10 bg-white/70 p-1.5 backdrop-blur-sm">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t.key
                  ? "bg-gradient-to-r from-accent to-accent-dark text-white"
                  : "text-stone-500 hover:bg-accent-light hover:text-accent"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Only the active tab mounts, so switching keeps exactly one server
          request in flight and tabs remember nothing across switches. */}
      {tab === "codes" && <PromoListTab />}
      {tab === "redemptions" && <RedemptionsTab />}
    </>
  );
}
