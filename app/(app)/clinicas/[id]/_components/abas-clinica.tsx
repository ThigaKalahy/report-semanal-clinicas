"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IdCard, LayoutList, Database, Target, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const ABAS = [
  { trecho: "perfil", rotulo: "Perfil", icone: IdCard },
  { trecho: "estrutura", rotulo: "Estrutura do relatório", icone: LayoutList },
  { trecho: "fontes", rotulo: "Fontes de dados", icone: Database },
  { trecho: "metas", rotulo: "Metas", icone: Target },
  { trecho: "checkpoint", rotulo: "Checkpoint", icone: ClipboardCheck },
];

export function AbasClinica({ id }: { id: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Configurações da clínica" className="border-b overflow-x-auto">
      <ul className="flex gap-1 -mb-px">
        {ABAS.map(({ trecho, rotulo, icone: Icone }) => {
          const href = `/clinicas/${id}/${trecho}`;
          const ativa = pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={trecho}>
              <Link
                href={href}
                aria-current={ativa ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  ativa
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
                )}
              >
                <Icone className="h-4 w-4 shrink-0" />
                {rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
