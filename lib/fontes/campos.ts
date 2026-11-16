import type { TipoFonte } from "@/lib/supabase/types";

/**
 * Colunas que cada fonte de dados conhece, além da data.
 *
 * A chave é o nome guardado em `fontes_dados.mapeamento` (e o campo de
 * `DEFINICOES` em detectar-colunas.ts). A coluna da data fica à parte, em
 * `fontes_dados.coluna_data`.
 *
 * Módulo puro: usado pelo formulário (cliente), pelas actions e pelos coletores.
 */

export interface CampoFonte {
  chave: string;
  rotulo: string;
  obrigatorio?: boolean;
  /** O que a coluna destrava nos relatórios — vira texto de ajuda no formulário. */
  ajuda?: string;
}

export const ROTULO_FONTE: Record<TipoFonte, string> = {
  pre_consulta: "Pré-Consulta",
  nps:          "NPS",
  leads:        "Leads",
  faturamento:  "Faturamento",
  despesa:      "Despesa",
  entradas:     "Entradas",
  orcamentos:   "Orçamentos",
};

/** Rótulo da coluna de data de cada fonte. */
export const ROTULO_DATA: Record<TipoFonte, string> = {
  pre_consulta: "Data/hora",
  nps:          "Data/hora",
  leads:        "Data do contato",
  faturamento:  "Data do atendimento",
  despesa:      "Data de vencimento",
  entradas:     "Data do recebimento",
  orcamentos:   "Data do orçamento",
};

/** Fontes novas, de aba única: todas as colunas são descritas aqui. */
export const CAMPOS_ENTRADAS: CampoFonte[] = [
  { chave: "valor",       rotulo: "Valor recebido", obrigatorio: true },
  { chave: "situacao",    rotulo: "Situação",
    ajuda: "Separa o que já foi recebido do que está em aberto. Sem ela, toda linha conta como recebida." },
  { chave: "categoria",   rotulo: "Categoria",
    ajuda: "Detalha as entradas por categoria e separa transferências, empréstimos e aportes." },
  { chave: "forma",       rotulo: "Forma de recebimento" },
  { chave: "competencia", rotulo: "Competência", ajuda: "Usada na visão de caixa e competência do ano." },
  { chave: "descricao",   rotulo: "Descrição" },
];

export const CAMPOS_ORCAMENTOS: CampoFonte[] = [
  { chave: "status",           rotulo: "Fechamento / status", obrigatorio: true },
  { chave: "valor_prescricao", rotulo: "Valor da prescrição", ajuda: "Valor orçado. Base do “valor gerado”." },
  { chave: "valor_venda",      rotulo: "Valor da venda",      ajuda: "Valor efetivamente fechado." },
  { chave: "paciente",         rotulo: "Cliente / paciente" },
  { chave: "profissional",     rotulo: "Profissional" },
  { chave: "prescricao",       rotulo: "Prescrição de tratamento" },
  { chave: "objecao",          rotulo: "Motivo / objeção", ajuda: "Destrava “motivos de não fechamento”." },
];

/**
 * Colunas opcionais acrescentadas às fontes que já existiam. As colunas
 * originais de cada uma continuam nos seus formulários.
 */
export const CAMPOS_EXTRAS: Partial<Record<TipoFonte, CampoFonte[]>> = {
  leads: [
    { chave: "origem",      rotulo: "Origem",              ajuda: "Como o lead conheceu a clínica." },
    { chave: "canal",       rotulo: "Canal",               ajuda: "WhatsApp, ligação, Instagram…" },
    { chave: "interesse",   rotulo: "Interesse / serviço", ajuda: "Serviço ou queixa buscada." },
    { chave: "objecao",     rotulo: "Objeção",             ajuda: "Por que não agendou." },
    { chave: "responsavel", rotulo: "Responsável" },
  ],
  faturamento: [
    { chave: "paciente",     rotulo: "Cliente / paciente", ajuda: "Destrava clientes atendidos e ticket médio." },
    { chave: "primeira_vez", rotulo: "1ª vez (cliente novo)", ajuda: "Destrava clientes novos e ticket dos novos." },
    { chave: "pagamento",    rotulo: "Meio de pagamento" },
    { chave: "unidade",      rotulo: "Unidade" },
  ],
  despesa: [
    { chave: "situacao",       rotulo: "Pago? / situação" },
    { chave: "data_pagamento", rotulo: "Data de pagamento" },
    { chave: "periodicidade",  rotulo: "Periodicidade", ajuda: "Fixa, variável, recorrente…" },
    { chave: "competencia",    rotulo: "Competência" },
    { chave: "centro_custo",   rotulo: "Centro de custo" },
    { chave: "descricao",      rotulo: "Descrição" },
  ],
};

