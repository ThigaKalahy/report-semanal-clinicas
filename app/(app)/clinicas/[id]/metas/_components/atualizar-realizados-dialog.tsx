"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { atualizarRealizados } from "../actions";
import type { Meta, TipoMeta } from "@/lib/supabase/types";
import { formatValor } from "@/lib/format";
import { format } from "date-fns";

export type MetaComTipo = Meta & { tipos_meta: TipoMeta };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clinicaId: string;
  metas: MetaComTipo[];
}

interface RealizadoInput {
  id: string;
  valor_realizado: string;
  valor_realizado_semana: string;
}

function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function AtualizarRealizadosDialog({ open, onOpenChange, clinicaId, metas }: Props) {
  const [dataRef, setDataRef] = useState(todayISO);
  const [inputs, setInputs] = useState<RealizadoInput[]>(() =>
    metas.map((m) => ({
      id: m.id,
      valor_realizado: String(m.valor_realizado),
      valor_realizado_semana: String(m.valor_realizado_semana),
    }))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  function update(id: string, field: "valor_realizado" | "valor_realizado_semana", value: string) {
    setInputs((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    const result = await atualizarRealizados(clinicaId, {
      data_referencia: dataRef,
      updates: inputs,
    });
    setIsSubmitting(false);
    if (result.error) toast.error(result.error);
    else { toast.success("Realizados atualizados."); onOpenChange(false); }
  }

  if (metas.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Atualizar realizados</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-4">
            Adicione metas primeiro para poder atualizar os realizados.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Atualizar realizados</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Data de referência */}
          <div className="space-y-1.5">
            <Label htmlFor="data_ref">Data de referência</Label>
            <Input
              id="data_ref"
              type="date"
              value={dataRef}
              onChange={(e) => setDataRef(e.target.value)}
              className="w-44"
            />
            <p className="text-xs text-muted-foreground">
              Data de corte do realizado acumulado e da semana.
            </p>
          </div>

          <Separator />

          {/* Inputs por meta */}
          <div className="space-y-5">
            {metas.map((meta, i) => {
              const inp = inputs[i];
              if (!inp) return null;
              const tipo = meta.tipos_meta;

              return (
                <div key={meta.id} className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm font-semibold">{tipo.nome}</p>
                    <span className="text-xs text-muted-foreground">
                      Meta: {formatValor(meta.valor_meta_mensal, tipo.formato)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor={`realizado-${meta.id}`} className="text-xs">
                        Realizado acumulado ({tipo.unidade})
                      </Label>
                      <Input
                        id={`realizado-${meta.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={inp.valor_realizado}
                        onChange={(e) => update(meta.id, "valor_realizado", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`semana-${meta.id}`} className="text-xs">
                        Realizado semana ({tipo.unidade})
                      </Label>
                      <Input
                        id={`semana-${meta.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={inp.valor_realizado_semana}
                        onChange={(e) => update(meta.id, "valor_realizado_semana", e.target.value)}
                      />
                    </div>
                  </div>
                  {i < metas.length - 1 && <Separator className="mt-1" />}
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Salvando…" : "Salvar tudo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
