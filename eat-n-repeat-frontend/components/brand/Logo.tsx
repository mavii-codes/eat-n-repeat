import Image from "next/image";
import Link from "next/link";

type LogoProps = {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  href?: string;
  className?: string;
};

const sizes = {
  sm: { image: 48, text: "text-base" },
  md: { image: 72, text: "text-lg" },
  lg: { image: 96, text: "text-xl" },
  xl: { image: 140, text: "text-2xl" },
};

const LOGO_SRC = "/logo.png?v=2";

export function Logo({
  size = "md",
  showText = false,
  href,
  className = "",
}: LogoProps) {
  const config = sizes[size];

  const content = (
    <div className={`flex items-center gap-3 ${className}`}>
      <Image
        src={LOGO_SRC}
        alt="Eat n' Repeat Café Cordova logo"
        width={config.image}
        height={config.image}
        unoptimized
        className="h-auto w-auto max-w-none object-contain"
        style={{ width: config.image, height: config.image }}
        priority
      />
      {showText && (
        <div>
          <p className={`font-script leading-none text-accent ${config.text}`}>
            Eat n&apos; Repeat
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-muted">
            Cordova
          </p>
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex transition-opacity hover:opacity-90">
        {content}
      </Link>
    );
  }

  return content;
}
