"use client";

import { useState } from "react";
import { format, subDays, subWeeks, startOfWeek, endOfWeek } from "date-fns";
import {
  FileText, Copy, Check, ChevronDown, ChevronUp,
  Loader2, AlertTriangle, Plus, Trash2,
  ExternalLink, Download, Image as ImageIcon, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  gerarRelatorioWhatsapp, prepararDadosImagem, salvarRelatorioImagem,
} from "../actions";
import { SEPARATOR } from "@/lib/relatorio/montar-whatsapp";
import type { Clinica } from "@/lib/supabase/types";
import type {
  RelatorioImagemData, DestaqueItem, TipoDestaque,
  FaturamentoVisao, NpsGoogleVisao,
} from "@/lib/relatorio/imagem-tipos";

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Preset  = "semana_passada" | "ultimos7" | "custom";
type Formato = "whatsapp_pesquisas" | "whatsapp_metas" | "imagem";

interface ResultadoClinica {
  clinicaId:  string;
  clinicaNome: string;
  texto:       string;
  erros:       string[];
  imagemId?:   string;
  imagemUrl?:  string;
  imagemDados?: RelatorioImagemData;
}

// ─── Datas ────────────────────────────────────────────────────────────────────
function semanaPassada()  { const t=new Date(),l=subWeeks(t,1); return { ini:format(startOfWeek(l,{weekStartsOn:1}),"yyyy-MM-dd"), fim:format(endOfWeek(l,{weekStartsOn:1}),"yyyy-MM-dd") }; }
function ultimos7Dias()   { const t=new Date(); return { ini:format(subDays(t,6),"yyyy-MM-dd"), fim:format(t,"yyyy-MM-dd") }; }

const PRESET_LABELS: Record<Preset,string> = { semana_passada:"Semana passada (seg–dom)", ultimos7:"Últimos 7 dias", custom:"Personalizado" };

const FORMATO_OPTIONS: {value:Formato;label:string}[] = [
  {value:"whatsapp_pesquisas",label:"WhatsApp — Pesquisas"},
  {value:"whatsapp_metas",    label:"WhatsApp — Metas"},
  {value:"imagem",            label:"Imagem (infográfico)"},
];

// ─── CopyButton ───────────────────────────────────────────────────────────────
function CopyButton({text,label="Copiar"}:{text:string;label?:string}) {
  const [copied,setCopied]=useState(false);
  return (
    <Button variant="outline" size="sm" className="gap-2 shrink-0"
      onClick={async()=>{await navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),2000);}}>
      {copied?<Check className="h-3.5 w-3.5 text-emerald-500"/>:<Copy className="h-3.5 w-3.5"/>}
      {copied?"Copiado!":label}
    </Button>
  );
}

