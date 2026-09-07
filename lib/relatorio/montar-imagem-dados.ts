import { format, getISOWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Clinica } from "@/lib/supabase/types";
import type { ResultadoPreConsulta } from "@/lib/coletores/pre-consulta";
import type { ResultadoNPS } from "@/lib/coletores/nps";
import type { ResultadoGoogle } from "@/lib/coletores/google-places";
import type { ResultadoLeads } from "@/lib/coletores/leads";
import type { ResultadoMeta } from "@/lib/coletores/metas";
import type { GrupoFinanceiro } from "@/lib/coletores/faturamento";
import type {
  RelatorioImagemData,
  FaturamentoVisao,
  NpsGoogleVisao,
  ComercialVisao,
  DestaqueItem,
} from "./imagem-tipos";

function fmtMoeda(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtPeriodoLabel(d: Date): string {
  return format(d, "dd/MM");
}

function fmtMesAno(d: Date): string {
  return format(d, "MMMM/yyyy", { locale: ptBR })
    .replace(/^\w/, (c) => c.toUpperCase());
}

function buildFaturamento(
  metas: ResultadoMeta[],
  realizadoFiltro?: number | null,    // total do período selecionado (ex: semana)
  realizadoAcumulado?: number | null, // total do dia 01 até data_fim (base dos %)
): FaturamentoVisao {
  const fat = metas.find(
    (m) => m.tipo_nome.toLowerCase().includes("faturamento")
  );

  // Base para cálculo de %: acumulado do mês quando disponível, senão filtro, senão realizado da meta
  const baseCalculo = realizadoAcumulado ?? realizadoFiltro ?? fat?.realizado ?? null;

  if (!fat) {
    return {
      is_media:                        false,
      realizado_filtro:                realizadoFiltro    != null ? fmtMoeda(realizadoFiltro)    : undefined,
      realizado_filtro_from_planilha:  realizadoFiltro    != null,
      acumulado:                       realizadoAcumulado != null ? fmtMoeda(realizadoAcumulado) : "N/A",
      acumulado_from_planilha:         realizadoAcumulado != null,
      meta_periodo:                    "N/A",
      pct_periodo:                     null,
      acima_periodo:                   false,
      meta_mensal:                     "N/A",
      pct_mensal:                      null,
      acima_mensal:                    false,
    };
  }

  const realizado = baseCalculo ?? 0;

  // pct_periodo: diferença relativa vs meta proporcional (badge +/-), base = acumulado.
  const diffPeriodo = fat.meta_periodo > 0
    ? Math.round(((realizado - fat.meta_periodo) / fat.meta_periodo) * 100)
    : null;

  // pct_mensal: atingimento (acumulado / meta_mensal * 100).
  const atingimento = fat.meta_mensal > 0
    ? Math.round((realizado / fat.meta_mensal) * 100)
    : null;

  const temFiltro    = realizadoFiltro    != null;
  const temAcumulado = realizadoAcumulado != null;

  return {
    is_media:                       fat.tipo_comportamento === "media",
    realizado_filtro:               temFiltro    ? fmtMoeda(realizadoFiltro!)    : undefined,
    realizado_filtro_from_planilha: temFiltro,
    acumulado:                      temAcumulado ? fmtMoeda(realizadoAcumulado!) : fmtMoeda(fat.realizado),
    acumulado_from_planilha:        temAcumulado,
    meta_periodo:                   fmtMoeda(fat.meta_periodo),
    pct_periodo:                    diffPeriodo !== null ? Math.abs(diffPeriodo) : null,
    acima_periodo:                  realizado >= fat.meta_periodo,
    meta_mensal:                    fmtMoeda(fat.meta_mensal),
    pct_mensal:                     atingimento,
    acima_mensal:                   realizado >= fat.meta_mensal,
  };
}

function buildNpsGoogle(
  nps: ResultadoNPS | null,
  google: ResultadoGoogle | null,
  metas: ResultadoMeta[],
  ini: Date,
  fim: Date,
): NpsGoogleVisao {
  const metaNps    = metas.find((m) => m.tipo_nome.toLowerCase().includes("nps"));
  const metaGoogle = metas.find((m) => m.tipo_nome.toLowerCase().includes("google"));

  // Log diagnóstico temporário — aparece no terminal do servidor (npm run dev)
  console.log(`[nps-google] período: ${ini.toLocaleDateString("pt-BR")} → ${fim.toLocaleDateString("pt-BR")}`);
  if (nps) {
    console.log(`[nps-google] NPS coletor retornou: total=${nps.total} | nps_score=${nps.nps_score} | promotores=${nps.classificacao.promotores} neutros=${nps.classificacao.neutros} detratores=${nps.classificacao.detratores}`);
    console.log(`[nps-google] → campo "Respostas NPS" receberá: ${nps.total} (total de respostas no período)`);
  } else {
    console.log("[nps-google] NPS: sem dados (fonte não configurada ou erro)");
  }
  if (google) {
    console.log(`[nps-google] Google coletor retornou: total=${google.total} avaliações filtradas no período`);
    console.log(`[nps-google] → campo "Avaliações Google" receberá: ${google.total}`);
  } else {
    console.log("[nps-google] Google: sem dados");
  }

  return {
    respostas_nps:     nps?.total    ?? null,   // contagem de respostas no período (não o score)
    avaliacoes_google: google?.total ?? null,
    meta_nps_meta:     metaNps?.meta_mensal    ?? null,
    meta_google_meta:  metaGoogle?.meta_mensal ?? null,
  };
}

function buildDestaquesCategoria(
  porCategoria: Record<string, GrupoFinanceiro> | null | undefined
): DestaqueItem[] {
  if (!porCategoria) return [];
  const entries = Object.entries(porCategoria);
  if (entries.length === 0) return [];
  const [nome, grupo] = entries[0];
  // só sugere destaque se a categoria tem pelo menos 20% do faturamento
  if (!nome || grupo.pct_do_total < 20) return [];
  return [{ tipo: "financeiro", texto: `${nome}: ${grupo.pct_do_total.toFixed(0)}% do faturamento` }];
}

function buildComercial(leads: ResultadoLeads | null | undefined): ComercialVisao {
  return {
    conversao_leads: (leads && leads.taxa_conversao !== null)
      ? `${leads.taxa_conversao.toFixed(1)}%`
      : "N/A",
    conversao_orcamentos: "N/A",
    total_leads:    leads != null ? String(leads.total) : "N/A",
    total_orcamentos: "N/A",
  };
}

export function montarDadosImagem(
  clinica: Clinica,
  pre: ResultadoPreConsulta | null,
  nps: ResultadoNPS | null,
  google: ResultadoGoogle | null,
  metas: ResultadoMeta[],
  ini: Date,
  fim: Date,
  leads?: ResultadoLeads | null,
  realizadoFiltro?: number | null,       // total do período selecionado (semana/filtro)
  realizadoAcumulado?: number | null,    // total do dia 01 do mês até data_fim (base dos %)
  porCategoriaFaturamento?: Record<string, GrupoFinanceiro> | null,
  porProfissionalFaturamento?: Record<string, GrupoFinanceiro> | null,
): RelatorioImagemData {
  void pre; // disponível para expansão futura

  const faturamento = buildFaturamento(metas, realizadoFiltro, realizadoAcumulado);
  const npsGoogle   = buildNpsGoogle(nps, google, metas, ini, fim);
  const comercial   = buildComercial(leads);
  const destaques   = buildDestaquesCategoria(porCategoriaFaturamento);

  const temSuplementar = porCategoriaFaturamento != null || porProfissionalFaturamento != null;

  return {
    cabecalho: {
      clinica_nome: clinica.nome,
      tag:          clinica.tag_curta ?? clinica.slug,
      semana:       getISOWeek(fim),
      periodo_ini:  fmtPeriodoLabel(ini),
      periodo_fim:  fmtPeriodoLabel(fim),
    },
    rodape: {
      mes_ano: fmtMesAno(fim),
    },
    visaoGeral: { faturamento, npsGoogle, comercial },
    destaques,
    alertas: [],
    acoes:   [],
    faturamento_suplementar: temSuplementar ? {
      por_categoria:    porCategoriaFaturamento    ?? undefined,
      por_profissional: porProfissionalFaturamento ?? undefined,
    } : undefined,
  };
}
