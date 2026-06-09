"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Settings, Pencil, Trash2, CheckCircle2, XCircle, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FonteForm } from "./fonte-form";
import { TesteLeituraDialog } from "./teste-leitura-dialog";
import { deleteFonte } from "../actions";
import type { FonteDados, Json, TipoFonte } from "@/lib/supabase/types";

interface Props {
  tipo: TipoFonte;
  title: string;
  description: string;
  clinicaId: string;
  fonte: FonteDados | null;
}

function ColBadge({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      {value ? (
        <code className="font-mono bg-muted px-1 py-0.5 rounded text-foreground">{value}</code>
      ) : (
        <span className="text-muted-foreground italic">—</span>
      )}
    </div>
  );
}

function getMapeamentoStr(mapeamento: Json): Record<string, string> {
  if (typeof mapeamento === "object" && mapeamento !== null && !Array.isArray(mapeamento)) {
    return mapeamento as Record<string, string>;
  }
  return {};
}

const TIPO_LABELS: Record<TipoFonte, string> = {
  pre_consulta: "Pré-Consulta",
  nps:          "NPS",
  leads:        "Leads",
  faturamento:  "Faturamento",
  despesa:      "Despesa",
};

export function FonteSection({ tipo, title, description, clinicaId, fonte }: Props) {
  const [isEditing,      setIsEditing]      = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState(false);
  const [isDeleting,     setIsDeleting]     = useState(false);
  const [testeOpen,      setTesteOpen]      = useState(false);

  const isFinanceiro = tipo === "faturamento" || tipo === "despesa";

  async function handleDelete() {
    setIsDeleting(true);
    const result = await deleteFonte(clinicaId, tipo);
    setIsDeleting(false);
    setConfirmDelete(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Fonte removida.");
    }
  }

  const label = TIPO_LABELS[tipo];

  return (
    <>
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{title}</CardTitle>
              {fonte ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex gap-2">
              {fonte && !isEditing && (<>
                {isFinanceiro && (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setTesteOpen(true)}>
                    <FlaskConical className="h-3.5 w-3.5" />Testar leitura
                  </Button>
                )}
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setIsEditing(true)}>
                  <Pencil className="h-3.5 w-3.5" />Editar
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-3.5 w-3.5" />Remover
                </Button>
              </>)}
              {!fonte && !isEditing && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setIsEditing(true)}>
                  <Settings className="h-3.5 w-3.5" />Configurar
                </Button>
              )}
            </div>
          </div>
          <CardDescription>{description}</CardDescription>
        </CardHeader>

        <CardContent>
          {isEditing ? (
            <FonteForm
              tipo={tipo}
              clinicaId={clinicaId}
              existingFonte={fonte}
              onSuccess={() => setIsEditing(false)}
              onCancel={() => setIsEditing(false)}
            />
          ) : fonte ? (
            <div className="space-y-3">
              <div className="p-3 bg-muted/50 rounded-md space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Planilha
                </div>
                <ColBadge label="Sheet ID"    value={fonte.sheet_id} />
                {/* Para fontes financeiras aba_nome guarda o resumo (opcional) */}
                {!isFinanceiro && <ColBadge label="Aba" value={fonte.aba_nome} />}
                {isFinanceiro && fonte.aba_nome && (
                  <ColBadge label="Aba resumo" value={fonte.aba_nome} />
                )}
                <ColBadge label="Coluna data" value={fonte.coluna_data} />
              </div>
              {(() => {
                const raw = fonte.mapeamento as Record<string, unknown> | null;
                const abasMensais = (raw?.abas_mensais && typeof raw.abas_mensais === "object" && !Array.isArray(raw.abas_mensais))
                  ? raw.abas_mensais as Record<string, string>
                  : null;
                const m = getMapeamentoStr(fonte.mapeamento);
                const colEntries = Object.entries(m).filter(([k]) => k !== "abas_mensais");

                return (
                  <>
                    {isFinanceiro && abasMensais && Object.keys(abasMensais).length > 0 && (
                      <div className="p-3 bg-muted/50 rounded-md space-y-2">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                          Abas mensais
                        </div>
                        {Object.entries(abasMensais)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([anoMes, abaNome]) => (
                            <ColBadge key={anoMes} label={anoMes} value={abaNome} />
                          ))}
                      </div>
                    )}
                    {isFinanceiro && (!abasMensais || Object.keys(abasMensais).length === 0) && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Mapa de abas mensais vazio — configure antes de coletar.
                      </p>
                    )}
                    {colEntries.length > 0 && (
                      <div className="p-3 bg-muted/50 rounded-md space-y-2">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                          Mapeamento de colunas
                        </div>
                        {colEntries.map(([k, v]) => (
                          <ColBadge key={k} label={k.replace(/_/g, " ")} value={v} />
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
              <Badge variant="secondary" className="text-xs">{label} configurado</Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma planilha configurada para {label}. Clique em{" "}
              <strong>Configurar</strong> para adicionar.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de exclusão */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover fonte {label}?</AlertDialogTitle>
            <AlertDialogDescription>
              A configuração da planilha será removida. Os relatórios já gerados não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90">
              {isDeleting ? "Removendo…" : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de teste de leitura (só fontes financeiras) */}
      {isFinanceiro && (
        <TesteLeituraDialog
          clinicaId={clinicaId}
          tipo={tipo as "faturamento" | "despesa"}
          open={testeOpen}
          onOpenChange={setTesteOpen}
        />
      )}
    </>
  );
}
