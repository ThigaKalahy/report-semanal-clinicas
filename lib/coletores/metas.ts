import { getSupabaseAdmin } from "@/lib/supabase/server";
import { diasUteisDoMes, diasUteisDecorridos } from "@/lib/dias-uteis";
import {
  calcularMetaPeriodo,
  descreverPerformance,
  calcularPercentualMeta,
  type PerformanceInfo,
} from "@/lib/metas";
import type { TipoMeta, Meta, FormatoMeta } from "@/lib/supabase/types";

export interface ResultadoMeta {
  tipo_nome: string;
  tipo_formato: FormatoMeta;
  tipo_unidade: string;
  realizado: number;
  realizado_semana: number;
  meta_periodo: number;
  meta_mensal: number;
  performance: PerformanceInfo;
  pct_mensal: number;
}

type MetaComTipo = Meta & { tipos_meta: TipoMeta };

export async function coletarMetas(
  clinicaId: string,
  dataRef: Date
): Promise<ResultadoMeta[]> {
  const db = getSupabaseAdmin();
  const mes = dataRef.getMonth() + 1;
  const ano = dataRef.getFullYear();

  const [{ data: rawMetas }, { data: feriados }] = await Promise.all([
    db
      .from("metas")
      .select("*, tipos_meta(*)")
      .eq("clinica_id", clinicaId)
      .eq("mes", mes)
      .eq("ano", ano)
      .order("tipos_meta(ordem_exibicao)", { ascending: true }),
    db.from("feriados").select("data"),
  ]);

  const metas = (rawMetas ?? []) as unknown as MetaComTipo[];
  const feriadosDatas = (feriados ?? []).map((f) => f.data);

  const today = new Date();
  const currentMes = today.getMonth() + 1;
  const currentAno = today.getFullYear();
  const diasTotal = diasUteisDoMes(mes, ano, feriadosDatas);

  let diasDecorridos: number;
  if (ano < currentAno || (ano === currentAno && mes < currentMes)) {
    diasDecorridos = diasTotal;
  } else if (ano === currentAno && mes === currentMes) {
    diasDecorridos = diasUteisDecorridos(dataRef, feriadosDatas);
  } else {
    diasDecorridos = 0;
  }

  return metas.map((meta) => {
    const tipo = meta.tipos_meta;
    const meta_periodo = calcularMetaPeriodo(meta.valor_meta_mensal, diasDecorridos, diasTotal);
    const performance = descreverPerformance(
      meta.valor_realizado,
      meta_periodo,
      meta.valor_meta_mensal
    );
    const pct_mensal = calcularPercentualMeta(meta.valor_realizado, meta.valor_meta_mensal);
    return {
      tipo_nome: tipo.nome,
      tipo_formato: tipo.formato,
      tipo_unidade: tipo.unidade,
      realizado: meta.valor_realizado,
      realizado_semana: meta.valor_realizado_semana,
      meta_periodo,
      meta_mensal: meta.valor_meta_mensal,
      performance,
      pct_mensal,
    };
  });
}
