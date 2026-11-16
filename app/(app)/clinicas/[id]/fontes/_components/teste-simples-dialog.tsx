"use client";

import { useState } from "react";
import { Loader2, FlaskConical, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { testarLeituraSimples } from "../actions";
import type { TesteResultadoSimples } from "../actions";
import { ROTULO_GRUPO_ENTRADA } from "@/lib/coletores/entradas-calculo";
import type { ResultadoEntradas } from "@/lib/coletores/entradas-calculo";
import type { ResultadoOrcamentos } from "@/lib/coletores/orcamentos-calculo";
import { ROTULO_FONTE } from "@/lib/fontes/campos";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number | null) =>
  v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

function dataBR(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Mantém só dígitos e aplica a máscara DD/MM/AAAA enquanto se digita. */
function mascaraData(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join("/");
}

function Linha({ rotulo, valor, fraco }: { rotulo: string; valor: string; fraco?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1.5 text-sm ${fraco ? "text-muted-foreground" : ""}`}>
      <span>{rotulo}</span>
      <span className="tabular-nums font-medium">{valor}</span>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{titulo}</p>
      <div className="rounded-md border px-3 divide-y">{children}</div>
    </div>
  );
}

function Ilegiveis({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      {n} linha{n !== 1 ? "s" : ""} com data ou valor ilegível ficaram fora do cálculo. Confira na planilha.
    </p>
  );
}

function EntradasResultado({ r }: { r: ResultadoEntradas }) {
  return (
    <div className="space-y-4">
      <Bloco titulo="Resumo">
        <Linha rotulo="Total de entradas (no resultado)" valor={brl(r.total)} />
        <Linha rotulo="Operacionais" valor={brl(r.operacionais)} fraco />
        <Linha rotulo="Não operacionais" valor={brl(r.naoOperacionais)} fraco />
        <Linha rotulo="Fora do resultado (transferências, empréstimos, aportes)" valor={brl(r.foraDoResultado)} fraco />
        <Linha rotulo="Lançamentos recebidos" valor={String(r.lancamentos)} fraco />
        <Linha rotulo={`Em aberto (${r.emAberto.quantidade})`} valor={brl(r.emAberto.valor)} fraco />
        {r.semSituacao > 0 && (
          <Linha rotulo="Sem situação preenchida (contados como recebidos)" valor={String(r.semSituacao)} fraco />
        )}
      </Bloco>
      {r.porCategoria.length > 0 && (
        <Bloco titulo="Por categoria">
          {r.porCategoria.map((c) => (
            <Linha key={`${c.grupo}:${c.nome}`}
              rotulo={`${c.nome} · ${ROTULO_GRUPO_ENTRADA[c.grupo]}`}
              valor={c.grupo === "fora" ? brl(c.valor) : `${brl(c.valor)} · ${pct(c.pct)}`} fraco />
          ))}
        </Bloco>
      )}
      <Ilegiveis n={r.linhasIlegiveis} />
    </div>
  );
}

function OrcamentosResultado({ r }: { r: ResultadoOrcamentos }) {
  return (
    <div className="space-y-4">
      <Bloco titulo="Por quantidade">
        <Linha rotulo="Total" valor={String(r.total)} />
        <Linha rotulo="Fechados" valor={`${r.fechados} · ${pct(r.conversaoQuantidade)}`} fraco />
        <Linha rotulo="Em aberto" valor={String(r.emAberto)} fraco />
        <Linha rotulo="Não fecharam" valor={String(r.naoFechou)} fraco />
        <Linha rotulo="Cancelados (fora da conversão)" valor={String(r.cancelados)} fraco />
      </Bloco>
      <Bloco titulo="Por valor">
        <Linha rotulo="Valor gerado" valor={brl(r.valorGerado)} />
        <Linha rotulo="Valor fechado" valor={`${brl(r.valorFechado)} · ${pct(r.conversaoValor)}`} fraco />
        <Linha rotulo="Valor em aberto" valor={brl(r.valorEmAberto)} fraco />
        <Linha rotulo="Valor cancelado" valor={brl(r.valorCancelado)} fraco />
      </Bloco>
      {r.porStatus.length > 0 && (
        <Bloco titulo="Por status (como escrito na planilha)">
          {r.porStatus.map((s) => (
            <Linha key={s.nome} rotulo={s.nome} valor={`${s.quantidade} · ${pct(s.pct)}`} fraco />
          ))}
        </Bloco>
      )}
      {r.statusSemSituacao.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2.5 space-y-1">
          <p className="flex items-start gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Status sem classificação — não contam como fechado, em aberto, não fechou nem cancelado:
          </p>
          <p className="text-xs text-muted-foreground">
            {r.statusSemSituacao.map((s) => `${s.nome} (${s.quantidade})`).join(" · ")}
          </p>
          <p className="text-xs text-muted-foreground">
            Edite a fonte e informe essas palavras em “Palavras desta clínica”.
          </p>
        </div>
      )}
      {r.porObjecao.length > 0 && (
        <Bloco titulo="Motivos de não fechamento">
          {r.porObjecao.map((s) => (
            <Linha key={s.nome} rotulo={s.nome} valor={`${s.quantidade} · ${pct(s.pct)}`} fraco />
          ))}
        </Bloco>
      )}
      <Ilegiveis n={r.linhasIlegiveis} />
    </div>
  );
}

export function TesteSimplesDialog({
  clinicaId, tipo, open, onOpenChange,
}: {
  clinicaId: string;
  tipo: "entradas" | "orcamentos";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const hoje = new Date();
  const [ini, setIni] = useState(() => dataBR(new Date(hoje.getFullYear(), hoje.getMonth(), 1)));
  const [fim, setFim] = useState(() => dataBR(hoje));
  const [lendo, setLendo] = useState(false);
  const [res, setRes] = useState<TesteResultadoSimples | null>(null);

  async function testar() {
    setLendo(true);
    setRes(null);
    setRes(await testarLeituraSimples(clinicaId, tipo, ini, fim));
    setLendo(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
            Testar leitura — {ROTULO_FONTE[tipo]}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`ts_ini_${tipo}`} className="text-xs">Data início</Label>
              <Input id={`ts_ini_${tipo}`} inputMode="numeric" placeholder="DD/MM/AAAA" maxLength={10}
                value={ini} onChange={(e) => setIni(mascaraData(e.target.value))} className="text-sm tabular-nums" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`ts_fim_${tipo}`} className="text-xs">Data fim</Label>
              <Input id={`ts_fim_${tipo}`} inputMode="numeric" placeholder="DD/MM/AAAA" maxLength={10}
                value={fim} onChange={(e) => setFim(mascaraData(e.target.value))} className="text-sm tabular-nums" />
            </div>
          </div>

          <Button onClick={testar} disabled={lendo} className="w-full gap-2">
            {lendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            {lendo ? "Lendo planilha…" : "Testar leitura"}
          </Button>

          {res && "erro" in res && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
              {res.erro}
            </div>
          )}
          {res && "ok" in res && res.tipo === "entradas" && <EntradasResultado r={res.resultado} />}
          {res && "ok" in res && res.tipo === "orcamentos" && <OrcamentosResultado r={res.resultado} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
