export const revalidate = 0;

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { resolverAtivos } from "@/lib/checkpoint/indicadores";
import { IndicadoresForm } from "./_components/indicadores-form";
import type { TipoFonte } from "@/lib/supabase/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CheckpointClinicaPage({ params }: Props) {
  const { id } = await params;
  const db = getSupabaseAdmin();

  const [{ data: clinica }, { data: fontes }, { data: linhas }] = await Promise.all([
    db.from("clinicas").select("id, nome").eq("id", id).single(),
    db.from("fontes_dados").select("tipo").eq("clinica_id", id),
    db.from("checkpoint_indicadores").select("indicador, ativo").eq("clinica_id", id),
  ]);

  if (!clinica) notFound();

  const tiposFonte = (fontes ?? []).map((f) => f.tipo as TipoFonte);
  const ativos     = resolverAtivos(linhas ?? [], tiposFonte);
  const jaSalvo    = (linhas ?? []).length > 0;

  return (
    <div className="p-8 space-y-8 max-w-3xl">
      {/* Breadcrumb */}
      <div className="space-y-1">
        <Link href="/clinicas"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" />Clínicas
        </Link>
        <h1 className="text-2xl font-bold font-heading">{clinica.nome}</h1>
        <p className="text-sm text-muted-foreground">
          Escolha quais indicadores esta clínica acompanha no checkpoint semanal.
        </p>
      </div>

      <IndicadoresForm
        clinicaId={id}
        ativosIniciais={ativos}
        tiposFonte={tiposFonte}
        jaSalvo={jaSalvo}
      />
    </div>
  );
}
