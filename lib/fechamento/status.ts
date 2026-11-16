import type { StatusFechamento } from "@/lib/supabase/types";

/** Fluxo do fechamento, na ordem. Módulo puro. */
export const ETAPAS: { status: StatusFechamento; rotulo: string; descricao: string }[] = [
  { status: "em_conferencia", rotulo: "Conferência", descricao: "Leitura das planilhas e alertas" },
  { status: "em_analise",     rotulo: "Indicadores e análise", descricao: "Números do período e leitura do consultor" },
  { status: "concluido",      rotulo: "Texto e entrega", descricao: "Texto pronto para enviar" },
  { status: "enviado",        rotulo: "Enviado", descricao: "Entregue ao cliente" },
];

export const ROTULO_STATUS: Record<StatusFechamento, string> = {
  em_conferencia: "Em conferência",
  em_analise: "Em análise",
  concluido: "Concluído",
  enviado: "Enviado",
};

/** Cor do selo de estado — legível nos dois temas. */
export const CLASSE_STATUS: Record<StatusFechamento, string> = {
  em_conferencia: "border-amber-500/40 text-amber-700 dark:text-amber-400",
  em_analise: "border-sky-500/40 text-sky-700 dark:text-sky-400",
  concluido: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
  enviado: "border-border text-muted-foreground",
};

export function posicaoDoStatus(status: StatusFechamento): number {
  return ETAPAS.findIndex((e) => e.status === status);
}

export function proximoStatus(status: StatusFechamento): StatusFechamento | null {
  return ETAPAS[posicaoDoStatus(status) + 1]?.status ?? null;
}
