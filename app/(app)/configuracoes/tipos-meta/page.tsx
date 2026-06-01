export const revalidate = 0;

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { TiposMetaClient } from "./_components/tipos-meta-client";
import { seedTiposMeta } from "./actions";

export default async function TiposMetaPage() {
  const db = getSupabaseAdmin();
  let { data: tiposMeta } = await db
    .from("tipos_meta")
    .select("*")
    .order("ordem_exibicao", { ascending: true });

  // Seed automático se vazio
  if (!tiposMeta || tiposMeta.length === 0) {
    await seedTiposMeta();
    const { data } = await db
      .from("tipos_meta")
      .select("*")
      .order("ordem_exibicao", { ascending: true });
    tiposMeta = data;
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <TiposMetaClient tiposMeta={tiposMeta ?? []} />
    </div>
  );
}
