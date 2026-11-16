export const revalidate = 0;

import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { carregarEstrutura } from "@/lib/estrutura/carregar";
import { carregarFicha } from "@/lib/perfil/carregar";
import { vocabularioDe } from "@/lib/perfil/vocabulario";
import { rotuloPeriodo } from "@/lib/fechamento/periodo";
import type { DadosFechamento } from "@/lib/fechamento/dados";
import type { AcaoPlano } from "@/lib/fechamento/secoes";
import { FechamentoClient } from "./_components/fechamento-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function FechamentoPage({ params }: Props) {
  const { id } = await params;
  const db = getSupabaseAdmin();

  const { data: f } = await db.from("fechamentos").select("*").eq("id", id).maybeSingle();
  if (!f) notFound();

  const [{ data: clinica }, { estrutura }, ficha] = await Promise.all([
    db.from("clinicas").select("id, nome").eq("id", f.clinica_id).single(),
    carregarEstrutura(f.clinica_id),
    carregarFicha(f.clinica_id),
  ]);

  const acoes = Array.isArray(f.acoes) ? (f.acoes as unknown as AcaoPlano[]) : [];

  return (
    <FechamentoClient
      id={f.id}
      clinicaId={f.clinica_id}
      clinicaNome={clinica?.nome ?? "Clínica"}
      tipo={f.tipo}
      rotulo={rotuloPeriodo({ tipo: f.tipo, ano: f.ano, mes: f.mes, quinzena: f.quinzena as 1 | 2 | null })}
      statusInicial={f.status}
      dadosIniciais={f.dados as unknown as DadosFechamento | null}
      lista={estrutura[f.tipo]}
      vocabulario={vocabularioDe(ficha)}
      analiseInicial={f.analise}
      acoesIniciais={acoes}
      textoInicial={f.texto}
      enviadoEmInicial={f.enviado_em}
    />
  );
}
