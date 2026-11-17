export const revalidate = 0;

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { carregarEstrutura } from "@/lib/estrutura/carregar";
import { carregarFicha } from "@/lib/perfil/carregar";
import { vocabularioDe } from "@/lib/perfil/vocabulario";
import { rotuloCurto } from "@/lib/fechamento/periodo";
import type { AcaoPlano } from "@/lib/fechamento/secoes";
import type { DadosFechamento } from "@/lib/fechamento/dados";
import { ROTULO_STATUS } from "@/lib/fechamento/status";
import { RelatorioPdf, ESTILO_PDF } from "./folhas";
import { SalvarPdf } from "./salvar-pdf";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ analise?: string }>;
}

async function carregar(id: string) {
  const db = getSupabaseAdmin();
  const { data: f } = await db.from("fechamentos").select("*").eq("id", id).maybeSingle();
  if (!f) return null;
  const { data: clinica } = await db.from("clinicas").select("nome").eq("id", f.clinica_id).single();
  const periodo = { tipo: f.tipo, ano: f.ano, mes: f.mes, quinzena: f.quinzena as 1 | 2 | null };
  return { f, nome: clinica?.nome ?? "Clínica", periodoCurto: rotuloCurto(periodo) };
}

/** O título da página vira o nome sugerido do arquivo ao salvar em PDF. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const c = await carregar(id);
  if (!c) return { title: "Fechamento" };
  // a barra não pode ir em nome de arquivo
  return { title: `${c.nome} - Fechamento ${c.periodoCurto.replace(/\//g, " ")}` };
}

/**
 * Relatório do fechamento em folhas A4, para salvar em PDF pelo navegador.
 * Fica fora do layout do painel: a página é só o papel.
 */
export default async function FechamentoPdfPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { analise: comAnalise } = await searchParams;
  const c = await carregar(id);
  if (!c) notFound();
  const { f, nome, periodoCurto } = c;

  const [{ estrutura }, ficha] = await Promise.all([carregarEstrutura(f.clinica_id), carregarFicha(f.clinica_id)]);
  const dados = f.dados as unknown as DadosFechamento | null;
  const acoes = Array.isArray(f.acoes) ? (f.acoes as unknown as AcaoPlano[]) : [];
  const incluir = comAnalise === "1";

  return (
    <div className="pdf py-6 font-sans text-[#1d1b22]">
      <style>{ESTILO_PDF}</style>
      <div className="pdf-sem-impressao mx-auto mb-5 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-2">
        <div className="text-sm">
          <Link className="font-medium underline" href={`/fechamentos/${id}`}>Voltar ao fechamento</Link>
          <span className="ml-2 text-[#6B6577]">{ROTULO_STATUS[f.status]}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link className="text-sm font-medium underline" href={incluir ? `/fechamentos-pdf/${id}` : `/fechamentos-pdf/${id}?analise=1`}>
            {incluir ? "Tirar a página de análise e plano de ação" : "Incluir página de análise e plano de ação"}
          </Link>
          <SalvarPdf />
        </div>
      </div>
      {dados ? (
        <RelatorioPdf d={dados} nome={nome} periodoCurto={periodoCurto} lista={estrutura[f.tipo]}
          v={vocabularioDe(ficha)} analise={f.analise ?? ""} acoes={acoes} comAnalise={incluir} />
      ) : (
        <p className="mx-auto max-w-xl p-10 text-sm text-[#6B6577]">Este fechamento ainda não tem leitura das planilhas.</p>
      )}
    </div>
  );
}
