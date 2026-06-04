"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { metaSchema, editarMetaSchema, atualizarRealizadosSchema } from "./_schemas";

function toNumber(v: string): number {
  return parseFloat(v.replace(",", ".")) || 0;
}

export async function criarMeta(
  clinicaId: string,
  mes: number,
  ano: number,
  data: unknown
) {
  const parsed = metaSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const db = getSupabaseAdmin();
  const { error } = await db.from("metas").insert({
    clinica_id: clinicaId,
    tipo_meta_id: parsed.data.tipo_meta_id,
    mes,
    ano,
    valor_meta_mensal: toNumber(parsed.data.valor_meta_mensal),
    valor_realizado: 0,
    valor_realizado_semana: 0,
  });

  if (error) {
    if (error.code === "23505") return { error: "Já existe uma meta deste tipo para este mês." };
    return { error: error.message };
  }
  revalidatePath(`/clinicas/${clinicaId}/metas`);
  return { ok: true };
}

export async function editarMeta(id: string, clinicaId: string, data: unknown) {
  const parsed = editarMetaSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const db = getSupabaseAdmin();
  const { error } = await db
    .from("metas")
    .update({ valor_meta_mensal: toNumber(parsed.data.valor_meta_mensal) })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath(`/clinicas/${clinicaId}/metas`);
  return { ok: true };
}

export async function deletarMeta(id: string, clinicaId: string) {
  const db = getSupabaseAdmin();
  const { error } = await db.from("metas").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/clinicas/${clinicaId}/metas`);
  return { ok: true };
}

export async function atualizarRealizados(clinicaId: string, data: unknown) {
  const parsed = atualizarRealizadosSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const db = getSupabaseAdmin();
  const promises = parsed.data.updates.map(({ id, valor_realizado }) =>
    db.from("metas").update({
      valor_realizado: toNumber(valor_realizado),
      data_referencia: parsed.data.data_referencia,
    }).eq("id", id)
  );

  const results = await Promise.all(promises);
  const err = results.find((r) => r.error);
  if (err?.error) return { error: err.error.message };

  revalidatePath(`/clinicas/${clinicaId}/metas`);
  return { ok: true };
}
