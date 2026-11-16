export const revalidate = 0;

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { carregarFicha } from "@/lib/perfil/carregar";
import { FICHA_VAZIA } from "@/lib/perfil/ficha";
import { segmentoDoTexto } from "@/lib/perfil/vocabulario";
import { PerfilForm } from "./_components/perfil-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PerfilClinicaPage({ params }: Props) {
  const { id } = await params;
  const db = getSupabaseAdmin();

  const { data: clinica } = await db
    .from("clinicas")
    .select("id, nome")
    .eq("id", id)
    .single();

  if (!clinica) notFound();

  const salva = await carregarFicha(id);
  // Sem ficha ainda: sugere o segmento pelo nome da clínica ("Odonto…" → odontologia)
  const inicial = salva ?? { ...FICHA_VAZIA, segmentoTipo: segmentoDoTexto(clinica.nome) };

  return (
    <div className="p-8 space-y-8 max-w-3xl">
      <div className="space-y-1">
        <Link href="/clinicas"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" />Clínicas
        </Link>
        <h1 className="text-2xl font-bold font-heading">{clinica.nome}</h1>
        <p className="text-sm text-muted-foreground">
          Perfil do cliente: define as palavras dos relatórios e dá contexto à IA na hora de
          escrever destaques, alertas e ações.
        </p>
      </div>

      <PerfilForm clinicaId={id} clinicaNome={clinica.nome} inicial={inicial} jaSalva={salva !== null} />
    </div>
  );
}
