"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  RefreshCw, Loader2, CheckCircle2, XCircle, MinusCircle, Sparkles, Plus, Trash2, Check, ChevronRight,
  Undo2, FileDown, Send, Lock, History, Info,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CopyButton } from "@/components/copy-button";
import type { AcaoPlano } from "@/lib/fechamento/secoes";
import type { DadosFechamento, Alerta, LeituraFonte } from "@/lib/fechamento/dados";
import { chaveDoAlerta, alertasPendentes } from "@/lib/fechamento/dados";
import { BLOCOS_ANALISE, lerAnalise, escreverAnalise } from "@/lib/fechamento/analise";
import type { TextoAnalise } from "@/lib/fechamento/analise";
import { isoParaBR } from "@/lib/fechamento/periodo";
import type { TipoFechamento } from "@/lib/fechamento/periodo";
import type { ItemEstrutura } from "@/lib/estrutura/estrutura";
import type { Vocabulario } from "@/lib/perfil/vocabulario";
import type { StatusFechamento } from "@/lib/supabase/types";
import { Indicadores } from "../../_components/indicadores";
import { SeloStatus } from "../../_components/selo-status";
import {
  lerDeNovo, salvarAnalise, mudarStatus, gerarTexto, salvarTexto, sugerirAnalise, decidirAlerta, salvarMeta,
} from "../../actions";

type Aba = "conferencia" | "indicadores" | "analise" | "entrega";

const hora = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};
const dataBR = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR");
};

/** Máscara DD/MM/AAAA para o prazo das ações. */
function mascaraData(v: string): string {
  if (/[a-z]/i.test(v)) return v.slice(0, 40); // "sem prazo"
  const n = v.replace(/\D/g, "").slice(0, 8);
  return [n.slice(0, 2), n.slice(2, 4), n.slice(4, 8)].filter(Boolean).join("/");
}

const campo = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed disabled:opacity-70";

// ── Conferência ──────────────────────────────────────────────────────────────

