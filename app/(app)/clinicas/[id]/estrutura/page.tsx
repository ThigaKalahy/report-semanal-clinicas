export const revalidate = 0;

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
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
    <div className="p-8 space-y-8 max-w-3xl">
      <div className="space-y-1">
        <Link href="/clinicas"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" />Clínicas
        </Link>
        <h1 className="text-2xl font-bold font-heading">{clinica.nome}</h1>
        <p className="text-sm text-muted-foreground">
          Estrutura do relatório: quais seções entram em cada periodicidade, em que ordem e com
          quais indicadores.
        </p>
      </div>

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
