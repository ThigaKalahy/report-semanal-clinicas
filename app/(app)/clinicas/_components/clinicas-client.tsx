"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Database, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { ClinicaFormDialog } from "./clinica-form-dialog";
import { deleteClinica } from "../actions";
import type { ClinicaComFontes } from "../page";

interface Props {
  clinicas: ClinicaComFontes[];
}

export function ClinicasClient({ clinicas }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClinicaComFontes | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(c: ClinicaComFontes) {
    setEditing(c);
    setDialogOpen(true);
  }

  async function handleDelete() {
    if (!deletingId) return;
    setIsDeleting(true);
    const result = await deleteClinica(deletingId);
    setIsDeleting(false);
    setDeletingId(null);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Clínica excluída.");
    }
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova clínica
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Nome</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Tag</TableHead>
              <TableHead>Place ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Fontes</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clinicas.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                  Nenhuma clínica cadastrada. Clique em &ldquo;Nova clínica&rdquo; para começar.
                </TableCell>
              </TableRow>
            )}
            {clinicas.map((c) => {
              const temPre = c.fontes_dados.some((f) => f.tipo === "pre_consulta");
              const temNps = c.fontes_dados.some((f) => f.tipo === "nps");
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{c.slug}</TableCell>
                  <TableCell>
                    {c.tag_curta ? (
                      <span className="font-bold text-gestfy-purple dark:text-gestfy-lavender">
                        {c.tag_curta}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">
                    {c.google_place_id ?? "—"}
                  </TableCell>
                  <TableCell>
                    {c.ativa ? (
                      <Badge variant="default" className="bg-green-600 text-white">Ativa</Badge>
                    ) : (
                      <Badge variant="secondary">Inativa</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      <Badge
                        variant={temPre ? "default" : "outline"}
                        className={temPre ? "bg-gestfy-purple text-white" : "text-muted-foreground"}
                      >
                        Pré
                      </Badge>
                      <Badge
                        variant={temNps ? "default" : "outline"}
                        className={temNps ? "bg-gestfy-magenta text-white" : "text-muted-foreground"}
                      >
                        NPS
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(c)}
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Fontes" asChild>
                        <Link href={`/clinicas/${c.id}/fontes`}>
                          <Database className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Metas" asChild>
                        <Link href={`/clinicas/${c.id}/metas`}>
                          <Target className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        title="Excluir"
                        onClick={() => setDeletingId(c.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ClinicaFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clinica={editing}
      />

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir clínica?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Todas as fontes de dados, metas e
              relatórios da clínica serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
