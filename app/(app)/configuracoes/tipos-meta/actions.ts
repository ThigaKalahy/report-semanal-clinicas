"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { tipoMetaSchema } from "./_schemas";

const SEED = [
  { nome: "Faturamento",       unidade: "R$", formato: "moeda_brl"      as const, comportamento: "acumulativa" as const, ordem_exibicao: 1 },
  { nome: "NPS respostas",     unidade: "un", formato: "numero_inteiro" as const, comportamento: "acumulativa" as const, ordem_exibicao: 2 },
  { nome: "Nota NPS Recepção", unidade: "—",  formato: "numero_decimal" as const, comportamento: "media"       as const, ordem_exibicao: 3 },
  { nome: "Nota Google",       unidade: "un", formato: "numero_decimal" as const, comportamento: "acumulativa" as const, ordem_exibicao: 4 },
];

export async function seedTiposMeta() {
  const db = getSupabaseAdmin();
  const { error } = await db.from("tipos_meta").insert(SEED);
  if (error) return { error: error.message };
  revalidatePath("/configuracoes/tipos-meta");
  return { ok: true };
}

export async function createTipoMeta(data: unknown) {
  const parsed = tipoMetaSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const db = getSupabaseAdmin();
  const { error } = await db.from("tipos_meta").insert({
    nome: parsed.data.nome,
    unidade: parsed.data.unidade,
    formato: parsed.data.formato,
    comportamento: parsed.data.comportamento,
    ordem_exibicao: parseInt(parsed.data.ordem_exibicao, 10),
  });
  if (error) return { error: error.message };
  revalidatePath("/configuracoes/tipos-meta");
  return { ok: true };
}

export async function updateTipoMeta(id: string, data: unknown) {
  const parsed = tipoMetaSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const db = getSupabaseAdmin();
  const { error } = await db
    .from("tipos_meta")
    .update({
      nome: parsed.data.nome,
      unidade: parsed.data.unidade,
      formato: parsed.data.formato,
      comportamento: parsed.data.comportamento,
      ordem_exibicao: parseInt(parsed.data.ordem_exibicao, 10),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/configuracoes/tipos-meta");
  return { ok: true };
}

export async function deleteTipoMeta(id: string) {
  const db = getSupabaseAdmin();
  const { error } = await db.from("tipos_meta").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/configuracoes/tipos-meta");
  return { ok: true };
}
