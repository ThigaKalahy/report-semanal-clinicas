export const revalidate = 0;

import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { calcularResultado } from "@/lib/fechamento/dados";
import type { DadosFechamento } from "@/lib/fechamento/dados";
import { MESES, chaveAnoMes, periodoSugerido } from "@/lib/fechamento/periodo";
import { brl0 } from "@/lib/fechamento/visao";
import type { StatusFechamento } from "@/lib/supabase/types";
import { SeloStatus } from "./_components/selo-status";
import { BotaoIniciar } from "./_components/botao-iniciar";

interface Props {
  searchParams: Promise<{ mes?: string }>;
}

interface Celula {
  id: string;
  status: StatusFechamento;
  faturamento: number | null;
  resultado: number | null;
}

/** "AAAA-MM" → ano e mês; inválido cai no mês do fechamento mensal sugerido. */
function mesDaUrl(v: string | undefined): { ano: number; mes: number } {
  const m = v?.match(/^(\d{4})-(\d{2})$/);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return { ano: Number(m[1]), mes: Number(m[2]) };
  const s = periodoSugerido("mensal", new Date());
  return { ano: s.ano, mes: s.mes };
}

function deslocar(ano: number, mes: number, delta: number) {
  const d = new Date(ano, mes - 1 + delta, 1);
  return chaveAnoMes(d.getFullYear(), d.getMonth() + 1);
}

/** Quando o próximo quinzenal (1 a 15) fica pronto para fechar: dia 16. */
function proximoQuinzenal(hoje: Date) {
  const alvo = hoje.getDate() <= 15 ? new Date(hoje.getFullYear(), hoje.getMonth(), 16) : new Date(hoje.getFullYear(), hoje.getMonth() + 1, 16);
  return {
    data: `16/${String(alvo.getMonth() + 1).padStart(2, "0")}`,
    rotulo: `1ª quinzena de ${MESES[alvo.getMonth()]}`,
  };
}

function CelulaFechamento({ c, clinicaId, tipo, ano, mes, pronto }: {
  c: Celula | undefined; clinicaId: string; tipo: "mensal" | "quinzenal"; ano: number; mes: number; pronto: boolean;
}) {
  if (!c) return <BotaoIniciar clinicaId={clinicaId} tipo={tipo} ano={ano} mes={mes} desabilitado={!pronto} />;
  const terminado = c.status === "concluido" || c.status === "enviado";
  return (
    <Link href={`/fechamentos/${c.id}`} className="group flex flex-col gap-1 rounded-md p-1.5 hover:bg-muted">
      <span className="flex flex-wrap items-center gap-1.5">
        <SeloStatus status={c.status} />
        <span className="inline-flex items-center gap-0.5 text-xs font-medium text-primary group-hover:underline">
          {terminado ? "Revisar" : "Continuar"}<ArrowRight className="h-3 w-3" />
        </span>
      </span>
      {c.faturamento !== null && (
        <span className="text-xs tabular-nums text-muted-foreground">
          {brl0(c.faturamento)}
          {c.resultado !== null && (
            <> · <span className={c.resultado < 0 ? "text-red-600 dark:text-red-400" : ""}>res. {brl0(c.resultado)}</span></>
          )}
        </span>
      )}
    </Link>
  );
}

