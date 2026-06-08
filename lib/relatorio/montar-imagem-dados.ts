import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Clinica } from "@/lib/supabase/types";
import type { ResultadoPreConsulta } from "@/lib/coletores/pre-consulta";
import type { ResultadoNPS } from "@/lib/coletores/nps";
import type { ResultadoGoogle } from "@/lib/coletores/google-places";
import type { ResultadoLeads } from "@/lib/coletores/leads";
import type { ResultadoMeta } from "@/lib/coletores/metas";
import type {
  RelatorioImagemData,
  FaturamentoVisao,
  NpsGoogleVisao,
  ComercialVisao,
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

function buildFaturamento(metas: ResultadoMeta[]): FaturamentoVisao {
  const fat = metas.find(
    (m) => m.tipo_nome.toLowerCase().includes("faturamento")
  );

  if (!fat) {
    return {
      is_media:      false,
      acumulado:     "N/A",
      meta_periodo:  "N/A",
      pct_periodo:   null,
      acima_periodo: false,
      meta_mensal:   "N/A",
      pct_mensal:    null,
      acima_mensal:  false,
    };
  }

  // pct_periodo: diferença relativa vs meta proporcional (badge +/-).
  const diffPeriodo = fat.meta_periodo > 0
    ? Math.round(((fat.realizado - fat.meta_periodo) / fat.meta_periodo) * 100)
    : null;

  // pct_mensal: atingimento (acumulado / meta_mensal * 100).
  const atingimento = fat.meta_mensal > 0
    ? Math.round((fat.realizado / fat.meta_mensal) * 100)
    : null;

  return {
    is_media:      fat.tipo_comportamento === "media",
    acumulado:     fmtMoeda(fat.realizado),
    meta_periodo:  fmtMoeda(fat.meta_periodo),
    pct_periodo:   diffPeriodo !== null ? Math.abs(diffPeriodo) : null,
    acima_periodo: fat.realizado >= fat.meta_periodo,
    meta_mensal:   fmtMoeda(fat.meta_mensal),
    pct_mensal:    atingimento,
    acima_mensal:  fat.realizado >= fat.meta_mensal,
  };
}

function buildNpsGoogle(
  nps: ResultadoNPS | null,
  google: ResultadoGoogle | null,
  metas: ResultadoMeta[]
): NpsGoogleVisao {
  const metaNps    = metas.find((m) => m.tipo_nome.toLowerCase().includes("nps"));
  const metaGoogle = metas.find((m) => m.tipo_nome.toLowerCase().includes("google"));

  return {
    respostas_nps:     nps?.nps_score ?? null,
    avaliacoes_google: google?.total  ?? null,
    meta_nps_meta:     metaNps?.meta_mensal    ?? null,
    meta_google_meta:  metaGoogle?.meta_mensal ?? null,
  };
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
): RelatorioImagemData {
  void pre; // disponível para expansão futura

  const faturamento = buildFaturamento(metas);
  const npsGoogle   = buildNpsGoogle(nps, google, metas);
  const comercial   = buildComercial(leads);

  return {
    cabecalho: {
      clinica_nome: clinica.nome,
      tag:          clinica.tag_curta ?? clinica.slug,
      periodo_ini:  fmtPeriodoLabel(ini),
      periodo_fim:  fmtPeriodoLabel(fim),
    },
    rodape: {
      mes_ano: fmtMesAno(fim),
    },
    visaoGeral: { faturamento, npsGoogle, comercial },
    destaques: [],
    alertas:   [],
    acoes:     [],
  };
}