// ─── Lista editável ───────────────────────────────────────────────────────────
function ListaEditavel({items,onChange,placeholder}:{items:string[];onChange:(v:string[])=>void;placeholder?:string}) {
  return (
    <div className="space-y-2">
      {items.map((item,i)=>(
        <div key={i} className="flex gap-2">
          <Input value={item} onChange={e=>{const n=[...items];n[i]=e.target.value;onChange(n);}} placeholder={placeholder} className="text-sm"/>
          <Button type="button" variant="ghost" size="sm" onClick={()=>onChange(items.filter((_,j)=>j!==i))} className="shrink-0 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5"/></Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={()=>onChange([...items,""])} className="gap-1.5"><Plus className="h-3.5 w-3.5"/>Adicionar</Button>
    </div>
  );
}

// ─── Lista de destaques ───────────────────────────────────────────────────────
const TIPO_LABELS:Record<TipoDestaque,string>={positivo:"✓ Positivo",atencao:"⚠ Atenção",financeiro:"$ Financeiro"};
function ListaDestaques({items,onChange}:{items:DestaqueItem[];onChange:(v:DestaqueItem[])=>void}) {
  return (
    <div className="space-y-2">
      {items.map((item,i)=>(
        <div key={i} className="flex gap-2 items-center">
          <Select value={item.tipo} onValueChange={v=>{const n=[...items];n[i]={...n[i],tipo:v as TipoDestaque};onChange(n);}}>
            <SelectTrigger className="w-36 shrink-0"><SelectValue/></SelectTrigger>
            <SelectContent>{(Object.keys(TIPO_LABELS) as TipoDestaque[]).map(t=><SelectItem key={t} value={t}>{TIPO_LABELS[t]}</SelectItem>)}</SelectContent>
          </Select>
          <Input value={item.texto} onChange={e=>{const n=[...items];n[i]={...n[i],texto:e.target.value};onChange(n);}} placeholder="Texto do destaque…" className="text-sm"/>
          <Button type="button" variant="ghost" size="sm" onClick={()=>onChange(items.filter((_,j)=>j!==i))} className="shrink-0 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5"/></Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={()=>onChange([...items,{tipo:"positivo",texto:""}])} className="gap-1.5"><Plus className="h-3.5 w-3.5"/>Adicionar destaque</Button>
    </div>
  );
}

// ─── Helpers para % calculado a partir de strings formatadas BR ──────────────
function parseFmtNum(s: string): number | null {
  if (!s || s === "N/A" || s === "—") return null;
  const n = parseFloat(s.replace(/R\$\s*/g, "").replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? null : n;
}
function calcPct(num: number | string | null | undefined, den: number | string | null | undefined): number | null {
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

// ─── Formulário de dados do infográfico ───────────────────────────────────────
function FormImagem({dados,onChange}:{dados:RelatorioImagemData;onChange:(d:RelatorioImagemData)=>void}) {
  const {visaoGeral,destaques,alertas,acoes}=dados;
  const fat=visaoGeral.faturamento,ng=visaoGeral.npsGoogle,com=visaoGeral.comercial;

  function onFatChange(patch: Partial<FaturamentoVisao>) {
    const newFat={...fat,...patch};
    const pctPeriodo=calcPct(newFat.acumulado, newFat.meta_periodo);
    const pctMensal=calcPct(newFat.acumulado, newFat.meta_mensal);
    onChange({...dados,visaoGeral:{...visaoGeral,faturamento:{
      ...newFat,
      pct_periodo: pctPeriodo,
      acima_periodo: (pctPeriodo??0)>=100,
      pct_mensal: pctMensal,
      acima_mensal: (pctMensal??0)>=100,
    }}});
  }

  function onNgChange(patch: Partial<NpsGoogleVisao>) {
    onChange({...dados,visaoGeral:{...visaoGeral,npsGoogle:{...ng,...patch}}});
  }

  const pctNps=calcPct(ng.respostas_nps, ng.meta_nps_meta);
  const pctGoogle=calcPct(ng.avaliacoes_google, ng.meta_google_meta);

  const FAT_FIELDS:[keyof FaturamentoVisao,string][]=[
    ["realizado_semana","Realizado semanal"],
    ["acumulado","Acumulado"],
    ["meta_periodo","Meta do período"],
    ["meta_mensal","Meta mensal"],
  ];

  return (
    <div className="space-y-6">
      {/* Faturamento */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Faturamento x Meta</h3>
        <div className="grid grid-cols-2 gap-3">
          {FAT_FIELDS.map(([k,l])=>(
            <div key={k} className="space-y-1"><Label className="text-xs">{l}</Label>
              <Input value={(fat as unknown as Record<string,string>)[k]??""}
                onChange={e=>onFatChange({[k]:e.target.value} as Partial<FaturamentoVisao>)} className="text-sm"/>
            </div>
          ))}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">% do período (auto)</Label>
            <ReadOnlyPct value={fat.pct_periodo}/>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">% da meta mensal (auto)</Label>
            <ReadOnlyPct value={fat.pct_mensal}/>
          </div>
        </div>
      </div>

      {/* NPS / Google */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">NPS / Google</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label className="text-xs">Respostas NPS</Label>
            <Input type="number" value={ng.respostas_nps??""} placeholder="—"
              onChange={e=>onNgChange({respostas_nps:e.target.value===""?null:Number(e.target.value)})} className="text-sm"/>
          </div>
          <div className="space-y-1"><Label className="text-xs">Avaliações Google</Label>
            <Input type="number" value={ng.avaliacoes_google??""} placeholder="—"
              onChange={e=>onNgChange({avaliacoes_google:e.target.value===""?null:Number(e.target.value)})} className="text-sm"/>
          </div>
          <div className="space-y-1"><Label className="text-xs">Meta NPS (alvo)</Label>
            <Input type="number" value={ng.meta_nps_meta??""} placeholder="—"
              onChange={e=>onNgChange({meta_nps_meta:e.target.value===""?null:Number(e.target.value)})} className="text-sm"/>
          </div>
          <div className="space-y-1"><Label className="text-xs">Meta Google (alvo)</Label>
            <Input type="number" value={ng.meta_google_meta??""} placeholder="—"
              onChange={e=>onNgChange({meta_google_meta:e.target.value===""?null:Number(e.target.value)})} className="text-sm"/>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">% NPS (auto)</Label>
            <ReadOnlyPct value={pctNps}/>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">% Google (auto)</Label>
            <ReadOnlyPct value={pctGoogle}/>
          </div>
        </div>
      </div>

      {/* Comercial */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Comercial &amp; Conversão</h3>
        <div className="grid grid-cols-2 gap-3">
          {(["conversao_leads","conversao_orcamentos","total_leads","total_orcamentos"] as (keyof typeof com)[]).map(k=>(
            <div key={k} className="space-y-1"><Label className="text-xs">{k.replace(/_/g," ")}</Label>
              <Input value={(com as unknown as Record<string,unknown>)[k] as string??""} placeholder="N/A"
                onChange={e=>onChange({...dados,visaoGeral:{...visaoGeral,comercial:{...com,[k]:e.target.value}}})} className="text-sm"/>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3"><h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Principais Destaques</h3><ListaDestaques items={destaques} onChange={v=>onChange({...dados,destaques:v})}/></div>
      <div className="space-y-3"><h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Alertas</h3><ListaEditavel items={alertas} onChange={v=>onChange({...dados,alertas:v})} placeholder="Texto do alerta…"/></div>
      <div className="space-y-3"><h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Ações Sugeridas</h3><ListaEditavel items={acoes} onChange={v=>onChange({...dados,acoes:v})} placeholder="Texto da ação…"/></div>
    </div>
  );
}

// ─── Resultado WhatsApp (por clínica) ─────────────────────────────────────────
function ResultadoWhatsapp({resultado}:{resultado:ResultadoClinica}) {
  const blocos = resultado.texto.split(SEPARATOR).map(b=>b.trim()).filter(Boolean);
  if (!blocos.length) return null;
  return (
    <div className="space-y-3">
      {resultado.erros.map((e,i)=>(
        <div key={i} className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:border-yellow-800/50 dark:bg-yellow-900/20 dark:text-yellow-400">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0"/>{e}
        </div>
      ))}
      <div className="flex justify-end"><CopyButton text={resultado.texto} label="Copiar tudo"/></div>
      {blocos.map((bloco,i)=>(
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-muted-foreground font-medium">Bloco {i+1} de {blocos.length}</CardTitle>
              <CopyButton text={bloco} label="Copiar este bloco"/>
            </div>
          </CardHeader>
          <CardContent><pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed bg-muted/50 rounded-md p-4">{bloco}</pre></CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Resultado Imagem (por clínica) ──────────────────────────────────────────
function ResultadoImagem({
  resultado, clinicaId, datas, onUpdate,
}:{
  resultado:ResultadoClinica;
  clinicaId:string;
  datas:{ini:string;fim:string};
  onUpdate:(r:ResultadoClinica)=>void;
}) {
  const [saving,setSaving]=useState(false);
  const dados=resultado.imagemDados;
  if(!dados) return null;

  async function handleGerar() {
    setSaving(true);
    try {
      const {id}=await salvarRelatorioImagem({clinicaId,ini:datas.ini,fim:datas.fim,dados:dados!,relatorioId:resultado.imagemId});
      onUpdate({...resultado,imagemId:id,imagemUrl:`/api/relatorio-imagem/${id}?t=${Date.now()}`});
    } finally {setSaving(false);}
  }

  return (
    <div className="space-y-4">
      {resultado.erros.map((e,i)=>(
        <div key={i} className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:border-yellow-800/50 dark:bg-yellow-900/20 dark:text-yellow-400">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0"/>{e}
        </div>
      ))}
      <FormImagem dados={dados} onChange={d=>onUpdate({...resultado,imagemDados:d})}/>
      <Separator/>
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={handleGerar} disabled={saving} className="gap-2">
          {saving?<Loader2 className="h-4 w-4 animate-spin"/>:<ImageIcon className="h-4 w-4"/>}
          {saving?"Gerando…":"Gerar imagem"}
        </Button>
        {resultado.imagemUrl&&(<>
          <Button variant="outline" size="sm" asChild className="gap-1.5"><a href={resultado.imagemUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5"/>Abrir</a></Button>
          <Button variant="outline" size="sm" asChild className="gap-1.5"><a href={resultado.imagemUrl} download={`relatorio-${resultado.imagemId}.png`}><Download className="h-3.5 w-3.5"/>Baixar PNG</a></Button>
        </>)}
      </div>
      {resultado.imagemUrl&&(
        <div className="rounded-lg overflow-hidden border bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resultado.imagemUrl} alt="Preview" className="w-full max-w-sm mx-auto block"/>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function RelatorioClient({clinicas}:{clinicas:Clinica[]}) {
  // ── Seleção de clínicas ──
  const [comparar,setComparar]=useState(false);
  const [clinicaId,setClinicaId]=useState(clinicas[0]?.id??"");
  const [clinicasSel,setClinicasSel]=useState<Set<string>>(new Set());

  // ── Período ──
  const [preset,setPreset]=useState<Preset>("semana_passada");
  const [customIni,setCustomIni]=useState(format(new Date(),"yyyy-MM-dd"));
  const [customFim,setCustomFim]=useState(format(new Date(),"yyyy-MM-dd"));

  // ── Formato ──
  const [formato,setFormato]=useState<Formato>("whatsapp_pesquisas");

  // ── Google fallback ──
  const [googleManual,setGoogleManual]=useState("");
  const [showGoogleManual,setShowGoogleManual]=useState(false);

  // ── Estado de resultados ──
  const [resultados,setResultados]=useState<ResultadoClinica[]>([]);
  const [isGenerating,setIsGenerating]=useState(false);
  const [activeTab,setActiveTab]=useState<string>("");

  function getDatas():{ini:string;fim:string} {
    if(preset==="semana_passada") return semanaPassada();
    if(preset==="ultimos7")       return ultimos7Dias();
    return {ini:customIni,fim:customFim};
  }

  function toggleClinica(id:string) {
    setClinicasSel(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});
  }

  // IDs efetivos para geração
  function getIdsParaGerar():string[] {
    if(!comparar) return clinicaId?[clinicaId]:[];
    return clinicas.filter(c=>clinicasSel.has(c.id)).map(c=>c.id);
  }

  async function handleGerar() {
    const ids=getIdsParaGerar();
    if(!ids.length) return;
    const datas=getDatas();
    setIsGenerating(true);
    setResultados([]);

    try {
      if(formato==="imagem") {
        // Para imagem: coletar dados em paralelo
        const tasks=ids.map(id=>{
          const clinica=clinicas.find(c=>c.id===id)!;
          return prepararDadosImagem({clinicaId:id,ini:datas.ini,fim:datas.fim})
            .then(({dados,erros}):ResultadoClinica=>({clinicaId:id,clinicaNome:clinica.nome,texto:"",erros,imagemDados:dados}));
        });
        const res=await Promise.all(tasks);
        setResultados(res);
        if(res.length) setActiveTab(res[0].clinicaId);
      } else {
        // WhatsApp: gerar em paralelo
        const tasks=ids.map(id=>{
          const clinica=clinicas.find(c=>c.id===id)!;
          return gerarRelatorioWhatsapp({clinicaId:id,ini:datas.ini,fim:datas.fim,formato,googleManual:googleManual||undefined})
            .then(({texto,erros}):ResultadoClinica=>({clinicaId:id,clinicaNome:clinica.nome,texto,erros}));
        });
        const res=await Promise.all(tasks);
        setResultados(res);
        if(res.length) setActiveTab(res[0].clinicaId);
        // auto-abrir Google fallback se a primeira clínica falhou
        if(res.some(r=>r.erros.some(e=>e.startsWith("Google:")))) setShowGoogleManual(true);
      }
    } finally {
      setIsGenerating(false);
    }
  }

  // Copiar tudo multi-clínica para WhatsApp
  function textoGlobalWhatsapp():string {
    return resultados.map(r=>`===== ${r.clinicaNome} =====\n\n${r.texto}`).join("\n\n");
  }

  // Baixar todas as imagens (abre abas)
  function abrirTodasImagens() {
    resultados.filter(r=>r.imagemUrl).forEach(r=>window.open(r.imagemUrl,"_blank"));
  }

  const idsParaGerar=getIdsParaGerar();
  const podGerar=idsParaGerar.length>0&&!isGenerating;
  const modoComparativo=comparar&&resultados.length>1;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold font-heading">Gerar Report Semanal</h1>

      {/* ── Form ── */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Configurações</CardTitle>
            <Button type="button" variant={comparar?"default":"outline"} size="sm" onClick={()=>{setComparar(v=>!v);setClinicasSel(new Set());}} className="gap-1.5">
              <Users className="h-3.5 w-3.5"/>Comparar clínicas
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Seleção de clínica */}
          {!comparar?(
            <div className="space-y-1.5">
              <Label>Clínica</Label>
              <Select value={clinicaId} onValueChange={setClinicaId}>
                <SelectTrigger className="w-80"><SelectValue placeholder="Selecione a clínica"/></SelectTrigger>
                <SelectContent>{clinicas.map(c=><SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ):(
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Clínicas ({clinicasSel.size} selecionadas)</Label>
                <Button type="button" variant="ghost" size="sm" className="text-xs h-7"
                  onClick={()=>setClinicasSel(clinicasSel.size===clinicas.length?new Set():new Set(clinicas.map(c=>c.id)))}>
                  {clinicasSel.size===clinicas.length?"Desmarcar todas":"Selecionar todas"}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {clinicas.map(c=>(
                  <label key={c.id} className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors">
                    <input type="checkbox" checked={clinicasSel.has(c.id)} onChange={()=>toggleClinica(c.id)} className="rounded"/>
                    <span className="text-sm truncate">{c.nome}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Período */}
          <div className="space-y-2">
            <Label>Período</Label>
            <div className="flex flex-wrap gap-2">
              {(["semana_passada","ultimos7","custom"] as Preset[]).map(p=>(
                <Button key={p} type="button" variant={preset===p?"default":"outline"} size="sm" onClick={()=>setPreset(p)}>{PRESET_LABELS[p]}</Button>
              ))}
            </div>
            {preset==="custom"&&(
              <div className="flex items-end gap-3 pt-1">
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">De</Label><Input type="date" value={customIni} onChange={e=>setCustomIni(e.target.value)} className="w-40"/></div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Até</Label><Input type="date" value={customFim} onChange={e=>setCustomFim(e.target.value)} className="w-40"/></div>
              </div>
            )}
          </div>

          {/* Formato */}
          <div className="space-y-2">
            <Label>Formato</Label>
            <div className="flex flex-wrap gap-2">
              {FORMATO_OPTIONS.map(f=>(
                <Button key={f.value} type="button" variant={formato===f.value?"default":"outline"} size="sm" onClick={()=>setFormato(f.value)}>
                  {f.value==="imagem"&&<ImageIcon className="h-3.5 w-3.5 mr-1.5"/>}{f.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Google fallback */}
          {formato==="whatsapp_pesquisas"&&(
            <div className="space-y-2">
              <button type="button" onClick={()=>setShowGoogleManual(v=>!v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                {showGoogleManual?<ChevronUp className="h-3 w-3"/>:<ChevronDown className="h-3 w-3"/>}
                Avaliações Google manuais (fallback)
              </button>
              {showGoogleManual&&(
                <div className="space-y-1.5">
                  <Textarea value={googleManual} onChange={e=>setGoogleManual(e.target.value)}
                    placeholder="Cole aqui as avaliações do Google manualmente…"
                    className="h-24 text-sm resize-none font-mono"/>
                  <p className="text-xs text-muted-foreground">Se preenchido, substitui a busca automática na API do Google.</p>
                </div>
              )}
            </div>
          )}

          <Separator/>

          <Button onClick={handleGerar} disabled={!podGerar} className="gap-2">
            {isGenerating?<Loader2 className="h-4 w-4 animate-spin"/>:<FileText className="h-4 w-4"/>}
            {isGenerating?(formato==="imagem"?"Coletando dados…":"Gerando…"):(formato==="imagem"?"Coletar dados":"Gerar")}
          </Button>
        </CardContent>
      </Card>

      {/* ── Resultados ── */}
      {resultados.length>0&&(
        <div className="space-y-4">
          {/* Ações globais multi-clínica */}
          {modoComparativo&&formato!=="imagem"&&(
            <div className="flex justify-end">
              <CopyButton text={textoGlobalWhatsapp()} label={`Copiar tudo (${resultados.length} clínicas)`}/>
            </div>
          )}
          {modoComparativo&&formato==="imagem"&&resultados.some(r=>r.imagemUrl)&&(
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={abrirTodasImagens} className="gap-1.5">
                <Download className="h-3.5 w-3.5"/>Abrir todas as imagens
              </Button>
            </div>
          )}

          {/* Uma clínica: resultado direto */}
          {!modoComparativo&&resultados[0]&&(
            formato==="imagem"?(
              <Card>
                <CardHeader className="pb-4"><CardTitle className="text-base">Dados do Infográfico</CardTitle></CardHeader>
                <CardContent>
                  <ResultadoImagem
                    resultado={resultados[0]}
                    clinicaId={resultados[0].clinicaId}
                    datas={getDatas()}
                    onUpdate={r=>setResultados([r])}
                  />
                </CardContent>
              </Card>
            ):<ResultadoWhatsapp resultado={resultados[0]}/>
          )}

          {/* Multi-clínica: tabs */}
          {modoComparativo&&(
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="flex-wrap h-auto gap-1">
                {resultados.map(r=>(
                  <TabsTrigger key={r.clinicaId} value={r.clinicaId} className="text-xs">
                    {r.clinicaNome}
                    {r.erros.length>0&&<span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-yellow-400 inline-block"/>}
                  </TabsTrigger>
                ))}
              </TabsList>
              {resultados.map(r=>(
                <TabsContent key={r.clinicaId} value={r.clinicaId} className="mt-4">
                  {formato==="imagem"?(
                    <Card>
                      <CardHeader className="pb-4"><CardTitle className="text-base">Dados do Infográfico — {r.clinicaNome}</CardTitle></CardHeader>
                      <CardContent>
                        <ResultadoImagem
                          resultado={r}
                          clinicaId={r.clinicaId}
                          datas={getDatas()}
                          onUpdate={upd=>setResultados(prev=>prev.map(x=>x.clinicaId===upd.clinicaId?upd:x))}
                        />
                      </CardContent>
                    </Card>
                  ):<ResultadoWhatsapp resultado={r}/>}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      )}
    </div>
  );
}
