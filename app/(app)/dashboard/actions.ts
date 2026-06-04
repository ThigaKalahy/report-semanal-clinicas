"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function excluirRelatorios(
  ids: string[]
): Promise<{ ok?: boolean; error?: string }> {
  if (!ids.length) return { ok: true };
  const db = getSupabaseAdmin();
  const { error } = await db.from("relatorios_gerados").delete().in("id", ids);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}
