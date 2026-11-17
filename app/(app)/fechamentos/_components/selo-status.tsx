import { ROTULO_STATUS } from "@/lib/fechamento/status";
import type { StatusFechamento } from "@/lib/supabase/types";

/** Selo do estado do fechamento — o mesmo da lista do mês e da tela do fechamento. */
export const CLASSE_SELO: Record<StatusFechamento, string> = {
  em_conferencia: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  em_analise: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  concluido: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  enviado: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
};

export function SeloStatus({ status }: { status: StatusFechamento }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${CLASSE_SELO[status]}`}>
      {ROTULO_STATUS[status]}
    </span>
  );
}
