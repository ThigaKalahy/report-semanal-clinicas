"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { metaSchema, editarMetaSchema, type MetaFormValues, type EditarMetaFormValues } from "../_schemas";
import { criarMeta, editarMeta } from "../actions";
import type { Meta, TipoMeta } from "@/lib/supabase/types";
import { formatValor } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clinicaId: string;
  mes: number;
  ano: number;
  tiposMeta: TipoMeta[];
  tiposJaAdicionados: string[];
  editando: Meta | null;
  tipoEditando: TipoMeta | null;
}

export function MetaFormDialog({
  open,
  onOpenChange,
  clinicaId,
  mes,
  ano,
  tiposMeta,
  tiposJaAdicionados,
  editando,
  tipoEditando,
}: Props) {
  const isEdit = !!editando;

  return isEdit ? (
    <EditarMetaDialog
      open={open}
      onOpenChange={onOpenChange}
      clinicaId={clinicaId}
      meta={editando}
      tipo={tipoEditando!}
    />
  ) : (
    <CriarMetaDialog
      open={open}
      onOpenChange={onOpenChange}
      clinicaId={clinicaId}
      mes={mes}
      ano={ano}
      tiposMeta={tiposMeta.filter((t) => !tiposJaAdicionados.includes(t.id))}
    />
  );
}

function CriarMetaDialog({
  open,
  onOpenChange,
  clinicaId,
  mes,
  ano,
  tiposMeta,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clinicaId: string;
  mes: number;
  ano: number;
  tiposMeta: TipoMeta[];
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<MetaFormValues>({
    resolver: zodResolver(metaSchema),
    defaultValues: { tipo_meta_id: "", valor_meta_mensal: "" },
  });

  useEffect(() => {
    if (open) form.reset({ tipo_meta_id: "", valor_meta_mensal: "" });
  }, [open, form]);

  const selectedTipo = tiposMeta.find((t) => t.id === form.watch("tipo_meta_id"));
  const errors = form.formState.errors;

  async function onSubmit(data: MetaFormValues) {
    setIsSubmitting(true);
    const result = await criarMeta(clinicaId, mes, ano, data);
    setIsSubmitting(false);
    if (result.error) toast.error(result.error);
    else { toast.success("Meta adicionada."); onOpenChange(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Adicionar meta</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">
          {tiposMeta.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Todos os tipos de meta já foram adicionados neste mês.
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Tipo de meta</Label>
                <Select
                  value={form.watch("tipo_meta_id")}
                  onValueChange={(v) => form.setValue("tipo_meta_id", v, { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposMeta.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nome} <span className="text-muted-foreground ml-1">({t.unidade})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.tipo_meta_id && (
                  <p className="text-xs text-destructive">{errors.tipo_meta_id.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="valor_meta_mensal">
                  Meta mensal
                  {selectedTipo && (
                    <span className="ml-1.5 font-normal text-muted-foreground text-xs">
                      ({selectedTipo.unidade})
                    </span>
                  )}
                </Label>
                <Input
                  id="valor_meta_mensal"
                  type="number"
                  step="0.01"
                  min="0"
                  {...form.register("valor_meta_mensal")}
                  placeholder="0"
                />
                {errors.valor_meta_mensal && (
                  <p className="text-xs text-destructive">{errors.valor_meta_mensal.message}</p>
                )}
              </div>
            </>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            {tiposMeta.length > 0 && (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando…" : "Adicionar"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditarMetaDialog({
  open,
  onOpenChange,
  clinicaId,
  meta,
  tipo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clinicaId: string;
  meta: Meta;
  tipo: TipoMeta;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EditarMetaFormValues>({
    resolver: zodResolver(editarMetaSchema),
    defaultValues: { valor_meta_mensal: String(meta.valor_meta_mensal) },
  });

  useEffect(() => {
    if (open) form.reset({ valor_meta_mensal: String(meta.valor_meta_mensal) });
  }, [open, meta, form]);

  const errors = form.formState.errors;

  async function onSubmit(data: EditarMetaFormValues) {
    setIsSubmitting(true);
    const result = await editarMeta(meta.id, clinicaId, data);
    setIsSubmitting(false);
    if (result.error) toast.error(result.error);
    else { toast.success("Meta atualizada."); onOpenChange(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar meta — {tipo.nome}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="valor_meta_mensal_edit">
              Meta mensal
              <span className="ml-1.5 font-normal text-muted-foreground text-xs">({tipo.unidade})</span>
            </Label>
            <Input
              id="valor_meta_mensal_edit"
              type="number"
              step="0.01"
              min="0"
              {...form.register("valor_meta_mensal")}
            />
            <p className="text-xs text-muted-foreground">
              Atual: {formatValor(meta.valor_meta_mensal, tipo.formato)}
            </p>
            {errors.valor_meta_mensal && (
              <p className="text-xs text-destructive">{errors.valor_meta_mensal.message}</p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
