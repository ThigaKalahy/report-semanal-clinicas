"use client";

import { useState } from "react";
import { format, subDays, subWeeks, startOfWeek, endOfWeek } from "date-fns";
import {
  FileText,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  Plus,
  Trash2,
  ExternalLink,
  Download,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  gerarRelatorioWhatsapp,
  prepararDadosImagem,
  salvarRelatorioImagem,
} from "../actions";
import { SEPARATOR } from "@/lib/relatorio/montar-whatsapp";
import type { Clinica } from "@/lib/supabase/types";
import type {
  RelatorioImagemData,
  DestaqueItem,
  TipoDestaque,
} from "@/lib/relatorio/imagem-tipos";

type Preset = "semana_passada" | "ultimos7" | "custom";
type Formato = "whatsapp_pesquisas" | "whatsapp_metas" | "imagem";

// ─── Helpers de data ───────────────────────────────────────────────────────────
function semanaPassada(): { ini: string; fim: string } {
  const today = new Date();
  const lastWeek = subWeeks(today, 1);
  const ini = startOfWeek(lastWeek, { weekStartsOn: 1 });
  const fim = endOfWeek(lastWeek, { weekStartsOn: 1 });
  return { ini: format(ini, "yyyy-MM-dd"), fim: format(fim, "yyyy-MM-dd") };
}

function ultimos7Dias(): { ini: string; fim: string } {
  const today = new Date();
  return {
    ini: format(subDays(today, 6), "yyyy-MM-dd"),
    fim: format(today, "yyyy-MM-dd"),
  };
}

const PRESET_LABELS: Record<Preset, string> = {
  semana_passada: "Semana passada (seg–dom)",
  ultimos7: "Últimos 7 dias",
  custom: "Personalizado",
};

const FORMATO_OPTIONS: { value: Formato; label: string }[] = [
  { value: "whatsapp_pesquisas", label: "WhatsApp — Pesquisas" },
  { value: "whatsapp_metas", label: "WhatsApp — Metas" },
  { value: "imagem", label: "Imagem (infográfico)" },
];

// ─── CopyButton ───────────────────────────────────────────────────────────────
function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2 shrink-0">
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {copied ? "Copiado!" : label}
    </Button>
  );
}

// ─── Lista editável genérica ──────────────────────────────────────────────────
function ListaEditavel({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={item}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
            placeholder={placeholder}
            className="text-sm"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="shrink-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, ""])}
        className="gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar
      </Button>
    </div>
  );
}

// ─── Lista de destaques ───────────────────────────────────────────────────────
const TIPO_LABELS: Record<TipoDestaque, string> = {
  positivo: "✓ Positivo",
  atencao: "⚠️ Atenção",
  financeiro: "$ Financeiro",
};

function ListaDestaques({
  items,
  onChange,
}: {
  items: DestaqueItem[];
  onChange: (v: DestaqueItem[]) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Select
            value={item.tipo}
            onValueChange={(v) => {
              const next = [...items];
              next[i] = { ...next[i], tipo: v as TipoDestaque };
              onChange(next);
            }}
          >
            <SelectTrigger className="w-36 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TIPO_LABELS) as TipoDestaque[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {TIPO_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={item.texto}
            onChange={(e) => {
              const next = [...items];
              next[i] = { ...next[i], texto: e.target.value };
              onChange(next);
            }}
            placeholder="Texto do destaque…"
            className="text-sm"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="shrink-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, { tipo: "positivo", texto: "" }])}
        className="gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar destaque
      </Button>
    </div>
  );
}

