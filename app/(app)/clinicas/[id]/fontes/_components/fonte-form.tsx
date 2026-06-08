"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Wifi, Loader2, Wand2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { upsertFonte } from "../actions";
import {
  preConsultaSchema,
  npsSchema,
  leadsSchema,
  faturamentoSchema,
  despesaSchema,
  type PreConsultaFormValues,
  type NpsFormValues,
  type LeadsFormValues,
  type FaturamentoFormValues,
  type DespesaFormValues,
} from "../_schemas";
import type { FonteDados, Json } from "@/lib/supabase/types";

// ── Column import utilities ───────────────────────────────────────────────────

function colLetter(idx: number): string {
  let result = "";
  let n = idx + 1;
  while (n > 0) {
    result = String.fromCharCode(64 + ((n - 1) % 26 + 1)) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function parseColumnText(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of text.split(/[;\n]/)) {
    const colonIdx = part.indexOf(":");
    if (colonIdx < 0) continue;
    const letter = part.slice(0, colonIdx).trim().toUpperCase();
    const name   = part.slice(colonIdx + 1).trim();
    if (/^[A-Z]+$/.test(letter) && name) result[letter] = name;
  }
  return result;
}

function matchCol(cols: Record<string, string>, ...keywords: string[]): string {
  for (const [letter, name] of Object.entries(cols)) {
    const lower = name.toLowerCase();
    if (keywords.some((kw) => lower.includes(kw))) return letter;
  }
  return "";
}

function detectPreConsulta(cols: Record<string, string>): Partial<PreConsultaFormValues> {
  return {
    coluna_data: matchCol(cols, "carimbo", "data/hora"),
    motivo: matchCol(cols, "motivo"),
    origem: matchCol(cols, "origem", "captação", "captacao", "canal", "como nos conheceu", "como você nos"),
  };
}

function detectNps(cols: Record<string, string>): Partial<NpsFormValues> {
  return {
    coluna_data:         matchCol(cols, "carimbo", "data/hora"),
    nota_geral:          matchCol(cols, "nota geral", "avaliação geral", "avaliacao geral", "geral"),
    nota_profissional:   matchCol(cols, "profissional", "médico", "medico", "dentista"),
    nota_recepcao:       matchCol(cols, "recepção", "recepcao"),
    nota_infraestrutura: matchCol(cols, "infraestrutura", "estrutura"),
    nota_enfermagem:     matchCol(cols, "enfermagem"),
    comentario:          matchCol(cols, "comentário", "comentario", "sugestão", "sugestao", "observação"),
    nome_paciente:       matchCol(cols, "nome do paciente", "nome completo", "paciente"),
    anonimato:           matchCol(cols, "anonimato", "anônimo", "privacidade", "preferência de privacidade"),
    indicacao:           matchCol(cols, "indicação", "indicacao", "indicou", "indica", "referência", "referencia"),
  };
}

function detectLeads(cols: Record<string, string>): Partial<LeadsFormValues> {
  return {
    coluna_data: matchCol(cols, "carimbo", "data/hora", "data"),
    convertido:  matchCol(cols, "convertido", "agendou", "status", "situação"),
  };
}

function detectFaturamento(cols: Record<string, string>): Partial<FaturamentoFormValues> {
  return {
    coluna_data:  matchCol(cols, "data", "carimbo", "data/hora"),
    categoria:    matchCol(cols, "categoria", "tipo", "serviço", "procedimento"),
    valor_pago:   matchCol(cols, "valor", "pagamento", "receita", "faturado"),
    profissional: matchCol(cols, "profissional", "médico", "medico", "dentista", "operador"),
  };
}

function detectDespesa(cols: Record<string, string>): Partial<DespesaFormValues> {
  return {
    coluna_data: matchCol(cols, "data", "carimbo", "data/hora"),
    categoria:   matchCol(cols, "categoria", "tipo", "centro de custo"),
    valor_pago:  matchCol(cols, "valor", "despesa", "custo", "pagamento"),
  };
}

// ── Shared types ──────────────────────────────────────────────────────────────

interface Props {
  tipo: "pre_consulta" | "nps" | "leads" | "faturamento" | "despesa";
  clinicaId: string;
  existingFonte: FonteDados | null;
  onSuccess: () => void;
  onCancel: () => void;
}

function getMapeamento(m: Json): Record<string, string> {
  if (m && typeof m === "object" && !Array.isArray(m)) return m as Record<string, string>;
  return {};
}

// ── ColInput ──────────────────────────────────────────────────────────────────

interface ColInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
}

