export const revalidate = 0;

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { rotuloCurto, MESES } from "@/lib/fechamento/periodo";
import type { TipoFechamento, Quinzena } from "@/lib/fechamento/periodo";
import { calcularResultado, atingimentoDaMeta, variacao } from "@/lib/fechamento/dados";
import type { DadosFechamento } from "@/lib/fechamento/dados";
import { brl, num, pct, textoVariacao } from "@/lib/fechamento/secoes";
import { ROTULO_STATUS } from "@/lib/fechamento/status";

interface Props {
  searchParams: Promise<{ tipo?: string; ano?: string; mes?: string; q?: string }>;
}

interface Periodo {
  tipo: TipoFechamento;
  ano: number;
  mes: number;
  quinzena: Quinzena | null;
}

const chave = (p: Periodo) => `${p.tipo}:${p.ano}:${p.mes}:${p.quinzena ?? 0}`;
const href = (p: Periodo) =>
  `/fechamentos/comparativos?tipo=${p.tipo}&ano=${p.ano}&mes=${p.mes}${p.quinzena ? `&q=${p.quinzena}` : ""}`;
const TIPOS: { tipo: TipoFechamento; rotulo: string }[] = [
  { tipo: "mensal", rotulo: "Mensal" },
  { tipo: "quinzenal", rotulo: "Quinzenal" },
];
const mesAbrev = (m: number) => MESES[m - 1].slice(0, 3);
const TOM_BOM = "text-emerald-600 dark:text-emerald-400";
const TOM_RUIM = "text-red-600 dark:text-red-400";

