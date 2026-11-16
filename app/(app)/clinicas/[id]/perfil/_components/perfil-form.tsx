"use client";

import { useState } from "react";
import { Check, Loader2, AlertTriangle, ClipboardPaste, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CopyButton } from "@/components/copy-button";
import { salvarFicha } from "../actions";
import {
  PORTES, MODELOS, LIMITES, lerFichaGerada, pedidoFicha,
} from "@/lib/perfil/ficha";
import type { FichaCliente, Porte, Modelo } from "@/lib/perfil/ficha";
import {
  SEGMENTOS, CAMPOS_VOCAB, vocabularioDe, cap,
} from "@/lib/perfil/vocabulario";
import type { SegmentoTipo } from "@/lib/perfil/vocabulario";

/** Valor do Select para "nenhum" — o Radix não aceita item com value vazio. */
const NENHUM = "__nenhum__";

function dataHoraBR(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const CAMPOS_TEXTO: {
  k: "perfil" | "prioridades" | "pessoas" | "estilo" | "evitar";
  rotulo: string;
  ajuda: string;
  linhas: number;
}[] = [
  { k: "perfil",      rotulo: "Perfil e posicionamento",        ajuda: "Quem é o cliente, o que o diferencia, momento do negócio.", linhas: 4 },
  { k: "prioridades", rotulo: "Prioridades e metas do momento", ajuda: "O que importa agora: metas, frentes abertas, o que estão tentando resolver.", linhas: 4 },
  { k: "pessoas",     rotulo: "Pessoas e papéis",               ajuda: "Sócios, gestores, equipe e quem cuida do quê.", linhas: 3 },
  { k: "estilo",      rotulo: "Como escrever para este cliente", ajuda: "Tom, tratamento e o que eles valorizam ler.", linhas: 3 },
  { k: "evitar",      rotulo: "Assuntos a evitar",              ajuda: "O que os textos não devem tocar.", linhas: 3 },
];

export function PerfilForm({
  clinicaId, clinicaNome, inicial, jaSalva,
}: {
  clinicaId: string;
  clinicaNome: string;
  inicial: FichaCliente;
  jaSalva: boolean;
}) {
  const [ficha, setFicha] = useState<FichaCliente>(inicial);
  const [salvando, setSalvando] = useState(false);
  const [salvoEm, setSalvoEm] = useState<string | null>(jaSalva ? inicial.atualizadoEm : null);
  const [sujo, setSujo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [colarAberto, setColarAberto] = useState(false);
  const [textoColado, setTextoColado] = useState("");
  const [avisoColar, setAvisoColar] = useState<string | null>(null);

  function mudar(patch: Partial<FichaCliente>) {
    setFicha(prev => ({ ...prev, ...patch }));
    setSujo(true);
  }

  function mudarTermo(chave: string, valor: string) {
    const vocabulario = { ...ficha.vocabulario };
    if (valor.trim()) vocabulario[chave] = valor;
    else delete vocabulario[chave];
    mudar({ vocabulario });
  }

  function aplicarColado() {
    const { ficha: nova, achados } = lerFichaGerada(textoColado, ficha);
    if (achados === 0) {
      setAvisoColar("Não reconheci nenhum título. Confira se a resposta manteve os títulos do pedido (### CIDADE/UF, ### SEGMENTO…).");
      return;
    }
    setFicha(nova);
    setSujo(true);
    setTextoColado("");
    setColarAberto(false);
    setAvisoColar(`${achados} campo${achados !== 1 ? "s" : ""} preenchido${achados !== 1 ? "s" : ""} a partir do texto. Revise e salve.`);
  }

  async function handleSalvar() {
    setSalvando(true);
    setErro(null);
    try {
      const res = await salvarFicha(clinicaId, ficha);
      if (res.ok) {
        setSalvoEm(res.atualizadoEm ?? new Date().toISOString());
        setSujo(false);
      } else {
        setErro(res.erro ?? "Não foi possível salvar.");
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  // Vocabulário efetivo (padrão do segmento + personalizados) — vira placeholder e exemplo
  const vocab = vocabularioDe(ficha);
  const padrao = vocabularioDe({ segmentoTipo: ficha.segmentoTipo, segmento: ficha.segmento });

  return (
    <div className="space-y-6">
      {/* ── Preencher com ajuda de um assistente ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />Preencher com ajuda de um assistente
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Copie o pedido, cole num assistente que já conhece este cliente e traga a resposta
            de volta. Os campos são preenchidos pelos títulos; nada é salvo antes de você revisar.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <CopyButton text={pedidoFicha(clinicaNome)} label="Copiar pedido" />
            <Button type="button" variant="outline" size="sm" className="gap-2"
              onClick={() => { setColarAberto(v => !v); setAvisoColar(null); }}>
              <ClipboardPaste className="h-3.5 w-3.5" />
              {colarAberto ? "Fechar" : "Colar resposta"}
            </Button>
          </div>
          {colarAberto && (
            <div className="space-y-2">
              <Textarea
                id="ficha-colada"
                value={textoColado}
                onChange={e => setTextoColado(e.target.value)}
                placeholder={"### CIDADE/UF\nRio de Janeiro/RJ\n### SEGMENTO (tipo de negócio)\n…"}
                className="text-sm font-mono h-40 resize-y"
              />
              <Button type="button" size="sm" onClick={aplicarColado} disabled={!textoColado.trim()}>
                Preencher campos
              </Button>
            </div>
          )}
          {avisoColar && <p className="text-xs text-muted-foreground">{avisoColar}</p>}
        </CardContent>
      </Card>

      {/* ── Identificação ── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">O negócio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="seg-tipo">Segmento</Label>
              <Select
                value={ficha.segmentoTipo || NENHUM}
                onValueChange={v => mudar({ segmentoTipo: v === NENHUM ? "" : (v as SegmentoTipo) })}
              >
                <SelectTrigger id="seg-tipo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NENHUM}>Não definido</SelectItem>
                  {SEGMENTOS.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.rotulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Define as palavras padrão dos textos.</p>
            </div>
            <div className="grid grid-cols-[1fr_5rem] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cidade">Cidade</Label>
                <Input id="cidade" value={ficha.cidade} maxLength={LIMITES.cidade}
                  onChange={e => mudar({ cidade: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="uf">UF</Label>
                <Input id="uf" value={ficha.uf} maxLength={2}
                  onChange={e => mudar({ uf: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })} />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="segmento">Descrição do negócio</Label>
            <Input id="segmento" value={ficha.segmento} maxLength={LIMITES.segmento}
              placeholder="Ex: Clínica médica especializada em ginecologia integrativa"
              onChange={e => mudar({ segmento: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="especialidades">Áreas de atuação</Label>
            <Textarea id="especialidades" value={ficha.especialidades} maxLength={LIMITES.especialidades}
              rows={2} className="text-sm resize-y"
              placeholder="Especialidades, linhas de serviço ou produto"
              onChange={e => mudar({ especialidades: e.target.value })} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="porte">Porte (faturamento)</Label>
              <Select
                value={ficha.porte || NENHUM}
                onValueChange={v => mudar({ porte: v === NENHUM ? "" : (v as Porte) })}
              >
                <SelectTrigger id="porte"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NENHUM}>Não informado</SelectItem>
                  {(Object.entries(PORTES) as [Porte, string][]).map(([k, rot]) => (
                    <SelectItem key={k} value={k}>{rot}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="modelo">Modelo de negócio</Label>
              <Select
                value={ficha.modelo || NENHUM}
                onValueChange={v => mudar({ modelo: v === NENHUM ? "" : (v as Modelo) })}
              >
                <SelectTrigger id="modelo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NENHUM}>Não informado</SelectItem>
                  {(Object.entries(MODELOS) as [Modelo, string][]).map(([k, rot]) => (
                    <SelectItem key={k} value={k}>{rot}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Vocabulário ── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Vocabulário dos textos</CardTitle>
          <p className="text-sm text-muted-foreground">
            Deixe em branco para usar o padrão do segmento (mostrado em cinza). Preencha só o
            que este cliente chama de outro jeito.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            {CAMPOS_VOCAB.map(({ k, rotulo }) => (
              <div key={k} className="space-y-1.5">
                <Label htmlFor={`vocab-${k}`} className="text-xs">{rotulo}</Label>
                <Input
                  id={`vocab-${k}`}
                  value={ficha.vocabulario[k] ?? ""}
                  placeholder={padrao[k]}
                  maxLength={LIMITES.termo}
                  onChange={e => mudarTermo(k, e.target.value)}
                  className="text-sm"
                />
              </div>
            ))}
          </div>
          <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Exemplo com as palavras atuais: “{vocab.saudacao} {cap(vocab.clientes)} atendidos
            pel{vocab.genero === "a" ? "as" : "os"} {vocab.profissionais}, por {vocab.servico} e {vocab.area}.”
          </div>
        </CardContent>
      </Card>

      {/* ── Contexto para a IA ── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Contexto para a IA</CardTitle>
          <p className="text-sm text-muted-foreground">
            Entra no pedido à IA quando ela escreve destaques, alertas e ações. Não coloque
            dados pessoais de pacientes.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {CAMPOS_TEXTO.map(({ k, rotulo, ajuda, linhas }) => (
            <div key={k} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor={`txt-${k}`}>{rotulo}</Label>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {ficha[k].length.toLocaleString("pt-BR")} / {LIMITES[k].toLocaleString("pt-BR")}
                </span>
              </div>
              <Textarea
                id={`txt-${k}`}
                value={ficha[k]}
                maxLength={LIMITES[k]}
                rows={linhas}
                placeholder={ajuda}
                onChange={e => mudar({ [k]: e.target.value } as Partial<FichaCliente>)}
                className="text-sm resize-y"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {erro && (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />{erro}
        </p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={handleSalvar} disabled={salvando} className="gap-2">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {salvando ? "Salvando…" : "Salvar perfil"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {sujo
            ? "Alterações não salvas"
            : salvoEm
              ? `Salvo em ${dataHoraBR(salvoEm)}`
              : "Ainda não salvo"}
        </span>
      </div>
    </div>
  );
}
