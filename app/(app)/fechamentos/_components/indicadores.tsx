"use client";

import { useState, type ReactNode } from "react";
import type { DadosFechamento } from "@/lib/fechamento/dados";
import type { ItemEstrutura } from "@/lib/estrutura/estrutura";
import { secaoPorId } from "@/lib/estrutura/catalogo";
import type { Vocabulario } from "@/lib/perfil/vocabulario";
import { NEUTRO, cap } from "@/lib/perfil/vocabulario";
import { montarSecoes } from "@/lib/fechamento/secoes";
import { temInformacao } from "@/lib/fechamento/calculos";
import type { ItemValor } from "@/lib/fechamento/calculos";
import type { ItemContagem } from "@/lib/coletores/planilha";
import {
  brl0, brl2, pct, inteiro, nota, textoVar, comparacaoDo, cartoesDoResultado, visaoRitmo, visaoCaixa,
  categoriasDeReceita, linhasDeDespesa, visaoAno, somaDe, mesAbrev, ligadosDa,
} from "@/lib/fechamento/visao";
import type { Variacao, Cartao } from "@/lib/fechamento/visao";
import { CartaoSecao } from "./secao";

/**
 * Aba "Indicadores" do fechamento — o desenho do Sync Financeiro: cartões do
 * resultado, menu das seções e um quadro por assunto. Segue a estrutura da
 * clínica (seções ligadas e ordem).
 */

const VERDE = "text-emerald-600 dark:text-emerald-400";
const VERMELHO = "text-red-600 dark:text-red-400";

function VarTela({ v, quedaNeutra = false }: { v: Variacao; quedaNeutra?: boolean }) {
  if (v.valor === null && !v.novo) return null;
  const cor = v.tom === "ruim" ? VERMELHO : v.tom === "bom" && !quedaNeutra ? VERDE : "";
  return <b className={cor}>{textoVar(v)}</b>;
}

