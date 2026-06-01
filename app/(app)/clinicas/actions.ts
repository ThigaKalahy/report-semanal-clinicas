"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { clinicaSchema } from "./_schemas";

function nullify(v: string | undefined): string | null {
  return v && v.trim() ? v.trim() : null;
}

export async function createClinica(data: unknown) {
  const parsed = clinicaSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const db = getSupabaseAdmin();
  const { error } = await db.from("clinicas").insert({
    nome: parsed.data.nome,
    slug: parsed.data.slug,
    tag_curta: nullify(parsed.data.tag_curta),
    google_place_id: nullify(parsed.data.google_place_id),
    ativa: parsed.data.ativa,
  });

  if (error) {
    if (error.code === "23505") return { error: "Slug já existe. Escolha outro." };
    return { error: error.message };
  }
  revalidatePath("/clinicas");
  return { ok: true };
}

export async function updateClinica(id: string, data: unknown) {
  const parsed = clinicaSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const db = getSupabaseAdmin();
  const { error } = await db
    .from("clinicas")
    .update({
      nome: parsed.data.nome,
      slug: parsed.data.slug,
      tag_curta: nullify(parsed.data.tag_curta),
      google_place_id: nullify(parsed.data.google_place_id),
      ativa: parsed.data.ativa,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") return { error: "Slug já existe. Escolha outro." };
    return { error: error.message };
  }
  revalidatePath("/clinicas");
  return { ok: true };
}

export async function deleteClinica(id: string) {
  const db = getSupabaseAdmin();
  const { error } = await db.from("clinicas").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/clinicas");
  return { ok: true };
}
