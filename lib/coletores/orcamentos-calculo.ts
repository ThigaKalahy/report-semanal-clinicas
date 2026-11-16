import {
  indiceDaColuna, lerData, lerValor, normalizarTexto, centavos, diaMs, contarPorTexto,
  lerTermos, contemTermo,
} from "./planilha";
import type { ItemContagem } from "./planilha";

/**
 * Cálculo do funil de Orçamentos a partir das linhas da planilha.
 * Módulo puro — a leitura da planilha fica em orcamentos.ts.
 *
 * Regras:
 *  - o orçamento entra pela data dele, dentro do período;
 *  - cada status da planilha cai em uma situação: fechado, em aberto, não
 *    fechou ou cancelado. Status vazio ou não reconhecido fica sem situação
 *    (conta no total e aparece em "por status" como está escrito);
 *  - CANCELADOS FICAM FORA DA CONVERSÃO:
 *      conversão em quantidade = fechados ÷ (total − cancelados)
 *      conversão em valor      = valor fechado ÷ (valor gerado − valor cancelado)
 *  - valor gerado  = valor da prescrição (ou o da venda, se a prescrição faltar);
 *    valor fechado = valor da venda dos fechados (ou o da prescrição, se faltar);
 *  - motivos de não fechamento vêm só da própria fonte de orçamentos.
 */

export type SituacaoOrcamento = "fechado" | "aberto" | "nao_fechou" | "cancelado" | null;

export interface ResultadoOrcamentos {
  total: number;
  fechados: number;
  emAberto: number;
  naoFechou: number;
  cancelados: number;
  valorGerado: number;
  valorFechado: number;
  valorEmAberto: number;
  valorCancelado: number;
  /** 0 a 1; null quando não há base (nenhum orçamento válido). */
  conversaoQuantidade: number | null;
  conversaoValor: number | null;
  porStatus: ItemContagem[];
  /** Motivos preenchidos nos orçamentos que não foram fechados. */
  porObjecao: ItemContagem[];
  /**
   * Status preenchidos que não caíram em nenhuma situação. Enquanto houver,
   * a conversão está subestimada: vale ensinar essas palavras na fonte.
   */
  statusSemSituacao: ItemContagem[];
  linhasIlegiveis: number;
}

/** Palavras próprias da clínica para cada situação (texto livre, separado por ";"). */
export interface TermosOrcamento {
  fechado?: string;
  aberto?: string;
  nao_fechou?: string;
  cancelado?: string;
}

export interface ColunasOrcamentos {
  data: string;
  status: string;
  valor_prescricao?: string;
  valor_venda?: string;
  objecao?: string;
}

/**
 * Texto do status → situação. As palavras da clínica (`termos`) valem antes das
 * regras gerais. A ordem importa: "não fechou" antes de "fechou".
 */
export function situacaoDoOrcamento(status: string, termos?: TermosOrcamento): SituacaoOrcamento {
  const s = normalizarTexto(status);
  if (!s) return null;
  if (termos) {
    if (contemTermo(s, lerTermos(termos.cancelado))) return "cancelado";
    if (contemTermo(s, lerTermos(termos.nao_fechou))) return "nao_fechou";
    if (contemTermo(s, lerTermos(termos.aberto))) return "aberto";
    if (contemTermo(s, lerTermos(termos.fechado))) return "fechado";
  }
  if (/cancel/.test(s)) return "cancelado";
  if (/^(nao|n)$/.test(s) || /nao fech|nao aprov|nao aceit|perdid|perdeu|recus|reprov|desist|declin/.test(s)) {
    return "nao_fechou";
  }
  if (/abert|pendent|aguard|negocia|andamento|analise|follow|retorn|pensando/.test(s)) return "aberto";
  if (/^(sim|s)$/.test(s) || /fech|aprov|aceit|vendid|ganh|conclu|realizad|pago/.test(s)) return "fechado";
  return null;
}

export function calcularOrcamentos(
  linhas: unknown[][],
  colunas: ColunasOrcamentos,
  dataInicio: Date,
  dataFim: Date,
  termos?: TermosOrcamento,
): ResultadoOrcamentos {
  const iData = indiceDaColuna(colunas.data);
  const iStatus = indiceDaColuna(colunas.status);
  const iPrescricao = indiceDaColuna(colunas.valor_prescricao);
  const iVenda = indiceDaColuna(colunas.valor_venda);
  const iObjecao = indiceDaColuna(colunas.objecao);
  const ini = diaMs(dataInicio);
  const fim = diaMs(dataFim);

  const qtd = { fechado: 0, aberto: 0, nao_fechou: 0, cancelado: 0 };
  let total = 0;
  let valorGerado = 0, valorFechado = 0, valorEmAberto = 0, valorCancelado = 0;
  let linhasIlegiveis = 0;
  const statusLidos: string[] = [];
  const semSituacao: string[] = [];
  const objecoes: string[] = [];

  for (const linha of linhas) {
    const dataBruta = String(linha[iData] ?? "").trim();
    const statusBruto = String(linha[iStatus] ?? "").trim();
    if (!dataBruta && !statusBruto) continue; // linha em branco

    const data = lerData(dataBruta);
    if (!data) { linhasIlegiveis++; continue; }
    const t = diaMs(data);
    if (t < ini || t > fim) continue;

    const prescricao = iPrescricao >= 0 ? lerValor(linha[iPrescricao]) : null;
    const venda = iVenda >= 0 ? lerValor(linha[iVenda]) : null;
    const gerado = prescricao ?? venda ?? 0;
    const situacao = situacaoDoOrcamento(statusBruto, termos);
    if (!situacao && statusBruto) semSituacao.push(statusBruto);

    total++;
    valorGerado += gerado;
    statusLidos.push(statusBruto);

    if (situacao) qtd[situacao]++;
    if (situacao === "fechado") valorFechado += venda ?? prescricao ?? 0;
    if (situacao === "aberto") valorEmAberto += gerado;
    if (situacao === "cancelado") valorCancelado += gerado;

    if (iObjecao >= 0 && situacao !== "fechado") objecoes.push(String(linha[iObjecao] ?? ""));
  }

  const baseQtd = total - qtd.cancelado;
  const baseValor = valorGerado - valorCancelado;

  return {
    total,
    fechados: qtd.fechado,
    emAberto: qtd.aberto,
    naoFechou: qtd.nao_fechou,
    cancelados: qtd.cancelado,
    valorGerado: centavos(valorGerado),
    valorFechado: centavos(valorFechado),
    valorEmAberto: centavos(valorEmAberto),
    valorCancelado: centavos(valorCancelado),
    conversaoQuantidade: baseQtd > 0 ? qtd.fechado / baseQtd : null,
    conversaoValor: baseValor > 0 ? valorFechado / baseValor : null,
    porStatus: contarPorTexto(statusLidos),
    porObjecao: contarPorTexto(objecoes, true),
    statusSemSituacao: contarPorTexto(semSituacao, true),
    linhasIlegiveis,
  };
}
