import { readSheetRange } from "@/lib/google/sheets";
import type { FonteDados, Json } from "@/lib/supabase/types";
import type { GrupoFinanceiro } from "./faturamento";

export type { GrupoFinanceiro };

export interface ResultadoDespesa {
  total_despesa: number;
  qtd_lancamentos: number;
  por_categoria: Record<string, GrupoFinanceiro>;
}

function getMapeamento(m: Json): Record<string, string> {
  if (m && typeof m === "object" && !Array.isArray(m)) return m as Record<string, string>;
  return {};
}

function colIndex(letter: string): number {
  let idx = 0;
  for (const ch of letter.toUpperCase()) idx = idx * 26 + (ch.charCodeAt(0) - 64);
  return idx - 1;
}

function parseSheetDate(value: string): Date | null {
  const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

function parseValorBR(raw: string): number {
  const s = String(raw).replace(/[R$\s]/g, "").trim();
  if (!s) return 0;
  let normalized: string;
  if (s.includes(",")) {
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(".")) {
    const parts = s.split(".");
    const lastPart = parts[parts.length - 1];
    if (parts.length === 2 && lastPart.length <= 2) {
      normalized = s;
    } else {
      normalized = s.replace(/\./g, "");
    }
  } else {
    normalized = s;
  }
  const v = parseFloat(normalized);
  return isFinite(v) && v > 0 ? v : 0;
}

function normKey(s: string): string {
  return s.trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function buildGrupo(
  items: Array<{ key: string; valor: number }>,
  total: number
): Record<string, GrupoFinanceiro> {
  const map = new Map<string, { display: string; total: number }>();
  for (const { key, valor } of items) {
    if (!key) continue;
    const norm = normKey(key);
    const existing = map.get(norm);
    if (existing) {
      existing.total += valor;
    } else {
      map.set(norm, { display: key, total: valor });
    }
  }
  return Object.fromEntries(
    [...map.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .map(([, { display, total: t }]) => [
        display,
        {
          total:        Math.round(t * 100) / 100,
          pct_do_total: total > 0 ? Math.round((t / total) * 1000) / 10 : 0,
        },
      ])
  );
}

export async function coletarDespesa(
  fonte: FonteDados,
  dataInicio: Date,
  dataFim: Date
): Promise<ResultadoDespesa> {
  const mapeamento = getMapeamento(fonte.mapeamento);
  const range      = `${fonte.aba_nome}!A:Z`;
  const rows       = await readSheetRange(fonte.sheet_id, range);

  const dataIdx      = colIndex(fonte.coluna_data);
  const categoriaIdx = mapeamento.categoria  ? colIndex(mapeamento.categoria)  : -1;
  const valorIdx     = mapeamento.valor_pago ? colIndex(mapeamento.valor_pago) : -1;
  const linhaInicial = Math.max(2, parseInt(String(mapeamento.linha_inicial ?? "2"), 10));
  const dataRows     = rows.slice(linhaInicial - 1);

  const iniMs = new Date(dataInicio.getFullYear(), dataInicio.getMonth(), dataInicio.getDate()).getTime();
  const fimMs = new Date(dataFim.getFullYear(),    dataFim.getMonth(),    dataFim.getDate()).getTime();

  console.log("[despesa] range:", range, "| total rows:", rows.length, "| linha_inicial:", linhaInicial, "| dataRows:", dataRows.length);
  console.log("[despesa] cols — data:", dataIdx, "categoria:", categoriaIdx, "valor_pago:", valorIdx);

  const categorias: Array<{ key: string; valor: number }> = [];
  let total_despesa   = 0;
  let qtd_lancamentos = 0;

  dataRows.forEach((row, i) => {
    const dateRaw  = String(row[dataIdx]  ?? "");
    const valorRaw = String(row[valorIdx] ?? "");
    const date     = parseSheetDate(dateRaw);
    const valor    = valorIdx >= 0 ? parseValorBR(valorRaw) : 0;

    if (i < 3) {
      const inRange = date ? date.getTime() >= iniMs && date.getTime() <= fimMs : false;
      console.log(`[despesa] row ${linhaInicial + i}: date="${dateRaw}" → ${date?.toISOString() ?? "null"} | valor="${valorRaw}" → ${valor} | inRange=${inRange}`);
    }

    if (!date) return;
    const t = date.getTime();
    if (t < iniMs || t > fimMs || valor <= 0) return;

    total_despesa += valor;
    qtd_lancamentos++;

    const cat = String(row[categoriaIdx] ?? "").trim();
    categorias.push({ key: cat, valor });
  });

  console.log("[despesa] total_despesa:", total_despesa, "| qtd_lancamentos:", qtd_lancamentos);

  return {
    total_despesa:   Math.round(total_despesa * 100) / 100,
    qtd_lancamentos,
    por_categoria: buildGrupo(categorias, total_despesa),
  };
}