function Resumo({ titulo, valor, sub }: { titulo: string; valor: string; sub: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
      <p className="font-heading text-2xl font-semibold tabular-nums">{valor}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

/** Fechamentos do mês: cada clínica com o seu quinzenal e o seu mensal. */
export default async function FechamentosDoMesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { ano, mes } = mesDaUrl(sp.mes);
  const db = getSupabaseAdmin();

  const [{ data: clinicas }, { data: fontes }, { data: fechamentos, error }] = await Promise.all([
    db.from("clinicas").select("id, nome").eq("ativa", true).order("nome"),
    db.from("fontes_dados").select("clinica_id, tipo"),
    db.from("fechamentos").select("id, clinica_id, tipo, quinzena, status, dados").eq("ano", ano).eq("mes", mes),
  ]);

  const comVendas = new Set((fontes ?? []).filter((f) => f.tipo === "faturamento").map((f) => f.clinica_id));
  const celulas = new Map<string, Celula>();
  for (const f of fechamentos ?? []) {
    if (f.tipo === "quinzenal" && f.quinzena !== 1) continue; // a 2ª quinzena fica no histórico
    const d = f.dados as unknown as DadosFechamento | null;
    celulas.set(`${f.clinica_id}:${f.tipo}`, {
      id: f.id, status: f.status,
      faturamento: d?.faturamento?.total ?? null,
      resultado: d ? calcularResultado(d)?.valor ?? null : null,
    });
  }

  const lista = clinicas ?? [];
  const prontas = lista.filter((c) => comVendas.has(c.id)).length;
  const mensais = lista.map((c) => celulas.get(`${c.id}:mensal`));
  const terminados = mensais.filter((c) => c && (c.status === "concluido" || c.status === "enviado")).length;
  const porIniciar = lista.filter((c, i) => !mensais[i] && comVendas.has(c.id)).length;
  const todas = [...celulas.values()];
  const emConferencia = todas.filter((c) => c.status === "em_conferencia").length;
  const emAnalise = todas.filter((c) => c.status === "em_analise").length;
  const prox = proximoQuinzenal(new Date());
  const nomeMes = `${MESES[mes - 1]}/${ano}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Relatórios Financeiros</p>
        <h1 className="text-2xl font-semibold">Fechamentos do mês</h1>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Não foi possível ler os fechamentos: {error.message}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Resumo titulo="Clientes com fechamento no período" valor={String(prontas)}
          sub={prontas === lista.length ? `todos os ${lista.length} clientes ativos` : `de ${lista.length} clientes ativos (os demais sem fonte de vendas)`} />
        <Resumo titulo="Concluídos ou enviados" valor={`${terminados} de ${prontas}`} sub={`mensais de ${nomeMes} · ${porIniciar} por iniciar`} />
        <Resumo titulo="Em andamento" valor={String(emConferencia + emAnalise)} sub={`${emConferencia} em conferência · ${emAnalise} em análise`} />
        <Resumo titulo="Próximo quinzenal" valor={prox.data} sub={prox.rotulo} />
      </div>

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex items-center gap-1">
            <Link aria-label="Mês anterior" className="rounded-md p-1.5 hover:bg-muted" href={`/fechamentos?mes=${deslocar(ano, mes, -1)}`}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <h2 className="min-w-40 text-center font-semibold capitalize">{nomeMes}</h2>
            <Link aria-label="Próximo mês" className="rounded-md p-1.5 hover:bg-muted" href={`/fechamentos?mes=${deslocar(ano, mes, 1)}`}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">Clique num fechamento para continuar ou revisar.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Configuração</th>
                <th className="px-3 py-2 font-medium">Quinzenal (1–15)</th>
                <th className="px-3 py-2 font-medium">Mensal</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => {
                const pronto = comVendas.has(c.id);
                return (
                  <tr key={c.id} className="border-b align-top last:border-0">
                    <td className="px-4 py-3">
                      <Link className="font-medium hover:underline" title="Ver o histórico deste cliente" href={`/fechamentos/historico?cliente=${c.id}`}>{c.nome}</Link>
                    </td>
                    <td className="px-3 py-3">
                      {pronto
                        ? <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Pronto</span>
                        : <Link href={`/clinicas/${c.id}/fontes`} className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-400">Falta a fonte de vendas</Link>}
                    </td>
                    <td className="px-3 py-2">
                      <CelulaFechamento c={celulas.get(`${c.id}:quinzenal`)} clinicaId={c.id} tipo="quinzenal" ano={ano} mes={mes} pronto={pronto} />
                    </td>
                    <td className="px-3 py-2">
                      <CelulaFechamento c={celulas.get(`${c.id}:mensal`)} clinicaId={c.id} tipo="mensal" ano={ano} mes={mes} pronto={pronto} />
                    </td>
                  </tr>
                );
              })}
              {lista.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhuma clínica ativa.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        As clínicas, as fontes de dados e a estrutura dos relatórios ficam em <Link href="/clinicas" className="underline">Clínicas</Link>.
        A 2ª quinzena e os meses anteriores ficam no <Link href="/fechamentos/historico" className="underline">Histórico</Link>.
      </p>
    </div>
  );
}
