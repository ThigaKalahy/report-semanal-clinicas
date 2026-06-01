"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          Ocorreu um erro inesperado. Tente recarregar a página.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground font-mono">
            ID: {error.digest}
          </p>
        )}
      </div>
      <Button onClick={reset} variant="outline">
        Tentar novamente
      </Button>
    </div>
  );
}