export function CartaoKpi({ rotulo, valor, sub, destaque, tom }: {
  rotulo: string; valor: string; sub?: ReactNode; destaque?: boolean; tom?: "bom" | "ruim";
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 rounded-lg border p-4 ${destaque ? "border-primary/50" : ""}`}>
      <span className="text-xs font-medium text-muted-foreground">{rotulo}</span>
      <span className={`font-heading text-2xl font-semibold tabular-nums leading-tight ${tom === "ruim" ? VERMELHO : ""}`}>{valor}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

function KpiDoCartao({ c, longo }: { c: Cartao; longo: string }) {
  const temVar = c.variacao && (c.variacao.valor !== null || c.variacao.novo);
  return (
    <CartaoKpi rotulo={c.rotulo} valor={c.valor} destaque={c.destaque} tom={c.tomValor}
      sub={temVar ? <span><VarTela v={c.variacao!} quedaNeutra={false} /> vs {longo}</span> : c.sub} />
  );
}

function Quadro({ id, titulo, lado, children }: { id: string; titulo: string; lado?: ReactNode; children: ReactNode }) {
  return (
    <section id={`ind-${id}`} className="scroll-mt-16 overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        {lado && <span className="text-xs text-muted-foreground">{lado}</span>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Grade({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

/** Linhas com barra proporcional: rótulo · barra · valor. */
function Barras({ itens, formato = (n) => inteiro(n), extra }: {
  itens: { nome: string; valor: number; extra?: string; apagado?: boolean }[];
  formato?: (n: number) => string;
  extra?: boolean;
}) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <table className="w-full text-sm">
      <tbody>
        {itens.map((i) => (
          <tr key={i.nome} className={`border-b last:border-0 ${i.apagado ? "text-muted-foreground" : ""}`}>
            <td className="py-1.5 pr-2">{i.nome}</td>
            <td className="w-[30%] py-1.5">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(1, (i.valor / max) * 100)}%` }} />
              </div>
            </td>
            <td className="whitespace-nowrap py-1.5 pl-2 text-right tabular-nums">
              {formato(i.valor)}
              {extra && i.extra && <span className="ml-1 text-xs text-muted-foreground">{i.extra}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Subtitulo({ children }: { children: ReactNode }) {
  return <p className="pb-1 pt-3 text-xs font-semibold text-muted-foreground">{children}</p>;
}

const contagem = (itens: ItemContagem[] | null | undefined, n = 8) =>
  (itens ?? []).slice(0, n).map((i) => ({ nome: i.nome, valor: i.quantidade, apagado: i.nome === "Não informado" }));

// ── Gráfico do ano: barras de faturamento + linha de despesas ────────────────

function milhar(v: number) {
  return `${Math.round(v / 1000).toLocaleString("pt-BR")} mil`;
}

function GraficoBarras({ d }: { d: DadosFechamento }) {
  const ano = visaoAno(d);
  if (!ano || ano.linhas.length < 2) {
    return <p className="text-sm text-muted-foreground">Esta leitura não tem a série do ano. Leia as planilhas de novo.</p>;
  }
  const L = ano.linhas;
  const W = 640, H = 200, topo = 18, base = 178;
  const passo = W / L.length;
  const larg = passo * 0.6;
  const max = Math.max(1, ...L.flatMap((l) => [l.faturamento ?? 0, l.despesas ?? 0]));
  const y = (v: number) => base - ((base - topo) * v) / max;
  const cx = (i: number) => passo * i + passo / 2;
  const linha = L.map((l, i) => (l.despesas === null ? null : `${cx(i)},${y(l.despesas)}`)).filter(Boolean).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Faturamento e despesas por mês">
      {L.map((l, i) => {
        const atual = i === L.length - 1;
        const nomeMes = mesAbrev(Number(l.mes.slice(5, 7)));
        return (
          <g key={l.mes}>
            {l.faturamento !== null && (
              <>
                <rect x={cx(i) - larg / 2} y={y(l.faturamento)} width={larg} height={base - y(l.faturamento)} rx={2}
                  className={atual ? "fill-primary" : "fill-primary/40"}>
                  <title>{`${nomeMes}: ${brl0(l.faturamento)}`}</title>
                </rect>
                <text x={cx(i)} y={y(l.faturamento) - 4} textAnchor="middle" className="fill-muted-foreground text-[10px]">{milhar(l.faturamento)}</text>
              </>
            )}
            <text x={cx(i)} y={194} textAnchor="middle" className={`text-[11px] ${atual ? "fill-foreground font-semibold" : "fill-muted-foreground"}`}>{nomeMes}</text>
          </g>
        );
      })}
      <polyline fill="none" strokeWidth={2} strokeLinejoin="round" className="stroke-accent dark:stroke-chart-3" points={linha} />
      {L.map((l, i) => l.despesas !== null && (
        <circle key={l.mes} cx={cx(i)} cy={y(l.despesas)} r={3} className="fill-accent dark:fill-chart-3">
          <title>{`Despesas ${mesAbrev(Number(l.mes.slice(5, 7)))}: ${brl0(l.despesas)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

// ── A aba ────────────────────────────────────────────────────────────────────

const ROTULO_MENU: Record<string, string> = {
  ritmo: "Ritmo", caixaMes: "Caixa do mês", grafico: "Gráfico", funilLeads: "Funis", funilOrcamentos: "Funis",
  experiencia: "Experiência", receitas: "Receitas", distribuicao: "Por profissional", despesas: "Despesas",
  entradas: "Entradas", regimes: "Caixa x competência",
};

export function Indicadores({ d, lista, v = NEUTRO }: { d: DadosFechamento; lista: ItemEstrutura[]; v?: Vocabulario }) {
  const [todasReceitas, setTodasReceitas] = useState(false);
  const [gruposAbertos, setGruposAbertos] = useState<Set<string>>(new Set());
  const lig = ligadosDa(lista, d.tipo);
  const comp = comparacaoDo(d);
  const cartoes = cartoesDoResultado(d, lig, v);
  const quinzenal = d.tipo === "quinzenal";
  const dia = Number(d.periodo.fim.slice(8, 10));

  const blocos: { id: string; menu: string; no: ReactNode }[] = [];
  const feitos = new Set<string>();

  for (const item of lista) {
    if (!item.ativa || feitos.has(item.id)) continue;
    const def = secaoPorId(item.id);
    if (!def || !def.tipos.includes(d.tipo)) continue;
    feitos.add(item.id);

    switch (item.id) {
      case "resultado":
      case "analise":
        break;

      case "ritmo":
      case "caixaMes": {
        feitos.add("ritmo"); feitos.add("caixaMes");
        const r = lig.secao("ritmo") ? visaoRitmo(d) : null;
        const c = lig.secao("caixaMes") ? visaoCaixa(d) : null;
        if (!r && !c) break;
        blocos.push({
          id: "ritmo", menu: r ? "Ritmo" : "Caixa do mês",
          no: (
            <Quadro id="ritmo" titulo={r ? "Ritmo do mês" : "Caixa do mês"} lado={r ? `${r.decorridos} de ${r.diasMes} dias úteis` : undefined}>
              <Grade>
                {r && (
                  <>
                    <CartaoKpi rotulo="Faturamento por dia útil" valor={r.porDia !== null ? brl0(r.porDia) : "—"} sub={`até o dia ${dia}`} />
                    <CartaoKpi rotulo="Projeção do mês" valor={r.projecao !== null ? brl0(r.projecao) : "—"} sub={r.meta ? `meta ${brl0(r.meta)}` : "sem meta cadastrada"} />
                    <CartaoKpi rotulo="Necessário por dia útil"
                      valor={r.necessarioPorDia !== null ? brl0(r.necessarioPorDia) : r.falta === 0 ? "meta batida" : "—"}
                      sub={r.falta ? `faltam ${brl0(r.falta)} em ${r.restantes} dias úteis` : undefined} />
                  </>
                )}
                {c && (
                  <>
                    {c.saldoProjetado !== null && (
                      <CartaoKpi rotulo="Saldo projetado do mês" valor={brl0(c.saldoProjetado)} tom={c.saldoProjetado < 0 ? "ruim" : undefined}
                        sub="projeção − despesas esperadas" />
                    )}
                    <CartaoKpi rotulo="Despesas" valor={brl0(c.pagas)} sub={`até o dia ${dia}, pelo vencimento`} />
                    {c.media !== null && <CartaoKpi rotulo="Média de despesas" valor={brl0(c.media)} sub={`últimos ${c.mesesDaMedia.length} meses (${c.mesesDaMedia.join(", ")})`} />}
                    <CartaoKpi rotulo="Provisionado a pagar" valor={brl0(c.provisionado)} sub={c.regraProvisionado} />
                    {c.saldoPeriodo !== null && (
                      <CartaoKpi rotulo="Saldo do período" valor={brl0(c.saldoPeriodo)} tom={c.saldoPeriodo < 0 ? "ruim" : undefined} sub="faturamento − despesas" />
                    )}
                  </>
                )}
              </Grade>
            </Quadro>
          ),
        });
        break;
      }

      case "grafico": {
        const ano = visaoAno(d);
        blocos.push({
          id: "grafico", menu: "Gráfico",
          no: (
            <Quadro id="grafico" titulo={`${ano?.porRecebido ? "Entradas" : "Faturamento"} e despesas em ${ano?.ano ?? d.periodo.inicio.slice(0, 4)}`}
              lado={<>
                <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-primary align-[-1px]" />{ano?.porRecebido ? "Entradas" : "Faturamento"}
                <span className="ml-3 mr-1 inline-block h-2.5 w-2.5 rounded-full bg-accent align-[-1px] dark:bg-chart-3" />Despesas
              </>}>
              <GraficoBarras d={d} />
            </Quadro>
          ),
        });
        break;
      }

      case "funilLeads":
      case "funilOrcamentos": {
        feitos.add("funilLeads"); feitos.add("funilOrcamentos");
        const l = lig.secao("funilLeads") ? d.leads : null;
        const o = lig.secao("funilOrcamentos") ? d.orcamentos : null;
        if (!lig.secao("funilLeads") && !lig.secao("funilOrcamentos")) break;
        blocos.push({
          id: "funis", menu: "Funis",
          no: (
            <div className="grid gap-5 lg:grid-cols-2">
              {lig.secao("funilLeads") && (
                <Quadro id="funis" titulo="Funil comercial · leads" lado={d.anterior?.leads ? `vs ${comp.curto}: ${inteiro(d.anterior.leads.total)} leads` : undefined}>
                  {!l ? <p className="text-sm text-muted-foreground">Sem fonte de Leads.</p> : (
                    <div>
                      <Barras extra itens={[
                        { nome: "Leads chegando", valor: l.total },
                        { nome: "Agendados", valor: l.agendados, extra: pct(l.conversao, 0) },
                      ]} />
                      {temInformacao(l.porOrigem) && <><Subtitulo>Origem</Subtitulo><Barras itens={contagem(l.porOrigem)} /></>}
                      {temInformacao(l.porInteresse) && <><Subtitulo>{cap(v.servico)} mais buscado</Subtitulo><Barras itens={contagem(l.porInteresse)} /></>}
                      {temInformacao(l.porObjecao) && <><Subtitulo>Motivos de não agendamento</Subtitulo><Barras itens={contagem(l.porObjecao)} /></>}
                    </div>
                  )}
                </Quadro>
              )}
              {lig.secao("funilOrcamentos") && (
                <Quadro id={lig.secao("funilLeads") ? "funis-orc" : "funis"} titulo="Funil comercial · orçamentos">
                  {!o ? <p className="text-sm text-muted-foreground">Sem fonte de Orçamentos.</p> : (
                    <div>
                      <Barras extra itens={[
                        { nome: "Gerados", valor: o.total },
                        { nome: "Fechados", valor: o.fechados, extra: pct(o.conversaoQuantidade, 0) },
                        { nome: "Em aberto", valor: o.emAberto },
                        { nome: "Não fecharam", valor: o.naoFechou },
                      ]} />
                      <div className="pt-3" />
                      <Barras formato={brl0} extra itens={[
                        { nome: "Valor gerado", valor: o.valorGerado },
                        { nome: "Valor fechado", valor: o.valorFechado, extra: pct(o.conversaoValor, 0) },
                        { nome: "Valor em aberto", valor: o.valorEmAberto },
                      ]} />
                      {o.porStatus.length > 0 && <><Subtitulo>Por status</Subtitulo><Barras itens={contagem(o.porStatus)} /></>}
                    </div>
                  )}
                </Quadro>
              )}
            </div>
          ),
        });
        break;
      }

      case "experiencia": {
        const n = d.nps, g = d.google;
        blocos.push({
          id: "experiencia", menu: "Experiência",
          no: (
            <Quadro id="experiencia" titulo={`Experiência do ${v.cliente}`}>
              {!n && !g ? <p className="text-sm text-muted-foreground">Sem fonte de NPS nem Google cadastrado.</p> : (
                <Grade>
                  {n && <CartaoKpi rotulo="NPS" valor={n.respostas ? inteiro(n.score) : "—"} sub={`${n.respostas} respostas · ${n.promotores}/${n.neutros}/${n.detratores}`} />}
                  {n && ([["Médico", n.notas.profissional], ["Recepção", n.notas.recepcao], ["Infraestrutura", n.notas.infraestrutura], ["Enfermagem", n.notas.enfermagem]] as const)
                    .filter(([, x]) => x !== null)
                    .map(([r, x]) => <CartaoKpi key={r} rotulo={r} valor={nota(x!)} sub="de 5" />)}
                  {g && <CartaoKpi rotulo="Google" valor={g.media !== null ? nota(g.media, 1) : "—"} sub={`${g.total} avaliações`} />}
                </Grade>
              )}
            </Quadro>
          ),
        });
        break;
      }

      case "receitas": {
        const fat = d.faturamento;
        const linhas = categoriasDeReceita(d).filter((l) => l.valor > 0 || l.antes);
        const LIMITE = 10;
        const visiveis = todasReceitas ? linhas : linhas.slice(0, LIMITE);
        const resto = linhas.slice(LIMITE);
        const temAnterior = d.anterior?.faturamento != null;
        blocos.push({
          id: "receitas", menu: "Receitas",
          no: (
            <Quadro id="receitas" titulo="Receitas detalhadas" lado={fat ? `${fat.lancamentos} lançamentos${fat.linhasIlegiveis ? ` · ${fat.linhasIlegiveis} ilegíveis` : ""}` : undefined}>
              {!fat ? <p className="text-sm text-muted-foreground">Sem fonte de Vendas.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-2 pr-2 font-medium">Grupo</th>
                        <th className="py-2 pl-3 text-right font-medium">Valor</th>
                        {temAnterior && <th className="py-2 pl-3 text-right font-medium">vs {comp.coluna}</th>}
                        <th className="py-2 pl-3 text-right font-medium">Quantidade</th>
                        <th className="py-2 pl-3 text-right font-medium">Ticket médio</th>
                        <th className="py-2 pl-3 text-right font-medium">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiveis.map((l) => (
                        <tr key={l.nome} className={`border-b ${l.valor === 0 ? "text-muted-foreground" : ""}`}>
                          <td className="py-1.5 pr-2">{l.nome}</td>
                          <td className="py-1.5 pl-3 text-right tabular-nums">{brl2(l.valor)}</td>
                          {temAnterior && <td className="py-1.5 pl-3 text-right tabular-nums text-xs"><VarTela v={l.variacao} /></td>}
                          <td className="py-1.5 pl-3 text-right tabular-nums">{l.quantidade}</td>
                          <td className="py-1.5 pl-3 text-right tabular-nums">{l.ticket !== null ? brl2(l.ticket) : "—"}</td>
                          <td className="py-1.5 pl-3 text-right tabular-nums">{pct(l.pct)}</td>
                        </tr>
                      ))}
                      {!todasReceitas && resto.length > 0 && (
                        <tr className="border-b text-muted-foreground">
                          <td className="py-1.5 pr-2">Outras {resto.length} categorias</td>
                          <td className="py-1.5 pl-3 text-right tabular-nums">{brl2(resto.reduce((s, l) => s + l.valor, 0))}</td>
                          {temAnterior && <td />}
                          <td className="py-1.5 pl-3 text-right tabular-nums">{resto.reduce((s, l) => s + l.quantidade, 0)}</td>
                          <td />
                          <td className="py-1.5 pl-3 text-right tabular-nums">{pct(resto.reduce((s, l) => s + l.pct, 0))}</td>
                        </tr>
                      )}
                      <tr className="bg-muted/40 font-semibold">
                        <td className="py-1.5 pr-2">Total</td>
                        <td className="py-1.5 pl-3 text-right tabular-nums">{brl2(fat.total)}</td>
                        {temAnterior && <td />}
                        <td className="py-1.5 pl-3 text-right tabular-nums">{fat.lancamentos}</td>
                        <td className="py-1.5 pl-3 text-right tabular-nums">{fat.pacientes.ticketMedio !== null ? brl2(fat.pacientes.ticketMedio) : ""}</td>
                        <td className="py-1.5 pl-3 text-right tabular-nums">100%</td>
                      </tr>
                    </tbody>
                  </table>
                  {resto.length > 0 && (
                    <button type="button" onClick={() => setTodasReceitas((x) => !x)} className="mt-2 text-sm font-medium text-primary hover:underline">
                      {todasReceitas ? "Mostrar só as principais" : `Ver todas (${linhas.length})`}
                    </button>
                  )}
                </div>
              )}
            </Quadro>
          ),
        });
        break;
      }

      case "distribuicao": {
        const fat = d.faturamento;
        const quadro = (titulo: string, itens: ItemValor[] | null) => (
          <section className="overflow-hidden rounded-lg border bg-card">
            <div className="border-b px-4 py-3"><h2 className="text-sm font-semibold">{titulo}</h2></div>
            <div className="p-4">
              {!itens ? <p className="text-sm text-muted-foreground">A planilha não tem esta coluna.</p>
                : <Barras formato={brl0} extra itens={itens.slice(0, 8).map((i) => ({ nome: i.nome, valor: i.valor, extra: pct(i.pct, 0), apagado: i.nome === "Não informado" }))} />}
            </div>
          </section>
        );
        if (!fat) break;
        blocos.push({
          id: "distribuicao", menu: `Por ${v.profissional}`,
          no: (
            <div id="ind-distribuicao" className="grid scroll-mt-16 gap-5 lg:grid-cols-3">
              {quadro(`Por ${v.profissional}`, fat.porProfissional)}
              {quadro("Por unidade", fat.porUnidade)}
              {quadro("Meio de pagamento", fat.porPagamento)}
            </div>
          ),
        });
        break;
      }

      case "despesas": {
        const linhas = linhasDeDespesa(d);
        const desp = d.despesas;
        const temAnterior = d.anterior?.despesas != null;
        // categorias abaixo de 2% do total ficam recolhidas no grupo
        const grupos: { g: (typeof linhas)[number]; cats: typeof linhas }[] = [];
        for (const l of linhas) {
          if (l.grupo) grupos.push({ g: l, cats: [] });
          else grupos[grupos.length - 1]?.cats.push(l);
        }
        blocos.push({
          id: "despesas", menu: "Despesas",
          no: (
            <Quadro id="despesas" titulo="Despesas detalhadas por grupo e categoria" lado={desp ? `pela data de vencimento${desp.emAberto ? ` · ${brl0(desp.emAberto)} em aberto` : ""}` : undefined}>
              {!desp ? <p className="text-sm text-muted-foreground">Sem fonte de Despesas.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-2 pr-2 font-medium">Grupo / categoria</th>
                        {temAnterior && <th className="py-2 pl-3 text-right font-medium">{comp.coluna}</th>}
                        <th className="py-2 pl-3 text-right font-medium">Valor</th>
                        {temAnterior && <th className="py-2 pl-3 text-right font-medium">Variação</th>}
                        <th className="py-2 pl-3 text-right font-medium">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grupos.map(({ g, cats }) => {
                        const aberto = gruposAbertos.has(g.nome);
                        const grandes = cats.filter((c) => c.pct >= 0.02 || c.aumentou);
                        const menores = cats.filter((c) => !(c.pct >= 0.02 || c.aumentou));
                        const mostrar = aberto ? cats : grandes;
                        return [
                          <tr key={`g-${g.nome}`} className="border-b bg-muted/40 font-semibold">
                            <td className="py-1.5 pr-2">{g.nome}</td>
                            {temAnterior && <td className="py-1.5 pl-3 text-right tabular-nums font-normal text-muted-foreground">{brl2(g.antes ?? 0)}</td>}
                            <td className={`py-1.5 pl-3 text-right tabular-nums ${g.aumentou ? VERMELHO : ""}`}>{brl2(g.valor)}</td>
                            {temAnterior && <td className="py-1.5 pl-3 text-right tabular-nums text-xs"><VarTela v={g.variacao} quedaNeutra /></td>}
                            <td className="py-1.5 pl-3 text-right tabular-nums">{pct(g.pct)}</td>
                          </tr>,
                          ...mostrar.map((c) => (
                            <tr key={`c-${g.nome}-${c.nome}`} className="border-b">
                              <td className="py-1.5 pl-5 pr-2">{c.nome}</td>
                              {temAnterior && <td className="py-1.5 pl-3 text-right tabular-nums text-muted-foreground">{brl2(c.antes ?? 0)}</td>}
                              <td className={`py-1.5 pl-3 text-right tabular-nums ${c.aumentou ? `${VERMELHO} font-semibold` : ""}`}>{brl2(c.valor)}</td>
                              {temAnterior && <td className="py-1.5 pl-3 text-right tabular-nums text-xs"><VarTela v={c.variacao} quedaNeutra /></td>}
                              <td className="py-1.5 pl-3 text-right tabular-nums text-muted-foreground">{pct(c.pct)}</td>
                            </tr>
                          )),
                          menores.length > 0 && (
                            <tr key={`m-${g.nome}`} className="border-b">
                              <td colSpan={5} className="py-1 pl-5">
                                <button type="button" className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                                  onClick={() => setGruposAbertos((s) => { const n = new Set(s); if (n.has(g.nome)) n.delete(g.nome); else n.add(g.nome); return n; })}>
                                  {aberto ? "recolher as categorias menores" : `+ ${menores.length} ${menores.length === 1 ? "categoria menor" : "categorias menores"}`}
                                </button>
                              </td>
                            </tr>
                          ),
                        ];
                      })}
                      <tr className="font-semibold">
                        <td className="py-1.5 pr-2">Total</td>
                        {temAnterior && <td className="py-1.5 pl-3 text-right tabular-nums font-normal text-muted-foreground">{brl2(d.anterior!.despesas!)}</td>}
                        <td className="py-1.5 pl-3 text-right tabular-nums">{brl2(desp.total)}</td>
                        {temAnterior && <td />}
                        <td className="py-1.5 pl-3 text-right tabular-nums">100%</td>
                      </tr>
                    </tbody>
                  </table>
                  {temAnterior && <p className="mt-2 text-xs text-muted-foreground">Em vermelho, o que subiu mais de 10% (e ao menos R$ 300) em relação a {comp.curto}.</p>}
                </div>
              )}
            </Quadro>
          ),
        });
        break;
      }

      case "regimes": {
        const ano = visaoAno(d);
        const comp_ = item.nivel !== "caixa" && !!ano?.temCompetencia;
        blocos.push({
          id: "regimes", menu: "Caixa x competência",
          no: (
            <Quadro id="regimes" titulo={`Caixa x competência em ${ano?.ano ?? ""}`} lado={ano?.porRecebido ? "entradas pela data do recebimento" : "faturamento pela data do atendimento"}>
              {!ano ? <p className="text-sm text-muted-foreground">Esta leitura não tem a série do ano. Leia as planilhas de novo.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-2 pr-2 text-left font-medium">Mês</th>
                        <th className="py-2 pl-3 text-right font-medium">{ano.porRecebido ? "Entradas" : "Faturamento"}</th>
                        <th className="py-2 pl-3 text-right font-medium">Despesas</th>
                        <th className="py-2 pl-3 text-right font-medium">Saldo</th>
                        {comp_ && <th className="py-2 pl-3 text-right font-medium">Desp. competência</th>}
                        {comp_ && <th className="py-2 pl-3 text-right font-medium">Saldo competência</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {ano.linhas.map((l) => (
                        <tr key={l.mes} className="border-b">
                          <td className="py-1.5 pr-2">{l.rotulo}</td>
                          <td className="py-1.5 pl-3 text-right tabular-nums">{l.faturamento !== null ? brl0(l.faturamento) : "—"}</td>
                          <td className="py-1.5 pl-3 text-right tabular-nums">{l.despesas !== null ? brl0(l.despesas) : "—"}</td>
                          <td className={`py-1.5 pl-3 text-right tabular-nums font-medium ${l.saldo !== null && l.saldo < 0 ? VERMELHO : ""}`}>{l.saldo !== null ? brl0(l.saldo) : "—"}</td>
                          {comp_ && <td className="py-1.5 pl-3 text-right tabular-nums">{l.despesasCompetencia !== null ? brl0(l.despesasCompetencia) : "—"}</td>}
                          {comp_ && <td className={`py-1.5 pl-3 text-right tabular-nums font-medium ${l.saldoCompetencia !== null && l.saldoCompetencia < 0 ? VERMELHO : ""}`}>{l.saldoCompetencia !== null ? brl0(l.saldoCompetencia) : "—"}</td>}
                        </tr>
                      ))}
                      <tr className="bg-muted/40 font-semibold">
                        <td className="py-1.5 pr-2">Total</td>
                        <td className="py-1.5 pl-3 text-right tabular-nums">{brl0(somaDe(ano.linhas, (l) => l.faturamento))}</td>
                        <td className="py-1.5 pl-3 text-right tabular-nums">{brl0(somaDe(ano.linhas, (l) => l.despesas))}</td>
                        <td className="py-1.5 pl-3 text-right tabular-nums">{brl0(somaDe(ano.linhas, (l) => l.saldo))}</td>
                        {comp_ && <td className="py-1.5 pl-3 text-right tabular-nums">{brl0(somaDe(ano.linhas, (l) => l.despesasCompetencia))}</td>}
                        {comp_ && <td className="py-1.5 pl-3 text-right tabular-nums">{brl0(somaDe(ano.linhas, (l) => l.saldoCompetencia))}</td>}
                      </tr>
                    </tbody>
                  </table>
                  {d.origem && <p className="mt-2 text-xs text-muted-foreground">Série calculada no Sync Financeiro: despesas pela data de pagamento.</p>}
                </div>
              )}
            </Quadro>
          ),
        });
        break;
      }

      default: {
        // seções sem quadro próprio (ex.: Entradas) usam o cartão genérico
        const s = montarSecoes(d, [item], { vocabulario: v })[0];
        if (s) blocos.push({ id: item.id, menu: ROTULO_MENU[item.id] ?? s.titulo, no: <div id={`ind-${item.id}`} className="scroll-mt-16"><CartaoSecao s={s} /></div> });
      }
    }
  }

  const menu = blocos.filter((b, i) => blocos.findIndex((x) => x.menu === b.menu) === i);

  return (
    <div className="space-y-5">
      {cartoes.length > 0 && (
        <Grade>{cartoes.map((c) => <KpiDoCartao key={c.id} c={c} longo={quinzenal ? comp.longo : comp.curto} />)}</Grade>
      )}
      {menu.length > 1 && (
        <nav aria-label="Seções dos indicadores" className="sticky top-0 z-10 -mx-1 overflow-x-auto border-b bg-background/95 px-1 py-2 backdrop-blur">
          <ul className="flex gap-1 whitespace-nowrap text-sm">
            {menu.map((b) => (
              <li key={b.id}>
                <a href={`#ind-${b.id}`} className="rounded-md px-2.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">{b.menu}</a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {blocos.map((b) => <div key={b.id}>{b.no}</div>)}
    </div>
  );
}