function ColInput({ id, label, required, error, onChange, ...props }: ColInputProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
        <span className="ml-1.5 text-xs font-normal text-muted-foreground">(coluna)</span>
      </Label>
      <Input
        id={id}
        className="font-mono uppercase w-24"
        maxLength={3}
        placeholder="A"
        onChange={(e) => {
          const upper = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
          const fake = Object.assign({}, e, { target: Object.assign({}, e.target, { value: upper }) });
          onChange?.(fake as React.ChangeEvent<HTMLInputElement>);
        }}
        {...props}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── ColImporter ───────────────────────────────────────────────────────────────

interface ColImporterProps {
  value: string;
  onChange: (v: string) => void;
  onApply: () => void;
  onClose: () => void;
}

function ColImporter({ value, onChange, onApply, onClose }: ColImporterProps) {
  return (
    <div className="rounded-md border bg-muted/40 p-3 space-y-2.5">
      <div className="space-y-0.5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Importar mapeamento
        </p>
        <p className="text-xs text-muted-foreground">
          Cole as colunas no formato{" "}
          <code className="bg-muted px-1 rounded text-[11px]">A: Nome;B: Outra coluna</code>.
          Ao testar a conexão, isso é preenchido automaticamente.
        </p>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="A: Carimbo de data/hora;B: Status;C: Origem"
        className="font-mono text-xs h-20 resize-none"
      />
      <div className="flex gap-2">
        <Button type="button" size="sm" className="gap-1.5" onClick={onApply} disabled={!value.trim()}>
          <Wand2 className="h-3.5 w-3.5" />Detectar e preencher
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>Fechar</Button>
      </div>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{children}</p>
  );
}

function FormBase({
  form, errors, onTest, isTesting,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: ReturnType<typeof useForm<any>>;
  errors: Record<string, { message?: string }>;
  onTest: () => void;
  isTesting: boolean;
}) {
  return (
    <div className="space-y-4">
      <SectionLabel>Planilha</SectionLabel>
      <div className="space-y-1.5">
        <Label htmlFor="sheet_id">Sheet ID <span className="text-destructive">*</span></Label>
        <Input id="sheet_id" {...form.register("sheet_id")}
          placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" className="font-mono text-xs" />
        <p className="text-xs text-muted-foreground">
          Na URL: <code className="bg-muted px-1 rounded">docs.google.com/spreadsheets/d/<strong>[ID]</strong>/edit</code>
        </p>
        {errors.sheet_id && <p className="text-xs text-destructive">{errors.sheet_id.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="aba_nome">Aba <span className="text-destructive">*</span></Label>
          <Input id="aba_nome" {...form.register("aba_nome")} placeholder="Respostas ao formulário 1" />
          {errors.aba_nome && <p className="text-xs text-destructive">{errors.aba_nome.message}</p>}
        </div>
        <ColInput id="coluna_data" label="Data/hora" required
          {...form.register("coluna_data")} error={errors.coluna_data?.message} />
      </div>
      <Button type="button" variant="outline" size="sm" className="gap-2" onClick={onTest} disabled={isTesting}>
        {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
        {isTesting ? "Testando…" : "Testar conexão"}
      </Button>
    </div>
  );
}

function FormFooter({ isSubmitting, onCancel }: { isSubmitting: boolean; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Salvando…" : "Salvar configuração"}
      </Button>
    </div>
  );
}

// ── Shared test connection helper ─────────────────────────────────────────────

async function testSheetConnection(
  sheetId: string,
  abaNome: string,
  setImportText: (v: string) => void,
  setShowImporter: (v: boolean) => void
) {
  if (!sheetId || !abaNome) { toast.error("Preencha Sheet ID e Aba antes de testar."); return; }
  try {
    const res  = await fetch("/api/sheets/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sheet_id: sheetId, aba_nome: abaNome }),
    });
    const data = await res.json();
    if (data.ok) {
      toast.success(`Conexão OK! Colunas: ${data.primeira_linha?.join(", ") || "(sem cabeçalho)"}`);
      if (data.primeira_linha?.length) {
        setImportText((data.primeira_linha as string[]).map((name: string, i: number) => `${colLetter(i)}: ${name}`).join(";"));
        setShowImporter(true);
      }
    } else {
      toast.error(data.erro ?? "Falha na conexão");
    }
  } catch { toast.error("Erro de rede."); }
}

// ── Pre-Consulta form ─────────────────────────────────────────────────────────

function PreConsultaForm({ clinicaId, existingFonte, onSuccess, onCancel }: Omit<Props, "tipo">) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting]       = useState(false);
  const [importText, setImportText]     = useState("");
  const [showImporter, setShowImporter] = useState(false);
  const m = existingFonte ? getMapeamento(existingFonte.mapeamento) : {};

  const form = useForm<PreConsultaFormValues>({
    resolver: zodResolver(preConsultaSchema),
    defaultValues: {
      sheet_id:    existingFonte?.sheet_id ?? "",
      aba_nome:    existingFonte?.aba_nome ?? "Respostas ao formulário 1",
      coluna_data: existingFonte?.coluna_data ?? "",
      motivo:      m.motivo ?? "",
      origem:      m.origem ?? "",
    },
  });

  const errors = form.formState.errors;

  async function testConnection() {
    setIsTesting(true);
    await testSheetConnection(form.getValues("sheet_id"), form.getValues("aba_nome"), setImportText, setShowImporter);
    setIsTesting(false);
  }

  function applyDetection() {
    const cols = parseColumnText(importText);
    const detected = detectPreConsulta(cols);
    let filled = 0;
    for (const [key, val] of Object.entries(detected)) {
      if (val) { form.setValue(key as keyof PreConsultaFormValues, val, { shouldValidate: true }); filled++; }
    }
    toast.success(filled ? `${filled} campo(s) preenchido(s).` : "Nenhum campo reconhecido automaticamente.");
    if (filled) setShowImporter(false);
  }

  async function onSubmit(data: PreConsultaFormValues) {
    setIsSubmitting(true);
    const result = await upsertFonte(clinicaId, "pre_consulta", data);
    setIsSubmitting(false);
    if (result.error) { toast.error(result.error); }
    else { toast.success("Fonte configurada."); onSuccess(); }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <FormBase form={form} errors={errors as Record<string, { message?: string }>}
        onTest={testConnection} isTesting={isTesting} />
      <Separator />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionLabel>Mapeamento de colunas</SectionLabel>
          <button type="button" onClick={() => setShowImporter((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            {showImporter ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}Importar
          </button>
        </div>
        {showImporter && (
          <ColImporter value={importText} onChange={setImportText}
            onApply={applyDetection} onClose={() => setShowImporter(false)} />
        )}
        <div className="grid grid-cols-2 gap-4">
          <ColInput id="motivo" label="Motivo da consulta"
            {...form.register("motivo")} error={errors.motivo?.message} />
          <ColInput id="origem" label="Origem / captação"
            {...form.register("origem")} error={errors.origem?.message} />
        </div>
      </div>
      <FormFooter isSubmitting={isSubmitting} onCancel={onCancel} />
    </form>
  );
}

// ── NPS form ──────────────────────────────────────────────────────────────────

function NpsForm({ clinicaId, existingFonte, onSuccess, onCancel }: Omit<Props, "tipo">) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting]       = useState(false);
  const [importText, setImportText]     = useState("");
  const [showImporter, setShowImporter] = useState(false);
  const m = existingFonte ? getMapeamento(existingFonte.mapeamento) : {};

  const form = useForm<NpsFormValues>({
    resolver: zodResolver(npsSchema),
    defaultValues: {
      sheet_id:            existingFonte?.sheet_id ?? "",
      aba_nome:            existingFonte?.aba_nome ?? "Respostas ao formulário 1",
      coluna_data:         existingFonte?.coluna_data ?? "",
      nota_geral:          m.nota_geral ?? "",
      nota_profissional:   m.nota_profissional ?? "",
      nota_recepcao:       m.nota_recepcao ?? "",
      nota_infraestrutura: m.nota_infraestrutura ?? "",
      nota_enfermagem:     m.nota_enfermagem ?? "",
      comentario:          m.comentario ?? "",
      nome_paciente:       m.nome_paciente ?? "",
      anonimato:           m.anonimato ?? "",
      indicacao:           m.indicacao ?? "",
    },
  });

  const errors = form.formState.errors;

  async function testConnection() {
    setIsTesting(true);
    await testSheetConnection(form.getValues("sheet_id"), form.getValues("aba_nome"), setImportText, setShowImporter);
    setIsTesting(false);
  }

  function applyDetection() {
    const cols = parseColumnText(importText);
    const detected = detectNps(cols);
    let filled = 0;
    for (const [key, val] of Object.entries(detected)) {
      if (val) { form.setValue(key as keyof NpsFormValues, val, { shouldValidate: true }); filled++; }
    }
    toast.success(filled ? `${filled} campo(s) preenchido(s).` : "Nenhum campo reconhecido automaticamente.");
    if (filled) setShowImporter(false);
  }

  async function onSubmit(data: NpsFormValues) {
    setIsSubmitting(true);
    const result = await upsertFonte(clinicaId, "nps", data);
    setIsSubmitting(false);
    if (result.error) { toast.error(result.error); }
    else { toast.success("Fonte configurada."); onSuccess(); }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <FormBase form={form} errors={errors as Record<string, { message?: string }>}
        onTest={testConnection} isTesting={isTesting} />
      <Separator />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionLabel>Mapeamento de colunas</SectionLabel>
          <button type="button" onClick={() => setShowImporter((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            {showImporter ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}Importar
          </button>
        </div>
        {showImporter && (
          <ColImporter value={importText} onChange={setImportText}
            onApply={applyDetection} onClose={() => setShowImporter(false)} />
        )}
        <div className="grid grid-cols-2 gap-4">
          <ColInput id="nota_geral"          label="Nota geral" required   {...form.register("nota_geral")}          error={errors.nota_geral?.message} />
          <ColInput id="nota_profissional"   label="Nota profissional"      {...form.register("nota_profissional")}   error={errors.nota_profissional?.message} />
          <ColInput id="nota_recepcao"       label="Nota recepção"          {...form.register("nota_recepcao")}       error={errors.nota_recepcao?.message} />
          <ColInput id="nota_infraestrutura" label="Nota infraestrutura"    {...form.register("nota_infraestrutura")} error={errors.nota_infraestrutura?.message} />
          <ColInput id="nota_enfermagem"     label="Nota enfermagem"        {...form.register("nota_enfermagem")}     error={errors.nota_enfermagem?.message} />
          <ColInput id="comentario"          label="Comentário"             {...form.register("comentario")}          error={errors.comentario?.message} />
          <ColInput id="nome_paciente"       label="Nome do paciente"       {...form.register("nome_paciente")}       error={errors.nome_paciente?.message} />
          <ColInput id="anonimato"           label="Anonimato (opcional)"   {...form.register("anonimato")}           error={errors.anonimato?.message} />
          <ColInput id="indicacao"           label="Indicação (opcional)"   {...form.register("indicacao")}           error={errors.indicacao?.message} />
        </div>
      </div>
      <FormFooter isSubmitting={isSubmitting} onCancel={onCancel} />
    </form>
  );
}

// ── Leads form ────────────────────────────────────────────────────────────────

function LeadsForm({ clinicaId, existingFonte, onSuccess, onCancel }: Omit<Props, "tipo">) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting]       = useState(false);
  const [importText, setImportText]     = useState("");
  const [showImporter, setShowImporter] = useState(false);
  const m = existingFonte ? getMapeamento(existingFonte.mapeamento) : {};

  const form = useForm<LeadsFormValues>({
    resolver: zodResolver(leadsSchema),
    defaultValues: {
      sheet_id:        existingFonte?.sheet_id ?? "",
      aba_nome:        existingFonte?.aba_nome ?? "Respostas ao formulário 1",
      coluna_data:     existingFonte?.coluna_data ?? "",
      convertido:      m.convertido ?? "",
      valor_conversao: m.valor_conversao ?? "sim",
      linha_inicial:   Number(m.linha_inicial ?? 2),
    },
  });

  const errors = form.formState.errors;

  async function testConnection() {
    setIsTesting(true);
    await testSheetConnection(form.getValues("sheet_id"), form.getValues("aba_nome"), setImportText, setShowImporter);
    setIsTesting(false);
  }

  function applyDetection() {
    const cols = parseColumnText(importText);
    const detected = detectLeads(cols);
    let filled = 0;
    for (const [key, val] of Object.entries(detected)) {
      if (val) { form.setValue(key as keyof LeadsFormValues, val, { shouldValidate: true }); filled++; }
    }
    toast.success(filled ? `${filled} campo(s) preenchido(s).` : "Nenhum campo reconhecido automaticamente.");
    if (filled) setShowImporter(false);
  }

  async function onSubmit(data: LeadsFormValues) {
    setIsSubmitting(true);
    const result = await upsertFonte(clinicaId, "leads", data);
    setIsSubmitting(false);
    if (result.error) { toast.error(result.error); }
    else { toast.success("Fonte configurada."); onSuccess(); }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <FormBase form={form} errors={errors as Record<string, { message?: string }>}
        onTest={testConnection} isTesting={isTesting} />
      <Separator />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionLabel>Mapeamento de colunas</SectionLabel>
          <button type="button" onClick={() => setShowImporter((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            {showImporter ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}Importar
          </button>
        </div>
        {showImporter && (
          <ColImporter value={importText} onChange={setImportText}
            onApply={applyDetection} onClose={() => setShowImporter(false)} />
        )}
        <div className="grid grid-cols-2 gap-4">
          <ColInput id="convertido" label="Convertido / Status" {...form.register("convertido")} error={errors.convertido?.message} />
          <div className="space-y-1.5">
            <Label htmlFor="valor_conversao">
              Valor que indica conversão
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">(texto)</span>
            </Label>
            <Input id="valor_conversao" {...form.register("valor_conversao")}
              placeholder="sim" className="text-sm" />
            <p className="text-xs text-muted-foreground">
              Qualquer célula que <em>contenha</em> este texto (sem acento, sem maiúscula) conta como convertido.
              Ex: &quot;sim&quot; captura &quot;Sim&quot;, &quot;SIM&quot;, &quot;Simulado&quot;.
            </p>
            {errors.valor_conversao && <p className="text-xs text-destructive">{errors.valor_conversao.message}</p>}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="linha_inicial">
            Linha inicial dos dados
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">(número)</span>
          </Label>
          <Input
            id="linha_inicial"
            type="number"
            min={1}
            className="w-24"
            {...form.register("linha_inicial", { valueAsNumber: true })}
          />
          <p className="text-xs text-muted-foreground">
            Linha da planilha onde começam os dados (padrão: 2).
            Use 3 se a planilha tem um título mesclado antes do cabeçalho.
          </p>
          {errors.linha_inicial && <p className="text-xs text-destructive">{String(errors.linha_inicial.message)}</p>}
        </div>
      </div>
      <FormFooter isSubmitting={isSubmitting} onCancel={onCancel} />
    </form>
  );
}

// ── Faturamento form ──────────────────────────────────────────────────────────

function FaturamentoForm({ clinicaId, existingFonte, onSuccess, onCancel }: Omit<Props, "tipo">) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting]       = useState(false);
  const [importText, setImportText]     = useState("");
  const [showImporter, setShowImporter] = useState(false);
  const m = existingFonte ? getMapeamento(existingFonte.mapeamento) : {};

  const form = useForm<FaturamentoFormValues>({
    resolver: zodResolver(faturamentoSchema),
    defaultValues: {
      sheet_id:      existingFonte?.sheet_id ?? "",
      aba_nome:      existingFonte?.aba_nome ?? "",
      coluna_data:   existingFonte?.coluna_data ?? "",
      categoria:     m.categoria    ?? "",
      valor_pago:    m.valor_pago   ?? "",
      profissional:  m.profissional ?? "",
      linha_inicial: Number(m.linha_inicial ?? 2),
    },
  });

  const errors = form.formState.errors;

  async function testConnection() {
    setIsTesting(true);
    await testSheetConnection(form.getValues("sheet_id"), form.getValues("aba_nome"), setImportText, setShowImporter);
    setIsTesting(false);
  }

  function applyDetection() {
    const cols = parseColumnText(importText);
    const detected = detectFaturamento(cols);
    let filled = 0;
    for (const [key, val] of Object.entries(detected)) {
      if (val) { form.setValue(key as keyof FaturamentoFormValues, val, { shouldValidate: true }); filled++; }
    }
    toast.success(filled ? `${filled} campo(s) preenchido(s).` : "Nenhum campo reconhecido automaticamente.");
    if (filled) setShowImporter(false);
  }

  async function onSubmit(data: FaturamentoFormValues) {
    setIsSubmitting(true);
    const result = await upsertFonte(clinicaId, "faturamento", data);
    setIsSubmitting(false);
    if (result.error) { toast.error(result.error); }
    else { toast.success("Fonte configurada."); onSuccess(); }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <FormBase form={form} errors={errors as Record<string, { message?: string }>}
        onTest={testConnection} isTesting={isTesting} />
      <Separator />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionLabel>Mapeamento de colunas</SectionLabel>
          <button type="button" onClick={() => setShowImporter((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            {showImporter ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}Importar
          </button>
        </div>
        {showImporter && (
          <ColImporter value={importText} onChange={setImportText}
            onApply={applyDetection} onClose={() => setShowImporter(false)} />
        )}
        <div className="grid grid-cols-2 gap-4">
          <ColInput id="fat_categoria"   label="Categoria" required {...form.register("categoria")}   error={errors.categoria?.message} />
          <ColInput id="fat_valor_pago"  label="Valor pago" required {...form.register("valor_pago")}  error={errors.valor_pago?.message} />
          <ColInput id="fat_profissional" label="Profissional" {...form.register("profissional")} error={errors.profissional?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fat_linha_inicial">
            Linha inicial dos dados
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">(número)</span>
          </Label>
          <Input id="fat_linha_inicial" type="number" min={1} className="w-24"
            {...form.register("linha_inicial", { valueAsNumber: true })} />
          <p className="text-xs text-muted-foreground">
            Linha da planilha onde começam os dados (padrão: 2).
            Use 3 se há título mesclado antes do cabeçalho.
          </p>
          {errors.linha_inicial && <p className="text-xs text-destructive">{String(errors.linha_inicial.message)}</p>}
        </div>
      </div>
      <FormFooter isSubmitting={isSubmitting} onCancel={onCancel} />
    </form>
  );
}

// ── Despesa form ──────────────────────────────────────────────────────────────

function DespesaForm({ clinicaId, existingFonte, onSuccess, onCancel }: Omit<Props, "tipo">) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting]       = useState(false);
  const [importText, setImportText]     = useState("");
  const [showImporter, setShowImporter] = useState(false);
  const m = existingFonte ? getMapeamento(existingFonte.mapeamento) : {};

  const form = useForm<DespesaFormValues>({
    resolver: zodResolver(despesaSchema),
    defaultValues: {
      sheet_id:      existingFonte?.sheet_id ?? "",
      aba_nome:      existingFonte?.aba_nome ?? "",
      coluna_data:   existingFonte?.coluna_data ?? "",
      categoria:     m.categoria  ?? "",
      valor_pago:    m.valor_pago ?? "",
      linha_inicial: Number(m.linha_inicial ?? 2),
    },
  });

  const errors = form.formState.errors;

  async function testConnection() {
    setIsTesting(true);
    await testSheetConnection(form.getValues("sheet_id"), form.getValues("aba_nome"), setImportText, setShowImporter);
    setIsTesting(false);
  }

  function applyDetection() {
    const cols = parseColumnText(importText);
    const detected = detectDespesa(cols);
    let filled = 0;
    for (const [key, val] of Object.entries(detected)) {
      if (val) { form.setValue(key as keyof DespesaFormValues, val, { shouldValidate: true }); filled++; }
    }
    toast.success(filled ? `${filled} campo(s) preenchido(s).` : "Nenhum campo reconhecido automaticamente.");
    if (filled) setShowImporter(false);
  }

  async function onSubmit(data: DespesaFormValues) {
    setIsSubmitting(true);
    const result = await upsertFonte(clinicaId, "despesa", data);
    setIsSubmitting(false);
    if (result.error) { toast.error(result.error); }
    else { toast.success("Fonte configurada."); onSuccess(); }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <FormBase form={form} errors={errors as Record<string, { message?: string }>}
        onTest={testConnection} isTesting={isTesting} />
      <Separator />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionLabel>Mapeamento de colunas</SectionLabel>
          <button type="button" onClick={() => setShowImporter((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            {showImporter ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}Importar
          </button>
        </div>
        {showImporter && (
          <ColImporter value={importText} onChange={setImportText}
            onApply={applyDetection} onClose={() => setShowImporter(false)} />
        )}
        <div className="grid grid-cols-2 gap-4">
          <ColInput id="desp_categoria"  label="Categoria" required {...form.register("categoria")}  error={errors.categoria?.message} />
          <ColInput id="desp_valor_pago" label="Valor pago" required {...form.register("valor_pago")} error={errors.valor_pago?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="desp_linha_inicial">
            Linha inicial dos dados
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">(número)</span>
          </Label>
          <Input id="desp_linha_inicial" type="number" min={1} className="w-24"
            {...form.register("linha_inicial", { valueAsNumber: true })} />
          <p className="text-xs text-muted-foreground">
            Linha da planilha onde começam os dados (padrão: 2).
            Use 3 se há título mesclado antes do cabeçalho.
          </p>
          {errors.linha_inicial && <p className="text-xs text-destructive">{String(errors.linha_inicial.message)}</p>}
        </div>
      </div>
      <FormFooter isSubmitting={isSubmitting} onCancel={onCancel} />
    </form>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────

export function FonteForm(props: Props) {
  if (props.tipo === "pre_consulta") return <PreConsultaForm {...props} />;
  if (props.tipo === "nps")          return <NpsForm {...props} />;
  if (props.tipo === "leads")        return <LeadsForm {...props} />;
  if (props.tipo === "faturamento")  return <FaturamentoForm {...props} />;
  return <DespesaForm {...props} />;
}
