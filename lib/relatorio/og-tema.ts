import type React from "react";

// ─── Dimensões ───────────────────────────────────────────────────────────────
// Largura fixa; a altura é calculada pelo Satori a partir do conteúdo, para a
// imagem terminar onde o conteúdo acaba (sem espaço vazio no rodapé).
export const LARGURA_OG = 1080;

// ─── Paleta Gestfy ───────────────────────────────────────────────────────────
export const C = {
  bgEscuro:"#0A0313",  // canto inferior esquerdo — quase preto
  bgMeio:  "#0B0316",  // metade de baixo praticamente chapada (evita banding)
  bgClaro: "#170528",  // topo da rampa, já dentro da área do brilho
  brilhoQuente: "rgba(163,43,112,0.34)",  // brilho magenta/quente no canto superior direito
  brilhoBorda:  "rgba(163,43,112,0)",     // dissipação do brilho
  card: "rgba(255,255,255,0.065)",
  cardBorda: "rgba(255,255,255,0.11)",
  laranja: "#F5872F",
  magenta: "#C026D3",
  roxo: "#B57BF7",
  roxoEscuro: "#7B099C",
  lavanda: "#BCAFCE",
  branco: "#FFFFFF",
  vermelho: "#F04747",
  vermelhoBg: "rgba(240,71,71,0.09)",
  vermelhoBorda: "rgba(240,71,71,0.42)",
  verde: "#3FBF6E",
  ambar: "#E6A700",
  trilho: "rgba(255,255,255,0.14)",
} as const;

export type S = React.CSSProperties;

// ─── Helpers de layout (todos com display:flex explícito) ─────────────────────
export function col(extra?: S): S {
  return { display: "flex", flexDirection: "column", ...extra };
}
export function row(extra?: S): S {
  return { display: "flex", flexDirection: "row", ...extra };
}

/** Texto seguro: nunca renderiza null/undefined/NaN. */
export function txt(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  return String(v).trim();
}

export function isNA(v?: string | null): boolean {
  const t = txt(v);
  return t === "" || t === "N/A" || t === "—" || t.toLowerCase() === "nan";
}

/**
 * Fundo compartilhado pelas duas páginas do infográfico.
 *
 * Satori exige `backgroundImage` (não o shorthand) para o degradê cobrir toda a
 * área. São duas camadas: um brilho quente no canto superior direito e uma rampa
 * diagonal curta — a metade de baixo fica quase chapada de propósito, porque um
 * degradê sutil espalhado por 1080px vira faixas visíveis em 8 bits.
 */
export function fundoRaiz(largura: number): S {
  return {
    display: "flex",
    flexDirection: "column",
    width: largura,
    backgroundColor: C.bgEscuro,
    backgroundImage:
      `radial-gradient(circle 620px at 92% 0%, ${C.brilhoQuente} 0%, ${C.brilhoBorda} 72%), ` +
      `linear-gradient(45deg, ${C.bgEscuro} 0%, ${C.bgMeio} 56%, ${C.bgClaro} 100%)`,
    fontFamily: "Inter",
    paddingTop: 40,
    paddingBottom: 38,
    paddingLeft: 44,
    paddingRight: 44,
  };
}

/** Divisor degradê usado abaixo do cabeçalho. */
export const DIVISOR_CABECALHO: S = {
  display: "flex",
  width: "100%",
  height: 1,
  marginTop: 22,
  marginBottom: 22,
  background: "linear-gradient(90deg, rgba(245,135,47,0.55), rgba(255,255,255,0.06))",
};

/** Divisor discreto acima do rodapé. */
export const DIVISOR_RODAPE: S = {
  display: "flex",
  width: "100%",
  height: 1,
  marginTop: 32,
  marginBottom: 18,
  background: "linear-gradient(90deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02))",
};
