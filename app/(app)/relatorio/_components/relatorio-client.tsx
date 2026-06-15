"use client";

import { useState } from "react";
import { format, subDays, subWeeks, startOfWeek, endOfWeek } from "date-fns";
import {
  FileText, Copy, Check, ChevronDown, ChevronUp,
  Loader2, AlertTriangle, Plus, Trash2,
  ExternalLink, Download, Image as ImageIcon, Archive, Database, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  gerarRelatorioWhatsapp, prepararDadosImagem, salvarRelatorioImagem, gerarSugestoesIA,
} from "../actions";
import { SEPARATOR } from "@/lib/relatorio/montar-whatsapp";
import type { Clinica, RelatorioGerado } from "@/lib/supabase/types";
import type {
  RelatorioImagemData, DestaqueItem, TipoDestaque,
  FaturamentoVisao, NpsGoogleVisao,
} from "@/lib/relatorio/imagem-tipos";
import type { AvaliacaoGoogle } from "@/lib/coletores/google-places";

// ─── Types ────────────────────────────────────────────────────────────────────
type Preset  = "semana_passada" | "ultimos7" | "custom";
type Formato = "whatsapp_pesquisas" | "whatsapp_metas" | "imagem";

interface LeadsManualDados {
  total:      string;
  convertidos: string;
}

interface ResultadoClinica {
  clinicaId:    string;
  clinicaNome:  string;
  texto:        string;
  erros:        string[];
  imagemId?:    string;
  imagemUrl?:   string;
  imagemDados?: RelatorioImagemData;
}

// ─── Concurrency pool ─────────────────────────────────────────────────────────
async function withConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
  onComplete: (result: T) => void
): Promise<void> {
  if (!tasks.length) return;
  const queue = [...tasks];

  async function worker() {
    while (queue.length > 0) {
      const task = queue.shift()!;
      const result = await task();
      onComplete(result);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, () => worker())
  );
}

// ─── Dates ───────────────────────────────────────────────────────────────────
function semanaPassada() {
  const l = subWeeks(new Date(), 1);
  return {
    ini: format(startOfWeek(l, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    fim: format(endOfWeek(l, { weekStartsOn: 1 }), "yyyy-MM-dd"),
  };
}
function ultimos7Dias() {
  const t = new Date();
  return { ini: format(subDays(t, 6), "yyyy-MM-dd"), fim: format(t, "yyyy-MM-dd") };
}

const PRESET_LABELS: Record<Preset, string> = {
  semana_passada: "Semana passada (seg–dom)",
  ultimos7:       "Últimos 7 dias",
  custom:         "Personalizado",
};

const FORMATO_OPTIONS: { value: Formato; label: string }[] = [
  { value: "whatsapp_pesquisas", label: "WhatsApp — Pesquisas" },
  { value: "whatsapp_metas",     label: "WhatsApp — Metas" },
  { value: "imagem",             label: "Imagem (infográfico)" },
];

// ─── Parsers ──────────────────────────────────────────────────────────────────
function parseGoogleTexto(texto: string): AvaliacaoGoogle[] {
  if (!texto.trim()) return [];
  return texto.split("/").map(p => p.trim()).filter(Boolean).flatMap((parte): AvaliacaoGoogle[] => {
    const campos = parte.split(";").map(c => c.trim());
    if (campos.length < 3) return [];
    const [estStr, autorStr, textoStr, dataStr = ""] = campos;
    const nota = Number(estStr);
    if (isNaN(nota) || nota < 1 || nota > 5) return [];
    const textoLimpo = textoStr.replace(/^["""'']|["""'']$/g, "").trim();
    if (!textoLimpo) return [];
    return [{ nota: Math.round(nota), autor: autorStr || "Anônimo", texto: textoLimpo, data: dataStr.trim() }];
  });
}

function parseLeadsManual(
  d: LeadsManualDados | undefined
): { total: number; convertidos: number } | undefined {
  if (!d) return undefined;
  const total      = parseInt(d.total, 10);
  const convertidos = parseInt(d.convertidos, 10);
  if (isNaN(total) || total < 0) return undefined;
  return { total, convertidos: isNaN(convertidos) ? 0 : Math.max(0, convertidos) };
}

// ─── CopyButton ───────────────────────────────────────────────────────────────
function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="outline" size="sm" className="gap-2 shrink-0"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}>
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copiado!" : label}
    </Button>
  );
}

