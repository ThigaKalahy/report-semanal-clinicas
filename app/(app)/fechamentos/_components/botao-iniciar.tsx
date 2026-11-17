"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { criarFechamento } from "../actions";

/** Cria o fechamento do período (lendo as planilhas) e abre a tela dele. */
export function BotaoIniciar({ clinicaId, tipo, ano, mes, desabilitado }: {
  clinicaId: string; tipo: "mensal" | "quinzenal"; ano: number; mes: number; desabilitado?: boolean;
}) {
  const router = useRouter();
  const [criando, setCriando] = useState(false);

  async function iniciar() {
    setCriando(true);
    const res = await criarFechamento({ clinicaId, tipo, ano, mes, quinzena: tipo === "quinzenal" ? 1 : null });
    if (!res.ok) { setCriando(false); toast.error(res.erro); return; }
    router.push(`/fechamentos/${res.id}`);
  }

  return (
    <button type="button" onClick={iniciar} disabled={criando || desabilitado}
      title={desabilitado ? "Cadastre a fonte de vendas da clínica antes" : "Lê as planilhas e abre o fechamento"}
      className="inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50">
      {criando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
      {criando ? "Lendo planilhas…" : "Iniciar"}
    </button>
  );
}
