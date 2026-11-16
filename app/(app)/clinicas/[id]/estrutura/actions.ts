"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { normalizarEstrutura } from "@/lib/estrutura/estrutura";
import type { Estrutura } from "@/lib/estrutura/estrutura";
import type { Json } from "@/lib/supabase/types";

export async function salvarEstrutura(
  clinicaId: string,
  estrutura: Estrutura,
): Promise<{ ok: boolean; erro?: string; atualizadoEm?: string }> {
  const db = getSupabaseAdmin();
  // Nunca grava o que veio do navegador sem passar pela normalização
  const config = normalizarEstrutura(estrutura) as unknown as Json;

  const { data, error } = await db
    .from("estruturas_relatorio")
    .upsert({ clinica_id: clinicaId, config }, { onConflict: "clinica_id" })
    .select("updated_at")
    .single();

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/clinicas/${clinicaId}/estrutura`);
  return { ok: true, atualizadoEm: data?.updated_at };
}

/** Volta a clínica para a estrutura padrão (apaga a personalização). */
export async function restaurarEstruturaPadrao(
  clinicaId: string,
): Promise<{ ok: boolean; erro?: string }> {
  const { error } = await getSupabaseAdmin()
    .from("estruturas_relatorio")
    .delete()
    .eq("clinica_id", clinicaId);

  if (error) return { ok: false, erro: error.message };
  revalidatePath(`/clinicas/${clinicaId}/estrutura`);
  return { ok: true };
}
