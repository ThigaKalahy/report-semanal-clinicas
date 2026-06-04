"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { clinicaSchema, type ClinicaFormValues } from "../_schemas";
import { createClinica, updateClinica } from "../actions";
import { toSlug } from "@/lib/utils";
import type { ClinicaComFontes } from "../page";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinica: ClinicaComFontes | null;
}

export function ClinicaFormDialog({ open, onOpenChange, clinica }: Props) {
  const isEdit = !!clinica;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const slugTouched = useRef(false);

  const form = useForm<ClinicaFormValues>({
    resolver: zodResolver(clinicaSchema),
    defaultValues: { nome: "", slug: "", tag_curta: "", google_place_id: "", ativa: true },
  });

  useEffect(() => {
    if (open) {
      slugTouched.current = isEdit;
      form.reset({
        nome: clinica?.nome ?? "",
        slug: clinica?.slug ?? "",
        tag_curta: clinica?.tag_curta ?? "",
        google_place_id: clinica?.google_place_id ?? "",
        ativa: clinica?.ativa ?? true,
      });
    }
  }, [open, clinica, isEdit, form]);

  const nome = form.watch("nome");
  useEffect(() => {
    if (!isEdit && !slugTouched.current && nome) {
      form.setValue("slug", toSlug(nome), { shouldValidate: false });
    }
  }, [nome, isEdit, form]);

  async function onSubmit(data: ClinicaFormValues) {
    setIsSubmitting(true);
    const result = isEdit
      ? await updateClinica(clinica.id, data)
      : await createClinica(data);
    setIsSubmitting(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(isEdit ? "Clínica atualizada." : "Clínica criada.");
      onOpenChange(false);
    }
  }

  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar clínica" : "Nova clínica"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" {...form.register("nome")} placeholder="Clínica Axem Paulista" autoFocus />
            {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              {...form.register("slug")}
              placeholder="axem-paulista"
              className="font-mono text-sm"
              onChange={(e) => {
                slugTouched.current = true;
                form.setValue("slug", e.target.value, { shouldValidate: true });
              }}
            />
            {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="tag_curta">Código de integração</Label>
              <Input
                id="tag_curta"
                {...form.register("tag_curta")}
                placeholder="EX-001"
                maxLength={10}
                onChange={(e) => form.setValue("tag_curta", e.target.value.toUpperCase())}
              />
              <p className="text-xs text-muted-foreground">Código interno para integrações futuras (opcional)</p>
              {errors.tag_curta && <p className="text-xs text-destructive">{errors.tag_curta.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <div className="flex items-center gap-2 h-9">
                <Switch
                  checked={form.watch("ativa")}
                  onCheckedChange={(v) => form.setValue("ativa", v)}
                />
                <span className="text-sm text-muted-foreground">
                  {form.watch("ativa") ? "Ativa" : "Inativa"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="google_place_id">Google Place ID</Label>
            <Input id="google_place_id" {...form.register("google_place_id")} placeholder="ChIJ..." />
            <p className="text-xs text-muted-foreground">
              Opcional — encontre em{" "}
              <code className="text-[11px] bg-muted px-1 rounded">
                developers.google.com/maps/documentation/places/web-service/place-id
              </code>
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando…" : isEdit ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