// ─── Lista editável ───────────────────────────────────────────────────────────
function ListaEditavel({ items, onChange, placeholder }: {
  items: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <Input value={item}
            onChange={e => { const n = [...items]; n[i] = e.target.value; onChange(n); }}
            placeholder={placeholder} className="text-sm" />
          <Button type="button" variant="ghost" size="sm"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="shrink-0 text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm"
        onClick={() => onChange([...items, ""])} className="gap-1.5">
        <Plus className="h-3.5 w-3.5" />Adicionar
      </Button>
    </div>
  );
}

// ─── Lista de destaques ───────────────────────────────────────────────────────
const TIPO_LABELS: Record<TipoDestaque, string> = {
  positivo:   "✓ Positivo",
  atencao:    "⚠ Atenção",
  financeiro: "$ Financeiro",
};

function ListaDestaques({ items, onChange }: {
  items: DestaqueItem[];
  onChange: (v: DestaqueItem[]) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Select value={item.tipo}
            onValueChange={v => { const n = [...items]; n[i] = { ...n[i], tipo: v as TipoDestaque }; onChange(n); }}>
            <SelectTrigger className="w-36 shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(TIPO_LABELS) as TipoDestaque[]).map(t => (
                <SelectItem key={t} value={t}>{TIPO_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input value={item.texto}
            onChange={e => { const n = [...items]; n[i] = { ...n[i], texto: e.target.value }; onChange(n); }}
            placeholder="Texto do destaque…" className="text-sm" />
          <Button type="button" variant="ghost" size="sm"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="shrink-0 text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm"
        onClick={() => onChange([...items, { tipo: "positivo", texto: "" }])} className="gap-1.5">
        <Plus className="h-3.5 w-3.5" />Adicionar destaque
      </Button>
    </div>
  );
}

// ─── % helpers ────────────────────────────────────────────────────────────────
function parseFmtNum(s: string): number | null {
  if (!s || s === "N/A" || s === "—") return null;
  const n = parseFloat(s.replace(/R\$\s*/g, "").replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? null : n;
}
function calcPct(
  num: number | string | null | undefined,
  den: number | string | null | undefined
): number | null {
  const n = typeof num === "string" ? parseFmtNum(num) : (num ?? null);
  const d = typeof den === "string" ? parseFmtNum(den) : (den ?? null);
  if (n === null || d === null || d === 0) return null;
  return Math.round((n / d) * 100);
}
function ReadOnlyPct({ value }: { value: number | null }) {
  return (
    <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground">
      {value !== null ? `${value}%` : "—"}
    </div>
  );
}

// ─── Google Fallback Panel (por clínica) ──────────────────────────────────────
function GoogleFallbackPanel({
  clinicaNome, placeId, textoManual, onChangeTexto, labelOverride,
}: {
  clinicaNome: string;
  placeId: string | null | undefined;
  textoManual: string;
  onChangeTexto: (v: string) => void;
  labelOverride?: string;
}) {
  const [open, setOpen] = useState(false);
  const googleUrl = placeId
    ? `https://www.google.com/maps/place/?q=place_id:${placeId}`
    : null;
  const parsed = parseGoogleTexto(textoManual);
  const count = parsed.length;
  const temTexto = textoManual.trim().length > 0;

  return (
    <div className="rounded-md border bg-muted/30">
      <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
        <button type="button" onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors flex-1 text-left min-w-0">
          {open ? <ChevronUp className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
          <span className="font-medium">{labelOverride ?? "Inserir avaliações Google manualmente"}</span>
          {count > 0 && (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
              — {count} avaliação(ões)
            </span>
          )}
        </button>
        {googleUrl && (
          <Button variant="outline" size="sm" asChild className="shrink-0 gap-1.5">
            <a href={googleUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />Abrir no Google
            </a>
          </Button>
        )}
      </div>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            A API do Google retorna no máximo ~5 avaliações curadas. Se houver dados manuais,
            eles <strong>substituem</strong> a busca automática no relatório de{" "}
            <em>{clinicaNome}</em>.
          </p>
          <div className="rounded-md bg-muted/60 px-3 py-2 space-y-1 text-xs">
            <p className="font-medium text-foreground">Formato:</p>
            <p className="text-muted-foreground font-mono">
              estrelas; nome; &quot;texto&quot;; data{" "}
              <span className="not-italic">— separe múltiplas com</span>{" "}
              <span className="font-semibold text-foreground">/</span>
            </p>
            <p className="font-medium text-foreground pt-1">Exemplo:</p>
            <p className="font-mono text-muted-foreground break-all">
              5; João Lima; &quot;Ótima clínica!&quot;; 02/06
            </p>
          </div>
          <Textarea
            value={textoManual}
            onChange={e => onChangeTexto(e.target.value)}
            placeholder={'5; João Lima; "Ótima clínica!"; 02/06 / 4; Maria S.; "Bom atendimento"; 03/06'}
            className="text-sm resize-none h-24 font-mono"
          />
          {temTexto && (
            <p className={`text-xs font-medium ${count > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
              {count > 0
                ? `✓ ${count} avaliação(ões) reconhecida(s) — serão usadas em vez da API`
                : "⚠ Nenhuma avaliação reconhecida — verifique o formato acima"}
            </p>
          )}
          {!temTexto && (
            <p className="text-xs text-muted-foreground italic">
              Sem dados manuais — o relatório usará o resultado da API do Google (quando disponível).
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Leads Manual Panel (por clínica) ────────────────────────────────────────
function LeadsManualPanel({
  clinicaNome, dados, onChangeDados, labelOverride,
}: {
  clinicaNome: string;
  dados: LeadsManualDados | undefined;
  onChangeDados: (d: LeadsManualDados) => void;
  labelOverride?: string;
}) {
  const [open, setOpen] = useState(false);
  const total      = dados?.total ?? "";
  const convertidos = dados?.convertidos ?? "";
  const totalN      = parseInt(total, 10);
  const convertidosN = parseInt(convertidos, 10);
  const taxa =
    !isNaN(totalN) && totalN > 0 && !isNaN(convertidosN)
      ? `${((convertidosN / totalN) * 100).toFixed(1)}%`
      : null;
  const hasData = total !== "" || convertidos !== "";

  return (
    <div className="rounded-md border bg-muted/30">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-left px-4 py-3">
        {open ? <ChevronUp className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
        <span className="font-medium flex-1">{labelOverride ?? "Inserir leads manualmente"}</span>
        {hasData && (
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
            — {total || "?"} leads, {convertidos || "?"} conv.
          </span>
        )}
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Preencha se <em>{clinicaNome}</em> não tem planilha de leads, ou para sobrescrever a coleta automática.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Total de leads</Label>
              <Input type="number" min="0" value={total}
                onChange={e => onChangeDados({ total: e.target.value, convertidos })}
                placeholder="0" className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Convertidos</Label>
              <Input type="number" min="0" value={convertidos}
                onChange={e => onChangeDados({ total, convertidos: e.target.value })}
                placeholder="0" className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Taxa (auto)</Label>
              <div className="flex h-9 items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground">
                {taxa ?? "—"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Formulário de dados do infográfico ───────────────────────────────────────
function FormImagem({ dados, onChange }: {
  dados: RelatorioImagemData;
  onChange: (d: RelatorioImagemData) => void;
}) {
  const { visaoGeral, destaques, alertas, acoes } = dados;
  const fat = visaoGeral.faturamento, ng = visaoGeral.npsGoogle, com = visaoGeral.comercial;
  const [loadingIA, setLoadingIA] = useState(false);
  const [erroIA,    setErroIA]    = useState<string | null>(null);
  const [iaUsada,   setIaUsada]   = useState(false);

  async function handleIA() {
    setLoadingIA(true);
    setErroIA(null);
    try {
      const res = await gerarSugestoesIA(dados);
      if (!res.ok) {
        setErroIA(res.erro);
        return;
      }
      onChange({ ...dados, destaques: res.sugestoes.destaques, alertas: res.sugestoes.alertas, acoes: res.sugestoes.acoes });
      setIaUsada(true);
    } catch (e) {
      setErroIA(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setLoadingIA(false);
    }
  }

  function onFatChange(patch: Partial<FaturamentoVisao>) {
    const newFat   = { ...fat, ...patch };
    const acumVal  = parseFmtNum(newFat.acumulado);
    const metaPVal = parseFmtNum(newFat.meta_periodo);
    const metaMVal = parseFmtNum(newFat.meta_mensal);
    // pct_periodo: diferença relativa vs meta proporcional (StatusPill mostra +/-X%)
    const pctPeriodo = (acumVal !== null && metaPVal !== null && metaPVal > 0)
      ? Math.abs(Math.round(((acumVal - metaPVal) / metaPVal) * 100))
      : null;
    // pct_mensal: atingimento (acumulado / meta_mensal * 100)
    const pctMensal = (acumVal !== null && metaMVal !== null && metaMVal > 0)
      ? Math.round((acumVal / metaMVal) * 100)
      : null;
    onChange({ ...dados, visaoGeral: { ...visaoGeral, faturamento: {
      ...newFat,
      pct_periodo:   pctPeriodo,
      acima_periodo: acumVal !== null && metaPVal !== null ? acumVal >= metaPVal : false,
      pct_mensal:    pctMensal,
      acima_mensal:  acumVal !== null && metaMVal !== null ? acumVal >= metaMVal : false,
    }}});
  }

  function onNgChange(patch: Partial<NpsGoogleVisao>) {
    onChange({ ...dados, visaoGeral: { ...visaoGeral, npsGoogle: { ...ng, ...patch } } });
  }

  const pctNps    = calcPct(ng.respostas_nps,    ng.meta_nps_meta);
  const pctGoogle = calcPct(ng.avaliacoes_google, ng.meta_google_meta);

  const FAT_EXTRA_FIELDS: [keyof FaturamentoVisao, string][] = [
    ["meta_periodo",    "Meta do período"],
    ["meta_mensal",     "Meta mensal"],
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Faturamento x Meta</h3>
        <div className="grid grid-cols-2 gap-3">
          {/* Acumulado — renderizado separado para mostrar indicador de planilha */}
          <div className="space-y-1">
            <Label className="text-xs">Acumulado</Label>
            <Input
              value={fat.acumulado ?? ""}
              onChange={e => onFatChange({ acumulado: e.target.value })}
              className="text-sm" />
            {fat.acumulado_from_planilha && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Database className="h-3 w-3 shrink-0" />
                Preenchido a partir da planilha de faturamento
              </p>
            )}
          </div>
          {FAT_EXTRA_FIELDS.map(([k, l]) => (
            <div key={k} className="space-y-1">
              <Label className="text-xs">{l}</Label>
              <Input
                value={(fat as unknown as Record<string, string>)[k] ?? ""}
                onChange={e => onFatChange({ [k]: e.target.value } as Partial<FaturamentoVisao>)}
                className="text-sm" />
            </div>
          ))}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">% do período (auto)</Label>
            <ReadOnlyPct value={fat.pct_periodo} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">% da meta mensal (auto)</Label>
            <ReadOnlyPct value={fat.pct_mensal} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">NPS / Google</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Respostas NPS</Label>
            <Input type="number" value={ng.respostas_nps ?? ""} placeholder="—"
              onChange={e => onNgChange({ respostas_nps: e.target.value === "" ? null : Number(e.target.value) })}
              className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Avaliações Google</Label>
            <Input type="number" value={ng.avaliacoes_google ?? ""} placeholder="—"
              onChange={e => onNgChange({ avaliacoes_google: e.target.value === "" ? null : Number(e.target.value) })}
              className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Meta NPS (alvo)</Label>
            <Input type="number" value={ng.meta_nps_meta ?? ""} placeholder="—"
              onChange={e => onNgChange({ meta_nps_meta: e.target.value === "" ? null : Number(e.target.value) })}
              className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Meta Google (alvo)</Label>
            <Input type="number" value={ng.meta_google_meta ?? ""} placeholder="—"
              onChange={e => onNgChange({ meta_google_meta: e.target.value === "" ? null : Number(e.target.value) })}
              className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">% NPS (auto)</Label>
            <ReadOnlyPct value={pctNps} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">% Google (auto)</Label>
            <ReadOnlyPct value={pctGoogle} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Comercial &amp; Conversão</h3>
        <div className="grid grid-cols-2 gap-3">
          {(["conversao_leads", "conversao_orcamentos", "total_leads", "total_orcamentos"] as (keyof typeof com)[]).map(k => (
            <div key={k} className="space-y-1">
              <Label className="text-xs">{k.replace(/_/g, " ")}</Label>
              <Input
                value={(com as unknown as Record<string, unknown>)[k] as string ?? ""}
                placeholder="N/A"
                onChange={e => onChange({ ...dados, visaoGeral: { ...visaoGeral, comercial: { ...com, [k]: e.target.value } } })}
                className="text-sm" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Principais Destaques</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleIA}
            disabled={loadingIA}
            className="gap-1.5 text-xs font-normal h-7 px-2.5"
          >
            {loadingIA
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <Sparkles className="h-3 w-3" />}
            {loadingIA ? "Gerando…" : "✨ Preencher com IA"}
          </Button>
        </div>
        {erroIA && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 shrink-0" />{erroIA}
          </p>
        )}
        {iaUsada && !erroIA && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3 w-3 shrink-0" />
            Sugestão gerada por IA — revise antes de enviar.
          </p>
        )}
        <ListaDestaques items={destaques} onChange={v => onChange({ ...dados, destaques: v })} />
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Alertas</h3>
        <ListaEditavel items={alertas} onChange={v => onChange({ ...dados, alertas: v })} placeholder="Texto do alerta…" />
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Ações Sugeridas</h3>
        <ListaEditavel items={acoes} onChange={v => onChange({ ...dados, acoes: v })} placeholder="Texto da ação…" />
      </div>
    </div>
  );
}

// ─── Card WhatsApp por clínica ────────────────────────────────────────────────
function ClinicaWhatsappCard({ resultado }: { resultado: ResultadoClinica }) {
  const blocos = resultado.texto.split(SEPARATOR).map(b => b.trim()).filter(Boolean);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">{resultado.clinicaNome}</CardTitle>
          {blocos.length > 0 && <CopyButton text={resultado.texto} label="Copiar tudo" />}
        </div>
        {resultado.erros.map((e, i) => (
          <div key={i} className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:border-yellow-800/50 dark:bg-yellow-900/20 dark:text-yellow-400 mt-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{e}
          </div>
        ))}
      </CardHeader>
      <CardContent className="pt-0">
        {blocos.length > 0 ? (
          <div className="space-y-3">
            {blocos.map((bloco, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-medium">
                    Bloco {i + 1} de {blocos.length}
                  </span>
                  <CopyButton text={bloco} label="Copiar bloco" />
                </div>
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed bg-muted/50 rounded-md p-4">
                  {bloco}
                </pre>
              </div>
            ))}
          </div>
        ) : resultado.erros.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem conteúdo gerado.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ─── Card Imagem por clínica ──────────────────────────────────────────────────
function ClinicaImagemCard({
  resultado, datas, onUpdate,
}: {
  resultado: ResultadoClinica;
  datas: { ini: string; fim: string };
  onUpdate: (r: ResultadoClinica) => void;
}) {
  const [saving, setSaving] = useState(false);
  const dados = resultado.imagemDados;

  async function handleGerar() {
    if (!dados) return;
    setSaving(true);
    try {
      const { id } = await salvarRelatorioImagem({
        clinicaId:   resultado.clinicaId,
        ini:         datas.ini,
        fim:         datas.fim,
        dados,
        relatorioId: resultado.imagemId,
      });
      onUpdate({
        ...resultado,
        imagemId:  id,
        imagemUrl: `/api/relatorio-imagem/${id}?t=${Date.now()}`,
      });
    } finally {
      setSaving(false);
    }
  }

  const slugNome = resultado.clinicaNome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">{resultado.clinicaNome}</CardTitle>
        {resultado.erros.map((e, i) => (
          <div key={i} className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:border-yellow-800/50 dark:bg-yellow-900/20 dark:text-yellow-400 mt-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{e}
          </div>
        ))}
      </CardHeader>
      <CardContent>
        {dados ? (
          <div className="space-y-4">
            <FormImagem dados={dados} onChange={d => onUpdate({ ...resultado, imagemDados: d })} />
            <Separator />
            <div className="flex items-center gap-3 flex-wrap">
              <Button onClick={handleGerar} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                {saving ? "Gerando…" : "Gerar imagem"}
              </Button>
              {resultado.imagemUrl && (<>
                <Button variant="outline" size="sm" asChild className="gap-1.5">
                  <a href={resultado.imagemUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />Abrir
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild className="gap-1.5">
                  <a href={resultado.imagemUrl} download={`${slugNome}_${datas.ini}.png`}>
                    <Download className="h-3.5 w-3.5" />Baixar PNG
                  </a>
                </Button>
              </>)}
            </div>
            {resultado.imagemUrl && (
              <div className="rounded-lg overflow-hidden border bg-muted/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resultado.imagemUrl} alt={`Infográfico ${resultado.clinicaNome}`}
                  className="w-full max-w-sm mx-auto block" />
              </div>
            )}
          </div>
        ) : resultado.erros.length > 0 ? (
          <p className="text-sm text-destructive">Não foi possível coletar dados para esta clínica.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function RelatorioClient({
  clinicas,
  relatorioParaReabrir,
}: {
  clinicas: Clinica[];
  relatorioParaReabrir?: RelatorioGerado | null;
}) {
  const rea = relatorioParaReabrir;

  const [clinicasSel, setClinicasSel] = useState<Set<string>>(
    () => rea ? new Set([rea.clinica_id]) : new Set()
  );
  const [preset, setPreset] = useState<Preset>(
    () => rea ? "custom" : "semana_passada"
  );
  const [customIni, setCustomIni] = useState(
    () => (rea?.data_inicio) ?? format(new Date(), "yyyy-MM-dd")
  );
  const [customFim, setCustomFim] = useState(
    () => (rea?.data_fim) ?? format(new Date(), "yyyy-MM-dd")
  );
  const [formato, setFormato] = useState<Formato>(
    () => (rea?.formato as Formato | undefined) ?? "whatsapp_pesquisas"
  );

  // Per-clinic manual data (keyed by clinicaId)
  const [googleManualMap, setGoogleManualMap] = useState<Record<string, string>>({});
  const [leadsManualMap, setLeadsManualMap]   = useState<Record<string, LeadsManualDados>>({});

  const [resultados, setResultados] = useState<ResultadoClinica[]>(() => {
    if (!rea || rea.formato !== "imagem") return [];
    const dj = rea.dados_json;
    if (!dj || typeof dj !== "object" || Array.isArray(dj)) return [];
    const clinica = clinicas.find((c) => c.id === rea.clinica_id);
    return [{
      clinicaId:   rea.clinica_id,
      clinicaNome: clinica?.nome ?? rea.clinica_id,
      texto:       "",
      erros:       [],
      imagemId:    rea.id,
      imagemUrl:   `/api/relatorio-imagem/${rea.id}`,
      imagemDados: dj as unknown as RelatorioImagemData,
    }];
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [progresso, setProgresso]     = useState<{ done: number; total: number } | null>(null);
  const [datasGeradas, setDatasGeradas] = useState<{ ini: string; fim: string } | null>(
    () => rea?.data_inicio && rea.data_fim
      ? { ini: rea.data_inicio, fim: rea.data_fim }
      : null
  );
  const [isZipping, setIsZipping]     = useState(false);

  function getDatas(): { ini: string; fim: string } {
    if (preset === "semana_passada") return semanaPassada();
    if (preset === "ultimos7")       return ultimos7Dias();
    return { ini: customIni, fim: customFim };
  }

  function toggleClinica(id: string) {
    setClinicasSel(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function toggleAll() {
    setClinicasSel(
      clinicasSel.size === clinicas.length
        ? new Set()
        : new Set(clinicas.map(c => c.id))
    );
  }

  const selectedClinics = clinicas.filter(c => clinicasSel.has(c.id));
  const multiClinica    = selectedClinics.length > 1;

  async function handleGerar() {
    const ids = selectedClinics.map(c => c.id);
    if (!ids.length) return;

    const datas = getDatas();
    setIsGenerating(true);
    setResultados([]);
    setDatasGeradas(datas);

    let doneCount = 0;
    setProgresso({ done: 0, total: ids.length });

    const tasks = ids.map(id => {
      const clinica = clinicas.find(c => c.id === id)!;
      const base: ResultadoClinica = { clinicaId: id, clinicaNome: clinica.nome, texto: "", erros: [] };

      return async (): Promise<ResultadoClinica> => {
        const googleAvaliacoes = parseGoogleTexto(googleManualMap[id] ?? "");
        const leadsManual      = parseLeadsManual(leadsManualMap[id]);

        if (formato === "imagem") {
          return prepararDadosImagem({
            clinicaId: id,
            ini: datas.ini,
            fim: datas.fim,
            leadsManual,
          })
            .then(({ dados, erros }): ResultadoClinica => ({ ...base, erros, imagemDados: dados }))
            .catch((e): ResultadoClinica => ({
              ...base,
              erros: [`Erro ao coletar dados: ${e instanceof Error ? e.message : String(e)}`],
            }));
        }
        return gerarRelatorioWhatsapp({
          clinicaId: id,
          ini: datas.ini,
          fim: datas.fim,
          formato,
          googleManualAvaliacoes: googleAvaliacoes.length > 0 ? googleAvaliacoes : undefined,
          leadsManual,
        })
          .then(({ texto, erros }): ResultadoClinica => ({ ...base, texto, erros }))
          .catch((e): ResultadoClinica => ({
            ...base,
            erros: [`Erro ao gerar relatório: ${e instanceof Error ? e.message : String(e)}`],
          }));
      };
    });

    await withConcurrency(tasks, 3, result => {
      doneCount++;
      setResultados(prev => [...prev, result]);
      setProgresso({ done: doneCount, total: ids.length });
    });

    setIsGenerating(false);
    setProgresso(null);
  }

  async function handleDownloadAll() {
    const comImagem = resultados.filter(r => r.imagemUrl);
    if (!comImagem.length) return;

    setIsZipping(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip  = new JSZip();
      const datas = datasGeradas ?? getDatas();

      for (const r of comImagem) {
        try {
          const res  = await fetch(r.imagemUrl!);
          const blob = await res.blob();
          const slug = r.clinicaNome
            .toLowerCase()
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
          zip.file(`${slug}_${datas.ini}_${datas.fim}.png`, blob);
        } catch {
          // one failed image doesn't abort the zip
        }
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url;
      a.download = `relatorios_${datas.ini}_${datas.fim}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsZipping(false);
    }
  }

  const imagensGeradas = resultados.filter(r => r.imagemUrl);
  const podGerar       = clinicasSel.size > 0 && !isGenerating;
  const showLeadsPanel = formato === "whatsapp_pesquisas" || formato === "imagem";

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold font-heading">Gerar Report Semanal</h1>

      {/* ── Configurações ── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Configurações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Seleção de clínicas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Clínicas{" "}
                <span className="text-muted-foreground text-sm font-normal">
                  ({clinicasSel.size} de {clinicas.length} selecionada{clinicasSel.size !== 1 ? "s" : ""})
                </span>
              </Label>
              <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={toggleAll}>
                {clinicasSel.size === clinicas.length ? "Desmarcar todas" : "Selecionar todas"}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {clinicas.map(c => (
                <label key={c.id}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors ${
                    clinicasSel.has(c.id) ? "border-primary/50 bg-primary/5" : ""
                  }`}>
                  <input type="checkbox" checked={clinicasSel.has(c.id)}
                    onChange={() => toggleClinica(c.id)}
                    className="h-4 w-4 cursor-pointer accent-[#7B099C]" />
                  <span className="text-sm truncate">{c.nome}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Período */}
          <div className="space-y-2">
            <Label>Período</Label>
            <div className="flex flex-wrap gap-2">
              {(["semana_passada", "ultimos7", "custom"] as Preset[]).map(p => (
                <Button key={p} type="button"
                  variant={preset === p ? "default" : "outline"}
                  size="sm" onClick={() => setPreset(p)}>
                  {PRESET_LABELS[p]}
                </Button>
              ))}
            </div>
            {preset === "custom" && (
              <div className="flex items-end gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">De</Label>
                  <Input type="date" value={customIni} onChange={e => setCustomIni(e.target.value)} className="w-40" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Até</Label>
                  <Input type="date" value={customFim} onChange={e => setCustomFim(e.target.value)} className="w-40" />
                </div>
              </div>
            )}
          </div>

          {/* Formato */}
          <div className="space-y-2">
            <Label>Formato</Label>
            <div className="flex flex-wrap gap-2">
              {FORMATO_OPTIONS.map(f => (
                <Button key={f.value} type="button"
                  variant={formato === f.value ? "default" : "outline"}
                  size="sm" onClick={() => setFormato(f.value)}>
                  {f.value === "imagem" && <ImageIcon className="h-3.5 w-3.5 mr-1.5" />}
                  {f.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Google fallback — só para pesquisas, um painel por clínica selecionada */}
          {formato === "whatsapp_pesquisas" && selectedClinics.length > 0 && (
            <div className="space-y-2">
              {multiClinica && (
                <Label className="text-sm text-muted-foreground">
                  Avaliações Google — por clínica (opcional)
                </Label>
              )}
              {selectedClinics.map(c => (
                <GoogleFallbackPanel
                  key={c.id}
                  clinicaNome={c.nome}
                  placeId={c.google_place_id}
                  textoManual={googleManualMap[c.id] ?? ""}
                  onChangeTexto={val => setGoogleManualMap(prev => ({ ...prev, [c.id]: val }))}
                  labelOverride={multiClinica ? `Avaliações Google — ${c.nome}` : undefined}
                />
              ))}
            </div>
          )}

          {/* Leads manual — para pesquisas e imagem, um painel por clínica selecionada */}
          {showLeadsPanel && selectedClinics.length > 0 && (
            <div className="space-y-2">
              {multiClinica && (
                <Label className="text-sm text-muted-foreground">
                  Leads — por clínica (opcional, sobrescreve planilha)
                </Label>
              )}
              {selectedClinics.map(c => (
                <LeadsManualPanel
                  key={c.id}
                  clinicaNome={c.nome}
                  dados={leadsManualMap[c.id]}
                  onChangeDados={d => setLeadsManualMap(prev => ({ ...prev, [c.id]: d }))}
                  labelOverride={multiClinica ? `Leads — ${c.nome}` : undefined}
                />
              ))}
            </div>
          )}

          <Separator />

          <div className="flex items-center gap-4">
            <Button onClick={handleGerar} disabled={!podGerar} className="gap-2">
              {isGenerating
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <FileText className="h-4 w-4" />}
              {isGenerating
                ? (progresso
                    ? `Gerando ${progresso.done + 1} de ${progresso.total}…`
                    : "Gerando…")
                : formato === "imagem"
                  ? `Coletar dados${clinicasSel.size > 1 ? ` (${clinicasSel.size})` : ""}`
                  : `Gerar${clinicasSel.size > 1 ? ` (${clinicasSel.size})` : ""}`}
            </Button>
            {!isGenerating && clinicasSel.size === 0 && (
              <p className="text-sm text-muted-foreground">Selecione ao menos uma clínica.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Resultados ── */}
      {(resultados.length > 0 || isGenerating) && (
        <div className="space-y-4">

          {/* Progresso */}
          {isGenerating && progresso && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>
                {progresso.done === 0
                  ? `Iniciando geração para ${progresso.total} clínica${progresso.total !== 1 ? "s" : ""}…`
                  : `${progresso.done} de ${progresso.total} concluído${progresso.done !== 1 ? "s" : ""}${
                      progresso.done < progresso.total ? " — aguardando os demais…" : ""
                    }`}
              </span>
            </div>
          )}

          {/* Ações globais */}
          {resultados.length > 1 && formato !== "imagem" && (
            <div className="flex justify-end">
              <CopyButton
                text={resultados.map(r => `===== ${r.clinicaNome} =====\n\n${r.texto}`).join("\n\n")}
                label={`Copiar tudo (${resultados.length} clínicas)`}
              />
            </div>
          )}
          {formato === "imagem" && imagensGeradas.length > 0 && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handleDownloadAll} disabled={isZipping} className="gap-1.5">
                {isZipping
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Archive className="h-3.5 w-3.5" />}
                {isZipping
                  ? "Preparando ZIP…"
                  : `Baixar todas (${imagensGeradas.length} imagem${imagensGeradas.length !== 1 ? "ns" : ""})`}
              </Button>
            </div>
          )}

          {/* Cards por clínica */}
          {resultados.map(r =>
            formato === "imagem" ? (
              <ClinicaImagemCard
                key={r.clinicaId}
                resultado={r}
                datas={datasGeradas ?? getDatas()}
                onUpdate={upd =>
                  setResultados(prev => prev.map(x => x.clinicaId === upd.clinicaId ? upd : x))
                }
              />
            ) : (
              <ClinicaWhatsappCard key={r.clinicaId} resultado={r} />
            )
          )}
        </div>
      )}
    </div>
  );
}
