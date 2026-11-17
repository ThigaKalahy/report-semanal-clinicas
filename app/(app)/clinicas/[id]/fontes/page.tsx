export const revalidate = 0;

import { notFound } from "next/navigation";
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

  const preConsulta  = fontes?.find((f) => f.tipo === "pre_consulta") as FonteDados | undefined;
  const nps          = fontes?.find((f) => f.tipo === "nps")          as FonteDados | undefined;
  const leads        = fontes?.find((f) => f.tipo === "leads")        as FonteDados | undefined;
  const faturamento  = fontes?.find((f) => f.tipo === "faturamento")  as FonteDados | undefined;
  const despesa      = fontes?.find((f) => f.tipo === "despesa")      as FonteDados | undefined;
  const entradas     = fontes?.find((f) => f.tipo === "entradas")     as FonteDados | undefined;
  const orcamentos   = fontes?.find((f) => f.tipo === "orcamentos")   as FonteDados | undefined;

  return (
    <div className="space-y-8 max-w-3xl">
      <p className="text-sm text-muted-foreground">
          Configure as planilhas Google Sheets usadas para coletar os dados do relatório.
        </p>

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

      <FonteSection
        tipo="faturamento"
        title="Faturamento"
        description="Planilha com os lançamentos de receita da clínica (data, categoria, valor pago, profissional)."
        clinicaId={id}
        fonte={faturamento ?? null}
      />

      <FonteSection
        tipo="despesa"
        title="Despesa"
        description="Planilha com os lançamentos de despesas operacionais (data, categoria, valor pago)."
        clinicaId={id}
        fonte={despesa ?? null}
      />

      <FonteSection
        tipo="entradas"
        title="Entradas"
        description="Planilha com os recebimentos — o que entrou no caixa, pela data do recebimento. Usada no resultado de caixa do fechamento mensal."
        clinicaId={id}
        fonte={entradas ?? null}
      />

      <FonteSection
        tipo="orcamentos"
        title="Orçamentos"
        description="Planilha com os orçamentos gerados e o status de cada um. Alimenta o funil de orçamentos (cancelados ficam fora da conversão)."
        clinicaId={id}
        fonte={orcamentos ?? null}
      />
    </div>
  );
}
