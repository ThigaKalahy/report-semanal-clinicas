"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Copy, Check, FileText } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RelatorioGerado } from "@/lib/supabase/types";

const FORMATO_LABELS: Record<string, string> = {
  whatsapp_pesquisas: "WhatsApp — Pesquisas",
  whatsapp_metas: "WhatsApp — Metas",
  imagem: "Imagem",
};

export type RelatorioComClinica = RelatorioGerado & { clinicas: { nome: string } };

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {copied ? "Copiado!" : "Copiar"}
    </Button>
  );
}

function fmtPeriodo(ini: string | null, fim: string | null): string {
  if (!ini || !fim) return "—";
  const [iy, im, id] = ini.split("-");
  const [fy, fm, fd] = fim.split("-");
  const iniStr = `${id}/${im}`;
  const fimStr = `${fd}/${fm}`;
  return iy === fy ? `${iniStr} – ${fimStr}` : `${iniStr}/${iy} – ${fimStr}/${fy}`;
}

export function DashboardClient({ relatorios }: { relatorios: RelatorioComClinica[] }) {
  const [viewing, setViewing] = useState<RelatorioComClinica | null>(null);

  return (
    <>
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-heading">Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Histórico dos últimos relatórios gerados.
          </p>
        </div>

        {relatorios.length === 0 ? (
          <div className="rounded-md border p-14 text-center">
            <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum relatório gerado ainda.</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clínica</TableHead>
                  <TableHead>Formato</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Gerado em</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatorios.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer"
                    onClick={() => setViewing(r)}
                  >
                    <TableCell className="font-medium">{r.clinicas.nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {FORMATO_LABELS[r.formato] ?? r.formato}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtPeriodo(r.data_inicio, r.data_fim)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(r.gerado_em), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewing(r);
                        }}
                      >
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base leading-snug">
              {viewing?.clinicas.nome}
              {" — "}
              {FORMATO_LABELS[viewing?.formato ?? ""] ?? viewing?.formato}
              {viewing && (
                <span className="text-muted-foreground font-normal">
                  {" "}({fmtPeriodo(viewing.data_inicio, viewing.data_fim)})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {viewing?.conteudo_markdown ? (
            <div className="space-y-3">
              <div className="flex justify-end">
                <CopyButton text={viewing.conteudo_markdown} />
              </div>
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed rounded-md bg-muted/60 p-4 max-h-[55vh] overflow-y-auto">
                {viewing.conteudo_markdown}
              </pre>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">Sem conteúdo.</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