/** Clínicas lado a lado no mesmo período, a partir dos fechamentos já salvos. */
export default async function ComparativosPage({ searchParams }: Props) {
  const sp = await searchParams;
  const db = getSupabaseAdmin();
  const [{ data: clinicas }, { data: fechamentos }] = await Promise.all([
    db.from("clinicas").select("id, nome"),
    db.from("fechamentos").select("id, clinica_id, tipo, ano, mes, quinzena, status, dados").limit(1000),
  ]);
  const nomes = new Map((clinicas ?? []).map((c) => [c.id, c.nome]));
  const todos = (fechamentos ?? []).map((f) => ({
    ...f,
    quinzena: f.quinzena as Quinzena | null,
    dados: f.dados as unknown as DadosFechamento | null,
  }));

  // períodos que têm fechamento, do mais recente para o mais antigo
  const periodos = [...new Map(todos.map((f) => [chave(f), { tipo: f.tipo, ano: f.ano, mes: f.mes, quinzena: f.quinzena }])).values()]
    .sort((a, b) => b.ano - a.ano || b.mes - a.mes || (b.quinzena ?? 3) - (a.quinzena ?? 3) || a.tipo.localeCompare(b.tipo));

  // Sem escolha: o período mais recente. Só o tipo: o mais recente daquele tipo.
  const tipoPedido: TipoFechamento | null = sp.tipo === "quinzenal" ? "quinzenal" : sp.tipo === "mensal" ? "mensal" : null;
  const pedido: Periodo | null = tipoPedido && sp.ano && sp.mes
    ? { tipo: tipoPedido, ano: Number(sp.ano), mes: Number(sp.mes), quinzena: sp.q === "1" || sp.q === "2" ? (Number(sp.q) as Quinzena) : null }
    : null;
  const atual = (pedido && periodos.find((p) => chave(p) === chave(pedido)))
    || (tipoPedido && periodos.find((p) => p.tipo === tipoPedido))
    || periodos[0] || null;

  // os períodos do tipo escolhido, agrupados por ano
  const doTipo = atual ? periodos.filter((p) => p.tipo === atual.tipo) : [];
  const anos = [...new Set(doTipo.map((p) => p.ano))];

  const linhas = atual
    ? todos.filter((f) => chave(f) === chave(atual) && f.dados)
        .map((f) => {
          const d = f.dados!;
          return {
            id: f.id, nome: nomes.get(f.clinica_id) ?? "Clínica", status: f.status,
            faturamento: d.faturamento?.total ?? null,
            varFaturamento: d.faturamento ? variacao(d.faturamento.total, d.anterior?.faturamento) : null,
            despesas: d.despesas?.total ?? null,
            resultado: calcularResultado(d)?.valor ?? null,
            meta: atingimentoDaMeta(d),
            ticket: d.faturamento?.pacientes.ticketMedio ?? null,
            leads: d.leads?.total ?? null,
            convLeads: d.leads?.conversao ?? null,
            convOrc: d.orcamentos?.conversaoQuantidade ?? null,
            nps: d.nps?.score ?? null,
          };
        })
        .sort((a, b) => (b.faturamento ?? -1) - (a.faturamento ?? -1))
    : [];

  const soma = (f: (l: (typeof linhas)[number]) => number | null) => linhas.reduce((t, l) => t + (f(l) ?? 0), 0);
  const v = (x: number | null, fmt: (n: number) => string) => (x === null ? "—" : fmt(x));

  return (
    <div className="p-8 space-y-6 max-w-6xl">
      <div className="space-y-1">
        <Link href="/fechamentos"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" />Fechamentos
        </Link>
        <h1 className="text-2xl font-bold font-heading">Comparativos</h1>
        <p className="text-sm text-muted-foreground">
          As clínicas lado a lado no mesmo período, com os números dos fechamentos já salvos.
        </p>
      </div>

      {periodos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ainda não há fechamentos para comparar.</p>
      ) : (
        <>
          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <nav aria-label="Tipo de fechamento" className="inline-flex rounded-md border p-0.5 bg-muted/40">
                {TIPOS.map(({ tipo, rotulo }) => {
                  const qtd = periodos.filter((p) => p.tipo === tipo).length;
                  const ativo = atual?.tipo === tipo;
                  if (qtd === 0) {
                    return (
                      <span key={tipo} aria-disabled="true" title="Ainda não há fechamentos deste tipo"
                        className="px-3 py-1 text-sm rounded text-muted-foreground/50 cursor-not-allowed">{rotulo}</span>
                    );
                  }
                  return (
                    <Link key={tipo} href={`/fechamentos/comparativos?tipo=${tipo}`} aria-current={ativo ? "page" : undefined}
                      className={`px-3 py-1 text-sm rounded transition-colors ${ativo ? "bg-background text-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}>
                      {rotulo} <span className="text-xs text-muted-foreground tabular-nums">({qtd})</span>
                    </Link>
                  );
                })}
              </nav>
              {atual && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Período: </span>
                  <span className="font-medium">{rotuloCurto(atual)}</span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              {anos.map((ano) => (
                <div key={ano} className="flex items-start gap-3">
                  <span className="w-12 shrink-0 pt-1 text-xs font-semibold text-muted-foreground tabular-nums">{ano}</span>
                  <nav aria-label={`Períodos de ${ano}`} className="flex gap-1.5 flex-wrap">
                    {doTipo.filter((p) => p.ano === ano).map((p) => {
                      const ativo = atual && chave(p) === chave(atual);
                      return (
                        <Link key={chave(p)} href={href(p)} aria-current={ativo ? "page" : undefined} title={rotuloCurto(p)}
                          className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors ${ativo ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
                          {p.tipo === "quinzenal" ? `${p.quinzena}ª ${mesAbrev(p.mes)}` : mesAbrev(p.mes)}
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left font-normal">Clínica</th>
                  {["Faturamento", "Variação", "Despesas", "Resultado", "Meta", "Ticket médio", "Leads", "Conv. leads", "Conv. orçamentos", "NPS"].map((c) => (
                    <th key={c} className="px-3 py-2 text-right font-normal whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {linhas.map((l) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2">
                      <Link href={`/fechamentos/${l.id}`} className="font-medium hover:underline">{l.nome}</Link>
                      <span className="block text-[11px] text-muted-foreground">{ROTULO_STATUS[l.status]}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{v(l.faturamento, brl)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${l.varFaturamento === null ? "" : l.varFaturamento >= 0 ? TOM_BOM : TOM_RUIM}`}>
                      {textoVariacao(l.varFaturamento) || "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{v(l.despesas, brl)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${l.resultado === null ? "" : l.resultado >= 0 ? TOM_BOM : TOM_RUIM}`}>
                      {v(l.resultado, brl)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{v(l.meta, (x) => pct(x, 0))}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{v(l.ticket, brl)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{v(l.leads, num)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{v(l.convLeads, (x) => pct(x, 0))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{v(l.convOrc, (x) => pct(x, 0))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{v(l.nps, num)}</td>
                  </tr>
                ))}
                {linhas.length > 1 && (
                  <tr className="font-medium bg-muted/40">
                    <td className="px-3 py-2">Total ({linhas.length} clínicas)</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{brl(soma((l) => l.faturamento))}</td>
                    <td />
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{brl(soma((l) => l.despesas))}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{brl(soma((l) => l.resultado))}</td>
                    <td /><td />
                    <td className="px-3 py-2 text-right tabular-nums">{num(soma((l) => l.leads))}</td>
                    <td /><td /><td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Variação contra o mesmo recorte do mês anterior. Resultado = entradas − despesas quando a clínica tem a fonte de
            Entradas; senão, faturamento − despesas. Fechamentos importados do Sync usam a regra de despesa de lá (pagamento).
          </p>
        </>
      )}
    </div>
  );
}
