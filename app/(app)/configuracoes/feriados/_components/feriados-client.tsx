"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { feriadoSchema, type FeriadoFormValues } from "../_schemas";
import { createFeriado, deleteFeriado, importarFeriadosNacionais } from "../actions";
import type { Feriado } from "@/lib/supabase/types";

function formatDataBR(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

interface Props {
  feriados: Feriado[];
}

export function FeriadosClient({ feriados }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<Feriado | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  async function handleImport() {
    setIsImporting(true);
    const result = await importarFeriadosNacionais();
    setIsImporting(false);
    if (result.error) toast.error(result.error);
    else toast.success(`${result.count} feriados nacionais importados (2026–2027).`);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setIsDeleting(true);
    const result = await deleteFeriado(deleting.data);
    setIsDeleting(false);
    if (result.error) toast.error(result.error);
    else { toast.success("Feriado excluído."); setDeleting(null); }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Feriados</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Datas excluídas do cálculo de dias úteis.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleImport}
            disabled={isImporting}
          >
            <Download className="h-4 w-4" />
            {isImporting ? "Importando…" : "Importar nacionais 2026–2027"}
          </Button>
          <Button className="gap-2" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-28">Abrangência</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {feriados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Nenhum feriado cadastrado. Importe os nacionais ou adicione manualmente.
                </TableCell>
              </TableRow>
            ) : (
              feriados.map((f) => (
                <TableRow key={f.data}>
                  <TableCell className="font-mono text-sm">{formatDataBR(f.data)}</TableCell>
                  <TableCell>{f.descricao}</TableCell>
                  <TableCell>
                    {f.uf ? (
                      <Badge variant="secondary">{f.uf}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Nacional</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleting(f)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <FeriadoDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir feriado?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.descricao}" ({deleting?.data && formatDataBR(deleting.data)}) será removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function FeriadoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FeriadoFormValues>({
    resolver: zodResolver(feriadoSchema),
    defaultValues: { data: "", descricao: "", uf: "" },
  });

  const errors = form.formState.errors;

  async function onSubmit(data: FeriadoFormValues) {
    setIsSubmitting(true);
    const result = await createFeriado(data);
    setIsSubmitting(false);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Feriado salvo.");
      form.reset({ data: "", descricao: "", uf: "" });
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Adicionar feriado</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="data">Data</Label>
            <Input id="data" type="date" {...form.register("data")} />
            {errors.data && <p className="text-xs text-destructive">{errors.data.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descrição</Label>
            <Input id="descricao" {...form.register("descricao")} placeholder="Natal" autoFocus />
            {errors.descricao && <p className="text-xs text-destructive">{errors.descricao.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="uf">
              UF{" "}
              <span className="font-normal text-muted-foreground text-xs">(vazio = Nacional)</span>
            </Label>
            <Input
              id="uf"
              {...form.register("uf")}
              placeholder="SP"
              maxLength={2}
              className="w-20 uppercase font-mono"
              onChange={(e) =>
                form.setValue("uf", e.target.value.toUpperCase())
              }
            />
            {errors.uf && <p className="text-xs text-destructive">{errors.uf.message}</p>}
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
