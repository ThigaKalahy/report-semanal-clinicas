import { getSupabaseAdmin } from "@/lib/supabase/server";
import { normalizarEstrutura, estruturaPadrao } from "./estrutura";
import type { Estrutura, Disponibilidade } from "./estrutura";
import type { FonteDados, Json } from "@/lib/supabase/types";

/**
 * Estrutura dos relatórios da clínica — a salva, ou a padrão quando ela nunca
 * configurou nada.
 *
 * Nunca lança: uma falha aqui (tabela ainda não criada, banco fora do ar) não
 * pode derrubar a geração do relatório — só faz valer a estrutura padrão.
 */
export async function carregarEstrutura(
  clinicaId: string,
): Promise<{ estrutura: Estrutura; personalizada: boolean; atualizadoEm: string | null }> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("estruturas_relatorio")
      .select("config, updated_at")
      .eq("clinica_id", clinicaId)
      .maybeSingle();
    if (error || !data) return { estrutura: estruturaPadrao(), personalizada: false, atualizadoEm: null };
    return {
      estrutura: normalizarEstrutura(data.config),
      personalizada: true,
      atualizadoEm: data.updated_at,
    };
  } catch {
    return { estrutura: estruturaPadrao(), personalizada: false, atualizadoEm: null };
  }
}

function mapa(m: Json): Record<string, unknown> {
  return m && typeof m === "object" && !Array.isArray(m) ? (m as Record<string, unknown>) : {};
}

/**
 * O que a clínica tem cadastrado hoje, a partir das fontes de dados. Serve para
 * a tela de configuração avisar quais seções e indicadores ficariam vazios.
 *
 * As chaves batem com as de `fontes_dados.mapeamento` (lib/fontes/campos.ts).
 */
export function disponibilidadeDasFontes(
  fontes: Pick<FonteDados, "tipo" | "mapeamento">[],
  temGoogle: boolean,
): Disponibilidade {
  const de = (tipo: string) => fontes.find((f) => f.tipo === tipo);
  const tem = (tipo: string, campo: string) => {
    const v = mapa(de(tipo)?.mapeamento ?? null)[campo];
    return typeof v === "string" && v.trim() !== "";
  };

  return {
    // meta depende do mês; a tela não tem como saber, então não acusa falta
    meta: true,
    google: temGoogle,
    preConsulta: !!de("pre_consulta"),
    "preConsulta.motivo": tem("pre_consulta", "motivo"),
    "preConsulta.origem": tem("pre_consulta", "origem"),
    nps: !!de("nps"),
    "nps.profissional": tem("nps", "nota_profissional"),
    "nps.recepcao": tem("nps", "nota_recepcao"),
    "nps.infraestrutura": tem("nps", "nota_infraestrutura"),
    "nps.enfermagem": tem("nps", "nota_enfermagem"),
    "nps.indicacao": tem("nps", "indicacao"),
    "nps.comentario": tem("nps", "comentario"),
    leads: !!de("leads"),
    "leads.origem": tem("leads", "origem"),
    "leads.interesse": tem("leads", "interesse"),
    "leads.canal": tem("leads", "canal"),
    "leads.objecao": tem("leads", "objecao"),
    "vendas.profissional": tem("faturamento", "profissional"),
    "vendas.primeiraVez": tem("faturamento", "primeira_vez"),
    "vendas.unidade": tem("faturamento", "unidade"),
    "vendas.pagamento": tem("faturamento", "pagamento"),
    entradas: !!de("entradas"),
    orcamentos: !!de("orcamentos"),
    "orcamentos.motivo": tem("orcamentos", "objecao"),
  };
}
