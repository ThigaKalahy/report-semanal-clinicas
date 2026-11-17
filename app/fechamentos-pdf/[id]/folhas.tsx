/* eslint-disable @next/next/no-img-element -- o PDF sai pela impressão do navegador: <img> simples imprime melhor */
import type { ReactNode } from "react";
import type { DadosFechamento } from "@/lib/fechamento/dados";
import type { AcaoPlano } from "@/lib/fechamento/secoes";
import type { Vocabulario } from "@/lib/perfil/vocabulario";
import { cap } from "@/lib/perfil/vocabulario";
import { temInformacao } from "@/lib/fechamento/calculos";
import { blocosParaCliente, lerAnalise, analiseVazia } from "@/lib/fechamento/analise";
import {
  brl0, brl2, pct, inteiro, nota, textoVar, comparacaoDo, cartoesDoResultado, visaoRitmo, visaoCaixa,
  categoriasDeReceita, linhasDeDespesa, maioresAumentos, visaoAno, somaDe, comparar, mesAbrev, ligadosDa,
} from "@/lib/fechamento/visao";
import type { Variacao, Cartao, Comparacao, Ligados } from "@/lib/fechamento/visao";
import type { ItemEstrutura } from "@/lib/estrutura/estrutura";

/**
 * O relatório do fechamento em folhas A4 — o mesmo desenho do Sync Financeiro:
 * laranja no quinzenal, roxo no mensal, uma folha por assunto.
 */

const CINZA = "#6B6577";
const LINHA = "#E9E4EF";
const VERDE = "#0F7A4A";
const VERMELHO = "#C0262D";
const LARANJA = "#FF5001";

interface Tema {
  cor: string;
  fundo: string;
  borda: string;
  rotulo: string;
}

const TEMAS: Record<DadosFechamento["tipo"], Tema> = {
  quinzenal: { cor: "#E04800", fundo: "#FFF3EC", borda: "#FFC6A8", rotulo: "Quinzenal" },
  mensal: { cor: "#7B099C", fundo: "#F4EFF9", borda: "#D9C2E8", rotulo: "Mensal" },
};

export const ESTILO_PDF = `
@page { size: A4; margin: 12mm 12mm 14mm; }
html, body { background: #ECEAF0 !important; color: #1d1b22; }
.pdf * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.pdf-folha { width: 210mm; min-height: 297mm; padding: 12mm; margin: 0 auto 8mm; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.12); }
.pdf-folha + .pdf-folha { break-before: page; }
.pdf tr, .pdf .pdf-bloco { break-inside: avoid; }
@media print {
  html, body { background: #fff !important; }
  .pdf-sem-impressao { display: none !important; }
  .pdf-folha { width: auto; min-height: 0; padding: 0; margin: 0; box-shadow: none; }
}
`;

// ── Peças ────────────────────────────────────────────────────────────────────

/** quedaNeutra: em despesa, cair não ganha verde — fica cinza, como no Sync. */
function Var({ v, forte = true, quedaNeutra = false }: { v: Variacao; forte?: boolean; quedaNeutra?: boolean }) {
  if (v.valor === null && !v.novo) return <span style={{ color: CINZA }}>—</span>;
  const cor = v.tom === "bom" && !quedaNeutra ? VERDE : v.tom === "ruim" ? VERMELHO : CINZA;
  return <span className={v.tom === "ruim" && forte ? "font-semibold" : ""} style={{ color: cor }}>{textoVar(v)}</span>;
}

function Folha({ tema, cabecalho, titulo, children, espaco = "space-y-6" }: {
  tema: Tema; cabecalho: string; titulo: string; children: ReactNode; espaco?: string;
}) {
  return (
    <section className="pdf-folha">
      <header className="mb-5 flex items-end justify-between border-b-2 pb-3" style={{ borderColor: tema.cor }}>
        <div>
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: CINZA }}>
            <span className="rounded px-1.5 py-0.5 text-[9px] text-white" style={{ background: tema.cor }}>{tema.rotulo}</span>
            {cabecalho}
          </p>
          <h2 className="font-heading text-xl font-semibold" style={{ color: tema.cor }}>{titulo}</h2>
        </div>
        <img src="/brand/gestfy-symbol.png" alt="Gestfy" className="h-7 w-auto" />
      </header>
      <div className={espaco}>{children}</div>
    </section>
  );
}

function Titulo({ tema, texto, lado }: { tema: Tema; texto: string; lado?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h3 className="font-heading text-[15px] font-semibold" style={{ color: tema.cor }}>{texto}</h3>
      {lado && <span className="text-[10px]" style={{ color: CINZA }}>{lado}</span>}
    </div>
  );
}

