export const revalidate = 0;

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { CheckpointClient } from "./_components/checkpoint-client";
import type { Clinica } from "@/lib/supabase/types";

export default async function CheckpointPage() {
  const db = getSupabaseAdmin();

  const { data: clinicas } = await db
    .from("clinicas")
    .select("*")
    .eq("ativa", true)
    .order("nome");

  return <CheckpointClient clinicas={(clinicas ?? []) as Clinica[]} />;
}
