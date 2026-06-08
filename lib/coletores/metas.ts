import { getSupabaseAdmin } from "@/lib/supabase/server";
import { diasUteisDoMes, diasUteisDecorridos } from "@/lib/dias-uteis";
import {
  calcularMetaPeriodo,
  descreverPerformance,
  calcularPercentualMeta,
  type PerformanceInfo,
} from "@/lib/metas";
import type { TipoMeta, Meta, FormatoMeta, ComportamentoMeta } from "@/lib/supabase/types";

export interface ResultadoMeta {
  tipo_nome: string;
  tipo_formato: FormatoMeta;
  tipo_unidade: string;
  tipo_comportamento: ComportamentoMeta;
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

  // Usa dataRef como referência: conta dias úteis do início do mês até dataRef.
  // Para meses futuros (nenhum dia decorrido): 0.
  // Para meses passados ou atual: diasUteisDecorridos(dataRef) — correto mesmo que o
  // resultado seja igual a diasTotal (fim de mês), pois a proporção é 100%.
  let diasDecorridos: number;
  if (ano > currentAno || (ano === currentAno && mes > currentMes)) {
    diasDecorridos = 0;
  } else {
    diasDecorridos = diasUteisDecorridos(dataRef, feriadosDatas);
  }

  console.log("[metas] diagnóstico:", {
    dataRef: dataRef.toISOString(),
    mes,
    ano,
    diasUteisTotalMes: diasTotal,
    diasUteisDecorridos: diasDecorridos,
  });

  return metas.map((meta) => {
    const tipo = meta.tipos_meta;
    const comportamento = tipo.comportamento ?? "acumulativa";
    const meta_periodo = calcularMetaPeriodo(meta.valor_meta_mensal, diasDecorridos, diasTotal, comportamento);
    console.log(`[metas] "${tipo.nome}":`, {
      valor_meta_mensal: meta.valor_meta_mensal,
      metaPeriodo: meta_periodo,
      comportamento,
    });
    const performance = descreverPerformance(
      meta.valor_realizado,
      meta_periodo,
      meta.valor_meta_mensal,
      comportamento
    );
    const pct_mensal = calcularPercentualMeta(meta.valor_realizado, meta.valor_meta_mensal);
    return {
      tipo_nome: tipo.nome,
      tipo_formato: tipo.formato,
      tipo_unidade: tipo.unidade,
      tipo_comportamento: comportamento,
      realizado: meta.valor_realizado,
      realizado_semana: meta.valor_realizado_semana,
      meta_periodo,
      meta_mensal: meta.valor_meta_mensal,
      performance,
      pct_mensal,
    };
  });
}
