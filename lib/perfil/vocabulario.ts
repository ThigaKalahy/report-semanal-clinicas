/**
 * Vocabulário dos textos gerados.
 *
 * Cada segmento troca as palavras do relatório: uma clínica fala de pacientes e
 * médicos, um consultório odontológico de pacientes e dentistas, um shopping de
 * clientes e lojas. O que a clínica personalizar na ficha prevalece sobre o
 * padrão do segmento.
 *
 * Módulo puro (sem I/O): é importado tanto por código de servidor quanto pelo
 * componente de cliente da ficha.
 */

export type SegmentoTipo =
  | "clinica" | "odontologia" | "estetica" | "varejo" | "servicos" | "outro";

export interface Vocabulario {
  cliente: string;
  clientes: string;
  profissional: string;
  profissionais: string;
  servico: string;
  servicos: string;
  area: string;
  areas: string;
  saudacao: string;
  /** Gênero gramatical de "profissional" no segmento ("o médico", "a loja"). */
  genero: "o" | "a";
}

/** Termos que a clínica pode sobrescrever (gênero não é editável). */
export type TermoVocabulario = Exclude<keyof Vocabulario, "genero">;

export const NEUTRO: Vocabulario = {
  cliente: "cliente",
  clientes: "clientes",
  profissional: "profissional",
  profissionais: "profissionais",
  servico: "serviço",
  servicos: "serviços",
  area: "área de atuação",
  areas: "áreas de atuação",
  saudacao: "Olá, pessoal!",
  genero: "o",
};

export const SEGMENTOS: { id: SegmentoTipo; rotulo: string; vocab: Vocabulario }[] = [
  {
    id: "clinica",
    rotulo: "Clínica médica",
    vocab: {
      ...NEUTRO,
      cliente: "paciente", clientes: "pacientes",
      profissional: "médico", profissionais: "médicos",
      servico: "procedimento", servicos: "procedimentos",
      area: "especialidade", areas: "especialidades",
      saudacao: "Fala, Drs.!",
    },
  },
  {
    id: "odontologia",
    rotulo: "Odontologia",
    vocab: {
      ...NEUTRO,
      cliente: "paciente", clientes: "pacientes",
      profissional: "dentista", profissionais: "dentistas",
      servico: "tratamento", servicos: "tratamentos",
      area: "especialidade", areas: "especialidades",
      saudacao: "Fala, Drs.!",
    },
  },
  {
    id: "estetica",
    rotulo: "Estética",
    vocab: { ...NEUTRO, servico: "procedimento", servicos: "procedimentos" },
  },
  {
    id: "varejo",
    rotulo: "Shopping / varejo",
    vocab: {
      ...NEUTRO,
      profissional: "loja", profissionais: "lojas",
      servico: "venda", servicos: "vendas",
      area: "segmento", areas: "segmentos",
      genero: "a",
    },
  },
  { id: "servicos", rotulo: "Serviços", vocab: NEUTRO },
  { id: "outro",    rotulo: "Outro",    vocab: NEUTRO },
];

/** Campos editáveis do vocabulário, na ordem em que aparecem na ficha. */
export const CAMPOS_VOCAB: { k: TermoVocabulario; rotulo: string }[] = [
  { k: "cliente",       rotulo: "Quem compra (singular)" },
  { k: "clientes",      rotulo: "Quem compra (plural)" },
  { k: "profissional",  rotulo: "Quem atende (singular)" },
  { k: "profissionais", rotulo: "Quem atende (plural)" },
  { k: "servico",       rotulo: "O que é vendido (singular)" },
  { k: "servicos",      rotulo: "O que é vendido (plural)" },
  { k: "area",          rotulo: "Área de atuação (singular)" },
  { k: "areas",         rotulo: "Área de atuação (plural)" },
  { k: "saudacao",      rotulo: "Saudação do texto" },
];

const LIMITE_TERMO = 40;

/** Primeira letra maiúscula ("paciente" → "Paciente"). */
export function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * Sugere o segmento a partir de um texto livre (nome ou descrição do negócio).
 * Devolve "" quando nada casa — nesse caso vale o vocabulário neutro.
 */
export function segmentoDoTexto(texto: string): SegmentoTipo | "" {
  const t = texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (!t.trim()) return "";
  if (/odonto|dent/.test(t)) return "odontologia";
  if (/estetic|beleza|spa\b/.test(t)) return "estetica";
  if (/shopping|varejo|loja/.test(t)) return "varejo";
  if (/clinic|medic|saude|hospital|dermato|cardio|oftalmo|ortoped|cirurg|pediatr|ginec/.test(t)) {
    return "clinica";
  }
  return "";
}

/** O que a função precisa saber da ficha para montar o vocabulário. */
export interface FonteVocabulario {
  segmentoTipo?: string | null;
  segmento?: string | null;
  vocabulario?: Record<string, unknown> | null;
}

/**
 * Vocabulário efetivo da clínica: padrão do segmento (ou o segmento adivinhado
 * pela descrição) com os termos personalizados por cima. Sem ficha, o neutro.
 */
export function vocabularioDe(ficha?: FonteVocabulario | null): Vocabulario {
  const tipo = ficha?.segmentoTipo || segmentoDoTexto(ficha?.segmento ?? "");
  const base = SEGMENTOS.find((s) => s.id === tipo)?.vocab ?? NEUTRO;

  const proprios: Partial<Vocabulario> = {};
  for (const [chave, valor] of Object.entries(ficha?.vocabulario ?? {})) {
    if (chave === "genero" || typeof valor !== "string" || !valor.trim()) continue;
    if (!CAMPOS_VOCAB.some((c) => c.k === chave)) continue;
    const termo = valor.trim().slice(0, LIMITE_TERMO);
    // A saudação preserva a caixa ("Fala, Pri"); os demais termos vão em minúsculas
    proprios[chave as TermoVocabulario] = chave === "saudacao" ? termo : termo.toLowerCase();
  }

  return { ...base, ...proprios };
}
