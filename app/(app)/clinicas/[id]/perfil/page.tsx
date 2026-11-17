export const revalidate = 0;

import { notFound } from "next/navigation";
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
    <div className="space-y-8 max-w-3xl">
      <p className="text-sm text-muted-foreground">
          Perfil do cliente: define as palavras dos relatórios e dá contexto à IA na hora de
          escrever destaques, alertas e ações.
        </p>

      <PerfilForm clinicaId={id} clinicaNome={clinica.nome} inicial={inicial} jaSalva={salva !== null} />
    </div>
  );
}
