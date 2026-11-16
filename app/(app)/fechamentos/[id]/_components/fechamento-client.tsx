"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft, RefreshCw, Loader2, CheckCircle2, XCircle, MinusCircle, AlertTriangle, Info,
  Sparkles, Plus, Trash2, Check, ArrowRight, Undo2, LayoutList, FileText, Printer,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CopyButton } from "@/components/copy-button";
import { montarSecoes } from "@/lib/fechamento/secoes";
import type { AcaoPlano } from "@/lib/fechamento/secoes";
import { CartaoSecao } from "../../_components/secao";
import type { DadosFechamento, Alerta, LeituraFonte } from "@/lib/fechamento/dados";
import { ETAPAS, ROTULO_STATUS, CLASSE_STATUS, posicaoDoStatus, proximoStatus } from "@/lib/fechamento/status";
import type { TipoFechamento } from "@/lib/fechamento/periodo";
import type { ItemEstrutura } from "@/lib/estrutura/estrutura";
import type { Vocabulario } from "@/lib/perfil/vocabulario";
import type { StatusFechamento } from "@/lib/supabase/types";
import {
  lerDeNovo, salvarAnalise, mudarStatus, gerarTexto, salvarTexto, sugerirAnalise,
} from "../../actions";

function dataHoraBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ── Conferência ──────────────────────────────────────────────────────────────

function IconeLeitura({ estado }: { estado: LeituraFonte["estado"] }) {
  if (estado === "ok") return <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
  if (estado === "erro") return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
  return <MinusCircle className="h-4 w-4 text-muted-foreground shrink-0" />;
}

function CartaoAlerta({ a }: { a: Alerta }) {
  const estilo =
    a.gravidade === "erro" ? "border-destructive/40 bg-destructive/5"
    : a.gravidade === "atencao" ? "border-amber-500/40 bg-amber-500/5"
    : "border-border bg-muted/40";
  const Icone = a.gravidade === "info" ? Info : AlertTriangle;
  const cor =
    a.gravidade === "erro" ? "text-destructive"
    : a.gravidade === "atencao" ? "text-amber-600 dark:text-amber-400"
    : "text-muted-foreground";
  return (
    <div className={`flex items-start gap-2.5 rounded-md border px-3 py-2.5 ${estilo}`}>
      <Icone className={`h-4 w-4 mt-0.5 shrink-0 ${cor}`} />
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium">
          <span className="text-muted-foreground font-normal">{a.area} · </span>{a.titulo}
        </p>
        <p className="text-xs text-muted-foreground break-words">{a.descricao}</p>
      </div>
    </div>
  );
}

// ── Tela ─────────────────────────────────────────────────────────────────────

