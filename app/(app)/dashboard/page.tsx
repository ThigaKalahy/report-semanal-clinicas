export const revalidate = 0;

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { DashboardClient, type RelatorioComClinica } from "./_components/dashboard-client";

export default async function DashboardPage() {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("relatorios_gerados")
    .select("*, clinicas(nome)")
    .order("gerado_em", { ascending: false })
    .limit(20);

  return <DashboardClient relatorios={(data ?? []) as unknown as RelatorioComClinica[]} />;
}
