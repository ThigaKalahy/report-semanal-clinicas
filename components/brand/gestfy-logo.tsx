import Image from "next/image";

type LogoVariant = "full" | "mark" | "wordmark";

interface GestfyLogoProps {
  variant?: LogoVariant;
  size?: number;
  showSubtitle?: boolean;
  /** Força cores claras — use sobre fundos escuros como o painel de login */
  onDark?: boolean;
}

export function GestfyLogo({
  variant = "full",
  size = 32,
  showSubtitle = false,
  onDark = false,
}: GestfyLogoProps) {
  const mark = (
    <div className="shrink-0" style={{ height: size, width: size }}>
      <Image
        src="/gestfy-logo.png"
        alt="Gestfy"
        width={size}
        height={size}
        className="object-contain h-full w-full"
        style={onDark ? { filter: "brightness(0) invert(1)" } : undefined}
        priority
      />
    </div>
  );

  const wordmark = (
    <div className="flex flex-col leading-none">
      <span
        className="font-bold tracking-tight"
        style={{ fontSize: size * 0.56, lineHeight: 1.1 }}
      >
        <span className={onDark ? "text-white" : "text-gestfy-purple dark:text-gestfy-lavender"}>
          Gest
        </span>
        <span className="text-gestfy-orange">fy</span>
      </span>
      {showSubtitle && (
        <span
          className={onDark ? "text-white/60 uppercase tracking-widest font-medium" : "text-muted-foreground uppercase tracking-widest font-medium"}
          style={{ fontSize: size * 0.22 }}
        >
          Gestão para Clínicas
        </span>
      )}
    </div>
  );

  if (variant === "mark") return mark;
  if (variant === "wordmark") return wordmark;

  return (
    <div className="flex items-center gap-2">
      {mark}
      {wordmark}
    </div>
  );
}