export function FechamentoClient(props: {
  id: string;
  clinicaId: string;
  clinicaNome: string;
  tipo: TipoFechamento;
  rotulo: string;
  statusInicial: StatusFechamento;
  dadosIniciais: DadosFechamento | null;
  lista: ItemEstrutura[];
  vocabulario: Vocabulario;
  analiseInicial: string;
  acoesIniciais: AcaoPlano[];
  textoInicial: string;
  enviadoEmInicial: string | null;
}) {
  const { id, clinicaId, clinicaNome, rotulo, lista, vocabulario } = props;
  const [aba, setAba] = useState("conferencia");
  const [status, setStatus] = useState(props.statusInicial);
  const [enviadoEm, setEnviadoEm] = useState(props.enviadoEmInicial);
  const [mudandoStatus, setMudandoStatus] = useState(false);

  const [dados, setDados] = useState(props.dadosIniciais);
  const [lendo, setLendo] = useState(false);

  const [analise, setAnalise] = useState(props.analiseInicial);
  const [acoes, setAcoes] = useState<AcaoPlano[]>(props.acoesIniciais);
  const [analiseSuja, setAnaliseSuja] = useState(false);
  const [salvandoAnalise, setSalvandoAnalise] = useState(false);
  const [sugerindo, setSugerindo] = useState(false);
  const [sugestao, setSugestao] = useState<{ analise: string; acoes: AcaoPlano[] } | null>(null);

  const [texto, setTexto] = useState(props.textoInicial);
  const [textoSujo, setTextoSujo] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [salvandoTexto, setSalvandoTexto] = useState(false);

  const secoes = useMemo(
    () => (dados ? montarSecoes(dados, lista, { vocabulario, analise, acoes }) : []),
    [dados, lista, vocabulario, analise, acoes],
  );
  const alertasSerios = dados?.alertas.filter((a) => a.gravidade !== "info").length ?? 0;
  const proximo = proximoStatus(status);
  const posicao = posicaoDoStatus(status);

  async function handleLer() {
    setLendo(true);
    const res = await lerDeNovo(id);
    setLendo(false);
    if (res.ok) { setDados(res.dados); toast.success("Planilhas lidas de novo."); }
    else toast.error(res.erro);
  }

  async function irPara(novo: StatusFechamento) {
    setMudandoStatus(true);
    const res = await mudarStatus(id, novo);
    setMudandoStatus(false);
    if (!res.ok) { toast.error(res.erro); return; }
    setStatus(novo);
    setEnviadoEm(res.enviadoEm);
    if (novo === "em_analise") setAba("indicadores");
    if (novo === "concluido") setAba("texto");
  }

  function mudarAcao(i: number, patch: Partial<AcaoPlano>) {
    setAcoes((prev) => prev.map((a, j) => (j === i ? { ...a, ...patch } : a)));
    setAnaliseSuja(true);
  }

  async function handleSalvarAnalise(): Promise<boolean> {
    setSalvandoAnalise(true);
    const res = await salvarAnalise(id, analise, acoes);
    setSalvandoAnalise(false);
    if (!res.ok) { toast.error(res.erro); return false; }
    setAnaliseSuja(false);
    return true;
  }

  function aplicarSugestao(s: { analise: string; acoes: AcaoPlano[] }) {
    setAnalise(s.analise);
    setAcoes(s.acoes);
    setAnaliseSuja(true);
    setSugestao(null);
    toast.success("Rascunho da IA aplicado. Revise antes de salvar.");
  }

  async function handleSugerir() {
    setSugerindo(true);
    const res = await sugerirAnalise(id);
    setSugerindo(false);
    if (!res.ok) { toast.error(res.erro); return; }
    const nova = { analise: res.analise, acoes: res.acoes };
    // Com algo já escrito, pergunta antes de trocar
    if (analise.trim() || acoes.some((a) => a.texto.trim())) setSugestao(nova);
    else aplicarSugestao(nova);
  }

  async function handleGerarTexto() {
    setGerando(true);
    // o texto é montado no servidor a partir do que está salvo
    if (analiseSuja && !(await handleSalvarAnalise())) { setGerando(false); return; }
    const res = await gerarTexto(id);
    setGerando(false);
    if (!res.ok) { toast.error(res.erro); return; }
    setTexto(res.texto);
    setTextoSujo(false);
    toast.success("Texto gerado.");
  }

  async function handleSalvarTexto() {
    setSalvandoTexto(true);
    const res = await salvarTexto(id, texto);
    setSalvandoTexto(false);
    if (res.ok) { setTextoSujo(false); toast.success("Texto salvo."); }
    else toast.error(res.erro);
  }

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div className="space-y-1">
        <Link href="/fechamentos"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" />Fechamentos
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold font-heading">{clinicaNome}</h1>
          <Badge variant="outline" className={`font-normal ${CLASSE_STATUS[status]}`}>{ROTULO_STATUS[status]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{rotulo}</p>
      </div>

      {/* Etapas */}
      <div className="rounded-lg border bg-card p-3 space-y-3">
        <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ETAPAS.map((e, i) => (
            <li key={e.status}
              className={`rounded-md px-3 py-2 text-xs ${i === posicao ? "bg-primary/10 text-foreground" : i < posicao ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
              <span className="flex items-center gap-1.5 font-medium">
                {i < posicao ? <Check className="h-3 w-3" /> : <span className="tabular-nums">{i + 1}.</span>}
                {e.rotulo}
              </span>
              <span className="block mt-0.5 text-[11px] leading-snug">{e.descricao}</span>
            </li>
          ))}
        </ol>
        <div className="flex items-center gap-2 flex-wrap">
          {proximo && (
            <Button size="sm" className="gap-2" disabled={mudandoStatus || !dados} onClick={() => irPara(proximo)}>
              {mudandoStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
              {proximo === "em_analise" ? "Conferência feita — ir para a análise"
                : proximo === "concluido" ? "Análise pronta — concluir"
                : "Marcar como enviado"}
            </Button>
          )}
          {posicao > 0 && (
            <Button size="sm" variant="ghost" className="gap-2 text-muted-foreground" disabled={mudandoStatus}
              onClick={() => irPara(ETAPAS[posicao - 1].status)}>
              <Undo2 className="h-3.5 w-3.5" />Voltar uma etapa
            </Button>
          )}
          {status === "enviado" && enviadoEm && (
            <span className="text-xs text-muted-foreground">Enviado em {dataHoraBR(enviadoEm)}</span>
          )}
          {status === "em_conferencia" && alertasSerios > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />{alertasSerios} alerta{alertasSerios !== 1 ? "s" : ""} para conferir antes
            </span>
          )}
        </div>
      </div>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="conferencia" className="gap-1.5">
            Conferência
            {alertasSerios > 0 && <span className="text-[11px] tabular-nums text-amber-600 dark:text-amber-400">{alertasSerios}</span>}
          </TabsTrigger>
          <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
          <TabsTrigger value="analise">Análise</TabsTrigger>
          <TabsTrigger value="texto">Texto e entrega</TabsTrigger>
        </TabsList>

        {/* ── Conferência ── */}
        <TabsContent value="conferencia" className="space-y-5 mt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleLer} disabled={lendo}>
              {lendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {lendo ? "Lendo planilhas…" : "Ler planilhas de novo"}
            </Button>
            {dados && <span className="text-xs text-muted-foreground">Última leitura: {dataHoraBR(dados.lidoEm)}</span>}
            <Link href={`/clinicas/${clinicaId}/fontes`} className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
              Fontes da clínica
            </Link>
          </div>

          {!dados ? (
            <p className="text-sm text-muted-foreground">Este fechamento ainda não tem leitura. Use o botão acima.</p>
          ) : (
            <>
              <div className="space-y-2">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fontes lidas</h2>
                <ul className="rounded-lg border divide-y">
                  {dados.leituras.map((l) => (
                    <li key={l.fonte} className="flex items-start gap-2.5 px-3 py-2.5">
                      <IconeLeitura estado={l.estado} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{l.fonte}</p>
                        <p className={`text-xs break-words ${l.estado === "erro" ? "text-destructive" : "text-muted-foreground"}`}>{l.mensagem}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Alertas ({dados.alertas.length})
                </h2>
                {dados.alertas.length === 0
                  ? <p className="text-sm text-muted-foreground">Nenhum alerta nesta leitura.</p>
                  : <div className="space-y-2">{dados.alertas.map((a, i) => <CartaoAlerta key={i} a={a} />)}</div>}
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Indicadores ── */}
        <TabsContent value="indicadores" className="space-y-3 mt-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-muted-foreground">
              Seções, ordem e indicadores seguem a estrutura do relatório desta clínica.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <Link href={`/fechamentos/${id}/imprimir`}><Printer className="h-3.5 w-3.5" />Imprimir ou PDF</Link>
              </Button>
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <Link href={`/clinicas/${clinicaId}/estrutura`}><LayoutList className="h-3.5 w-3.5" />Estrutura do relatório</Link>
              </Button>
            </div>
          </div>
          {!dados
            ? <p className="text-sm text-muted-foreground">Sem leitura ainda.</p>
            : secoes.map((s) => <CartaoSecao key={s.id} s={s} />)}
        </TabsContent>

        {/* ── Análise ── */}
        <TabsContent value="analise" className="space-y-5 mt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleSugerir} disabled={sugerindo || !dados}>
              {sugerindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {sugerindo ? "Escrevendo rascunho…" : "Rascunho com IA"}
            </Button>
            <span className="text-xs text-muted-foreground">
              A IA usa só os números deste fechamento e o perfil do cliente. Revise sempre.
            </span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fc_analise">Análise do período</Label>
            <Textarea id="fc_analise" rows={9} value={analise} maxLength={8000} className="text-sm resize-y"
              placeholder="O que os números dizem, o que explica o resultado e para onde olhar."
              onChange={(e) => { setAnalise(e.target.value); setAnaliseSuja(true); }} />
          </div>

          <div className="space-y-2">
            <Label>Plano de ação</Label>
            {acoes.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma ação ainda.</p>}
            {acoes.map((a, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_10rem_8rem_auto] gap-2 items-start">
                <Input value={a.texto} placeholder="O que fazer" aria-label={`Ação ${i + 1}`} className="text-sm"
                  onChange={(e) => mudarAcao(i, { texto: e.target.value })} />
                <Input value={a.responsavel} placeholder="Responsável" aria-label={`Responsável da ação ${i + 1}`} className="text-sm"
                  onChange={(e) => mudarAcao(i, { responsavel: e.target.value })} />
                <Input value={a.prazo} placeholder="Prazo (DD/MM)" aria-label={`Prazo da ação ${i + 1}`} className="text-sm"
                  onChange={(e) => mudarAcao(i, { prazo: e.target.value })} />
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive"
                  title="Remover ação" onClick={() => { setAcoes((p) => p.filter((_, j) => j !== i)); setAnaliseSuja(true); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="gap-1.5"
              onClick={() => { setAcoes((p) => [...p, { texto: "", responsavel: "", prazo: "" }]); setAnaliseSuja(true); }}>
              <Plus className="h-3.5 w-3.5" />Adicionar ação
            </Button>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={async () => { if (await handleSalvarAnalise()) toast.success("Análise salva."); }}
              disabled={salvandoAnalise} className="gap-2">
              {salvandoAnalise ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Salvar análise
            </Button>
            <span className="text-xs text-muted-foreground">{analiseSuja ? "Alterações não salvas" : "Tudo salvo"}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            A análise só entra no relatório se a seção “Análise e plano de ação” estiver ligada na estrutura da clínica.
          </p>
        </TabsContent>

        {/* ── Texto e entrega ── */}
        <TabsContent value="texto" className="space-y-4 mt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleGerarTexto} disabled={gerando || !dados}>
              {gerando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              {texto ? "Gerar de novo a partir dos números" : "Gerar texto"}
            </Button>
            {texto && <CopyButton text={texto} label="Copiar para o WhatsApp" />}
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <Link href={`/fechamentos/${id}/imprimir`}><Printer className="h-3.5 w-3.5" />Imprimir ou PDF</Link>
            </Button>
          </div>
          {texto ? (
            <>
              <Textarea value={texto} rows={22} className="font-mono text-xs resize-y" aria-label="Texto de entrega"
                onChange={(e) => { setTexto(e.target.value); setTextoSujo(true); }} />
              <div className="flex items-center gap-3 flex-wrap">
                <Button onClick={handleSalvarTexto} disabled={salvandoTexto || !textoSujo} className="gap-2">
                  {salvandoTexto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Salvar texto
                </Button>
                <span className="text-xs text-muted-foreground">
                  {textoSujo ? "Edições não salvas" : "Gerar de novo descarta as edições feitas à mão."}
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              O texto é montado com as seções ligadas na estrutura da clínica. Seções sem dado ficam de fora.
            </p>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!sugestao} onOpenChange={(o) => !o && setSugestao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir a análise atual pelo rascunho da IA?</AlertDialogTitle>
            <AlertDialogDescription>
              O texto da análise e o plano de ação que estão na tela serão trocados pelo rascunho. Nada é salvo até você clicar em “Salvar análise”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter a análise atual</AlertDialogCancel>
            <AlertDialogAction onClick={() => sugestao && aplicarSugestao(sugestao)}>Usar o rascunho</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
