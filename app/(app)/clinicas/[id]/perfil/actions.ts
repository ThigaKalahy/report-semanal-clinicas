"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { normalizarFicha } from "@/lib/perfil/ficha";
import type { FichaCliente } from "@/lib/perfil/ficha";
import { fichaParaLinha } from "@/lib/perfil/carregar";

export async function salvarFicha(
  clinicaId: string,
  ficha: FichaCliente,
): Promise<{ ok: boolean; erro?: string; atualizadoEm?: string }> {
  const db = getSupabaseAdmin();
  const linha = fichaParaLinha(clinicaId, normalizarFicha(ficha));

  const { data, error } = await db
    .from("perfis_cliente")
    .upsert(linha, { onConflict: "clinica_id" })
    .select("updated_at")
    .single();

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/clinicas/${clinicaId}/perfil`);
  revalidatePath("/clinicas");
  return { ok: true, atualizadoEm: data?.updated_at };
}
