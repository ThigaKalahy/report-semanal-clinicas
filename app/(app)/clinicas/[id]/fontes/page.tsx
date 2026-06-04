export const revalidate = 0;

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, DollarSign, Receipt } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { FonteSection } from "./_components/fonte-section";
import { Badge } from "@/components/ui/badge";
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
  const nps         = fontes?.find((f) => f.tipo === "nps")          as FonteDados | undefined;
  const leads       = fontes?.find((f) => f.tipo === "leads")        as FonteDados | undefined;

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

      <FonteSection
        tipo="leads"
        title="Leads"
        description="Planilha com o pipeline de leads — cada linha é um lead, com coluna de status de conversão."
        clinicaId={id}
        fonte={leads ?? null}
      />

      {/* ── Módulos em desenvolvimento ────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground border border-dashed rounded-md px-4 py-2">
          Módulos em desenvolvimento — disponíveis em breve para integração.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {([
            { icon: DollarSign, label: "Faturamento", desc: "Integração com dados de receita e faturamento da clínica." },
            { icon: Receipt,    label: "Despesa",     desc: "Controle de despesas operacionais e custos fixos." },
          ] as const).map(({ icon: Icon, label, desc }) => (
            <div key={label} className="rounded-lg border bg-card p-5 opacity-50 select-none">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">{label}</span>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">Em breve</Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
