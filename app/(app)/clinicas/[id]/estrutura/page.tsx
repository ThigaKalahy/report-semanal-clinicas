export const revalidate = 0;

import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { carregarEstrutura, disponibilidadeDasFontes } from "@/lib/estrutura/carregar";
import { indisponiveis } from "@/lib/estrutura/estrutura";
import { EstruturaForm } from "./_components/estrutura-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EstruturaClinicaPage({ params }: Props) {
  const { id } = await params;
  const db = getSupabaseAdmin();

  const { data: clinica } = await db
    .from("clinicas")
    .select("id, nome, google_place_id")
    .eq("id", id)
    .single();

  if (!clinica) notFound();

  const [{ estrutura, personalizada, atualizadoEm }, { data: fontes }] = await Promise.all([
    carregarEstrutura(id),
    db.from("fontes_dados").select("tipo, mapeamento").eq("clinica_id", id),
  ]);

  const semDados = indisponiveis(disponibilidadeDasFontes(fontes ?? [], !!clinica.google_place_id));

  return (
    <div className="space-y-8 max-w-3xl">
      <p className="text-sm text-muted-foreground">
          Estrutura do relatório: quais seções entram em cada periodicidade, em que ordem e com
          quais indicadores.
        </p>

      <EstruturaForm
        clinicaId={id}
        inicial={estrutura}
        personalizada={personalizada}
        atualizadoEm={atualizadoEm}
        semDados={semDados}
      />
    </div>
  );
}
