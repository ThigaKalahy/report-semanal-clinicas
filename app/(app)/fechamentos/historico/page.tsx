export const revalidate = 0;

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { FechamentosClient } from "../_components/fechamentos-client";
import type { LinhaFechamento } from "../_components/fechamentos-client";
import type { DadosFechamento } from "@/lib/fechamento/dados";

interface Props {
  searchParams: Promise<{ cliente?: string }>;
}

/** Histórico: todos os fechamentos, com busca e filtros. */
export default async function HistoricoPage({ searchParams }: Props) {
  const { cliente } = await searchParams;
  const db = getSupabaseAdmin();

  const [{ data: clinicas }, { data: fechamentos, error }] = await Promise.all([
    db.from("clinicas").select("id, nome").eq("ativa", true).order("nome"),
    db.from("fechamentos")
      .select("id, clinica_id, tipo, ano, mes, quinzena, status, dados, lido_em, enviado_em")
      .order("ano", { ascending: false })
      .order("mes", { ascending: false })
      .limit(500),
  ]);

  const nomes = new Map((clinicas ?? []).map((c) => [c.id, c.nome]));
  const linhas: LinhaFechamento[] = (fechamentos ?? []).map((f) => {
    const dados = f.dados as unknown as DadosFechamento | null;
    return {
      id: f.id,
      clinicaId: f.clinica_id,
      clinicaNome: nomes.get(f.clinica_id) ?? "Clínica inativa",
      tipo: f.tipo,
      ano: f.ano,
      mes: f.mes,
      quinzena: f.quinzena as 1 | 2 | null,
      status: f.status,
      faturamento: dados?.faturamento?.total ?? null,
      alertas: dados?.alertas.filter((a) => a.gravidade !== "info").length ?? 0,
      lidoEm: f.lido_em,
      enviadoEm: f.enviado_em,
    };
  });

  return (
    <FechamentosClient
      clinicas={clinicas ?? []}
      linhas={linhas}
      // Tabela ainda não criada: a tela explica em vez de mostrar uma lista vazia enganosa
      erroBanco={error ? error.message : null}
      buscaInicial={cliente ? nomes.get(cliente) ?? "" : ""}
    />
  );
}
