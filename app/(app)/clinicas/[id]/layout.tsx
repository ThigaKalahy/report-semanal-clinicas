import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { AbasClinica } from "./_components/abas-clinica";
import { TrocarClinica } from "./_components/trocar-clinica";

/**
 * Cabeçalho comum das telas de configuração de uma clínica: volta para a lista,
 * troca de clínica e navega entre perfil, estrutura, fontes, metas e checkpoint.
 */
export default async function ClinicaLayout({ children, params }: LayoutProps<"/clinicas/[id]">) {
  const { id } = await params;
  const db = getSupabaseAdmin();
  const { data: clinicas } = await db.from("clinicas").select("id, nome").order("nome");
  const clinica = (clinicas ?? []).find((c) => c.id === id);
  if (!clinica) notFound();

  return (
    <div className="p-8 space-y-6 max-w-5xl">
      <div className="space-y-3">
        <div className="space-y-1">
          <Link href="/clinicas"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="h-4 w-4" />Clínicas
          </Link>
          <TrocarClinica atual={clinica} clinicas={clinicas ?? []} />
        </div>
        <AbasClinica id={id} />
      </div>
      {children}
    </div>
  );
}
