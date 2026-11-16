import {
  indiceDaColuna, lerData, lerValor, normalizarTexto, centavos, diaMs, lerTermos, contemTermo,
} from "./planilha";

/**
 * Cálculo das Entradas (recebimentos) a partir das linhas da planilha.
 * Módulo puro — a leitura da planilha fica em entradas.ts.
 *
 * Regras:
 *  - a linha entra pelo dia do RECEBIMENTO, dentro do período;
 *  - com coluna de situação, o que ainda não foi recebido fica à parte, em
 *    "em aberto", e não soma; célula de situação vazia conta como recebida
 *    (e é contada em `semSituacao`, para dar para conferir);
 *  - transferências entre contas, empréstimos e aportes NÃO são receita: ficam
 *    em "fora do resultado", só como informação;
 *  - o total é operacional + não operacional.
 */

export type GrupoEntrada = "operacional" | "nao_operacional" | "fora";

export const ROTULO_GRUPO_ENTRADA: Record<GrupoEntrada, string> = {
  operacional: "Operacional",
  nao_operacional: "Não operacional",
  fora: "Fora do resultado",
};

export interface CategoriaEntrada {
  nome: string;
  grupo: GrupoEntrada;
  valor: number;
  /** Participação dentro do total do resultado (0 a 1); 0 para o que está fora. */
  pct: number;
}

export interface ResultadoEntradas {
  /** Operacionais + não operacionais. */
  total: number;
  operacionais: number;
  naoOperacionais: number;
  foraDoResultado: number;
  /** Linhas recebidas no período (inclui as fora do resultado). */
  lancamentos: number;
  emAberto: { valor: number; quantidade: number };
  /** Linhas recebidas cuja célula de situação estava vazia. */
  semSituacao: number;
  porCategoria: CategoriaEntrada[];
  /** Linhas com data no formato certo mas valor ilegível, ou o contrário. */
  linhasIlegiveis: number;
}

export interface ColunasEntradas {
  data: string;
  valor: string;
  situacao?: string;
  categoria?: string;
}

/** Palavras próprias da clínica para cada grupo (texto livre, separado por ";"). */
export interface TermosEntrada {
  fora?: string;
  nao_operacional?: string;
}

/**
 * Categoria → grupo. Palavras procuradas no nome da categoria, sem acento; as
 * da clínica (`termos`) valem antes das regras gerais.
 */
export function grupoDaEntrada(categoria: string, termos?: TermosEntrada): GrupoEntrada {
  const c = normalizarTexto(categoria);
  if (termos) {
    if (contemTermo(c, lerTermos(termos.fora))) return "fora";
    if (contemTermo(c, lerTermos(termos.nao_operacional))) return "nao_operacional";
  }
  if (/transferencia|emprestimo|aporte/.test(c)) return "fora";
  if (/nao operacion|rendimento|juros/.test(c)) return "nao_operacional";
  return "operacional";
}

/** A situação diz que o valor AINDA NÃO entrou? */
export function situacaoEmAberto(situacao: string): boolean {
  const s = normalizarTexto(situacao);
  if (!s) return false;
  return /^(nao|n|false|0)$/.test(s) || /abert|a receber|pendent|previst|atras|vencid|nao recebid|inadimpl|cancel/.test(s);
}

export function calcularEntradas(
  linhas: unknown[][],
  colunas: ColunasEntradas,
  dataInicio: Date,
  dataFim: Date,
  termos?: TermosEntrada,
): ResultadoEntradas {
  const iData = indiceDaColuna(colunas.data);
  const iValor = indiceDaColuna(colunas.valor);
  const iSituacao = indiceDaColuna(colunas.situacao);
  const iCategoria = indiceDaColuna(colunas.categoria);
  const ini = diaMs(dataInicio);
  const fim = diaMs(dataFim);

  const somas: Record<GrupoEntrada, number> = { operacional: 0, nao_operacional: 0, fora: 0 };
  const categorias = new Map<string, { nome: string; grupo: GrupoEntrada; valor: number }>();
  const emAberto = { valor: 0, quantidade: 0 };
  let lancamentos = 0;
  let semSituacao = 0;
  let linhasIlegiveis = 0;

  for (const linha of linhas) {
    const dataBruta = String(linha[iData] ?? "").trim();
    const valorBruto = String(linha[iValor] ?? "").trim();
    // sem valor lançado (linha em branco ou só agendada): não entra e não é erro
    if (!valorBruto) continue; // linha em branco

    const data = lerData(dataBruta);
    const valor = lerValor(valorBruto);
    if (!data || valor === null) { linhasIlegiveis++; continue; }

    const t = diaMs(data);
    if (t < ini || t > fim) continue;

    if (iSituacao >= 0) {
      const situacao = String(linha[iSituacao] ?? "");
      if (situacaoEmAberto(situacao)) {
        emAberto.valor += valor;
        emAberto.quantidade++;
        continue;
      }
      if (!situacao.trim()) semSituacao++;
    }

    const nome = (iCategoria >= 0 ? String(linha[iCategoria] ?? "").trim() : "") || "Não informado";
    const grupo = grupoDaEntrada(nome, termos);
    somas[grupo] += valor;
    lancamentos++;

    const chave = normalizarTexto(nome);
    const atual = categorias.get(chave);
    if (atual) atual.valor += valor; else categorias.set(chave, { nome, grupo, valor });
  }

  const total = somas.operacional + somas.nao_operacional;
  const ordemGrupo: GrupoEntrada[] = ["operacional", "nao_operacional", "fora"];

  return {
    total: centavos(total),
    operacionais: centavos(somas.operacional),
    naoOperacionais: centavos(somas.nao_operacional),
    foraDoResultado: centavos(somas.fora),
    lancamentos,
    emAberto: { valor: centavos(emAberto.valor), quantidade: emAberto.quantidade },
    semSituacao,
    porCategoria: [...categorias.values()]
      .sort((a, b) =>
        ordemGrupo.indexOf(a.grupo) - ordemGrupo.indexOf(b.grupo) || b.valor - a.valor)
      .map((c) => ({
        nome: c.nome,
        grupo: c.grupo,
        valor: centavos(c.valor),
        pct: c.grupo !== "fora" && total > 0 ? c.valor / total : 0,
      })),
    linhasIlegiveis,
  };
}