/**
 * Palavras próprias da clínica, por fonte: texto livre (separado por ";") que
 * ensina como classificar o que está escrito na planilha. Ficam no mapeamento
 * com estas chaves e valem antes das regras gerais dos cálculos.
 */
export interface TermoFonte {
  chave: string;
  rotulo: string;
  exemplo: string;
}

export const TERMOS_FONTE: Record<"entradas" | "orcamentos", { ajuda: string; termos: TermoFonte[] }> = {
  entradas: {
    ajuda:
      "Por padrão, categorias com “transferência”, “empréstimo” ou “aporte” ficam fora do resultado, e com " +
      "“não operacional”, “rendimento” ou “juros” são não operacionais. Acrescente aqui as palavras desta clínica.",
    termos: [
      { chave: "termos_fora", rotulo: "Fora do resultado", exemplo: "resgate; mútuo" },
      { chave: "termos_nao_operacional", rotulo: "Não operacional", exemplo: "venda de equipamento" },
    ],
  },
  orcamentos: {
    ajuda:
      "Por padrão o status é lido por palavras comuns (fechado, aprovado, em aberto, não fechou, cancelado…). " +
      "Se a planilha usa outras, informe aqui — o teste de leitura mostra os status que ficaram sem classificação.",
    termos: [
      { chave: "termos_fechado", rotulo: "Contam como fechado", exemplo: "protocolo completo; contratou" },
      { chave: "termos_aberto", rotulo: "Contam como em aberto", exemplo: "em negociação; avaliando" },
      { chave: "termos_nao_fechou", rotulo: "Contam como não fechou", exemplo: "sem interesse" },
      { chave: "termos_cancelado", rotulo: "Contam como cancelado", exemplo: "estornado" },
    ],
  },
};

/** Campos das fontes de aba única (as novas). */
export const CAMPOS_FONTE_SIMPLES: Record<"entradas" | "orcamentos", CampoFonte[]> = {
  entradas: CAMPOS_ENTRADAS,
  orcamentos: CAMPOS_ORCAMENTOS,
};

export type TipoFonteSimples = keyof typeof CAMPOS_FONTE_SIMPLES;

export function ehFonteSimples(tipo: TipoFonte): tipo is TipoFonteSimples {
  return tipo === "entradas" || tipo === "orcamentos";
}

const ROTULOS_ANTIGOS: Record<string, string> = {
  coluna_data: "Data", valor_pago: "Valor", categoria: "Categoria", profissional: "Profissional",
  convertido: "Conversão", valor_conversao: "Valor que indica conversão", linha_inicial: "Linha inicial",
  motivo: "Motivo", origem: "Origem",
  nota_geral: "Nota geral", nota_profissional: "Nota profissional", nota_recepcao: "Nota recepção",
  nota_infraestrutura: "Nota infraestrutura", nota_enfermagem: "Nota enfermagem",
  comentario: "Comentário", nome_paciente: "Nome", anonimato: "Anonimato", indicacao: "Indicação",
};

/** Rótulo legível de uma chave de mapeamento, para qualquer fonte. */
export function rotuloDoCampo(tipo: TipoFonte, chave: string): string {
  const lista = [
    ...(ehFonteSimples(tipo) ? CAMPOS_FONTE_SIMPLES[tipo] : []),
    ...(CAMPOS_EXTRAS[tipo] ?? []),
  ];
  const termo = ehFonteSimples(tipo) ? TERMOS_FONTE[tipo].termos.find((t) => t.chave === chave) : undefined;
  if (termo) return `Palavras: ${termo.rotulo.toLowerCase()}`;
  return lista.find((c) => c.chave === chave)?.rotulo ?? ROTULOS_ANTIGOS[chave] ?? chave.replace(/_/g, " ");
}
