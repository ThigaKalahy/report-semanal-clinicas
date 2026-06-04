import { readSheetRange } from "@/lib/google/sheets";
import type { FonteDados, Json } from "@/lib/supabase/types";

export interface ResultadoLeads {
  total: number;
  convertidos: number;
  taxa_conversao: number | null; // null when total = 0, never NaN
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
  // Accepts DD/MM/YYYY or D/M/YYYY
  const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

function normStr(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export async function coletarLeads(
  fonte: FonteDados,
  dataInicio: Date,
  dataFim: Date
): Promise<ResultadoLeads> {
  const mapeamento    = getMapeamento(fonte.mapeamento);
  const range         = `${fonte.aba_nome}!A:Z`;
  const rows          = await readSheetRange(fonte.sheet_id, range);

  const dataIdx        = colIndex(fonte.coluna_data);
  const convertidoIdx  = mapeamento.convertido ? colIndex(mapeamento.convertido) : -1;
  const valorConversao = normStr(mapeamento.valor_conversao ?? "sim");

  // linha_inicial: 1-indexed row where data starts.
  // Default 2 = header on row 1, data from row 2 (standard Google Form sheet).
  // Set 3 when there is a title row before the header (e.g. "Controle de Leads").
  const linhaInicial = Math.max(2, parseInt(String(mapeamento.linha_inicial ?? "2"), 10));
  const dataRows     = rows.slice(linhaInicial - 1);

  const iniMs = new Date(dataInicio.getFullYear(), dataInicio.getMonth(), dataInicio.getDate()).getTime();
  const fimMs = new Date(dataFim.getFullYear(),    dataFim.getMonth(),    dataFim.getDate()).getTime();

  // ── Diagnostic logs (remove after validation) ─────────────────────────────
  console.log("[leads] range lido:", range);
  console.log("[leads] total linhas retornadas pela API:", rows.length);
  console.log("[leads] linha_inicial:", linhaInicial, `→ rows.slice(${linhaInicial - 1})`);
  console.log("[leads] linhas de dados após slice:", dataRows.length);
  console.log("[leads] coluna_data:", fonte.coluna_data, "→ índice", dataIdx);
  console.log("[leads] coluna convertido:", mapeamento.convertido ?? "(não configurada)", "→ índice", convertidoIdx);
  console.log("[leads] valor_conversao normalizado:", JSON.stringify(valorConversao));
  console.log(
    "[leads] período:",
    dataInicio.toLocaleDateString("pt-BR"), "→", dataFim.toLocaleDateString("pt-BR"),
    `(${iniMs} → ${fimMs})`,
  );

  console.log("[leads] primeiras 3 linhas de dados (cru):");
  for (let i = 0; i < Math.min(3, dataRows.length); i++) {
    const row      = dataRows[i];
    const rawDate  = String(row[dataIdx] ?? "(vazio)");
    const parsed   = parseSheetDate(rawDate);
    const passou   = parsed ? (parsed.getTime() >= iniMs && parsed.getTime() <= fimMs) : false;
    const rawConv  = convertidoIdx >= 0 ? String(row[convertidoIdx] ?? "(vazio)") : "(coluna não configurada)";
    const normConv = convertidoIdx >= 0 ? normStr(rawConv) : "-";
    const contaConv = convertidoIdx >= 0 ? normConv.includes(valorConversao) : false;

    console.log(
      `  [leads] linha ${linhaInicial + i}:`,
      `data="${rawDate}" parsed=${parsed?.toLocaleDateString("pt-BR") ?? "null"} filtro=${passou}`,
      `| conv="${rawConv}" norm="${normConv}" conta=${contaConv}`,
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  const filtered = dataRows.filter((row) => {
    const d = parseSheetDate(String(row[dataIdx] ?? ""));
    if (!d) return false;
    const t = d.getTime();
    return t >= iniMs && t <= fimMs;
  });

  console.log("[leads] linhas que passaram no filtro de data:", filtered.length);

  const total = filtered.length;
  let convertidos = 0;

  if (convertidoIdx >= 0) {
    for (const row of filtered) {
      const cell = normStr(String(row[convertidoIdx] ?? ""));
      if (cell.includes(valorConversao)) convertidos++;
    }
  }

  console.log("[leads] resultado final → total:", total, "| convertidos:", convertidos);

  return {
    total,
    convertidos,
    taxa_conversao: total > 0 ? Math.round((convertidos / total) * 1000) / 10 : null,
  };
}
