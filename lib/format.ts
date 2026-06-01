import type { FormatoMeta } from "@/lib/supabase/types";

export function formatValor(valor: number, formato: FormatoMeta): string {
  const abs = Math.abs(valor);
  const sign = valor < 0 ? "-" : "";

  switch (formato) {
    case "moeda_brl": {
      if (abs >= 1_000_000) {
        const v = (abs / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
        return `${sign}R$${v}M`;
      }
      if (abs >= 1_000) {
        const v = (abs / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
        return `${sign}R$${v}k`;
      }
      return `${sign}R$${abs.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    case "numero_inteiro":
      return valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
    case "numero_decimal":
      return valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    case "percentual":
      return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  }
}
