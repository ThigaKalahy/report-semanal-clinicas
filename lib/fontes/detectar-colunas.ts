import type { TipoFonte } from "@/lib/supabase/types";

/**
 * Detecção das colunas de uma planilha pelo texto do cabeçalho.
 *
 * Cada campo tem uma lista de apelidos em ordem de preferência. A busca roda em
 * duas passadas: primeiro o cabeçalho IGUAL a um apelido; só depois, para o que
 * sobrou, o cabeçalho que CONTÉM o apelido no início de uma palavra. Uma coluna
 * nunca é dada a dois campos.
 *
 * As listas vêm do Sync Financeiro (nomes reais das planilhas dos clientes),
 * somadas às palavras que este app já reconhecia nos formulários do Google.
 *
 * Módulo puro: usado pelo formulário de fontes (cliente) e testável sem rede.
 */

/** campo → apelidos, do mais específico ao mais genérico. A ordem dos campos também importa. */
export type DefinicaoFonte = Record<string, string[]>;

export interface ColunaDetectada {
  indice: number;       // 0 = coluna A
  letra: string;        // "A", "B", … "AA"
  cabecalho: string;    // texto original da planilha
  /** false = casou por aproximação; vale conferir antes de salvar. */
  exata: boolean;
}

export type Deteccao = Record<string, ColunaDetectada>;

export const DEFINICOES: Record<TipoFonte, DefinicaoFonte> = {
  faturamento: {
    coluna_data: [
      "data_ajustada", "data ajustada", "data de atendimento", "data do atendimento",
      "data", "carimbo de data/hora",
    ],
    valor_pago:   ["total_ajustado", "valor pago", "valor faturado", "valor recebido", "valor"],
    // Coluna "ajustada" é curadoria deliberada da planilha: vence a categoria bruta
    categoria: [
      "categoria_ajustada", "categoria ajustada",
      "categoria", "macro-categoria", "servico", "procedimento", "tipo",
      // planilhas sem coluna de categoria classificam pela descrição
      "descricao da venda", "descricao do recebimento", "descricao",
    ],
    profissional: ["profissional responsavel", "profissional", "medico responsavel", "medico", "dentista"],
    paciente:     ["paciente", "nome do paciente", "nome paciente", "cliente", "nome do cliente", "nome"],
    primeira_vez: ["1ª vez na clinica?", "1a vez na clinica?", "primeira vez", "paciente novo", "novo?"],
    pagamento:    ["meio de pagamento", "forma de pagamento", "pagamento"],
    unidade:      ["unidade", "centro de custo", "filial"],
  },
  despesa: {
    // Regra Gestfy: despesa conta pela data de VENCIMENTO. A de pagamento só
    // entra quando a planilha não tem vencimento. "pagamento" sozinho ficou de
    // fora de propósito — casava com "Forma de pagamento".
    coluna_data: [
      "data vcto", "data de vencimento", "data vencimento", "vencimento",
      "data pgto", "data de pagamento", "data pagamento", "data do ultimo pagamento",
      "data",
    ],
    categoria:  ["ajuste_categoria", "categoria ajustada", "categoria"],
    valor_pago: [
      "valor r$", "valor pago", "valor total pago da parcela (r$)",
      "valor pago da parcela (r$)", "vl pago r$", "vl pago", "vl receb r$", "vl receb", "valor",
    ],
    // Vem depois de coluna_data: se a planilha só tem a data de pagamento, ela
    // já foi usada como data da despesa e este campo fica vazio.
    data_pagamento: ["data pgto", "data de pagamento", "data pagamento", "data do ultimo pagamento"],
    situacao:       ["pago?", "pago", "status", "situacao"],
    periodicidade:  ["periodicidade", "recorrencia"],
    competencia:    ["competencia", "mes de competencia", "mes_comp", "data de competencia"],
    centro_custo:   ["centro de custo", "unidade"],
    descricao:      ["descricao", "historico", "fornecedor"],
  },
  leads: {
    coluna_data: [
      "data_ajuste", "data ajustada", "data 1º contato", "data do 1º contato",
      "data contato", "data do contato", "data de contato", "criado em",
      "data", "carimbo de data/hora",
    ],
    convertido: ["status final", "agendou?", "convertido", "status", "situacao"],
    origem: [
      "origem", "origem do lead", "por onde veio?", "como conheceu", "como conheceu?",
      "onde conheceu?", "onde conheceu",
    ],
    canal:       ["canal", "contato cliente"],
    interesse:   ["interesse", "servico", "servico buscado", "queixa", "queixa/objetivo", "procedimento"],
    objecao:     ["objecao", "objecao (caso nao agende)", "motivo de perda"],
    responsavel: ["responsavel", "atendente"],
  },
  entradas: {
    coluna_data: [
      "data receb", "data do recebimento", "data de recebimento", "data recebimento",
      "data do ultimo pagamento", "data pgto", "data de pagamento", "data",
    ],
    valor: [
      "valor total recebido da parcela (r$)", "valor recebido da parcela (r$)", "vl receb r$",
      "vl receb", "valor recebido", "valor r$", "valor",
    ],
    situacao:    ["status recebido", "status do recebimento", "recebido?", "recebido", "status", "situacao"],
    categoria:   ["categoria", "categoria 1", "categoria gestfy"],
    forma:       ["forma receb", "forma de recebimento", "forma de pagamento", "meio de pagamento"],
    competencia: ["data de competencia", "competencia", "mes de competencia"],
    descricao:   ["descricao", "cliente/forneced/descricao", "historico"],
  },
  orcamentos: {
    coluna_data:      ["data", "data da consulta", "data do orcamento"],
    paciente:         ["nome paciente", "paciente", "cliente", "nome"],
    profissional:     ["medico responsavel", "profissional", "medico"],
    prescricao:       ["prescricao de tratamentos?", "prescricao de tratamento?", "prescricao"],
    status:           ["fechamento", "status do orcamento", "status orcamento", "situacao", "status"],
    valor_venda:      ["valor da venda", "valor fechado", "valor vendido"],
    valor_prescricao: ["valor prescricao", "valor da prescricao", "valor orcado", "valor do orcamento"],
    objecao: [
      "objecao do orcamento", "motivo nao fechou", "motivo de nao fechamento", "motivo da perda",
      "motivo de perda", "objecao", "motivo",
    ],
  },
  // A ordem dos campos importa na passada aproximada: perguntas longas de
  // formulário compartilham palavras ("nota", "profissional", "indicaria"),
  // então o mais específico é procurado antes e a nota geral fica por último.
  nps: {
    coluna_data:         ["data ajustada", "carimbo de data/hora", "data/hora", "data"],
    nota_profissional:   ["nota do profissional", "atendimento do profissional", "profissional de saude que te atendeu"],
    nota_recepcao:       ["nota da recepcao", "recepcao"],
    nota_infraestrutura: ["nota da infraestrutura", "infraestrutura", "estrutura"],
    nota_enfermagem:     ["nota da enfermagem", "enfermagem"],
    anonimato:           ["anonimato", "anonimo", "privacidade"],
    indicacao: [
      "indicacao", "indicacoes", "indicou", "indique", "referencia",
      "nome e telefone", "conhece alguem",
    ],
    comentario: [
      "comentario", "sugestao", "sugestoes", "observacao", "observacoes",
      "motivos que te levaram", "quais foram os motivos",
    ],
    nome_paciente:       ["nome do paciente", "nome completo", "paciente", "nome"],
    nota_geral: [
      "nps", "nota geral", "avaliacao geral", "escala de 0 a 10", "de 0 a 10",
      "indicaria", "recomendaria", "nota",
    ],
  },
  pre_consulta: {
    coluna_data: ["carimbo de data/hora", "data/hora", "data"],
    // "motivo" por último: na aproximação ele casa com "O que te motivou…"
    motivo: [
      "foco da sua consulta", "principal objetivo", "porque buscou", "por que buscou",
      "motivo da consulta", "motivo", "queixa",
    ],
    origem: [
      "origem", "como nos conheceu", "como conheceu", "como ficou sabendo", "onde conheceu",
      "por onde veio", "captacao", "canal",
    ],
  },
};

