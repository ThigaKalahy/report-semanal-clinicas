export type TipoDestaque = "positivo" | "atencao" | "financeiro";

export interface DestaqueItem {
  tipo: TipoDestaque;
  texto: string;
}

export interface FaturamentoVisao {
  is_media: boolean;
  acumulado: string;
  acumulado_from_planilha?: boolean;  // true quando veio do coletor de faturamento
  meta_periodo: string;
  pct_periodo: number | null;  // diferença vs meta proporcional; null = N/A
  acima_periodo: boolean;
  meta_mensal: string;
  pct_mensal: number | null;   // atingimento % (realizado / meta_mensal * 100); null = N/A
  acima_mensal: boolean;
}

export interface NpsGoogleVisao {
  respostas_nps: number | null;      // NPS score realizado (comparado ao alvo)
  avaliacoes_google: number | null;  // qtd. de avaliações Google (comparado ao alvo)
  meta_nps_meta: number | null;      // alvo NPS (valor_meta_mensal da meta tipo NPS)
  meta_google_meta: number | null;   // alvo Google (valor_meta_mensal da meta tipo Google)
}

export interface ComercialVisao {
  conversao_leads: string;       // texto livre, ex: "32%" ou "N/A"
  conversao_orcamentos: string;
  total_leads: string;
  total_orcamentos: string;
}

export interface VisaoGeral {
  faturamento: FaturamentoVisao;
  npsGoogle: NpsGoogleVisao;
  comercial: ComercialVisao;
}

export interface CabecalhoInfo {
  clinica_nome: string;
  tag: string;      // tag_curta ou slug
  periodo_ini: string;  // ex: "26/05"
  periodo_fim: string;
}

export interface RodapeInfo {
  mes_ano: string;  // ex: "Maio/2026"
}

export interface FaturamentoSuplementar {
  por_categoria?:    Record<string, { total: number; pct_do_total: number }>;
  por_profissional?: Record<string, { total: number; pct_do_total: number }>;
}

export interface RelatorioImagemData {
  cabecalho: CabecalhoInfo;
  rodape: RodapeInfo;
  visaoGeral: VisaoGeral;
  destaques: DestaqueItem[];
  alertas: string[];
  acoes: string[];
  faturamento_suplementar?: FaturamentoSuplementar;
}
