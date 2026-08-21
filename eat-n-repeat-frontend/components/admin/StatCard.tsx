import type { ReactNode } from "react";

type StatCardProps = {
  title: string;
  value: string;
  subtitle: string;
  icon: ReactNode;
  tone?: "red" | "wine" | "rose" | "amber" | "emerald";
  subtitleColor?: string;
};

const toneStyles = {
  red: "from-[#c41e3a] to-[#9b1530]",
  wine: "from-[#800000] to-[#5c0000]",
  rose: "from-[#e85d75] to-[#c41e3a]",
  amber: "from-[#d97706] to-[#b45309]",
  emerald: "from-[#059669] to-[#047857]",
};

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  tone = "red",
  subtitleColor,
}: StatCardProps) {
  return (
    <div className="admin-stat-card rounded-2xl p-5 pl-6">
      <div className="mb-4 flex items-start justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">{title}</p>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${toneStyles[tone]} text-white shadow-lg shadow-accent/20`}
        >
          {icon}
        </div>
      </div>
      <p className="font-serif text-3xl font-bold text-[#800000]">{value}</p>
      <p className={`mt-2 text-xs font-semibold ${subtitleColor || (subtitle.startsWith("+") ? "text-emerald-700" : subtitle.startsWith("-") ? "text-rose-700" : "text-stone-600")}`}>
        {subtitle}
      </p>
    </div>
  );
}

export function PesoIcon() {
  return (
    <span className="font-bold text-lg leading-none font-serif select-none">₱</span>
  );
}

export function DollarIcon() {
  return <PesoIcon />;
}

export function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  );
}

export function TrendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}
