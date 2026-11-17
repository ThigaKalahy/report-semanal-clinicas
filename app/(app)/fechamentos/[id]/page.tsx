export const revalidate = 0;

import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { carregarEstrutura } from "@/lib/estrutura/carregar";
import { carregarFicha } from "@/lib/perfil/carregar";
import { vocabularioDe } from "@/lib/perfil/vocabulario";
import { rotuloCurto, periodoAnterior, periodoDe, chaveAnoMes } from "@/lib/fechamento/periodo";
import type { Quinzena } from "@/lib/fechamento/periodo";
import type { DadosFechamento } from "@/lib/fechamento/dados";
import type { AcaoPlano } from "@/lib/fechamento/secoes";
import { FechamentoClient } from "./_components/fechamento-client";

interface Props {
  params: Promise<{ id: string }>;
}

const acoesDe = (v: unknown) => (Array.isArray(v) ? (v as AcaoPlano[]) : []);

export default async function FechamentoPage({ params }: Props) {
  const { id } = await params;
  const db = getSupabaseAdmin();

  const { data: f } = await db.from("fechamentos").select("*").eq("id", id).maybeSingle();
  if (!f) notFound();

  const periodo = periodoDe(f.tipo, f.ano, f.mes, f.quinzena as Quinzena | null);
  const ant = periodoAnterior(periodo);
  let buscaAnterior = db.from("fechamentos").select("id, acoes")
    .eq("clinica_id", f.clinica_id).eq("tipo", ant.tipo).eq("ano", ant.ano).eq("mes", ant.mes);
  buscaAnterior = ant.quinzena === null ? buscaAnterior.is("quinzena", null) : buscaAnterior.eq("quinzena", ant.quinzena);

  const [{ data: clinica }, { estrutura }, ficha, { data: anterior }] = await Promise.all([
    db.from("clinicas").select("id, nome").eq("id", f.clinica_id).single(),
    carregarEstrutura(f.clinica_id),
    carregarFicha(f.clinica_id),
    buscaAnterior.maybeSingle(),
  ]);

  return (
    <FechamentoClient
      id={f.id}
      clinicaId={f.clinica_id}
      clinicaNome={clinica?.nome ?? "Clínica"}
      tipo={f.tipo}
      rotulo={rotuloCurto(periodo)}
      mesChave={chaveAnoMes(f.ano, f.mes)}
      dataInicio={f.data_inicio}
      dataFim={f.data_fim}
      statusInicial={f.status}
      dadosIniciais={f.dados as unknown as DadosFechamento | null}
      lista={estrutura[f.tipo]}
      vocabulario={vocabularioDe(ficha)}
      analiseInicial={f.analise}
      acoesIniciais={acoesDe(f.acoes)}
      textoInicial={f.texto}
      enviadoEmInicial={f.enviado_em}
      anterior={anterior ? { id: anterior.id, rotulo: rotuloCurto(ant), acoes: acoesDe(anterior.acoes).filter((a) => a.texto?.trim()) } : null}
    />
  );
}
