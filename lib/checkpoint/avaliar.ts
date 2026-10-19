import { format } from "date-fns";
import { diasUteisDesde } from "@/lib/dias-uteis";
import type { LeituraFonte } from "@/lib/coletores/checkpoint";
import { formatAnoMes } from "@/lib/coletores/checkpoint";

/** ✅ ok | ⚠️ atencao | null = em branco, à espera de preenchimento manual. */
export type StatusCheckpoint = "ok" | "atencao" | null;

/**
 * Limite padrão em dias úteis. Cada indicador tem o seu em
 * INDICADOR_LIMITE_DIAS_UTEIS — este valor só vale quando nenhum é informado.
 */
export const LIMITE_DIAS_UTEIS = 2;

export interface AvaliacaoIndicador {
  status: StatusCheckpoint;
  /** Texto sugerido para a observação; vazio quando não há o que apontar. */
  observacao: string;
  /** false = indicador sem planilha, nasce em branco para preenchimento manual. */
  automatico: boolean;
  /** Resumo factual do que foi lido, exibido como apoio (não é a observação). */
  detalhe: string;
  /** Régua aplicada a este indicador, em dias úteis. */
  limiteDiasUteis: number;
}

function dataBR(d: Date): string {
  return format(d, "dd/MM");
}

function plural(n: number, singular: string, pluralForma: string): string {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}

/**
 * Converte a leitura da planilha no status sugerido do indicador.
 *
 * O status só é ✅ quando passa em todas as checagens aplicáveis: lançamento
 * recente (até LIMITE_DIAS_UTEIS dias úteis) e, onde houver coluna de
 * categoria, nenhum lançamento do período sem categoria.
 *
 * Tudo aqui é sugestão: o que o usuário editar na tela prevalece.
 */
export function avaliarIndicador(params: {
  /** null = indicador sem fonte configurada (clínica usa sistema próprio). */
  leitura: LeituraFonte | null;
  /** Mensagem de falha ao ler a planilha, quando houver. */
  erro?: string | null;
  temCategoria: boolean;
  /** Data com que a frescura do dado é comparada — normalmente hoje. */
  referencia: Date;
  feriados: string[];
  limiteDiasUteis?: number;
}): AvaliacaoIndicador {
  const { leitura, erro, temCategoria, referencia, feriados } = params;
  const limite = params.limiteDiasUteis ?? LIMITE_DIAS_UTEIS;

  if (erro) {
    return {
      status: "atencao",
      observacao: `Não foi possível ler a planilha: ${erro}`,
      automatico: true,
      detalhe: "Falha na leitura da planilha",
      limiteDiasUteis: limite,
    };
  }

  // Sem fonte: nasce em branco, para o usuário preencher à mão.
  if (!leitura) {
    return {
      status: null,
      observacao: "",
      automatico: false,
      detalhe: "Sem planilha configurada — preencher manualmente",
      limiteDiasUteis: limite,
    };
  }

  const alertas: string[] = [];

  if (leitura.mesesSemAba.length > 0) {
    const meses = leitura.mesesSemAba.map(formatAnoMes).join(", ");
    alertas.push(`Aba não mapeada para ${meses}`);
  }

  if (leitura.ultimoLancamento === null) {
    alertas.push("Sem lançamentos na planilha");
    return {
      status: "atencao",
      observacao: alertas.join(" · "),
      automatico: true,
      detalhe: "Nenhum lançamento encontrado",
      limiteDiasUteis: limite,
    };
  }

  const dias = diasUteisDesde(leitura.ultimoLancamento, referencia, feriados);
  const quando = dataBR(leitura.ultimoLancamento);

  if (dias > limite) {
    alertas.push(`Último lançamento em ${quando} (${plural(dias, "dia útil", "dias úteis")} atrás)`);
  }

  if (temCategoria && leitura.semCategoriaPeriodo !== null && leitura.semCategoriaPeriodo > 0) {
    alertas.push(
      `${plural(leitura.semCategoriaPeriodo, "lançamento", "lançamentos")} sem categoria`
    );
  }

  const detalhes = [
    dias === 0
      ? `Último lançamento em ${quando} (hoje)`
      : `Último lançamento em ${quando} (${plural(dias, "dia útil", "dias úteis")} atrás)`,
    `${plural(leitura.lancamentosPeriodo, "lançamento", "lançamentos")} no período`,
  ];
  if (temCategoria && leitura.semCategoriaPeriodo !== null) {
    detalhes.push(
      leitura.semCategoriaPeriodo === 0
        ? "categoria preenchida em todos"
        : `${leitura.semCategoriaPeriodo} sem categoria`
    );
  }

  detalhes.push(`limite: ${plural(limite, "dia útil", "dias úteis")}`);

  return {
    status: alertas.length > 0 ? "atencao" : "ok",
    observacao: alertas.join(" · "),
    automatico: true,
    detalhe: detalhes.join(" · "),
    limiteDiasUteis: limite,
  };
}
