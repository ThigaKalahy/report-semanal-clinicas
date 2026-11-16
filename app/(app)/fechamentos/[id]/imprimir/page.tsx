export const revalidate = 0;

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { carregarEstrutura } from "@/lib/estrutura/carregar";
import { carregarFicha } from "@/lib/perfil/carregar";
import { vocabularioDe } from "@/lib/perfil/vocabulario";
import { rotuloPeriodo, rotuloCurto, isoParaBR } from "@/lib/fechamento/periodo";
import { montarSecoes } from "@/lib/fechamento/secoes";
import type { AcaoPlano } from "@/lib/fechamento/secoes";
import type { DadosFechamento } from "@/lib/fechamento/dados";
import { GestfyLogo } from "@/components/brand/gestfy-logo";
import { CartaoSecao } from "../../_components/secao";
import { BotaoImprimir } from "./botao-imprimir";

interface Props {
  params: Promise<{ id: string }>;
}

/** O título da página vira o nome sugerido do arquivo ao salvar em PDF. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const db = getSupabaseAdmin();
  const { data: f } = await db.from("fechamentos").select("clinica_id, tipo, ano, mes, quinzena").eq("id", id).maybeSingle();
  if (!f) return { title: "Fechamento" };
  const { data: clinica } = await db.from("clinicas").select("nome").eq("id", f.clinica_id).single();
  const periodo = rotuloCurto({ tipo: f.tipo, ano: f.ano, mes: f.mes, quinzena: f.quinzena as 1 | 2 | null });
  // datas no padrão brasileiro; a barra não pode ir em nome de arquivo
  return { title: `Fechamento ${clinica?.nome ?? ""} - ${periodo.replace(/\//g, "-")}` };
}

/**
 * Versão do fechamento para imprimir ou salvar em PDF pelo navegador. Mostra só
 * as seções com dado, na estrutura da clínica — o mesmo relatório da tela.
 */
export default async function ImprimirFechamentoPage({ params }: Props) {
  const { id } = await params;
  const db = getSupabaseAdmin();
  const { data: f } = await db.from("fechamentos").select("*").eq("id", id).maybeSingle();
  if (!f) notFound();

  const [{ data: clinica }, { estrutura }, ficha] = await Promise.all([
    db.from("clinicas").select("nome").eq("id", f.clinica_id).single(),
    carregarEstrutura(f.clinica_id),
    carregarFicha(f.clinica_id),
  ]);

  const dados = f.dados as unknown as DadosFechamento | null;
  const periodo = { tipo: f.tipo, ano: f.ano, mes: f.mes, quinzena: f.quinzena as 1 | 2 | null };
  const nome = clinica?.nome ?? "Clínica";
  const secoes = dados
    ? montarSecoes(dados, estrutura[f.tipo], {
        vocabulario: vocabularioDe(ficha), analise: f.analise,
        acoes: Array.isArray(f.acoes) ? (f.acoes as unknown as AcaoPlano[]) : [],
      }).filter((s) => !s.vazia)
    : [];

  return (
    <div className="p-8 print:p-0 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
        <Link href={`/fechamentos/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" />Voltar ao fechamento
        </Link>
        <BotaoImprimir />
      </div>

      <header className="flex items-end justify-between gap-4 border-b pb-4">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-bold font-heading">{nome}</h1>
          <p className="text-sm text-muted-foreground">Fechamento — {rotuloPeriodo(periodo)}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            Período: {isoParaBR(f.data_inicio)} a {isoParaBR(f.data_fim)}
          </p>
        </div>
        <GestfyLogo variant="full" size={28} />
      </header>

      {secoes.length === 0
        ? <p className="text-sm text-muted-foreground">Este fechamento ainda não tem dados para mostrar.</p>
        : secoes.map((s) => <CartaoSecao key={s.id} s={s} />)}
    </div>
  );
}
