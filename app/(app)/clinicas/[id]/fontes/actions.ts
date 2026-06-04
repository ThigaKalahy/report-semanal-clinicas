"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { preConsultaSchema, npsSchema, leadsSchema } from "./_schemas";
import type { Json } from "@/lib/supabase/types";

type TipoFonte = "pre_consulta" | "nps" | "leads";

function buildMapeamento(tipo: TipoFonte, data: Record<string, unknown>): Record<string, string> {
  const m: Record<string, string> = {};
  const add = (key: string) => { if (data[key]) m[key] = String(data[key]); };

  if (tipo === "pre_consulta") {
    add("motivo");
    add("origem");
  } else if (tipo === "nps") {
    add("nota_geral");
    add("nota_profissional");
    add("nota_recepcao");
    add("nota_infraestrutura");
    add("nota_enfermagem");
    add("comentario");
    add("nome_paciente");
    add("anonimato");
    add("indicacao");
  } else {
    // leads
    add("convertido");
    if (data.valor_conversao) m.valor_conversao = String(data.valor_conversao);
    // Only persist linha_inicial when non-default (> 2) to keep mapeamento clean
    const li = Number(data.linha_inicial);
    if (li > 2) m.linha_inicial = String(li);
  }
  return m;
}

export async function upsertFonte(
  clinicaId: string,
  tipo: TipoFonte,
  rawData: unknown
) {
  const schema =
    tipo === "pre_consulta" ? preConsultaSchema :
    tipo === "nps"          ? npsSchema          :
                              leadsSchema;

  const parsed = schema.safeParse(rawData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { sheet_id, aba_nome, coluna_data, ...rest } = parsed.data;
  const mapeamento = buildMapeamento(tipo, rest as Record<string, unknown>);

  const db = getSupabaseAdmin();
  const { data: existing } = await db
    .from("fontes_dados")
    .select("id")
    .eq("clinica_id", clinicaId)
    .eq("tipo", tipo)
    .maybeSingle();

  const payload = {
    sheet_id,
    aba_nome,
    coluna_data,
    mapeamento: mapeamento as Json,
    ativo: true,
  };

  const { error } = existing?.id
    ? await db.from("fontes_dados").update(payload).eq("id", existing.id)
    : await db.from("fontes_dados").insert({ ...payload, clinica_id: clinicaId, tipo });

  if (error) return { error: error.message };
  revalidatePath(`/clinicas/${clinicaId}/fontes`);
  return { ok: true };
}

export async function deleteFonte(clinicaId: string, tipo: TipoFonte) {
  const db = getSupabaseAdmin();
  const { error } = await db
    .from("fontes_dados")
    .delete()
    .eq("clinica_id", clinicaId)
    .eq("tipo", tipo);
  if (error) return { error: error.message };
  revalidatePath(`/clinicas/${clinicaId}/fontes`);
  return { ok: true };
}