const GRAVIDADE: Record<Alerta["gravidade"], { rotulo: string; faixa: string; selo: string }> = {
  erro: { rotulo: "Grave", faixa: "bg-red-500", selo: "bg-red-500/10 text-red-700 dark:text-red-400" },
  atencao: { rotulo: "Atenção", faixa: "bg-amber-500", selo: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  info: { rotulo: "Informativo", faixa: "bg-sky-500", selo: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
};

function IconeLeitura({ estado }: { estado: LeituraFonte["estado"] }) {
  if (estado === "ok") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />;
  if (estado === "erro") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  return <MinusCircle className="h-3.5 w-3.5 text-muted-foreground" />;
}

function Conferencia({ dados, congelado, decidir, irParaIndicadores, ocupado }: {
  dados: DadosFechamento; congelado: boolean; ocupado: boolean;
  decidir: (a: Alerta, acao: "ciente" | "manter" | null) => void;
  irParaIndicadores: () => void;
}) {
  const decisoes = new Map((dados.decisoes ?? []).map((x) => [x.chave, x]));
  const pendentes = alertasPendentes(dados);
  const informativos = dados.alertas.filter((a) => a.gravidade === "info");
  const decididos = dados.alertas.filter((a) => a.gravidade !== "info" && decisoes.has(chaveDoAlerta(a)));
  const graves = pendentes.filter((a) => a.gravidade === "erro").length;
  const conta = (g: Alerta["gravidade"]) => (g === "info" ? informativos.length : pendentes.filter((a) => a.gravidade === g).length);

  return (
    <div className="space-y-4">
      {(pendentes.length > 0 || informativos.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-3">
          {(["erro", "atencao", "info"] as const).map((g) => (
            <div key={g} className="rounded-lg border p-4">
              <p className="text-xs font-medium text-muted-foreground">
                {g === "erro" ? "Graves pendentes" : g === "atencao" ? "Atenção pendentes" : "Informativos"}
              </p>
              <p className={`text-2xl font-semibold tabular-nums ${g === "erro" && conta(g) ? "text-red-600 dark:text-red-400" : ""}`}>{conta(g)}</p>
              <p className="text-xs text-muted-foreground">
                {g === "erro" ? "travam os indicadores" : g === "atencao" ? "podem seguir, viram pontos de atenção" : "para conhecimento"}
              </p>
            </div>
          ))}
        </div>
      )}

      {pendentes.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-300/60 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            Tudo certo na conferência: nenhum alerta pendente{decididos.length ? ` (${decididos.length} já ${decididos.length > 1 ? "decididos" : "decidido"})` : ""}.
          </p>
          <Button onClick={irParaIndicadores} disabled={ocupado}>Ver indicadores <ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}

      {pendentes.map((a) => (
        <article key={chaveDoAlerta(a)} className="grid grid-cols-[4px_1fr] overflow-hidden rounded-lg border bg-card">
          <div className={GRAVIDADE[a.gravidade].faixa} />
          <div className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-full px-2 py-0.5 font-semibold ${GRAVIDADE[a.gravidade].selo}`}>{GRAVIDADE[a.gravidade].rotulo}</span>
              <span className="text-muted-foreground">{a.area}</span>
            </div>
            <h3 className="font-semibold">{a.titulo}</h3>
            <p className="text-sm text-muted-foreground">{a.descricao}</p>
            {!congelado && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={ocupado} onClick={() => decidir(a, "ciente")}>Ciente</Button>
                <Button size="sm" variant="outline" disabled={ocupado} onClick={() => decidir(a, "manter")}>Manter como está</Button>
              </div>
            )}
          </div>
        </article>
      ))}

      {informativos.length > 0 && (
        <section className="space-y-2">
          <h2 className="pt-2 text-sm font-semibold text-muted-foreground">Informativos</h2>
          {informativos.map((a) => (
            <div key={chaveDoAlerta(a)} className="flex items-start gap-2.5 rounded-lg border px-4 py-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
              <div className="min-w-0">
                <p className="text-sm font-medium"><span className="font-normal text-muted-foreground">{a.area} · </span>{a.titulo}</p>
                <p className="text-xs text-muted-foreground">{a.descricao}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {decididos.length > 0 && (
        <section className="space-y-2">
          <h2 className="pt-2 text-sm font-semibold text-muted-foreground">Decididos</h2>
          {decididos.map((a) => {
            const x = decisoes.get(chaveDoAlerta(a))!;
            return (
              <div key={x.chave} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{a.titulo}</p>
                  <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {x.acao === "manter" ? "Mantido como está." : "Ciente."} {dataBR(x.em) && `Em ${dataBR(x.em)}.`}
                  </p>
                </div>
                {!congelado && (
                  <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => decidir(a, null)}><Undo2 className="h-3.5 w-3.5" />Desfazer</Button>
                )}
              </div>
            );
          })}
        </section>
      )}

      {pendentes.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">
            {graves
              ? `Decida ${graves === 1 ? "o alerta grave" : `os ${graves} alertas graves`} para liberar os indicadores.`
              : "Conferência liberada. Alertas de atenção abertos podem virar pontos de atenção no texto."}
          </p>
          <Button onClick={irParaIndicadores} disabled={graves > 0 || ocupado}>Ver indicadores <ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}
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
  mesChave: string;
  dataInicio: string;
  dataFim: string;
  statusInicial: StatusFechamento;
  dadosIniciais: DadosFechamento | null;
  lista: ItemEstrutura[];
  vocabulario: Vocabulario;
  analiseInicial: string;
  acoesIniciais: AcaoPlano[];
  textoInicial: string;
  enviadoEmInicial: string | null;
  anterior: { rotulo: string; acoes: AcaoPlano[]; id: string } | null;
}) {
  const { id, clinicaId, clinicaNome, rotulo, lista, vocabulario, tipo } = props;
  const [status, setStatus] = useState(props.statusInicial);
  const [enviadoEm, setEnviadoEm] = useState(props.enviadoEmInicial);
  const [dados, setDados] = useState(props.dadosIniciais);
  const congelado = status === "concluido" || status === "enviado";

  const pendentesGraves = dados ? alertasPendentes(dados).filter((a) => a.gravidade === "erro").length : 0;
  const [aba, setAba] = useState<Aba>(() => {
    if (props.statusInicial === "concluido" || props.statusInicial === "enviado") return "entrega";
    if (props.statusInicial === "em_analise") return "indicadores";
    return props.dadosIniciais && alertasPendentes(props.dadosIniciais).length === 0 ? "indicadores" : "conferencia";
  });

  const [ocupado, setOcupado] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [meta, setMeta] = useState(props.dadosIniciais?.meta ? String(props.dadosIniciais.meta).replace(".", ",") : "");

  const [texto, setTextoAnalise] = useState<TextoAnalise>(() => lerAnalise(props.analiseInicial));
  const [acoes, setAcoes] = useState<AcaoPlano[]>(props.acoesIniciais);
  const [analiseSuja, setAnaliseSuja] = useState(false);
  const [salvandoAnalise, setSalvandoAnalise] = useState(false);
  const [sugerindo, setSugerindo] = useState(false);
  const [sugestao, setSugestao] = useState<{ analise: string; acoes: AcaoPlano[] } | null>(null);

  const [whats, setWhats] = useState(props.textoInicial);
  const [whatsSujo, setWhatsSujo] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [confirmarConclusao, setConfirmarConclusao] = useState(false);

  const acoesValidas = acoes.filter((a) => a.texto.trim()).length;
  const etapas: { k: Aba; titulo: string; sub: string; trava?: boolean }[] = useMemo(() => [
    { k: "conferencia", titulo: "1. Conferência", sub: pendentesGraves ? `${pendentesGraves} grave${pendentesGraves > 1 ? "s" : ""} pendente${pendentesGraves > 1 ? "s" : ""}` : "sem pendências graves" },
    { k: "indicadores", titulo: "2. Indicadores", sub: pendentesGraves ? "liberados após a conferência" : "calculados e comparados", trava: pendentesGraves > 0 },
    { k: "analise", titulo: "3. Análise", sub: texto.observacao.trim() ? `${acoesValidas} ${acoesValidas === 1 ? "ação" : "ações"} no plano` : "texto e plano de ação" },
    { k: "entrega", titulo: "4. Entrega", sub: status === "enviado" ? "enviado" : status === "concluido" ? "concluído" : "WhatsApp, PDF e concluir" },
  ], [pendentesGraves, texto.observacao, acoesValidas, status]);

  // ── ações ──

  async function handleLer() {
    setLendo(true);
    const res = await lerDeNovo(id);
    setLendo(false);
    if (!res.ok) { toast.error(res.erro); return; }
    setDados(res.dados);
    setMeta(res.dados.meta ? String(res.dados.meta).replace(".", ",") : "");
    toast.success("Planilhas lidas de novo.");
  }

  async function handleMeta() {
    const limpo = meta.replace(/[R$\s.]/g, "").replace(",", ".");
    const valor = limpo ? Number(limpo) : null;
    if (valor !== null && !isFinite(valor)) { toast.error("Digite a meta em reais, por exemplo 68.000."); return; }
    setOcupado(true);
    const res = await salvarMeta(id, valor);
    setOcupado(false);
    if (!res.ok) { toast.error(res.erro); return; }
    setDados(res.dados);
    toast.success(valor ? "Meta deste fechamento ajustada." : "Voltou a valer a meta cadastrada.");
  }

  async function decidir(a: Alerta, acao: "ciente" | "manter" | null) {
    setOcupado(true);
    const res = await decidirAlerta(id, { area: a.area, titulo: a.titulo }, acao);
    setOcupado(false);
    if (!res.ok) { toast.error(res.erro); return; }
    setDados(res.dados);
  }

  async function irPara(novo: StatusFechamento): Promise<boolean> {
    setOcupado(true);
    const res = await mudarStatus(id, novo);
    setOcupado(false);
    if (!res.ok) { toast.error(res.erro); return false; }
    setStatus(novo);
    setEnviadoEm(res.enviadoEm);
    return true;
  }

  async function irParaIndicadores() {
    if (status === "em_conferencia") await irPara("em_analise");
    setAba("indicadores");
  }

  function mudarTexto(k: keyof TextoAnalise, valor: string) {
    setTextoAnalise((t) => ({ ...t, [k]: valor }));
    setAnaliseSuja(true);
  }
  function mudarAcao(i: number, patch: Partial<AcaoPlano>) {
    setAcoes((prev) => prev.map((a, j) => (j === i ? { ...a, ...patch } : a)));
    setAnaliseSuja(true);
  }

  async function handleSalvarAnalise(): Promise<boolean> {
    setSalvandoAnalise(true);
    const res = await salvarAnalise(id, escreverAnalise(texto), acoes);
    setSalvandoAnalise(false);
    if (!res.ok) { toast.error(res.erro); return false; }
    setAnaliseSuja(false);
    return true;
  }

  function aplicarSugestao(s: { analise: string; acoes: AcaoPlano[] }) {
    setTextoAnalise(lerAnalise(s.analise));
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
    if (texto.destaques.trim() || texto.atencao.trim() || acoes.some((a) => a.texto.trim())) setSugestao(nova);
    else aplicarSugestao(nova);
  }

  async function handleGerarTexto() {
    setGerando(true);
    if (!congelado && analiseSuja && !(await handleSalvarAnalise())) { setGerando(false); return; }
    const res = await gerarTexto(id);
    setGerando(false);
    if (!res.ok) { toast.error(res.erro); return; }
    setWhats(res.texto);
    setWhatsSujo(false);
    toast.success("Texto gerado.");
  }

  async function handleSalvarWhats() {
    setOcupado(true);
    const res = await salvarTexto(id, whats);
    setOcupado(false);
    if (res.ok) { setWhatsSujo(false); toast.success("Texto salvo."); } else toast.error(res.erro);
  }

  async function concluir() {
    setConfirmarConclusao(false);
    if (analiseSuja && !(await handleSalvarAnalise())) return;
    if (whatsSujo) await handleSalvarWhats();
    if (await irPara("concluido")) toast.success("Fechamento concluído. Números, texto e plano congelados.");
  }

  const sub = [
    `${isoParaBR(props.dataInicio)} a ${isoParaBR(props.dataFim)}`,
    "despesas pelo vencimento",
    congelado ? "números congelados na conclusão" : dados ? `planilhas lidas às ${hora(dados.lidoEm)}${dataBR(dados.lidoEm) !== dataBR(new Date().toISOString()) ? ` de ${dataBR(dados.lidoEm)}` : ""}` : "sem leitura",
  ].join(" · ");

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            <Link className="hover:underline" href={`/fechamentos?mes=${props.mesChave}`}>Fechamentos do mês</Link>
            {" / "}
            <Link className="hover:underline" title="Histórico deste cliente" href={`/fechamentos/historico?cliente=${clinicaId}`}>{clinicaNome}</Link>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{clinicaNome} · {tipo === "mensal" ? "Mensal" : "Quinzenal"} · {rotulo}</h1>
            <SeloStatus status={status} />
          </div>
          <p className="text-sm text-muted-foreground">{sub}</p>
        </div>
        {congelado ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />Somente leitura
          </span>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            {dados && (
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Meta ajustada (opcional)
                <span className="flex gap-1.5">
                  <input inputMode="decimal" placeholder="R$" value={meta} onChange={(e) => setMeta(e.target.value)} aria-label="Meta ajustada"
                    onKeyDown={(e) => { if (e.key === "Enter") handleMeta(); }}
                    className="h-8 w-40 rounded-md border border-input bg-background px-2 text-sm text-foreground" />
                  <Button size="sm" variant="outline" className="h-8" disabled={ocupado} onClick={handleMeta}>Salvar</Button>
                </span>
              </label>
            )}
            <Button size="sm" variant="outline" className="h-8 gap-2" onClick={handleLer} disabled={lendo}>
              {lendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {lendo ? "Lendo planilhas…" : dados ? "Ler de novo" : "Ler planilhas"}
            </Button>
          </div>
        )}
      </div>

      {dados?.metaOriginal !== undefined && dados?.metaOriginal !== null && dados.meta !== dados.metaOriginal && (
        <p className="text-xs text-muted-foreground">
          Meta ajustada só neste fechamento: {dados.meta?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (a cadastrada é {dados.metaOriginal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}). Deixe o campo vazio e salve para voltar.
        </p>
      )}

      {/* Fontes lidas */}
      {dados && (
        <div className="flex flex-wrap gap-2 text-xs">
          {dados.leituras.map((l) => (
            <span key={l.fonte} title={l.mensagem}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${l.estado === "erro" ? "border-destructive/50 text-destructive" : l.estado === "ausente" ? "text-muted-foreground" : ""}`}>
              <IconeLeitura estado={l.estado} />
              {l.fonte}: {l.estado === "ausente" ? "não cadastrada" : l.estado === "erro" ? "erro na leitura" : l.mensagem}
            </span>
          ))}
          <Link href={`/clinicas/${clinicaId}/fontes`} className="inline-flex items-center px-1 py-1 text-muted-foreground hover:text-foreground hover:underline">
            Fontes da clínica
          </Link>
        </div>
      )}

      {/* Etapas */}
      <nav className="grid grid-cols-2 overflow-hidden rounded-lg border md:grid-cols-4" aria-label="Etapas do fechamento">
        {etapas.map((e, i) => (
          <button key={e.k} type="button" disabled={e.trava || !dados} aria-current={aba === e.k ? "step" : undefined}
            onClick={() => (e.k === "indicadores" ? irParaIndicadores() : setAba(e.k))}
            className={`border-b px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-50 md:border-b-0 ${i > 0 ? "md:border-l" : ""} ${i % 2 === 1 ? "border-l" : ""} ${aba === e.k ? "bg-secondary" : "hover:bg-muted/60"}`}>
            <span className="block text-sm font-semibold">{e.titulo}</span>
            <span className="block truncate text-xs text-muted-foreground">{e.sub}</span>
          </button>
        ))}
      </nav>

      {!dados ? (
        <p className="text-sm text-muted-foreground">Este fechamento ainda não tem leitura das planilhas. Use “Ler planilhas”.</p>
      ) : (
        <div className="transition-opacity" aria-busy={lendo}>
          {aba === "conferencia" && (
            <Conferencia dados={dados} congelado={congelado} decidir={decidir} irParaIndicadores={irParaIndicadores} ocupado={ocupado} />
          )}

          {aba === "indicadores" && (
            pendentesGraves > 0
              ? <p className="text-sm text-muted-foreground">Decida os alertas graves da conferência para liberar os indicadores.</p>
              : (
                <div className="space-y-3">
                  <Indicadores d={dados} lista={lista} v={vocabulario} />
                  <p className="text-xs text-muted-foreground">
                    Seções e ordem seguem a <Link href={`/clinicas/${clinicaId}/estrutura`} className="underline-offset-2 hover:underline">estrutura do relatório</Link> desta clínica.
                  </p>
                </div>
              )
          )}

          {aba === "analise" && (
            <div className="space-y-5">
              <div className="grid gap-5 lg:grid-cols-2">
                <section className="space-y-2 rounded-lg border bg-card p-4">
                  <h2 className="text-sm font-semibold">Contexto do período</h2>
                  {congelado ? <Leitura valor={texto.contexto} /> : (
                    <>
                      <p className="text-xs text-muted-foreground">
                        O que as planilhas não mostram: ausências, campanhas, pedidos do cliente. Um tópico por linha. Serve de apoio para escrever o texto e não vai para o cliente.
                      </p>
                      <textarea className={campo} rows={6} value={texto.contexto} aria-label="Contexto do período"
                        placeholder={"- Black Week em novembro com foco em estética\n- Recepcionista de férias na segunda quinzena"}
                        onChange={(e) => mudarTexto("contexto", e.target.value)} />
                    </>
                  )}
                </section>
                <section className="space-y-3 rounded-lg border bg-card p-4">
                  <h2 className="text-sm font-semibold">Ações do fechamento anterior</h2>
                  {!props.anterior || props.anterior.acoes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma ação registrada no fechamento anterior deste cliente.</p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Do fechamento de <Link className="underline-offset-2 hover:underline" href={`/fechamentos/${props.anterior.id}`}>{props.anterior.rotulo}</Link>. Vale comentar o andamento no contexto.
                      </p>
                      {props.anterior.acoes.map((a, i) => (
                        <div key={i} className="space-y-0.5 border-b pb-3 last:border-0 last:pb-0">
                          <p className="text-sm font-medium">{a.texto}</p>
                          <p className="text-xs text-muted-foreground">{[a.responsavel, a.prazo && `prazo ${a.prazo}`].filter(Boolean).join(" · ")}</p>
                        </div>
                      ))}
                    </>
                  )}
                </section>
              </div>

              <section className="space-y-4 rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold">Texto do fechamento</h2>
                    <p className="text-xs text-muted-foreground">Vai para o WhatsApp e para a página de análise do PDF.</p>
                  </div>
                  {!congelado && (
                    <Button size="sm" variant="outline" className="gap-2" onClick={handleSugerir} disabled={sugerindo}>
                      {sugerindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      {sugerindo ? "Escrevendo rascunho…" : "Rascunho com IA"}
                    </Button>
                  )}
                </div>
                {BLOCOS_ANALISE.map((b) => (
                  <label key={b.chave} className="block space-y-1.5">
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold">{b.titulo}</span>
                      {!congelado && <span className="text-xs text-muted-foreground">{b.ajuda}</span>}
                    </span>
                    {congelado ? <Leitura valor={texto[b.chave]} /> : (
                      <textarea className={campo} rows={b.linhas} value={texto[b.chave]} onChange={(e) => mudarTexto(b.chave, e.target.value)} />
                    )}
                  </label>
                ))}
                {!congelado && (
                  <p className="text-xs text-muted-foreground">
                    A IA usa só os números deste fechamento e o perfil do cliente, e preenche destaques, pontos de atenção e o plano. Revise sempre.
                  </p>
                )}
              </section>

              <section className="space-y-4 rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">Plano de ação</h2>
                  {!congelado && (
                    <Button size="sm" variant="outline" className="gap-1.5"
                      onClick={() => { setAcoes((p) => [...p, { texto: "", responsavel: "", prazo: "", descricao: "", indicador: "" }]); setAnaliseSuja(true); }}>
                      <Plus className="h-3.5 w-3.5" />Adicionar ação
                    </Button>
                  )}
                </div>
                {acoes.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {congelado ? "Nenhuma ação registrada neste fechamento." : "Nenhuma ação ainda. Os reports da Gestfy costumam ter 4."}
                  </p>
                )}
                {acoes.map((a, i) => (
                  <div key={i} className="grid grid-cols-[28px_1fr] gap-3 border-t pt-4 first:border-0 first:pt-0">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">{i + 1}</span>
                    <div className="min-w-0 space-y-3">
                      <div className="flex gap-2">
                        <input className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-medium disabled:opacity-70"
                          placeholder="Título da ação" value={a.texto} disabled={congelado} aria-label="Título da ação"
                          onChange={(e) => mudarAcao(i, { texto: e.target.value })} />
                        {!congelado && (
                          <Button size="sm" variant="ghost" aria-label="Remover ação" className="text-muted-foreground hover:text-destructive"
                            onClick={() => { setAcoes((p) => p.filter((_, j) => j !== i)); setAnaliseSuja(true); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      <textarea className={campo} rows={2} placeholder="O que fazer" value={a.descricao ?? ""} disabled={congelado}
                        onChange={(e) => mudarAcao(i, { descricao: e.target.value })} aria-label="O que fazer" />
                      <div className="grid gap-3 sm:grid-cols-[1fr_10rem_1fr]">
                        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
                          Responsáveis
                          <input className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground disabled:opacity-70"
                            placeholder="Nome + Nome" value={a.responsavel} disabled={congelado}
                            onChange={(e) => mudarAcao(i, { responsavel: e.target.value })} />
                        </label>
                        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
                          Prazo
                          <input className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground tabular-nums disabled:opacity-70"
                            placeholder="DD/MM/AAAA" value={a.prazo} disabled={congelado} inputMode="numeric"
                            onChange={(e) => mudarAcao(i, { prazo: mascaraData(e.target.value) })} />
                        </label>
                        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
                          Como medir
                          <input className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground disabled:opacity-70"
                            placeholder="Indicador que mostra se funcionou" value={a.indicador ?? ""} disabled={congelado}
                            onChange={(e) => mudarAcao(i, { indicador: e.target.value })} />
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </section>

              {!congelado && (
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={async () => { if (await handleSalvarAnalise()) toast.success("Análise salva."); }} disabled={salvandoAnalise} className="gap-2">
                    {salvandoAnalise ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Salvar análise
                  </Button>
                  <span className="text-xs text-muted-foreground">{analiseSuja ? "Alterações não salvas" : "Tudo salvo"}</span>
                  <Button variant="ghost" className="ml-auto gap-1" onClick={async () => { if (!analiseSuja || (await handleSalvarAnalise())) setAba("entrega"); }}>
                    Ir para a entrega <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {aba === "entrega" && (
            <div className="space-y-5">
              <div className="space-y-3 rounded-lg border bg-card p-4">
                {status === "enviado" ? (
                  <p className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />Enviado ao cliente{enviadoEm ? ` em ${dataBR(enviadoEm)}` : ""}. Números, texto e plano estão congelados.</p>
                ) : status === "concluido" ? (
                  <p className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />Concluído. Números, texto e plano estão congelados.</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Revise o texto e o PDF. Ao concluir, os números, o texto e o plano ficam congelados — para mudar algo depois, é só reabrir.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {!congelado && (
                    <Button className="gap-2" disabled={ocupado} onClick={() => setConfirmarConclusao(true)}><Check className="h-4 w-4" />Concluir fechamento</Button>
                  )}
                  {status === "concluido" && (
                    <Button className="gap-2" disabled={ocupado} onClick={() => irPara("enviado")}><Send className="h-4 w-4" />Marcar como enviado</Button>
                  )}
                  {congelado && (
                    <Button variant="outline" className="gap-2" disabled={ocupado}
                      onClick={async () => { if (await irPara("em_analise")) { setAba("analise"); toast.success("Fechamento reaberto para edição."); } }}>
                      <History className="h-4 w-4" />Reabrir
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
                <section className="space-y-3 rounded-lg border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold">Texto do WhatsApp</h2>
                    <div className="flex gap-2">
                      {(!congelado || !whats) && (
                        <Button size="sm" variant="outline" className="gap-2" onClick={handleGerarTexto} disabled={gerando}>
                          {gerando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          {whats ? "Gerar de novo" : "Gerar texto"}
                        </Button>
                      )}
                      {whats && <CopyButton text={whats} label="Copiar texto" />}
                    </div>
                  </div>
                  {!whats ? (
                    <p className="text-sm text-muted-foreground">
                      O texto é montado com os números e a análise, nas seções ligadas na estrutura da clínica.
                    </p>
                  ) : congelado ? (
                    <div className="whitespace-pre-wrap rounded-md bg-secondary/50 px-4 py-3 text-sm leading-relaxed">{whats}</div>
                  ) : (
                    <>
                      <textarea className={`${campo} bg-secondary/30`} rows={20} value={whats} aria-label="Texto do WhatsApp"
                        onChange={(e) => { setWhats(e.target.value); setWhatsSujo(true); }} />
                      <div className="flex flex-wrap items-center gap-3">
                        <Button size="sm" onClick={handleSalvarWhats} disabled={ocupado || !whatsSujo} className="gap-2"><Check className="h-3.5 w-3.5" />Salvar texto</Button>
                        <span className="text-xs text-muted-foreground">{whatsSujo ? "Edições não salvas" : "Gerar de novo descarta as edições feitas à mão."}</span>
                      </div>
                    </>
                  )}
                </section>
                <section className="space-y-3 self-start rounded-lg border bg-card p-4">
                  <h2 className="text-sm font-semibold">Relatório em PDF</h2>
                  <p className="text-sm text-muted-foreground">
                    Abre o relatório em páginas A4, na estrutura padrão Gestfy. Na tela que abrir, use “Salvar PDF”. A página com a análise e o plano de ação é opcional e pode ser incluída por lá.
                  </p>
                  <Button variant="outline" size="sm" className="gap-2" asChild>
                    <Link href={`/fechamentos-pdf/${id}`}><FileDown className="h-3.5 w-3.5" />Abrir PDF</Link>
                  </Button>
                </section>
              </div>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={confirmarConclusao} onOpenChange={setConfirmarConclusao}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Concluir o fechamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Os números, o texto e o plano de ação ficam congelados como estão agora. Para alterar depois, use “Reabrir”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar revisando</AlertDialogCancel>
            <AlertDialogAction onClick={concluir}>Concluir fechamento</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!sugestao} onOpenChange={(o) => !o && setSugestao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir destaques, pontos de atenção e plano pelo rascunho da IA?</AlertDialogTitle>
            <AlertDialogDescription>
              A observação e o contexto continuam como estão. Nada é salvo até você clicar em “Salvar análise”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter o que está escrito</AlertDialogCancel>
            <AlertDialogAction onClick={() => sugestao && aplicarSugestao(sugestao)}>Usar o rascunho</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Leitura({ valor }: { valor: string }) {
  return valor.trim()
    ? <p className="whitespace-pre-wrap rounded-md bg-muted/40 px-3 py-2 text-sm leading-relaxed">{valor}</p>
    : <p className="text-sm text-muted-foreground">Nada registrado neste fechamento.</p>;
}