function Bloco({ tema, rotulo, valor, sub, corValor }: {
  tema: Tema; rotulo: string; valor: string; sub?: ReactNode; corValor?: string;
}) {
  return (
    <div className="pdf-bloco rounded-lg p-3" style={{ background: tema.fundo }}>
      <p className="text-[10px] font-medium" style={{ color: CINZA }}>{rotulo}</p>
      <p className="font-heading text-[19px] font-semibold tabular-nums leading-tight" style={corValor ? { color: corValor } : undefined}>{valor}</p>
      {sub && <p className="mt-0.5 text-[10px]" style={{ color: CINZA }}>{sub}</p>}
    </div>
  );
}

function BlocoCartao({ tema, c, comp }: { tema: Tema; c: Cartao; comp: Comparacao }) {
  const temVar = c.variacao && (c.variacao.valor !== null || c.variacao.novo);
  return (
    <Bloco
      tema={tema} rotulo={c.rotulo} valor={c.valor}
      corValor={c.tomValor === "ruim" ? VERMELHO : undefined}
      sub={temVar ? <><Var v={c.variacao!} forte={c.variacao!.tom === "ruim"} quedaNeutra={c.id === "desp"} /> vs {comp.curto}</> : c.sub}
    />
  );
}

function Lista({ linhas, colunaVar }: {
  linhas: { rotulo: string; valor: string; forte?: boolean; v?: Variacao }[]; colunaVar?: boolean;
}) {
  return (
    <table className="w-full text-[11.5px]">
      <tbody>
        {linhas.map((l) => (
          <tr key={l.rotulo} className="border-b last:border-0" style={{ borderColor: LINHA }}>
            <td className={`py-[5px] pr-2 ${l.forte ? "font-semibold" : ""}`}>{l.rotulo}</td>
            <td className={`whitespace-nowrap py-[5px] text-right tabular-nums ${l.forte ? "font-semibold" : ""}`}>{l.valor}</td>
            {colunaVar && (
              <td className="w-[62px] whitespace-nowrap py-[5px] text-right text-[10.5px] tabular-nums">
                {l.v ? <Var v={l.v} /> : null}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Th({ tema, children, esquerda, className = "" }: { tema: Tema; children: ReactNode; esquerda?: boolean; className?: string }) {
  return (
    <th className={`py-1.5 text-[9.5px] font-semibold uppercase tracking-wide ${esquerda ? "text-left" : "text-right"} ${className}`} style={{ color: tema.cor }}>
      {children}
    </th>
  );
}

// ── Gráfico do ano (duas linhas) ─────────────────────────────────────────────

function milhar(v: number) {
  return `${Math.round(v / 1000).toLocaleString("pt-BR")} mil`;
}

function GraficoAno({ tema, d }: { tema: Tema; d: DadosFechamento }) {
  const ano = visaoAno(d);
  if (!ano || ano.linhas.length < 2) return null;
  const L = ano.linhas;
  const W = 640, H = 150, x0 = 22, x1 = 618, yTopo = 18, yBase = 130;
  const max = Math.max(1, ...L.flatMap((l) => [l.faturamento ?? 0, l.despesas ?? 0]));
  const x = (i: number) => x0 + (i * (x1 - x0)) / Math.max(1, L.length - 1);
  const y = (v: number) => yBase - ((yBase - yTopo) * v) / max;
  const pontos = (f: (l: (typeof L)[number]) => number | null) =>
    L.map((l, i) => (f(l) === null ? null : `${x(i)},${y(f(l)!)}`)).filter(Boolean).join(" ");
  return (
    <div className="pdf-bloco">
      <Titulo tema={tema} texto={`${ano.porRecebido ? "Entradas" : "Faturamento"} e despesas em ${ano.ano}`} lado={
        <>
          <span className="mr-1 inline-block h-[3px] w-3 align-middle" style={{ background: tema.cor }} />{ano.porRecebido ? "Entradas" : "Faturamento"}
          <span className="ml-3 mr-1 inline-block h-[2px] w-3 align-middle" style={{ background: LARANJA }} />Despesas
        </>
      } />
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Faturamento e despesas por mês">
        {[102, 74, 46, 18].map((yy) => <line key={yy} x1={x0} x2={x1} y1={yy} y2={yy} stroke={LINHA} strokeWidth={1} />)}
        <polyline fill="none" stroke={LARANJA} strokeWidth={2} strokeLinejoin="round" points={pontos((l) => l.despesas)} />
        <polyline fill="none" stroke={tema.cor} strokeWidth={2.5} strokeLinejoin="round" points={pontos((l) => l.faturamento)} />
        {L.map((l, i) => {
          const ultimo = i === L.length - 1;
          return (
            <g key={l.mes}>
              {l.despesas !== null && <circle cx={x(i)} cy={y(l.despesas)} r={2.5} fill={LARANJA} />}
              {l.faturamento !== null && <circle cx={x(i)} cy={y(l.faturamento)} r={ultimo ? 4 : 3} fill={tema.cor} />}
              {l.faturamento !== null && (
                <text x={x(i)} y={y(l.faturamento) - 7} textAnchor="middle" fontSize={9.5} fontWeight={ultimo ? 700 : 500} fill={tema.cor}>{milhar(l.faturamento)}</text>
              )}
              {l.despesas !== null && (
                <text x={x(i)} y={y(l.despesas) + 13} textAnchor="middle" fontSize={9} fill={LARANJA}>{milhar(l.despesas)}</text>
              )}
              <text x={x(i)} y={146} textAnchor="middle" fontSize={10.5} fill={ultimo ? "#1d1b22" : CINZA} fontWeight={ultimo ? 700 : 400}>
                {mesAbrev(Number(l.mes.slice(5, 7)))}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Seções ───────────────────────────────────────────────────────────────────

function Experiencia({ tema, d }: { tema: Tema; d: DadosFechamento }) {
  const n = d.nps;
  const g = d.google;
  if (!n && !g) return null;
  const notas: [string, number | null][] = n
    ? [["Médico", n.notas.profissional], ["Recepção", n.notas.recepcao], ["Infraestrutura", n.notas.infraestrutura], ["Enfermagem", n.notas.enfermagem]]
    : [];
  return (
    <div className="pdf-bloco">
      <Titulo tema={tema} texto="Experiência do paciente" />
      <div className="grid gap-2.5 grid-cols-3">
        {n && <Bloco tema={tema} rotulo="NPS" valor={n.respostas ? inteiro(n.score) : "—"} sub={`${n.respostas} respostas · ${n.promotores}/${n.neutros}/${n.detratores}`} />}
        {notas.filter(([, v]) => v !== null).map(([r, v]) => <Bloco key={r} tema={tema} rotulo={r} valor={nota(v!)} sub="de 5" />)}
        {g && <Bloco tema={tema} rotulo="Google" valor={g.media !== null ? nota(g.media, 1) : "—"} sub={`${g.total} avaliações`} />}
      </div>
    </div>
  );
}

function FunisMensal({ tema, d, lig, v }: { tema: Tema; d: DadosFechamento; lig: Ligados; v: Vocabulario }) {
  const l = lig.secao("funilLeads") ? d.leads : null;
  const o = lig.secao("funilOrcamentos") ? d.orcamentos : null;
  if (!l && !o) return null;
  const top = (itens: { nome: string; quantidade: number }[] | null, n = 6) =>
    temInformacao(itens)
      ? itens!.filter((i) => i.nome !== "Não informado").slice(0, n).map((i) => ({ rotulo: i.nome, valor: inteiro(i.quantidade) }))
      : [];
  return (
    <div className="grid grid-cols-2 gap-8">
      <div className="space-y-4">
        {l && (
          <>
            <div className="pdf-bloco">
              <Titulo tema={tema} texto="Funil de leads" />
              <Lista linhas={[
                { rotulo: "Leads chegando", valor: inteiro(l.total) },
                { rotulo: "Leads agendados", valor: inteiro(l.agendados) },
                { rotulo: "Conversão lead → agendamento", valor: pct(l.conversao, 0), forte: true },
              ]} />
            </div>
            {top(l.porInteresse).length > 0 && (
              <div className="pdf-bloco"><Titulo tema={tema} texto={`${cap(v.servico)} mais buscado`} /><Lista linhas={top(l.porInteresse)} /></div>
            )}
            {top(l.porOrigem).length > 0 && (
              <div className="pdf-bloco"><Titulo tema={tema} texto="Origem do lead" /><Lista linhas={top(l.porOrigem)} /></div>
            )}
            {top(l.porObjecao).length > 0 && (
              <div className="pdf-bloco"><Titulo tema={tema} texto="Motivos de não agendamento" /><Lista linhas={top(l.porObjecao)} /></div>
            )}
          </>
        )}
      </div>
      <div className="space-y-4">
        {o && (
          <>
            <div className="pdf-bloco">
              <Titulo tema={tema} texto="Orçamentos por valor" />
              <Lista linhas={[
                { rotulo: "Gerados", valor: brl0(o.valorGerado) },
                { rotulo: "Fechados", valor: brl0(o.valorFechado) },
                { rotulo: "Em aberto", valor: brl0(o.valorEmAberto) },
                { rotulo: "Conversão em valor", valor: pct(o.conversaoValor, 0), forte: true },
              ]} />
            </div>
            <div className="pdf-bloco">
              <Titulo tema={tema} texto="Orçamentos por quantidade" />
              <Lista linhas={[
                { rotulo: "Total de orçamentos", valor: inteiro(o.total) },
                { rotulo: "Fechados", valor: inteiro(o.fechados) },
                { rotulo: "Em aberto", valor: inteiro(o.emAberto) },
                { rotulo: "Não fecharam", valor: inteiro(o.naoFechou) },
                { rotulo: "Conversão em quantidade", valor: pct(o.conversaoQuantidade, 0), forte: true },
              ]} />
            </div>
            {o.porStatus.length > 0 && (
              <div className="pdf-bloco"><Titulo tema={tema} texto="Por status" /><Lista linhas={top(o.porStatus, 8)} /></div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FunisQuinzenal({ tema, d, lig, comp }: { tema: Tema; d: DadosFechamento; lig: Ligados; comp: Comparacao }) {
  const l = lig.secao("funilLeads") ? d.leads : null;
  const o = lig.secao("funilOrcamentos") ? d.orcamentos : null;
  if (!l && !o) return null;
  const la = d.anterior?.leads;
  const oa = d.anterior?.orcamentos;
  const ticket = (x: { total: number; valorGerado: number } | null | undefined) => (x && x.total ? x.valorGerado / x.total : x ? 0 : null);
  const objecoes = l && temInformacao(l.porObjecao) ? l.porObjecao!.filter((i) => i.nome !== "Não informado").slice(0, 6) : [];
  return (
    <div className="grid grid-cols-2 gap-8">
      <div>
        {l && (
          <div className="pdf-bloco space-y-4">
            <div>
              <Titulo tema={tema} texto="Funil de leads" lado={la ? `vs ${comp.curto}` : undefined} />
              <Lista colunaVar linhas={[
                { rotulo: "Leads chegando", valor: inteiro(l.total), v: comparar(l.total, la?.total) },
                { rotulo: "Agendados", valor: inteiro(l.agendados), v: comparar(l.agendados, la?.agendados) },
                { rotulo: "Conversão", valor: pct(l.conversao, 0), forte: true, v: comparar(l.conversao, la?.conversao) },
              ]} />
            </div>
            {objecoes.length > 0 && (
              <div className="pdf-bloco">
                <Titulo tema={tema} texto="Motivos de não agendamento" />
                <Lista linhas={objecoes.map((i) => ({ rotulo: i.nome, valor: inteiro(i.quantidade) }))} />
              </div>
            )}
          </div>
        )}
      </div>
      <div>
        {o && (
          <div className="pdf-bloco space-y-4">
            <div>
              <Titulo tema={tema} texto="Orçamentos" lado={oa ? `vs ${comp.curto}` : undefined} />
              <Lista colunaVar linhas={[
                { rotulo: "Orçamentos", valor: inteiro(o.total), v: comparar(o.total, oa?.total) },
                { rotulo: "Ticket médio por orçamento", valor: brl0(ticket(o) ?? 0), v: comparar(ticket(o), ticket(oa)) },
                { rotulo: "Valor gerado", valor: brl0(o.valorGerado), v: comparar(o.valorGerado, oa?.valorGerado) },
                { rotulo: "Valor fechado", valor: brl0(o.valorFechado), v: comparar(o.valorFechado, oa?.valorFechado) },
                { rotulo: "Conversão em valor", valor: pct(o.conversaoValor, 0), forte: true, v: comparar(o.conversaoValor, oa?.conversaoValor) },
              ]} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Ritmo({ tema, d }: { tema: Tema; d: DadosFechamento }) {
  const r = visaoRitmo(d);
  if (!r) return null;
  const escala = Math.max(r.realizado, r.projecao ?? 0, r.meta ?? 0) * 1.08 || 1;
  const w = (v: number) => `${Math.min(100, (v / escala) * 100)}%`;
  return (
    <div className="pdf-bloco rounded-xl border-2 p-4" style={{ borderColor: tema.borda }}>
      <Titulo tema={tema} texto="Ritmo do mês" lado={`${r.decorridos} de ${r.diasMes} dias úteis decorridos`} />
      <div className="mb-3 grid grid-cols-4 gap-3">
        {([
          ["Faturamento por dia útil", r.porDia !== null ? brl0(r.porDia) : "—"],
          ["Projeção do mês", r.projecao !== null ? brl0(r.projecao) : "—"],
          ["Meta do mês", r.meta !== null ? brl0(r.meta) : "—"],
          ["Projeção da meta", pct(r.atingimentoProjetado)],
        ] as const).map(([rot, val]) => (
          <div key={rot}>
            <p className="text-[10px] font-medium" style={{ color: CINZA }}>{rot}</p>
            <p className="font-heading text-[19px] font-semibold tabular-nums leading-tight">{val}</p>
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <div className="relative h-5 overflow-hidden rounded-full" style={{ background: "#F3EEEA" }}>
          {r.projecao !== null && <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: w(r.projecao), background: "#FFC6A8" }} />}
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: w(r.realizado), background: LARANJA }} />
          {r.meta !== null && <div className="absolute inset-y-[-2px] w-[2px]" style={{ left: w(r.meta), background: "#1d1b22" }} />}
        </div>
        <div className="flex flex-wrap gap-x-4 text-[10px]" style={{ color: CINZA }}>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full align-[-1px]" style={{ background: LARANJA }} />Realizado {brl0(r.realizado)}</span>
          {r.projecao !== null && <span><span className="mr-1 inline-block h-2 w-2 rounded-full align-[-1px]" style={{ background: "#FFC6A8" }} />Projeção {brl0(r.projecao)}</span>}
          {r.meta !== null && <span><span className="mr-1 inline-block h-2.5 w-[2px] align-[-1px]" style={{ background: "#1d1b22" }} />Meta {brl0(r.meta)}</span>}
        </div>
      </div>
      {r.meta !== null && (
        <p className="mt-3 text-[12px]">
          {r.falta && r.falta > 0 && r.necessarioPorDia !== null ? (
            <>
              Para bater a meta, faltam <b>{brl2(r.falta)}</b>: <b style={{ color: tema.cor }}>{brl2(r.necessarioPorDia)} por dia útil</b> nos {r.restantes} dias úteis restantes
              {r.porDia !== null && <> (hoje a média é {brl2(r.porDia)})</>}.
            </>
          ) : r.falta === 0 ? <b style={{ color: VERDE }}>A meta do mês já foi atingida.</b> : null}
        </p>
      )}
    </div>
  );
}

function CaixaMes({ tema, d, comp }: { tema: Tema; d: DadosFechamento; comp: Comparacao }) {
  const c = visaoCaixa(d);
  if (!c) return null;
  const dia = Number(d.periodo.fim.slice(8, 10));
  return (
    <div className="pdf-bloco">
      <Titulo tema={tema} texto="Caixa do mês" lado={c.media !== null ? "despesas a pagar estimadas pela média dos últimos meses" : "despesas a pagar pelos vencimentos do mês"} />
      <div className="grid grid-cols-4 gap-2.5">
        <Bloco tema={tema} rotulo={`Despesas até o dia ${dia}`} valor={brl0(c.pagas)}
          sub={c.varPagas.valor !== null ? <><Var v={c.varPagas} forte={false} quedaNeutra /> vs {comp.curto}</> : undefined} />
        {c.media !== null && <Bloco tema={tema} rotulo="Média mensal de despesas" valor={brl0(c.media)} sub={c.mesesDaMedia.join(", ")} />}
        <Bloco tema={tema} rotulo="Provisionado a pagar" valor={brl0(c.provisionado)} sub={c.regraProvisionado} />
        {c.saldoProjetado !== null && (
          <Bloco tema={tema} rotulo="Saldo projetado do mês" valor={brl0(c.saldoProjetado)} corValor={c.saldoProjetado < 0 ? VERMELHO : undefined}
            sub={c.saldoPeriodo !== null ? `saldo até o dia ${dia}: ${brl0(c.saldoPeriodo)}` : undefined} />
        )}
      </div>
    </div>
  );
}

function ReceitasQuinzenal({ tema, d, comp }: { tema: Tema; d: DadosFechamento; comp: Comparacao }) {
  const linhas = categoriasDeReceita(d).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  if (linhas.length === 0) return null;
  const fat = d.faturamento!;
  const totalAntes = d.anterior?.faturamento ?? null;
  const tdN = "py-[4px] tabular-nums pl-3 text-right";
  return (
    <>
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b-2" style={{ borderColor: tema.cor }}>
            <Th tema={tema} esquerda>Categoria</Th>
            <Th tema={tema}>{comp.coluna}</Th>
            <Th tema={tema}>{comp.colunaAtual}</Th>
            <Th tema={tema}>Variação</Th>
            <Th tema={tema}>Qtd.</Th>
            <Th tema={tema}>% fat.</Th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.nome} className="border-b" style={{ borderColor: LINHA }}>
              <td className="py-[4px] pr-2">{l.nome}</td>
              <td className="py-[4px] tabular-nums text-right" style={{ color: CINZA }}>{l.antes ? brl2(l.antes) : "—"}</td>
              <td className={tdN}>{l.valor ? brl2(l.valor) : "—"}</td>
              <td className={tdN}><Var v={l.variacao} /></td>
              <td className={tdN}>{l.quantidade || "—"}</td>
              <td className={tdN}>{l.valor ? pct(l.pct) : "—"}</td>
            </tr>
          ))}
          <tr className="border-t-2 font-semibold" style={{ borderColor: tema.cor }}>
            <td className="py-[4px] pr-2">Total</td>
            <td className="py-[4px] tabular-nums text-right">{totalAntes !== null ? brl2(totalAntes) : "—"}</td>
            <td className={tdN}>{brl2(fat.total)}</td>
            <td className={tdN}><Var v={comparar(fat.total, totalAntes)} /></td>
            <td className={tdN}>{fat.lancamentos}</td>
            <td className={tdN}>100%</td>
          </tr>
        </tbody>
      </table>
      <p className="text-[10px]" style={{ color: CINZA }}>
        Comparação com o mesmo período {comp.extenso}. Aparecem as categorias com faturamento neste período ou no anterior.
      </p>
    </>
  );
}

function ReceitasMensal({ tema, d, comp }: { tema: Tema; d: DadosFechamento; comp: Comparacao }) {
  const linhas = categoriasDeReceita(d).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  if (linhas.length === 0) return null;
  const fat = d.faturamento!;
  const pa = d.anterior?.pacientes;
  const ticket = fat.pacientes.ticketMedio;
  return (
    <>
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b-2" style={{ borderColor: tema.cor }}>
            <Th tema={tema} esquerda>Categoria</Th>
            <Th tema={tema}>Valor</Th>
            <Th tema={tema}>vs {comp.coluna}</Th>
            <Th tema={tema}>Qtd.</Th>
            <Th tema={tema}>Ticket médio</Th>
            <Th tema={tema}>vs {comp.coluna}</Th>
            <Th tema={tema}>% fat.</Th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.nome} className="border-b" style={{ borderColor: LINHA }}>
              <td className="py-[4px] pr-2">{l.nome}</td>
              <td className="py-[4px] tabular-nums text-right">{brl2(l.valor)}</td>
              <td className="py-[4px] tabular-nums pl-2 text-right"><Var v={l.variacao} /></td>
              <td className="py-[4px] tabular-nums pl-3 text-right">{l.quantidade}</td>
              <td className="py-[4px] tabular-nums pl-3 text-right">{l.ticket !== null ? brl2(l.ticket) : "—"}</td>
              <td className="py-[4px] tabular-nums pl-2 text-right"><Var v={l.varTicket} /></td>
              <td className="py-[4px] tabular-nums pl-2 text-right">{pct(l.pct)}</td>
            </tr>
          ))}
          <tr className="border-t-2 font-semibold" style={{ borderColor: tema.cor }}>
            <td className="py-[4px] pr-2">Total</td>
            <td className="py-[4px] tabular-nums text-right">{brl2(fat.total)}</td>
            <td className="py-[4px] tabular-nums pl-2 text-right"><Var v={comparar(fat.total, d.anterior?.faturamento)} /></td>
            <td className="py-[4px] tabular-nums pl-3 text-right">{fat.lancamentos}</td>
            <td className="py-[4px] tabular-nums pl-3 text-right">{ticket !== null ? brl2(ticket) : "—"}</td>
            <td className="py-[4px] tabular-nums pl-2 text-right"><Var v={comparar(ticket, pa?.ticketMedio)} /></td>
            <td className="py-[4px] tabular-nums pl-2 text-right">100%</td>
          </tr>
        </tbody>
      </table>
      <p className="text-[10px]" style={{ color: CINZA }}>
        Variação em relação a {comp.curto}. O ticket médio do total é por paciente atendido; o das categorias, por lançamento.
      </p>
    </>
  );
}

function DespesasMensal({ tema, d, comp }: { tema: Tema; d: DadosFechamento; comp: Comparacao }) {
  const linhas = linhasDeDespesa(d);
  if (linhas.length === 0) return null;
  const aumentos = maioresAumentos(d, comp);
  const desp = d.despesas!;
  const temAnterior = d.anterior?.despesas != null;
  return (
    <>
      {aumentos.length > 0 && (
        <div className="pdf-bloco">
          <Titulo tema={tema} texto="O que mais aumentou" lado={`por vencimento · em vermelho, o que subiu mais de 10% (e ao menos R$ 300) em relação a ${comp.curto}`} />
          <div className="grid grid-cols-4 gap-2.5">
            {aumentos.map((a) => (
              <div key={a.nome} className="rounded-lg border-l-[3px] px-3 py-2" style={{ borderColor: VERMELHO, background: "#FCF1F1" }}>
                <p className="truncate text-[10px] font-medium" style={{ color: CINZA }}>{a.nome}</p>
                <p className="font-heading text-[16px] font-semibold tabular-nums leading-tight" style={{ color: VERMELHO }}>{brl0(a.valor)}</p>
                <p className="text-[10px]" style={{ color: CINZA }}><b style={{ color: VERMELHO }}>{a.texto}</b></p>
              </div>
            ))}
          </div>
        </div>
      )}
      <table className="w-full text-[10.5px]">
        <thead>
          <tr className="border-b-2" style={{ borderColor: tema.cor }}>
            <Th tema={tema} esquerda className="pl-1.5">Grupo / categoria</Th>
            {temAnterior && <Th tema={tema}>{comp.curto}</Th>}
            <Th tema={tema}>{comp.colunaAtual}</Th>
            {temAnterior && <Th tema={tema}>Variação</Th>}
            <Th tema={tema} className="pr-1.5">% do total</Th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={`${l.nome}-${i}`} className="border-b" style={{ borderColor: LINHA, background: l.grupo ? tema.fundo : undefined }}>
              <td className={`py-[4px] pr-2 ${l.grupo ? "pl-1.5 font-semibold" : "pl-5"}`}>{l.nome}</td>
              {temAnterior && <td className="py-[4px] tabular-nums text-right" style={{ color: CINZA }}>{brl2(l.antes ?? 0)}</td>}
              <td className={`py-[4px] tabular-nums pl-3 text-right ${l.aumentou || l.grupo ? "font-semibold" : ""}`} style={l.aumentou ? { color: VERMELHO } : undefined}>{brl2(l.valor)}</td>
              {temAnterior && <td className="py-[4px] tabular-nums pl-3 text-right"><Var v={l.variacao} forte={l.aumentou} quedaNeutra /></td>}
              <td className={`py-[4px] tabular-nums pl-3 pr-1.5 text-right ${l.grupo ? "font-semibold" : ""}`} style={l.grupo ? undefined : { color: CINZA }}>{pct(l.pct)}</td>
            </tr>
          ))}
          <tr className="border-t-2 font-semibold" style={{ borderColor: tema.cor }}>
            <td className="py-[4px] pr-2 pl-1.5">Total de despesas</td>
            {temAnterior && <td className="py-[4px] tabular-nums text-right" style={{ color: CINZA }}>{brl2(d.anterior!.despesas!)}</td>}
            <td className="py-[4px] tabular-nums pl-3 text-right">{brl2(desp.total)}</td>
            {temAnterior && <td className="py-[4px] tabular-nums pl-3 text-right"><Var v={comparar(desp.total, d.anterior!.despesas, false)} quedaNeutra /></td>}
            <td className="py-[4px] tabular-nums pl-3 pr-1.5 text-right">100%</td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

function ResultadoAno({ tema, d, nivel }: { tema: Tema; d: DadosFechamento; nivel?: string }) {
  const ano = visaoAno(d);
  if (!ano) return null;
  const L = ano.linhas;
  const entrada = ano.porRecebido ? "Entradas" : "Faturamento";
  const td = "py-[4px] tabular-nums text-right";
  const tabela = (competencia: boolean) => (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="border-b-2" style={{ borderColor: tema.cor }}>
          <Th tema={tema} esquerda>Mês</Th>
          <Th tema={tema}>{entrada}</Th>
          <Th tema={tema}>Var.</Th>
          <Th tema={tema}>{competencia ? "Despesas do mês" : "Despesas"}</Th>
          <Th tema={tema}>Var.</Th>
          <Th tema={tema}>{competencia ? "Resultado" : `${ano.porRecebido ? "Ent." : "Fat."} x desp.`}</Th>
        </tr>
      </thead>
      <tbody>
        {L.map((l) => {
          const desp = competencia ? l.despesasCompetencia : l.despesas;
          const saldo = competencia ? l.saldoCompetencia : l.saldo;
          return (
            <tr key={l.mes} className="border-b" style={{ borderColor: LINHA }}>
              <td className="py-[4px] pr-2">{l.rotulo}</td>
              <td className={td}>{l.faturamento !== null ? brl0(l.faturamento) : "—"}</td>
              <td className={td}><Var v={l.varFaturamento} /></td>
              <td className={`${td} pl-3`}>{desp !== null ? brl0(desp) : "—"}</td>
              <td className={td}><Var v={competencia ? l.varCompetencia : l.varDespesas} quedaNeutra /></td>
              <td className={`${td} font-semibold`} style={saldo !== null && saldo < 0 ? { color: VERMELHO } : undefined}>{saldo !== null ? brl0(saldo) : "—"}</td>
            </tr>
          );
        })}
        <tr className="border-t-2 font-semibold" style={{ borderColor: tema.cor }}>
          <td className="py-[4px] pr-2">Total</td>
          <td className={td}>{brl0(somaDe(L, (l) => l.faturamento))}</td>
          <td />
          <td className={`${td} pl-3`}>{brl0(somaDe(L, (l) => (competencia ? l.despesasCompetencia : l.despesas)))}</td>
          <td />
          <td className={td}>{brl0(somaDe(L, (l) => (competencia ? l.saldoCompetencia : l.saldo)))}</td>
        </tr>
      </tbody>
    </table>
  );
  return (
    <>
      <div className="pdf-bloco">
        <Titulo tema={tema} texto={`${entrada} x Despesas`} lado={`${entrada.toLowerCase()} − despesas do mês, pela data de vencimento${ano.porRecebido ? "" : " (sem fonte de entradas)"}`} />
        {tabela(false)}
      </div>
      {ano.temCompetencia && nivel !== "caixa" && (
        <div className="pdf-bloco">
          <Titulo tema={tema} texto="Regime de competência" lado={`${entrada.toLowerCase()} do mês − despesas do mês a que se referem`} />
          {tabela(true)}
        </div>
      )}
      {d.origem && <p className="text-[10px]" style={{ color: CINZA }}>Série calculada no Sync Financeiro: despesas pela data de pagamento.</p>}
    </>
  );
}

function Analise({ tema, analise, acoes }: { tema: Tema; analise: string; acoes: AcaoPlano[] }) {
  const blocos = blocosParaCliente(lerAnalise(analise));
  const lista = acoes.filter((a) => a.texto.trim());
  if (blocos.length === 0 && lista.length === 0) return null;
  return (
    <>
      {blocos.map((b) => (
        <div key={b.titulo}>
          <Titulo tema={tema} texto={b.titulo} />
          <div className="whitespace-pre-wrap text-[12px] leading-relaxed">{b.texto}</div>
        </div>
      ))}
      {lista.length > 0 && (
        <div>
          <Titulo tema={tema} texto="Plano de ação" />
          <ol className="space-y-3">
            {lista.map((a, i) => (
              <li key={i} className="pdf-bloco grid grid-cols-[22px_1fr] gap-2 text-[12px]">
                <span className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: tema.cor }}>{i + 1}</span>
                <div className="space-y-0.5">
                  <p className="font-semibold">{a.texto}</p>
                  {a.descricao?.trim() && <p className="leading-relaxed">{a.descricao}</p>}
                  <p className="text-[10.5px]" style={{ color: CINZA }}>
                    {[a.responsavel.trim() && `Responsável: ${a.responsavel.trim()}`, a.prazo.trim() && `Prazo: ${a.prazo.trim()}`, a.indicador?.trim() && `Como medir: ${a.indicador.trim()}`]
                      .filter(Boolean).join(" · ")}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}

// ── O relatório ──────────────────────────────────────────────────────────────

export function RelatorioPdf({ d, nome, periodoCurto, lista, v, analise, acoes, comAnalise }: {
  d: DadosFechamento; nome: string; periodoCurto: string; lista: ItemEstrutura[]; v: Vocabulario;
  analise: string; acoes: AcaoPlano[]; comAnalise: boolean;
}) {
  const tema = TEMAS[d.tipo];
  const comp = comparacaoDo(d);
  const lig = ligadosDa(lista, d.tipo);
  const cab = `${nome} · Relatório ${d.tipo} · ${periodoCurto}`;
  const cartoes = cartoesDoResultado(d, lig, v);
  const folhas: ReactNode[] = [];

  if (d.tipo === "quinzenal") {
    const principais = cartoes.filter((c) => ["fat", "ent", "atend", "ticket", "novos"].includes(c.id));
    if (principais.length) {
      folhas.push(
        <Folha key="parcial" tema={tema} cabecalho={cab} titulo="Parcial do mês">
          <div className="grid grid-cols-4 gap-2.5">{principais.map((c) => <BlocoCartao key={c.id} tema={tema} c={c} comp={comp} />)}</div>
        </Folha>,
      );
    }
    const ritmo = lig.secao("ritmo") ? <Ritmo tema={tema} d={d} /> : null;
    const caixa = lig.secao("caixaMes") ? <CaixaMes tema={tema} d={d} comp={comp} /> : null;
    const funis = <FunisQuinzenal tema={tema} d={d} lig={lig} comp={comp} />;
    if (ritmo || caixa || d.leads || d.orcamentos) {
      folhas.push(
        <Folha key="ritmo" tema={tema} cabecalho={cab} titulo="Ritmo do mês">{ritmo}{caixa}{funis}</Folha>,
      );
    }
    if (lig.secao("receitas") && d.faturamento?.porCategoria.length) {
      folhas.push(
        <Folha key="receitas" tema={tema} cabecalho={cab} titulo="Faturamento por categoria">
          <ReceitasQuinzenal tema={tema} d={d} comp={comp} />
        </Folha>,
      );
    }
  } else {
    folhas.push(
      <Folha key="resultado" tema={tema} cabecalho={cab} titulo="Resultado do mês">
        {cartoes.length > 0 && <div className="grid grid-cols-4 gap-2.5">{cartoes.map((c) => <BlocoCartao key={c.id} tema={tema} c={c} comp={comp} />)}</div>}
        {lig.secao("grafico") && <GraficoAno tema={tema} d={d} />}
        {lig.secao("experiencia") && <Experiencia tema={tema} d={d} />}
        <FunisMensal tema={tema} d={d} lig={lig} v={v} />
      </Folha>,
    );
    if (lig.secao("receitas") && d.faturamento?.porCategoria.length) {
      folhas.push(
        <Folha key="receitas" tema={tema} cabecalho={cab} titulo="Receitas detalhadas"><ReceitasMensal tema={tema} d={d} comp={comp} /></Folha>,
      );
    }
    if (lig.secao("despesas") && d.despesas?.porGrupo.length) {
      folhas.push(
        <Folha key="despesas" tema={tema} cabecalho={cab} titulo="Despesas detalhadas" espaco="space-y-3"><DespesasMensal tema={tema} d={d} comp={comp} /></Folha>,
      );
    }
    if (lig.secao("regimes") && visaoAno(d)) {
      folhas.push(
        <Folha key="ano" tema={tema} cabecalho={cab} titulo={`Resultado em ${visaoAno(d)!.ano}: caixa e competência`}>
          <ResultadoAno tema={tema} d={d} nivel={lig.item("regimes")?.nivel} />
        </Folha>,
      );
    }
  }

  if (comAnalise) {
    const vazia = analiseVazia(lerAnalise(analise)) && !acoes.some((a) => a.texto.trim());
    folhas.push(
      <Folha key="analise" tema={tema} cabecalho={cab} titulo="Análise e plano de ação">
        {vazia
          ? <p className="text-[12px]" style={{ color: CINZA }}>A análise deste fechamento ainda não foi escrita.</p>
          : <Analise tema={tema} analise={analise} acoes={acoes} />}
      </Folha>,
    );
  }

  return <>{folhas}</>;
}
