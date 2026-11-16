"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Abre a impressão do navegador — de onde se imprime ou se salva em PDF. */
export function BotaoImprimir() {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground">
        Na janela de impressão, escolha “Salvar como PDF” para gerar o arquivo.
      </span>
      <Button size="sm" className="gap-2" onClick={() => window.print()}>
        <Printer className="h-3.5 w-3.5" />Imprimir ou salvar em PDF
      </Button>
    </div>
  );
}
