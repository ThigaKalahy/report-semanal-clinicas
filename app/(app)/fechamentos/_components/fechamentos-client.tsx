"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Trash2, AlertTriangle, Search, ArrowRight, Columns3 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MESES, periodoSugerido, rotuloCurto } from "@/lib/fechamento/periodo";
import type { TipoFechamento, Quinzena } from "@/lib/fechamento/periodo";
import { ROTULO_STATUS, CLASSE_STATUS } from "@/lib/fechamento/status";
import type { StatusFechamento } from "@/lib/supabase/types";
import { criarFechamento, excluirFechamento } from "../actions";

export interface LinhaFechamento {
  id: string;
  clinicaId: string;
  clinicaNome: string;
  tipo: TipoFechamento;
  ano: number;
  mes: number;
  quinzena: Quinzena | null;
  status: StatusFechamento;
  faturamento: number | null;
  alertas: number;
  lidoEm: string | null;
  enviadoEm: string | null;
}

const TODOS = "__todos__";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function dataHoraBR(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function FechamentosClient({
  clinicas, linhas, erroBanco, buscaInicial = "",
}: {
  clinicas: { id: string; nome: string }[];
  linhas: LinhaFechamento[];
  erroBanco: string | null;
  /** Vindo de "?cliente=": já abre filtrado por essa clínica. */
  buscaInicial?: string;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState(buscaInicial);
  const [filtroTipo, setFiltroTipo] = useState(TODOS);
  const [filtroStatus, setFiltroStatus] = useState(TODOS);

  const [novoAberto, setNovoAberto] = useState(false);
  const [criando, setCriando] = useState(false);
  const [erroNovo, setErroNovo] = useState<string | null>(null);
  const sugestaoInicial = periodoSugerido("mensal", new Date());
  const [clinicaId, setClinicaId] = useState("");
  const [tipo, setTipo] = useState<TipoFechamento>("mensal");
  const [mes, setMes] = useState(sugestaoInicial.mes);
  const [ano, setAno] = useState(sugestaoInicial.ano);
  const [quinzena, setQuinzena] = useState<Quinzena>(1);

  const [excluindo, setExcluindo] = useState<LinhaFechamento | null>(null);
  const [apagando, setApagando] = useState(false);

  const visiveis = useMemo(() => {
    const termo = semAcento(busca.trim());
    return linhas.filter((l) =>
      (filtroTipo === TODOS || l.tipo === filtroTipo) &&
      (filtroStatus === TODOS || l.status === filtroStatus) &&
      (!termo || semAcento(l.clinicaNome).includes(termo)));
  }, [linhas, busca, filtroTipo, filtroStatus]);

  const anos = useMemo(() => {
    const atual = new Date().getFullYear();
    return [atual + 1, atual, atual - 1, atual - 2];
  }, []);

  function mudarTipo(novo: TipoFechamento) {
    setTipo(novo);
    const s = periodoSugerido(novo, new Date());
    setMes(s.mes);
    setAno(s.ano);
    if (s.quinzena) setQuinzena(s.quinzena);
  }

  async function handleCriar() {
    if (!clinicaId) { setErroNovo("Escolha a clínica."); return; }
    setCriando(true);
    setErroNovo(null);
    const res = await criarFechamento({ clinicaId, tipo, ano, mes, quinzena: tipo === "quinzenal" ? quinzena : null });
    if (!res.ok) { setErroNovo(res.erro); setCriando(false); return; }
    if (res.jaExistia) toast.message("Esse fechamento já existia — abrindo o que está salvo.");
    router.push(`/fechamentos/${res.id}`);
  }

  async function handleExcluir() {
    if (!excluindo) return;
    setApagando(true);
    const res = await excluirFechamento(excluindo.id);
    setApagando(false);
    setExcluindo(null);
    if (res.ok) { toast.success("Fechamento excluído."); router.refresh(); }
    else toast.error(res.erro);
  }

  return (
    <div className="p-8 space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Relatórios Financeiros</p>
          <h1 className="text-2xl font-semibold">Histórico</h1>
          <p className="text-sm text-muted-foreground">
            Todos os fechamentos, de todos os períodos: busque por clínica, tipo ou estado.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" asChild>
            <Link href="/fechamentos/comparativos"><Columns3 className="h-4 w-4" />Comparativos</Link>
          </Button>
          <Button className="gap-2" onClick={() => { setErroNovo(null); setNovoAberto(true); }} disabled={!!erroBanco}>
            <Plus className="h-4 w-4" />Novo fechamento
          </Button>
        </div>
      </div>

      {erroBanco && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Não foi possível ler os fechamentos.</p>
            <p className="text-xs mt-0.5">
              {erroBanco} — se a tabela ainda não existe, rode a migração
              <code className="mx-1 rounded bg-background/60 px-1">006_fechamentos.sql</code>no Supabase.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar clínica"
            aria-label="Buscar clínica" className="pl-8 w-56 text-sm" />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-40 text-sm" aria-label="Filtrar por tipo"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os tipos</SelectItem>
            <SelectItem value="mensal">Mensal</SelectItem>
            <SelectItem value="quinzenal">Quinzenal</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-44 text-sm" aria-label="Filtrar por estado"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os estados</SelectItem>
            {(Object.keys(ROTULO_STATUS) as StatusFechamento[]).map((s) => (
              <SelectItem key={s} value={s}>{ROTULO_STATUS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground tabular-nums">
          {visiveis.length} de {linhas.length}
        </span>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Clínica</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Faturamento</TableHead>
              <TableHead>Lido em</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visiveis.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  {linhas.length === 0
                    ? "Nenhum fechamento ainda. Comece por “Novo fechamento”."
                    : "Nenhum fechamento com esses filtros."}
                </TableCell>
              </TableRow>
            )}
            {visiveis.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">
                  <Link href={`/fechamentos/${l.id}`} className="hover:underline">{l.clinicaNome}</Link>
                </TableCell>
                <TableCell className="text-sm">
                  <span className="capitalize">{l.tipo}</span>
                  <span className="text-muted-foreground"> · {rotuloCurto(l)}</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`font-normal ${CLASSE_STATUS[l.status]}`}>{ROTULO_STATUS[l.status]}</Badge>
                    {l.alertas > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400"
                        title={`${l.alertas} alerta(s) para conferir`}>
                        <AlertTriangle className="h-3 w-3" />{l.alertas}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {l.faturamento !== null ? brl(l.faturamento) : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground tabular-nums">{dataHoraBR(l.lidoEm)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Abrir" asChild>
                      <Link href={`/fechamentos/${l.id}`}><ArrowRight className="h-3.5 w-3.5" /></Link>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      title="Excluir" onClick={() => setExcluindo(l)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Novo fechamento */}
      <Dialog open={novoAberto} onOpenChange={(o) => !criando && setNovoAberto(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo fechamento</DialogTitle>
            <DialogDescription>
              As planilhas da clínica são lidas na hora. Leva alguns segundos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nf_clinica">Clínica</Label>
              <Select value={clinicaId} onValueChange={setClinicaId}>
                <SelectTrigger id="nf_clinica"><SelectValue placeholder="Escolha a clínica" /></SelectTrigger>
                <SelectContent>
                  {clinicas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nf_tipo">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => mudarTipo(v as TipoFechamento)}>
                <SelectTrigger id="nf_tipo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal — o mês inteiro</SelectItem>
                  <SelectItem value="quinzenal">Quinzenal — acompanhamento do mês</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="nf_mes">Mês</Label>
                <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                  <SelectTrigger id="nf_mes" className="capitalize"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MESES.map((m, i) => <SelectItem key={m} value={String(i + 1)} className="capitalize">{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nf_ano">Ano</Label>
                <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                  <SelectTrigger id="nf_ano"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {tipo === "quinzenal" && (
              <div className="space-y-1.5">
                <Label htmlFor="nf_quinzena">Quinzena</Label>
                <Select value={String(quinzena)} onValueChange={(v) => setQuinzena(Number(v) as Quinzena)}>
                  <SelectTrigger id="nf_quinzena"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1ª quinzena — dia 1 a 15</SelectItem>
                    <SelectItem value="2">2ª quinzena — dia 16 ao fim do mês</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {erroNovo && (
              <p className="flex items-start gap-1.5 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{erroNovo}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoAberto(false)} disabled={criando}>Cancelar</Button>
            <Button onClick={handleCriar} disabled={criando} className="gap-2">
              {criando && <Loader2 className="h-4 w-4 animate-spin" />}
              {criando ? "Lendo planilhas…" : "Criar e ler planilhas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && !apagando && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este fechamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluindo && `${excluindo.clinicaNome} · ${excluindo.tipo} · ${rotuloCurto(excluindo)}. `}
              A leitura salva, a análise, o plano de ação e o texto de entrega serão apagados. As planilhas não são afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={apagando}>Manter</AlertDialogCancel>
            <AlertDialogAction disabled={apagando}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); handleExcluir(); }}>
              {apagando ? "Excluindo…" : "Excluir fechamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
