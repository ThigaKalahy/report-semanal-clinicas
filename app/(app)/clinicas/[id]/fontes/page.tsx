export const revalidate = 0;

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { FonteSection } from "./_components/fonte-section";
import type { FonteDados } from "@/lib/supabase/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function FontesPage({ params }: Props) {
  const { id } = await params;
  const db = getSupabaseAdmin();

  const { data: clinica } = await db
    .from("clinicas")
    .select("id, nome, slug")
    .eq("id", id)
    .single();

  if (!clinica) notFound();

  const { data: fontes } = await db
    .from("fontes_dados")
    .select("*")
    .eq("clinica_id", id);

  const preConsulta = fontes?.find((f) => f.tipo === "pre_consulta") as FonteDados | undefined;
  const nps = fontes?.find((f) => f.tipo === "nps") as FonteDados | undefined;

  return (
    <div className="p-8 space-y-8 max-w-3xl">
      {/* Breadcrumb */}
      <div className="space-y-1">
        <Link
          href="/clinicas"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Clínicas
        </Link>
        <h1 className="text-2xl font-bold">{clinica.nome}</h1>
        <p className="text-sm text-muted-foreground">
          Configure as planilhas Google Sheets usadas para coletar os dados do relatório.
        </p>
      </div>

      <FonteSection
        tipo="pre_consulta"
        title="Pré-Consulta"
        description="Planilha com as respostas da pesquisa realizada antes da consulta."
        clinicaId={id}
        fonte={preConsulta ?? null}
      />

      <FonteSection
        tipo="nps"
        title="NPS"
        description="Planilha com as respostas da pesquisa de satisfação pós-consulta."
        clinicaId={id}
        fonte={nps ?? null}
      />
    </div>
  );
}
