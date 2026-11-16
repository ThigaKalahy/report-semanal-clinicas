"use client";

import { useState } from "react";
import {
  Check, Loader2, AlertTriangle, ArrowUp, ArrowDown, ChevronDown, ChevronRight, RotateCcw, Lock, Info,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PERIODICIDADES, secaoPorId, indicadoresDa } from "@/lib/estrutura/catalogo";
import type { Periodicidade } from "@/lib/estrutura/catalogo";
import {
  estruturaPadrao, moverSecao, alternarIndicador, trocarNivel, indicadorLigado,
} from "@/lib/estrutura/estrutura";
import type { Estrutura, ItemEstrutura } from "@/lib/estrutura/estrutura";
import { salvarEstrutura, restaurarEstruturaPadrao } from "../actions";

function dataHoraBR(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const AVISO_TIPO: Record<Periodicidade, string> = {
  semanal:
    "Vale para o texto de pesquisas do WhatsApp e para o infográfico do Report Semanal. A evolução das metas continua sendo gerada à parte.",
  quinzenal:
    "Vale para a tela de indicadores e para o texto de entrega dos fechamentos quinzenais desta clínica.",
  mensal:
    "Vale para a tela de indicadores e para o texto de entrega dos fechamentos mensais desta clínica. O gráfico anual e a visão de caixa e competência ainda não são gerados.",
};

export function EstruturaForm({
  clinicaId, inicial, personalizada, atualizadoEm, semDados,
}: {
  clinicaId: string;
  inicial: Estrutura;
  personalizada: boolean;
  atualizadoEm: string | null;
  /** id de seção ou indicador → por que a clínica não tem dado para ele. */
  semDados: Record<string, string>;
}) {
  const [estrutura, setEstrutura] = useState<Estrutura>(inicial);
  const [aba, setAba] = useState<Periodicidade>("semanal");
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [sujo, setSujo] = useState(false);
  const [salvoEm, setSalvoEm] = useState<string | null>(personalizada ? atualizadoEm : null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmarPadrao, setConfirmarPadrao] = useState(false);
  const [restaurando, setRestaurando] = useState(false);

  function mudarLista(tipo: Periodicidade, fn: (lista: ItemEstrutura[]) => ItemEstrutura[]) {
    setEstrutura((prev) => ({ ...prev, [tipo]: fn(prev[tipo]) }));
    setSujo(true);
  }

  function mudarItem(tipo: Periodicidade, id: string, fn: (item: ItemEstrutura) => ItemEstrutura) {
    mudarLista(tipo, (lista) => lista.map((i) => (i.id === id ? fn(i) : i)));
  }

  function alternarAberta(chave: string) {
    setAbertas((prev) => {
      const nova = new Set(prev);
      if (nova.has(chave)) nova.delete(chave); else nova.add(chave);
      return nova;
    });
  }

  async function handleSalvar() {
    setSalvando(true);
    setErro(null);
    try {
      const res = await salvarEstrutura(clinicaId, estrutura);
      if (res.ok) {
        setSalvoEm(res.atualizadoEm ?? new Date().toISOString());
        setSujo(false);
        toast.success("Estrutura salva.");
      } else {
        setErro(res.erro ?? "Não foi possível salvar.");
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleRestaurar() {
    setRestaurando(true);
    setErro(null);
    try {
      const res = await restaurarEstruturaPadrao(clinicaId);
      if (res.ok) {
        setEstrutura(estruturaPadrao());
        setSalvoEm(null);
        setSujo(false);
        setConfirmarPadrao(false);
        toast.success("Estrutura padrão restaurada.");
      } else {
        setErro(res.erro ?? "Não foi possível restaurar.");
        setConfirmarPadrao(false);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado ao restaurar.");
      setConfirmarPadrao(false);
    } finally {
      setRestaurando(false);
    }
  }

  return (
    <div className="space-y-6">
      <Tabs value={aba} onValueChange={(v) => setAba(v as Periodicidade)}>
        <TabsList>
          {PERIODICIDADES.map((p) => {
            const ativas = estrutura[p.id].filter((i) => i.ativa).length;
            return (
              <TabsTrigger key={p.id} value={p.id} className="gap-2">
                {p.rotulo}
                <span className="text-[11px] tabular-nums text-muted-foreground">{ativas}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {PERIODICIDADES.map((p) => (
          <TabsContent key={p.id} value={p.id} className="space-y-3 mt-4">
            <p className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{AVISO_TIPO[p.id]}</span>
            </p>

            {estrutura[p.id].map((item, pos) => {
              const def = secaoPorId(item.id);
              if (!def) return null;
              const indicadores = indicadoresDa(item.id, p.id);
              const opcionais = indicadores.filter((i) => !i.obrigatorio);
              const ligados = indicadores.filter((i) => indicadorLigado(item, i)).length;
              const chave = `${p.id}:${item.id}`;
              const aberta = abertas.has(chave);
              const faltaSecao = semDados[item.id];

              return (
                <div key={item.id}
                  className={`rounded-lg border bg-card transition-opacity ${item.ativa ? "" : "opacity-60"}`}>
                  <div className="flex items-start gap-3 p-3">
                    <div className="flex flex-col gap-0.5 pt-0.5">
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6"
                        title="Subir" aria-label={`Subir ${def.titulo}`} disabled={pos === 0}
                        onClick={() => mudarLista(p.id, (l) => moverSecao(l, item.id, -1))}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6"
                        title="Descer" aria-label={`Descer ${def.titulo}`}
                        disabled={pos === estrutura[p.id].length - 1}
                        onClick={() => mudarLista(p.id, (l) => moverSecao(l, item.id, 1))}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{def.titulo}</span>
                        {def.fixa && (
                          <Badge variant="secondary" className="gap-1 text-[10px] font-normal">
                            <Lock className="h-2.5 w-2.5" />Sempre no relatório
                          </Badge>
                        )}
                        {faltaSecao && (
                          <Badge variant="outline" className="gap-1 text-[10px] font-normal text-amber-600 dark:text-amber-400 border-amber-500/40">
                            <AlertTriangle className="h-2.5 w-2.5" />{faltaSecao}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{def.descricao}</p>

                      {item.ativa && (def.niveis || opcionais.length > 0) && (
                        <div className="flex items-center gap-3 flex-wrap pt-1">
                          {def.niveis && (
                            <Select value={item.nivel ?? def.niveis[0].id}
                              onValueChange={(v) => mudarItem(p.id, item.id, (i) => trocarNivel(i, v))}>
                              <SelectTrigger className="h-8 w-auto min-w-[11rem] text-xs" aria-label={`Nível de ${def.titulo}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {def.niveis.map((n) => (
                                  <SelectItem key={n.id} value={n.id} className="text-xs">{n.rotulo}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {opcionais.length > 0 && (
                            <button type="button" onClick={() => alternarAberta(chave)}
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              aria-expanded={aberta}>
                              {aberta ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              Indicadores
                              <span className="tabular-nums">({ligados} de {indicadores.length})</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <Switch checked={item.ativa} disabled={def.fixa}
                      aria-label={`${item.ativa ? "Desligar" : "Ligar"} ${def.titulo}`}
                      onCheckedChange={(v) => mudarItem(p.id, item.id, (i) => ({ ...i, ativa: v }))} />
                  </div>

                  {item.ativa && aberta && (
                    <ul className="border-t divide-y">
                      {indicadores.map((ind) => {
                        const ligado = indicadorLigado(item, ind);
                        const falta = semDados[ind.id];
                        return (
                          <li key={ind.id} className="flex items-start gap-3 px-3 py-2.5 pl-12">
                            <div className={`min-w-0 flex-1 space-y-0.5 ${ligado ? "" : "opacity-60"}`}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-medium">{ind.rotulo}</span>
                                <span className="text-[11px] text-muted-foreground">· {ind.fonte}</span>
                                {ind.obrigatorio && (
                                  <span className="text-[10px] text-muted-foreground">(obrigatório)</span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-snug">{ind.regra}</p>
                              {falta && (
                                <p className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                                  <AlertTriangle className="h-3 w-3 shrink-0" />Hoje sairia vazio: {falta}.
                                </p>
                              )}
                            </div>
                            <Switch checked={ligado} disabled={ind.obrigatorio}
                              aria-label={`${ligado ? "Ocultar" : "Mostrar"} ${ind.rotulo}`}
                              onCheckedChange={(v) =>
                                mudarItem(p.id, item.id, (i) => alternarIndicador(i, p.id, ind.id, v))} />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </TabsContent>
        ))}
      </Tabs>

      {erro && (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />{erro}
        </p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={handleSalvar} disabled={salvando} className="gap-2">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {salvando ? "Salvando…" : "Salvar estrutura"}
        </Button>
        <Button type="button" variant="outline" className="gap-2"
          disabled={salvando || restaurando} onClick={() => setConfirmarPadrao(true)}>
          <RotateCcw className="h-4 w-4" />Restaurar padrão
        </Button>
        <span className="text-xs text-muted-foreground">
          {sujo
            ? "Alterações não salvas"
            : salvoEm
              ? `Salva em ${dataHoraBR(salvoEm)}`
              : "Usando a estrutura padrão"}
        </span>
      </div>

      <AlertDialog open={confirmarPadrao} onOpenChange={(o) => !restaurando && setConfirmarPadrao(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar a estrutura padrão?</AlertDialogTitle>
            <AlertDialogDescription>
              A ordem das seções, os níveis e os indicadores ocultos desta clínica serão apagados nas
              três periodicidades. Os relatórios voltam a sair no formato padrão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restaurando}>Manter como está</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={restaurando}
              onClick={(e) => { e.preventDefault(); handleRestaurar(); }}>
              {restaurando ? "Restaurando…" : "Restaurar padrão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
