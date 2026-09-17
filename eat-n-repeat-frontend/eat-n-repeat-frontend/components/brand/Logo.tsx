import Image from "next/image";
import Link from "next/link";

type LogoProps = {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  href?: string;
  className?: string;
  variant?: "default" | "customer";
};

const sizes = {
  sm: { icon: 42, text: "text-lg", sub: "text-xs" },
  md: { icon: 52, text: "text-xl", sub: "text-xs" },
  lg: { icon: 64, text: "text-2xl", sub: "text-sm" },
  xl: { icon: 84, text: "text-3xl", sub: "text-base" },
};

const LOGO_SRC = "/logo.png";

export function Logo({
  size = "md",
  showText = true,
  href = "/customer",
  className = "",
  variant = "customer",
}: LogoProps) {
  const config = sizes[size];
  const isCustomer = variant === "customer";

  const content = (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Brand Icon (Preserving 1:1 square ratio of transparent logo.png) */}
      <div className="relative shrink-0 flex items-center justify-center">
        <Image
          src={LOGO_SRC}
          alt="Eat n' Repeat Café Logo Icon"
          width={config.icon}
          height={config.icon}
          unoptimized
          priority
          className="object-contain drop-shadow-xs transition-transform duration-200 hover:scale-105"
          style={{ width: config.icon, height: config.icon }}
        />
      </div>

      {/* Brand Text */}
      {showText && (
        <div className="leading-none flex flex-col justify-center select-none">
          <div className="flex items-baseline gap-0.5">
            <span
              className={`font-black tracking-tight ${config.text} ${
                isCustomer ? "text-[#E85A1C]" : "text-amber-500"
              }`}
            >
              Eat <span className="text-[#451a03]">n</span> RepEat
            </span>
          </div>
          <span
            className={`font-bold text-[#EA580C] italic tracking-wide mt-0.5 ${config.sub}`}
            style={{ fontFamily: "var(--font-pacifico, cursive)" }}
          >
            Café
          </span>
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex transition-transform hover:scale-[1.02] active:scale-95">
        {content}
      </Link>
    );
  }

  return content;
}




