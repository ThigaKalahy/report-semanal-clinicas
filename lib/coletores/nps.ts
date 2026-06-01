import { readSheetRange } from "@/lib/google/sheets";
import type { FonteDados, Json } from "@/lib/supabase/types";

export interface NotaCount {
  nota: number;
  count: number;
}

export interface ResultadoNPS {
  total: number;
  notas_gerais: NotaCount[];
  classificacao: { promotores: number; neutros: number; detratores: number };
  nps_score: number;
  medias_por_area: {
    profissional: number | null;
    recepcao: number | null;
    infraestrutura: number | null;
    enfermagem: number | null;
  };
  comentarios: { nome: string; comentario: string }[];
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
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

function parseNota(v: string): number | null {
  const s = v.trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}

function mediaValida(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null);
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export async function coletarNPS(
  fonte: FonteDados,
  dataInicio: Date,
  dataFim: Date
): Promise<ResultadoNPS> {
  const mapeamento = getMapeamento(fonte.mapeamento);
  const rows = await readSheetRange(fonte.sheet_id, `${fonte.aba_nome}!A:Z`);

  const dataIdx = colIndex(fonte.coluna_data);
  const idx = (key: string) => (mapeamento[key] ? colIndex(mapeamento[key]) : -1);
  const notaGeralIdx = idx("nota_geral");
  const notaProfIdx = idx("nota_profissional");
  const notaRecIdx = idx("nota_recepcao");
  const notaInfraIdx = idx("nota_infraestrutura");
  const notaEnfIdx = idx("nota_enfermagem");
  const comentIdx = idx("comentario");
  const nomeIdx = idx("nome_paciente");

  const iniMs = new Date(dataInicio.getFullYear(), dataInicio.getMonth(), dataInicio.getDate()).getTime();
  const fimMs = new Date(dataFim.getFullYear(), dataFim.getMonth(), dataFim.getDate()).getTime();

  const filtered = rows.slice(1).filter((row) => {
    const d = parseSheetDate(String(row[dataIdx] ?? ""));
    if (!d) return false;
    const t = d.getTime();
    return t >= iniMs && t <= fimMs;
  });

  const notasGerais: number[] = [];
  const notasProf: (number | null)[] = [];
  const notasRec: (number | null)[] = [];
  const notasInfra: (number | null)[] = [];
  const notasEnf: (number | null)[] = [];
  const comentarios: { nome: string; comentario: string }[] = [];

  let promotores = 0,
    neutros = 0,
    detratores = 0;

  for (const row of filtered) {
    if (notaGeralIdx >= 0) {
      const ng = parseNota(String(row[notaGeralIdx] ?? ""));
      if (ng !== null) {
        notasGerais.push(ng);
        if (ng >= 9) promotores++;
        else if (ng >= 7) neutros++;
        else detratores++;
      }
    }
    if (notaProfIdx >= 0) notasProf.push(parseNota(String(row[notaProfIdx] ?? "")));
    if (notaRecIdx >= 0) notasRec.push(parseNota(String(row[notaRecIdx] ?? "")));
    if (notaInfraIdx >= 0) notasInfra.push(parseNota(String(row[notaInfraIdx] ?? "")));
    if (notaEnfIdx >= 0) notasEnf.push(parseNota(String(row[notaEnfIdx] ?? "")));

    if (comentIdx >= 0) {
      const comentario = String(row[comentIdx] ?? "").trim();
      if (comentario) {
        const nome = nomeIdx >= 0 ? String(row[nomeIdx] ?? "").trim() : "";
        comentarios.push({ nome: nome || "Paciente", comentario });
      }
    }
  }

  const notaMap = new Map<number, number>();
  for (const n of notasGerais) notaMap.set(n, (notaMap.get(n) ?? 0) + 1);
  const notas_gerais: NotaCount[] = Array.from(notaMap.entries())
    .map(([nota, count]) => ({ nota, count }))
    .sort((a, b) => b.nota - a.nota);

  const nps_score =
    notasGerais.length > 0
      ? Math.round(((promotores - detratores) / notasGerais.length) * 100)
      : 0;

  return {
    total: filtered.length,
    notas_gerais,
    classificacao: { promotores, neutros, detratores },
    nps_score,
    medias_por_area: {
      profissional: mediaValida(notasProf),
      recepcao: mediaValida(notasRec),
      infraestrutura: mediaValida(notasInfra),
      enfermagem: mediaValida(notasEnf),
    },
    comentarios,
  };
}
