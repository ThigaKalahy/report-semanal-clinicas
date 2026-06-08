export const revalidate = 0;

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { RelatorioClient } from "./_components/relatorio-client";
import type { RelatorioGerado } from "@/lib/supabase/types";

interface Props {
  searchParams: Promise<{ relatorio?: string }>;
}

export default async function RelatorioPage({ searchParams }: Props) {
  const { relatorio: relatorioId } = await searchParams;
  const db = getSupabaseAdmin();

  const [clinicasResult, relatorioResult] = await Promise.all([
    db
      .from("clinicas")
      .select("id, nome, slug, tag_curta, google_place_id, ativa, created_at, updated_at")
      .eq("ativa", true)
      .order("nome", { ascending: true }),
    relatorioId
      ? db.from("relatorios_gerados").select("*").eq("id", relatorioId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <RelatorioClient
      clinicas={clinicasResult.data ?? []}
      relatorioParaReabrir={(relatorioResult.data ?? null) as RelatorioGerado | null}
    />
  );
}
