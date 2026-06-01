export const revalidate = 0;

import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { MetasClient } from "./_components/metas-client";
import { diasUteisDoMes, diasUteisDecorridos } from "@/lib/dias-uteis";
import type { Meta, TipoMeta } from "@/lib/supabase/types";

type MetaComTipo = Meta & { tipos_meta: TipoMeta };

export default async function MetasPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { mes?: string; ano?: string };
}) {
  const { id } = params;
  const today = new Date();

  const mes = Number(searchParams.mes) || today.getMonth() + 1;
  const ano = Number(searchParams.ano) || today.getFullYear();

  const db = getSupabaseAdmin();

  const [{ data: clinica }, { data: rawMetas }, { data: tiposMeta }, { data: feriados }] =
    await Promise.all([
      db.from("clinicas").select("id, nome").eq("id", id).single(),
      db.from("metas").select("*, tipos_meta(*)").eq("clinica_id", id).eq("mes", mes).eq("ano", ano).order("tipos_meta(ordem_exibicao)", { ascending: true }),
      db.from("tipos_meta").select("*").order("ordem_exibicao", { ascending: true }),
      db.from("feriados").select("data"),
    ]);

  if (!clinica) notFound();

  const metas = (rawMetas ?? []) as unknown as MetaComTipo[];
  const feriadosDatas = (feriados ?? []).map((f) => f.data);

  const diasTotal = diasUteisDoMes(mes, ano, feriadosDatas);

  const currentMes = today.getMonth() + 1;
  const currentAno = today.getFullYear();

  let diasDecorridos: number;
  if (ano < currentAno || (ano === currentAno && mes < currentMes)) {
    diasDecorridos = diasTotal;
  } else if (ano === currentAno && mes === currentMes) {
    diasDecorridos = diasUteisDecorridos(today, feriadosDatas);
  } else {
    diasDecorridos = 0;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <MetasClient
        clinicaId={id}
        clinicaNome={clinica.nome}
        mes={mes}
        ano={ano}
        metas={metas}
        tiposMeta={tiposMeta ?? []}
        diasTotal={diasTotal}
        diasDecorridos={diasDecorridos}
      />
    </div>
  );
}