// ─── Formulário de dados do infográfico ───────────────────────────────────────
function FormImagem({
  dados,
  onChange,
}: {
  dados: RelatorioImagemData;
  onChange: (d: RelatorioImagemData) => void;
}) {
  const { visaoGeral, destaques, alertas, acoes } = dados;
  const fat = visaoGeral.faturamento;
  const ng = visaoGeral.npsGoogle;
  const com = visaoGeral.comercial;

  function setFat(k: keyof typeof fat, v: string | number | boolean | null) {
    onChange({
      ...dados,
      visaoGeral: {
        ...visaoGeral,
        faturamento: { ...fat, [k]: v },
      },
    });
  }

  function setNg(k: keyof typeof ng, v: string | number | boolean | null) {
    onChange({
      ...dados,
      visaoGeral: {
        ...visaoGeral,
        npsGoogle: { ...ng, [k]: v },
      },
    });
  }

  function setCom(k: keyof typeof com, v: string) {
    onChange({
      ...dados,
      visaoGeral: {
        ...visaoGeral,
        comercial: { ...com, [k]: v },
      },
    });
  }

  return (
    <div className="space-y-6">
      {/* Visão Geral — Faturamento */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Faturamento x Meta
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "realizado_semana", label: "Realizado semanal" },
            { key: "acumulado", label: "Acumulado" },
            { key: "meta_periodo", label: "Meta do período" },
            { key: "meta_mensal", label: "Meta mensal" },
          ].map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input
                value={(fat as unknown as Record<string, unknown>)[key] as string ?? ""}
                onChange={(e) => setFat(key as keyof typeof fat, e.target.value)}
                className="text-sm"
              />
            </div>
          ))}
          <div className="space-y-1">
            <Label className="text-xs">% do período</Label>
            <Input
              type="number"
              value={fat.pct_periodo ?? ""}
              onChange={(e) =>
                setFat("pct_periodo", e.target.value === "" ? null : Number(e.target.value))
              }
              placeholder="null = N/A"
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">% da meta mensal</Label>
            <Input
              type="number"
              value={fat.pct_mensal ?? ""}
              onChange={(e) =>
                setFat("pct_mensal", e.target.value === "" ? null : Number(e.target.value))
              }
              placeholder="null = N/A"
              className="text-sm"
            />
          </div>
        </div>
      </div>

      {/* NPS / Google */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          NPS / Google
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "respostas_nps", label: "Respostas NPS" },
            { key: "avaliacoes_google", label: "Avaliações Google" },
            { key: "meta_nps_realizado", label: "NPS Score real." },
            { key: "meta_nps_meta", label: "Meta NPS" },
            { key: "meta_nps_pct", label: "NPS % meta" },
            { key: "meta_google_realizado", label: "Google real." },
            { key: "meta_google_meta", label: "Meta Google" },
            { key: "meta_google_pct", label: "Google % meta" },
          ].map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input
                type="number"
                value={(ng as unknown as Record<string, unknown>)[key] as number ?? ""}
                onChange={(e) =>
                  setNg(
                    key as keyof typeof ng,
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
                placeholder="null = N/A"
                className="text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Comercial */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Comercial &amp; Conversão
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "conversao_leads", label: "Conversão leads" },
            { key: "conversao_orcamentos", label: "Conversão orçamentos" },
            { key: "total_leads", label: "Total leads" },
            { key: "total_orcamentos", label: "Total orçamentos" },
          ].map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input
                value={(com as unknown as Record<string, unknown>)[key] as string ?? ""}
                onChange={(e) => setCom(key as keyof typeof com, e.target.value)}
                placeholder="N/A"
                className="text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Destaques */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Principais Destaques
        </h3>
        <ListaDestaques
          items={destaques}
          onChange={(v) => onChange({ ...dados, destaques: v })}
        />
      </div>

      {/* Alertas */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Alertas
        </h3>
        <ListaEditavel
          items={alertas}
          onChange={(v) => onChange({ ...dados, alertas: v })}
          placeholder="Texto do alerta…"
        />
      </div>

      {/* Ações */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Ações Sugeridas
        </h3>
        <ListaEditavel
          items={acoes}
          onChange={(v) => onChange({ ...dados, acoes: v })}
          placeholder="Texto da ação…"
        />
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function RelatorioClient({ clinicas }: { clinicas: Clinica[] }) {
  const [clinicaId, setClinicaId] = useState(clinicas[0]?.id ?? "");
  const [preset, setPreset] = useState<Preset>("semana_passada");
  const [customIni, setCustomIni] = useState(format(new Date(), "yyyy-MM-dd"));
  const [customFim, setCustomFim] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formato, setFormato] = useState<Formato>("whatsapp_pesquisas");
  const [googleManual, setGoogleManual] = useState("");
  const [showGoogleManual, setShowGoogleManual] = useState(false);
  const [resultado, setResultado] = useState<{ texto: string; erros: string[] } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Estado do modo imagem
  const [imagemDados, setImagemDados] = useState<RelatorioImagemData | null>(null);
  const [imagemErros, setImagemErros] = useState<string[]>([]);
  const [imagemId, setImagemId] = useState<string | null>(null);
  const [isSavingImagem, setIsSavingImagem] = useState(false);
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);

  function getDatas(): { ini: string; fim: string } {
    if (preset === "semana_passada") return semanaPassada();
    if (preset === "ultimos7") return ultimos7Dias();
    return { ini: customIni, fim: customFim };
  }

  async function handleGerar() {
    if (!clinicaId) return;
    const { ini, fim } = getDatas();
    setIsGenerating(true);

    // Reseta resultados anteriores
    setResultado(null);
    setImagemDados(null);
    setImagemErros([]);
    setImagemId(null);
    setImagemUrl(null);

    try {
      if (formato === "imagem") {
        const { dados, erros } = await prepararDadosImagem({ clinicaId, ini, fim });
        setImagemDados(dados);
        setImagemErros(erros);
      } else {
        const result = await gerarRelatorioWhatsapp({
          clinicaId,
          ini,
          fim,
          formato,
          googleManual: googleManual || undefined,
        });
        setResultado(result);
        if (result.erros.some((e) => e.startsWith("Google:"))) {
          setShowGoogleManual(true);
        }
      }
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleGerarImagem() {
    if (!imagemDados || !clinicaId) return;
    const { ini, fim } = getDatas();
    setIsSavingImagem(true);
    try {
      const { id } = await salvarRelatorioImagem({
        clinicaId,
        ini,
        fim,
        dados: imagemDados,
        relatorioId: imagemId ?? undefined,
      });
      setImagemId(id);
      setImagemUrl(`/api/relatorio-imagem/${id}?t=${Date.now()}`);
    } finally {
      setIsSavingImagem(false);
    }
  }

  const blocos =
    resultado?.texto
      .split(SEPARATOR)
      .map((b) => b.trim())
      .filter(Boolean) ?? [];

  const errosVisiveis =
    formato === "imagem" ? imagemErros : (resultado?.erros ?? []);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Gerar Relatório</h1>

      {/* ── Form ── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Configurações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Clínica */}
          <div className="space-y-1.5">
            <Label>Clínica</Label>
            <Select value={clinicaId} onValueChange={setClinicaId}>
              <SelectTrigger className="w-80">
                <SelectValue placeholder="Selecione a clínica" />
              </SelectTrigger>
              <SelectContent>
                {clinicas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Período */}
          <div className="space-y-2">
            <Label>Período</Label>
            <div className="flex flex-wrap gap-2">
              {(["semana_passada", "ultimos7", "custom"] as Preset[]).map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant={preset === p ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPreset(p)}
                >
                  {PRESET_LABELS[p]}
                </Button>
              ))}
            </div>
            {preset === "custom" && (
              <div className="flex items-end gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">De</Label>
                  <Input
                    type="date"
                    value={customIni}
                    onChange={(e) => setCustomIni(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Até</Label>
                  <Input
                    type="date"
                    value={customFim}
                    onChange={(e) => setCustomFim(e.target.value)}
                    className="w-40"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Formato */}
          <div className="space-y-2">
            <Label>Formato</Label>
            <div className="flex flex-wrap gap-2">
              {FORMATO_OPTIONS.map((f) => (
                <Button
                  key={f.value}
                  type="button"
                  variant={formato === f.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormato(f.value)}
                >
                  {f.value === "imagem" && <ImageIcon className="h-3.5 w-3.5 mr-1.5" />}
                  {f.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Google fallback — só em whatsapp_pesquisas */}
          {formato === "whatsapp_pesquisas" && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowGoogleManual((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showGoogleManual ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                Avaliações Google manuais (fallback)
              </button>
              {showGoogleManual && (
                <div className="space-y-1.5">
                  <Textarea
                    value={googleManual}
                    onChange={(e) => setGoogleManual(e.target.value)}
                    placeholder="Cole aqui as avaliações do Google manualmente…"
                    className="h-24 text-sm resize-none font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Se preenchido, substitui a busca automática na API do Google.
                  </p>
                </div>
              )}
            </div>
          )}

          <Separator />

          <Button onClick={handleGerar} disabled={isGenerating || !clinicaId} className="gap-2">
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            {isGenerating
              ? formato === "imagem"
                ? "Coletando dados…"
                : "Gerando…"
              : formato === "imagem"
              ? "Coletar dados"
              : "Gerar"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Avisos de erro ── */}
      {errosVisiveis.length > 0 && (
        <div className="space-y-1.5">
          {errosVisiveis.map((e, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:border-yellow-800/50 dark:bg-yellow-900/20 dark:text-yellow-400"
            >
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              {e}
            </div>
          ))}
        </div>
      )}

      {/* ── Resultado WhatsApp ── */}
      {resultado && blocos.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <CopyButton text={resultado.texto} label="Copiar tudo" />
          </div>
          {blocos.map((bloco, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-muted-foreground font-medium">
                    Bloco {i + 1} de {blocos.length}
                  </CardTitle>
                  <CopyButton text={bloco} label="Copiar este bloco" />
                </div>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed bg-muted/50 rounded-md p-4">
                  {bloco}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Formulário de imagem ── */}
      {imagemDados && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Dados do Infográfico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormImagem dados={imagemDados} onChange={setImagemDados} />

            <Separator />

            <div className="flex items-center gap-3 flex-wrap">
              <Button
                onClick={handleGerarImagem}
                disabled={isSavingImagem}
                className="gap-2"
              >
                {isSavingImagem ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImageIcon className="h-4 w-4" />
                )}
                {isSavingImagem ? "Gerando…" : "Gerar imagem"}
              </Button>

              {imagemUrl && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="gap-1.5"
                  >
                    <a href={imagemUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Abrir em nova aba
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="gap-1.5"
                  >
                    <a href={imagemUrl} download={`relatorio-${imagemId}.png`}>
                      <Download className="h-3.5 w-3.5" />
                      Baixar PNG
                    </a>
                  </Button>
                </>
              )}
            </div>

            {/* Preview */}
            {imagemUrl && (
              <div className="rounded-lg overflow-hidden border bg-muted/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagemUrl}
                  alt="Preview do infográfico"
                  className="w-full max-w-sm mx-auto block"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
