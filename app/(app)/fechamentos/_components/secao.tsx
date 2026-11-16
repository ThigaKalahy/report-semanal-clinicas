import type { SecaoMontada, GraficoSecao } from "@/lib/fechamento/secoes";

/**
 * Uma seção do relatório de fechamento. Sem estado nem eventos: serve tanto na
 * tela do fechamento (cliente) quanto na versão para impressão (servidor).
 */

const TOM: Record<string, string> = {
  bom: "text-emerald-600 dark:text-emerald-400 print:text-emerald-700",
  ruim: "text-red-600 dark:text-red-400 print:text-red-700",
};

const COR_SERIE = [
  "text-emerald-600 dark:text-emerald-400 print:text-emerald-700",
  "text-rose-600 dark:text-rose-400 print:text-rose-700",
];
const TRACO_SERIE = [undefined, "6 4"];

const brlCurto = (v: number) =>
  Math.abs(v) >= 1000
    ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: v >= 100000 ? 0 : 1 })} mil`
    : `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Gráfico de linhas simples, em SVG. Cada série tem cor E traço próprios. */
function GraficoLinhas({ g }: { g: GraficoSecao }) {
  const L = 640, A = 240, esq = 64, dir = 16, topo = 12, base = 28;
  const valores = g.series.flatMap((s) => s.valores).filter((v): v is number => v !== null);
  const max = Math.max(1, ...valores);
  const n = g.meses.length;
  const x = (i: number) => esq + (n === 1 ? 0 : (i * (L - esq - dir)) / (n - 1));
  const y = (v: number) => topo + (1 - v / max) * (A - topo - base);
  const grade = [0, 0.5, 1].map((f) => f * max);

  return (
    <figure className="px-4 pb-3">
      <svg viewBox={`0 0 ${L} ${A}`} className="w-full h-auto" role="img"
        aria-label={`Gráfico de ${g.series.map((s) => s.nome.toLowerCase()).join(" e ")} por mês`}>
        {grade.map((v) => (
          <g key={v}>
            <line x1={esq} x2={L - dir} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth={1} />
            <text x={esq - 8} y={y(v) + 4} textAnchor="end" className="fill-muted-foreground" fontSize={11}>{brlCurto(v)}</text>
          </g>
        ))}
        {g.meses.map((m, i) => (
          <text key={`${m}-${i}`} x={x(i)} y={A - 8} textAnchor="middle" className="fill-muted-foreground" fontSize={11}>{m}</text>
        ))}
        {g.series.map((s, si) => {
          // trechos contínuos: um mês sem dado interrompe a linha em vez de ligar por cima
          const trechos: string[] = [];
          let atual: string[] = [];
          s.valores.forEach((v, i) => {
            if (v === null) { if (atual.length) trechos.push(atual.join(" ")); atual = []; }
            else atual.push(`${x(i)},${y(v)}`);
          });
          if (atual.length) trechos.push(atual.join(" "));
          return (
            <g key={s.nome} className={COR_SERIE[si % COR_SERIE.length]}>
              {trechos.map((p, i) => (
                <polyline key={i} points={p} fill="none" stroke="currentColor" strokeWidth={2}
                  strokeDasharray={TRACO_SERIE[si % TRACO_SERIE.length]} strokeLinejoin="round" strokeLinecap="round" />
              ))}
              {s.valores.map((v, i) => v !== null && (
                <circle key={i} cx={x(i)} cy={y(v)} r={3} fill="currentColor">
                  <title>{`${s.nome} · ${g.meses[i]}: ${brl(v)}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <figcaption className="flex items-center gap-4 flex-wrap pt-1 text-xs text-muted-foreground">
        {g.series.map((s, si) => (
          <span key={s.nome} className="inline-flex items-center gap-1.5">
            <svg width="22" height="6" aria-hidden className={COR_SERIE[si % COR_SERIE.length]}>
              <line x1="0" x2="22" y1="3" y2="3" stroke="currentColor" strokeWidth={2} strokeDasharray={TRACO_SERIE[si % TRACO_SERIE.length]} />
            </svg>
            {s.nome}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export function CartaoSecao({ s }: { s: SecaoMontada }) {
  if (s.vazia) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-3 print:hidden">
        <p className="text-sm font-medium text-muted-foreground">{s.titulo}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Fica fora do relatório: {s.vazia}.</p>
      </div>
    );
  }
  return (
    <section className="rounded-lg border bg-card print:break-inside-avoid-page print:border-neutral-300">
      <h3 className="px-4 pt-3.5 pb-2 text-sm font-semibold font-heading">{s.titulo}</h3>
      {s.grafico && <GraficoLinhas g={s.grafico} />}
      {s.linhas.length > 0 && (
        <dl className="px-4 pb-2 divide-y">
          {s.linhas.map((l) => (
            <div key={l.rotulo} className="flex items-baseline justify-between gap-4 py-1.5">
              <dt className="text-sm text-muted-foreground">{l.rotulo}</dt>
              <dd className="text-right">
                <span className={`text-sm font-medium tabular-nums ${l.tom && !l.extra ? TOM[l.tom] : ""}`}>{l.valor}</span>
                {l.extra && (
                  <span className={`ml-2 text-xs tabular-nums ${l.tom ? TOM[l.tom] : "text-muted-foreground"}`}>{l.extra}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {s.tabelas.filter((t) => t.linhas.length > 0).map((t) => (
        <div key={t.titulo} className="px-4 pb-3">
          <p className="pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t.titulo}</p>
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  {t.cabecalho.map((c, i) => (
                    <th key={c} className={`py-1 font-normal ${i === 0 ? "text-left" : "text-right pl-3"}`}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {t.linhas.map((linha, li) => (
                  <tr key={li} className={linha[0] === "Total" ? "font-medium" : ""}>
                    {linha.map((cel, i) => (
                      <td key={i} className={`py-1.5 ${i === 0 ? "text-left" : "text-right pl-3 tabular-nums whitespace-nowrap"}`}>{cel}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {s.texto && <p className="px-4 pb-3 text-sm whitespace-pre-wrap">{s.texto}</p>}
      {s.acoes && s.acoes.length > 0 && (
        <ol className="px-4 pb-3 space-y-1 text-sm list-decimal list-inside">
          {s.acoes.map((a, i) => (
            <li key={i}>
              {a.texto}
              {(a.responsavel || a.prazo) && (
                <span className="text-muted-foreground"> — {[a.responsavel, a.prazo && `até ${a.prazo}`].filter(Boolean).join(", ")}</span>
              )}
            </li>
          ))}
        </ol>
      )}
      {s.nota && <p className="px-4 pb-3 text-xs text-muted-foreground">{s.nota}</p>}
    </section>
  );
}
