"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoVariant = "full" | "mark" | "wordmark";

interface GestfyLogoProps {
  variant?: LogoVariant;
  /** Altura do logo em px (full e mark escalam proporcionalmente) */
  size?: number;
  /** Força versão branca total — use sobre fundos muito escuros como o painel do login */
  onDark?: boolean;
  className?: string;
}

export function GestfyLogo({
  variant = "full",
  size = 32,
  onDark = false,
  className,
}: GestfyLogoProps) {
  // Símbolo G isolado
  if (variant === "mark") {
    return (
      <div className={cn("shrink-0", className)} style={{ height: size, width: size }}>
        <Image
          src="/brand/gestfy-symbol.png"
          alt="Gestfy"
          width={size}
          height={size}
          className="object-contain h-full w-full"
          style={onDark ? { filter: "brightness(0) invert(1)" } : undefined}
          priority
        />
      </div>
    );
  }

  // Wordmark em texto (fallback)
  if (variant === "wordmark") {
    return (
      <div className={cn("flex flex-col leading-none", className)}>
        <span
          className="font-bold tracking-tight font-heading"
          style={{ fontSize: size * 0.56, lineHeight: 1.1 }}
        >
          <span className={onDark ? "text-white" : "text-gestfy-roxo-03 dark:text-gestfy-lavender"}>
            Gest
          </span>
          <span className="text-gestfy-laranja-05">fy</span>
        </span>
      </div>
    );
  }

  // Logo completo: wordmark PNG oficial
  // No tema escuro sem onDark, envolve em fundo translúcido p/ garantir legibilidade
  const logoH = size;
  // gestfy-logo-full.png é aprox. 4:1 (largura:altura)
  const logoW = Math.round(size * 4);

  return (
    <div className={cn("shrink-0", className)}>
      {onDark ? (
        // Sobre gradiente/fundo escuro — versão toda branca
        <Image
          src="/brand/gestfy-logo-full.png"
          alt="Gestfy"
          width={logoW}
          height={logoH}
          className="object-contain"
          style={{ height: logoH, width: "auto", filter: "brightness(0) invert(1)" }}
          priority
        />
      ) : (
        // Claro: sem filtro. Escuro: drop-shadow luminoso contorna a silhueta real do PNG.
        <Image
          src="/brand/gestfy-logo-full.png"
          alt="Gestfy"
          width={logoW}
          height={logoH}
          className="object-contain dark:logo-relief"
          style={{ height: logoH, width: "auto" }}
          priority
        />
      )}
    </div>
  );
}
