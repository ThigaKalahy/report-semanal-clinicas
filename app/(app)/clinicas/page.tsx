export const revalidate = 0;

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { ClinicasClient } from "./_components/clinicas-client";
import type { Clinica } from "@/lib/supabase/types";

export type ClinicaComFontes = Clinica & {
  fontes_dados: { id: string; tipo: string }[];
};

export default async function ClinicasPage() {
  const db = getSupabaseAdmin();
  const { data: clinicas } = await db
    .from("clinicas")
    .select("*, fontes_dados(id, tipo)")
    .order("nome");

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clínicas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie as clínicas e suas fontes de dados.
          </p>
        </div>
      </div>
      <ClinicasClient clinicas={(clinicas ?? []) as ClinicaComFontes[]} />
    </div>
  );
}
