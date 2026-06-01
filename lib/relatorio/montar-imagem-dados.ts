import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Clinica } from "@/lib/supabase/types";
import type { ResultadoPreConsulta } from "@/lib/coletores/pre-consulta";
import type { ResultadoNPS } from "@/lib/coletores/nps";
import type { ResultadoGoogle } from "@/lib/coletores/google-places";
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
      realizado_semana: "N/A",
      acumulado: "N/A",
      meta_periodo: "N/A",
      pct_periodo: null,
      acima_periodo: false,
      meta_mensal: "N/A",
      pct_mensal: null,
      acima_mensal: false,
    };
  }

  const pct_periodo = fat.meta_periodo > 0
    ? Math.round((fat.realizado / fat.meta_periodo) * 100)
    : null;
  const pct_mensal = fat.meta_mensal > 0
    ? Math.round((fat.realizado / fat.meta_mensal) * 100)
    : null;

  return {
    realizado_semana: fmtMoeda(fat.realizado_semana),
    acumulado: fmtMoeda(fat.realizado),
    meta_periodo: fmtMoeda(fat.meta_periodo),
    pct_periodo,
    acima_periodo: fat.realizado >= fat.meta_periodo,
    meta_mensal: fmtMoeda(fat.meta_mensal),
    pct_mensal,
    acima_mensal: fat.realizado >= fat.meta_mensal,
  };
}

function buildNpsGoogle(
  nps: ResultadoNPS | null,
  google: ResultadoGoogle | null,
  metas: ResultadoMeta[]
): NpsGoogleVisao {
  const metaNps = metas.find((m) => m.tipo_nome.toLowerCase().includes("nps"));
  const metaGoogle = metas.find((m) =>
    m.tipo_nome.toLowerCase().includes("google")
  );

  const nps_pct =
    metaNps && metaNps.meta_periodo > 0
      ? Math.round(((nps?.nps_score ?? 0) / metaNps.meta_periodo) * 100)
      : null;

  const google_pct =
    metaGoogle && metaGoogle.meta_periodo > 0
      ? Math.round(((google?.total ?? 0) / metaGoogle.meta_periodo) * 100)
      : null;

  return {
    respostas_nps: nps?.total ?? null,
    avaliacoes_google: google?.total ?? null,
    meta_nps_realizado: nps?.nps_score ?? null,
    meta_nps_meta: metaNps?.meta_periodo ?? null,
    meta_nps_pct: nps_pct,
    meta_nps_acima: nps_pct !== null && nps_pct >= 100,
    meta_google_realizado: google?.total ?? null,
    meta_google_meta: metaGoogle?.meta_periodo ?? null,
    meta_google_pct: google_pct,
    meta_google_acima: google_pct !== null && google_pct >= 100,
  };
}

export function montarDadosImagem(
  clinica: Clinica,
  pre: ResultadoPreConsulta | null,
  nps: ResultadoNPS | null,
  google: ResultadoGoogle | null,
  metas: ResultadoMeta[],
  ini: Date,
  fim: Date
): RelatorioImagemData {
  void pre; // disponível para expansão futura

  const faturamento = buildFaturamento(metas);
  const npsGoogle = buildNpsGoogle(nps, google, metas);

  const comercial: ComercialVisao = {
    conversao_leads: "N/A",
    conversao_orcamentos: "N/A",
    total_leads: "N/A",
    total_orcamentos: "N/A",
  };

  return {
    cabecalho: {
      clinica_nome: clinica.nome,
      tag: clinica.tag_curta ?? clinica.slug,
      periodo_ini: fmtPeriodoLabel(ini),
      periodo_fim: fmtPeriodoLabel(fim),
    },
    rodape: {
      mes_ano: fmtMesAno(fim),
    },
    visaoGeral: { faturamento, npsGoogle, comercial },
    destaques: [],
    alertas: [],
    acoes: [],
  };
}
