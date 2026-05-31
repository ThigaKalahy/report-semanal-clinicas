import { getSupabaseAdmin } from "@/lib/supabase/server";
import { RelatorioClient } from "./_components/relatorio-client";

export default async function RelatorioPage() {
  const db = getSupabaseAdmin();
  const { data: clinicas } = await db
    .from("clinicas")
    .select("id, nome, slug, tag_curta, google_place_id, ativa, created_at, updated_at")
    .eq("ativa", true)
    .order("nome", { ascending: true });

  return <RelatorioClient clinicas={clinicas ?? []} />;
}