/** "A", "B", … "Z", "AA" a partir do índice 0. */
export function letraDaColuna(indice: number): string {
  let resultado = "";
  let n = indice + 1;
  while (n > 0) {
    resultado = String.fromCharCode(64 + ((n - 1) % 26 + 1)) + resultado;
    n = Math.floor((n - 1) / 26);
  }
  return resultado;
}

/**
 * Deixa cabeçalho e apelido comparáveis: sem acento, sem caixa e com qualquer
 * pontuação virando espaço ("Valor R$" → "valor r", "1ª vez?" → "1a vez").
 */
export function normalizarCabecalho(texto: string): string {
  return String(texto ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** O cabeçalho contém o apelido começando no início de uma palavra? */
function contem(cabecalho: string, apelido: string): boolean {
  return ` ${cabecalho}`.includes(` ${apelido}`);
}

/**
 * Detecta as colunas de `cabecalho` (a linha de títulos, na ordem da planilha).
 * Campos sem correspondência simplesmente não aparecem no resultado.
 */
export function detectarColunas(cabecalho: unknown[], definicao: DefinicaoFonte): Deteccao {
  const colunas = cabecalho.map((c, indice) => ({
    indice,
    original: String(c ?? "").trim(),
    norm: normalizarCabecalho(String(c ?? "")),
  })).filter((c) => c.norm !== "");

  const usadas = new Set<number>();
  const achadas: Deteccao = {};

  const registrar = (campo: string, col: (typeof colunas)[number], exata: boolean) => {
    usadas.add(col.indice);
    achadas[campo] = {
      indice: col.indice,
      letra: letraDaColuna(col.indice),
      cabecalho: col.original,
      exata,
    };
  };

  const apelidosDe = (campo: string) =>
    definicao[campo].map(normalizarCabecalho).filter(Boolean);

  // 1ª passada — igualdade. Roda para todos os campos antes de qualquer
  // aproximação, para um "Valor pago" exato nunca perder a vaga para um palpite.
  for (const campo of Object.keys(definicao)) {
    for (const apelido of apelidosDe(campo)) {
      const col = colunas.find((c) => !usadas.has(c.indice) && c.norm === apelido);
      if (col) { registrar(campo, col, true); break; }
    }
  }

  // 2ª passada — aproximação, só para o que ficou sem coluna.
  for (const campo of Object.keys(definicao)) {
    if (achadas[campo]) continue;
    for (const apelido of apelidosDe(campo)) {
      const col = colunas.find((c) => !usadas.has(c.indice) && contem(c.norm, apelido));
      if (col) { registrar(campo, col, false); break; }
    }
  }

  return achadas;
}

/** Atalho: detecção usando a definição do tipo de fonte. */
export function detectarPorTipo(tipo: TipoFonte, cabecalho: unknown[]): Deteccao {
  return detectarColunas(cabecalho, DEFINICOES[tipo]);
}
