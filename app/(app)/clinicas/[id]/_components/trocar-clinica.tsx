"use client";

import { usePathname, useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Clinica { id: string; nome: string }

/** O nome da clínica abre a lista das outras — troca mantendo a mesma aba. */
export function TrocarClinica({ atual, clinicas }: { atual: Clinica; clinicas: Clinica[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const aba = pathname.split("/")[3] || "perfil";

  return (
    <Select value={atual.id} onValueChange={(id) => router.push(`/clinicas/${id}/${aba}`)}>
      <SelectTrigger
        aria-label="Trocar de clínica"
        title="Trocar de clínica"
        className="h-auto w-auto gap-2 border-0 bg-transparent px-0 py-0 shadow-none text-2xl font-bold font-heading hover:text-primary focus:ring-0 focus-visible:ring-2 [&>svg]:h-5 [&>svg]:w-5">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="start" className="max-h-80">
        {clinicas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
