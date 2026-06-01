export type TipoDestaque = "positivo" | "atencao" | "financeiro";

export interface DestaqueItem {
  tipo: TipoDestaque;
  texto: string;
}

export interface FaturamentoVisao {
  realizado_semana: string;   // texto formatado, ex: "R$ 12.500"
  acumulado: string;
  meta_periodo: string;
  pct_periodo: number | null;  // null = N/A
  acima_periodo: boolean;
  meta_mensal: string;
  pct_mensal: number | null;
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

export interface RelatorioImagemData {
  cabecalho: CabecalhoInfo;
  rodape: RodapeInfo;
  visaoGeral: VisaoGeral;
  destaques: DestaqueItem[];
  alertas: string[];
  acoes: string[];
}
