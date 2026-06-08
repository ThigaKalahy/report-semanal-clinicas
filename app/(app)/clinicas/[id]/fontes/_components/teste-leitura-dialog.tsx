"use client";

import { useState } from "react";
import { Loader2, FlaskConical } from "lucide-react";
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

function FaturamentoResultado({ r }: { r: ResultadoFaturamento }) {
  const categorias    = Object.entries(r.por_categoria);
  const profissionais = Object.entries(r.por_profissional);
  return (
    <div className="space-y-4">
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
    </div>
  );
}

function DespesaResultado({ r }: { r: ResultadoDespesa }) {
  const categorias = Object.entries(r.por_categoria);
  return (
    <div className="space-y-4">
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
    </div>
  );
}

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
          {/* Date range */}
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
