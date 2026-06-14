"use client";

import { useState } from "react";
import { Loader2, FlaskConical, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { testarLeituraFaturamento, testarLeituraDespesa } from "../actions";
import type { ResultadoFaturamento } from "@/lib/coletores/faturamento";
import type { ResultadoDespesa }     from "@/lib/coletores/despesa";

interface Props {
  clinicaId: string;
  tipo: "faturamento" | "despesa";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
}

function GrupoTable({ title, rows }: {
  title: string;
  rows: [string, { total: number; pct_do_total: number }][];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
      <div className="rounded-md border overflow-hidden text-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50 text-xs text-muted-foreground">
              <th className="text-left px-3 py-2">Nome</th>
              <th className="text-right px-3 py-2">Total</th>
              <th className="text-right px-3 py-2">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([nome, g]) => (
              <tr key={nome} className="border-t border-border">
                <td className="px-3 py-2">{nome || <span className="text-muted-foreground italic">(sem nome)</span>}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtBRL(g.total)}</td>
                <td className="px-3 py-2 text-right font-mono text-muted-foreground">{g.pct_do_total.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AbasLidas({ abas }: { abas: string[] }) {
  if (abas.length === 0) return null;
  return (
    <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground space-y-0.5">
      <p className="font-semibold uppercase tracking-wide">Aba{abas.length > 1 ? "s" : ""} lida{abas.length > 1 ? "s" : ""}</p>
      {abas.map((aba) => (
        <p key={aba} className="font-mono">{aba}</p>
      ))}
    </div>
  );
}

// ── Diagnóstico de colunas (sob demanda) ─────────────────────────────────────

function idxToLetter(idx: number): string {
  let s = "";
  let n = idx + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

type ColsDiag = {
  debug_cols: {
    data:          { letra: string; idx: number };
    valor_pago:    { letra: string; idx: number };
    categoria:     { letra: string; idx: number };
    profissional?: { letra: string; idx: number };
  };
  cabecalho_api: string[];
  primeiras_linhas: Array<{
    planilha_linha: number;
    date_raw: string;
    valor_raw: string;
    categoria_raw: string;
    profissional_raw?: string;
  }>;
};

function ColsDiagBox({ diag }: { diag: ColsDiag | undefined }) {
  if (!diag?.debug_cols) return null;
  const { debug_cols: cols, cabecalho_api: cab, primeiras_linhas: linhas } = diag;

  const mappedIdxs = new Set([
    cols.data.idx,
    cols.valor_pago.idx,
    cols.categoria.idx,
    ...(cols.profissional ? [cols.profissional.idx] : []),
  ]);

  function labelFor(idx: number): string {
    if (idx === cols.data.idx)                         return "data";
    if (idx === cols.valor_pago.idx)                   return "valor_pago";
    if (idx === cols.categoria.idx)                    return "categoria";
    if (cols.profissional && idx === cols.profissional.idx) return "profissional";
    return "";
  }

  return (
    <div className="rounded-md border border-dashed border-blue-400/60 bg-blue-50/50 dark:bg-blue-950/20 px-3 py-2.5 space-y-3 text-xs">
      <p className="font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
        Diagnóstico de colunas
      </p>

      <div>
        <p className="text-muted-foreground font-semibold mb-1">Cabeçalhos retornados pela API (linha 1):</p>
        <div className="rounded border bg-white/60 dark:bg-black/20 overflow-x-auto">
          <table className="font-mono w-full">
            <thead>
              <tr className="bg-muted/40 text-muted-foreground">
                <th className="text-left px-2 py-1">Letra</th>
                <th className="text-left px-2 py-1">Índice</th>
                <th className="text-left px-2 py-1">Cabeçalho</th>
                <th className="text-left px-2 py-1">Mapeado como</th>
              </tr>
            </thead>
            <tbody>
              {cab.map((header, idx) => (
                <tr
                  key={idx}
                  className={`border-t border-blue-100/50 dark:border-blue-900/40 ${mappedIdxs.has(idx) ? "bg-blue-100/60 dark:bg-blue-900/30" : ""}`}
                >
                  <td className="px-2 py-0.5 font-bold">{idxToLetter(idx)}</td>
                  <td className="px-2 py-0.5 text-muted-foreground">{idx}</td>
                  <td className="px-2 py-0.5">&quot;{header}&quot;</td>
                  <td className="px-2 py-0.5 text-blue-700 dark:text-blue-300">{labelFor(idx)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {linhas.length > 0 && (
        <div>
          <p className="text-muted-foreground font-semibold mb-1">Valores lidos nas primeiras linhas:</p>
          <div className="space-y-1">
            {linhas.map((l) => (
              <div key={l.planilha_linha} className="font-mono bg-white/50 dark:bg-black/20 rounded px-1.5 py-0.5">
                <span className="text-muted-foreground">L{l.planilha_linha}:</span>
                {" "}data=&quot;{l.date_raw}&quot;
                {" "}val=&quot;{l.valor_raw}&quot;
                {" "}<span className="text-blue-700 dark:text-blue-300">cat[{cols.categoria.letra}]=&quot;{l.categoria_raw}&quot;</span>
                {cols.profissional && l.profissional_raw !== undefined && (
                  <>{" "}prof[{cols.profissional.letra}]=&quot;{l.profissional_raw}&quot;</>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Diagnóstico de 0 lançamentos (faturamento) ───────────────────────────────

function DiagnosticoZeroBox({ d }: { d: ResultadoFaturamento["diagnostico"] }) {
  if (!d) return null;
  return (
    <div className="rounded-md border border-dashed border-amber-400/60 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2.5 space-y-2 text-xs">
      <p className="font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
        Diagnóstico — 0 lançamentos
      </p>
      <p className="text-muted-foreground">
        API: <strong>{d.total_rows_api}</strong> linhas totais · linha_inicial: <strong>{d.linha_inicial}</strong> · dados: <strong>{d.data_rows}</strong> linhas
      </p>
      {d.primeiras_linhas.length > 0 && (
        <div className="space-y-1">
          {d.primeiras_linhas.map((l) => (
            <div key={l.planilha_linha} className={`font-mono rounded px-1.5 py-0.5 ${l.motivo_rejeicao ? "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400" : "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400"}`}>
              L{l.planilha_linha}: data=&quot;{l.date_raw}&quot;→{l.date_parsed ?? "INVÁLIDA"} | val=&quot;{l.valor_raw}&quot;→{l.valor_parsed}
              {l.motivo_rejeicao && <span className="ml-1 opacity-80">⚠ {l.motivo_rejeicao}</span>}
            </div>
          ))}
        </div>
      )}
      {d.aviso && <p className="text-amber-700 dark:text-amber-400 whitespace-pre-wrap">{d.aviso}</p>}
    </div>
  );
}

// ── Resultados ────────────────────────────────────────────────────────────────

function FaturamentoResultado({ r }: { r: ResultadoFaturamento }) {
  const [showDiag, setShowDiag] = useState(false);
  const categorias    = Object.entries(r.por_categoria);
  const profissionais = Object.entries(r.por_profissional);
  return (
    <div className="space-y-4">
      <AbasLidas abas={r.abas_lidas ?? []} />
      {r.qtd_lancamentos === 0 && <DiagnosticoZeroBox d={r.diagnostico} />}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md bg-muted/50 p-3 space-y-0.5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total faturado</p>
          <p className="text-xl font-bold font-mono">{fmtBRL(r.total_faturado)}</p>
        </div>
        <div className="rounded-md bg-muted/50 p-3 space-y-0.5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Lançamentos</p>
          <p className="text-xl font-bold font-mono">{r.qtd_lancamentos}</p>
        </div>
      </div>
      <GrupoTable title="Por categoria" rows={categorias} />
      <GrupoTable title="Por profissional" rows={profissionais} />
      {r.diagnostico?.debug_cols && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto py-1 px-2 text-xs text-muted-foreground gap-1"
            onClick={() => setShowDiag((v) => !v)}
          >
            {showDiag ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showDiag ? "Ocultar diagnóstico de colunas" : "Ver diagnóstico de colunas"}
          </Button>
          {showDiag && <div className="mt-2"><ColsDiagBox diag={r.diagnostico} /></div>}
        </div>
      )}
    </div>
  );
}

function DespesaResultado({ r }: { r: ResultadoDespesa }) {
  const [showDiag, setShowDiag] = useState(false);
  const categorias = Object.entries(r.por_categoria);
  return (
    <div className="space-y-4">
      <AbasLidas abas={r.abas_lidas ?? []} />
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md bg-muted/50 p-3 space-y-0.5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total despesa</p>
          <p className="text-xl font-bold font-mono">{fmtBRL(r.total_despesa)}</p>
        </div>
        <div className="rounded-md bg-muted/50 p-3 space-y-0.5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Lançamentos</p>
          <p className="text-xl font-bold font-mono">{r.qtd_lancamentos}</p>
        </div>
      </div>
      <GrupoTable title="Por categoria" rows={categorias} />
      {r.diagnostico?.debug_cols && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto py-1 px-2 text-xs text-muted-foreground gap-1"
            onClick={() => setShowDiag((v) => !v)}
          >
            {showDiag ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showDiag ? "Ocultar diagnóstico de colunas" : "Ver diagnóstico de colunas"}
          </Button>
          {showDiag && <div className="mt-2"><ColsDiagBox diag={r.diagnostico} /></div>}
        </div>
      )}
    </div>
  );
}

// ── Modal principal ───────────────────────────────────────────────────────────

function defaultDateRange() {
  const now = new Date();
  const ini = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    ini: ini.toISOString().slice(0, 10),
    fim: now.toISOString().slice(0, 10),
  };
}

export function TesteLeituraDialog({ clinicaId, tipo, open, onOpenChange }: Props) {
  const defaults = defaultDateRange();
  const [dataInicio, setDataInicio] = useState(defaults.ini);
  const [dataFim,    setDataFim]    = useState(defaults.fim);
  const [loading,    setLoading]    = useState(false);
  const [erro,       setErro]       = useState<string | null>(null);
  const [resultado,  setResultado]  = useState<ResultadoFaturamento | ResultadoDespesa | null>(null);
  const [tipoResult, setTipoResult] = useState<"faturamento" | "despesa" | null>(null);

  async function handleTestar() {
    setLoading(true);
    setErro(null);
    setResultado(null);

    const res = tipo === "faturamento"
      ? await testarLeituraFaturamento(clinicaId, dataInicio, dataFim)
      : await testarLeituraDespesa(clinicaId, dataInicio, dataFim);

    setLoading(false);

    if ("erro" in res) {
      setErro(res.erro);
    } else {
      setResultado(res.resultado);
      setTipoResult(res.tipo);
    }
  }

  const titulo = tipo === "faturamento" ? "Testar leitura — Faturamento" : "Testar leitura — Despesa";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
            {titulo}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tl_ini" className="text-xs">Data início</Label>
              <Input
                id="tl_ini"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tl_fim" className="text-xs">Data fim</Label>
              <Input
                id="tl_fim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          <Button onClick={handleTestar} disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            {loading ? "Lendo planilha…" : "Testar leitura"}
          </Button>

          {erro && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
              {erro}
            </div>
          )}

          {resultado && tipoResult === "faturamento" && (
            <FaturamentoResultado r={resultado as ResultadoFaturamento} />
          )}
          {resultado && tipoResult === "despesa" && (
            <DespesaResultado r={resultado as ResultadoDespesa} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
