/**
 * Catálogo da estrutura dos relatórios: quais seções existem em cada
 * periodicidade e quais indicadores cada seção mostra.
 *
 * As seções e os indicadores de mensal e quinzenal vêm do Sync Financeiro; as
 * de semanal descrevem o Report Semanal que este app sempre gerou — agora
 * configurável por clínica, como as outras duas.
 *
 * Módulo puro: usado pela tela de configuração (cliente), pelos montadores de
 * relatório e pelos testes. Não importa nada que toque rede ou banco.
 */

export type Periodicidade = "semanal" | "quinzenal" | "mensal";

export const PERIODICIDADES: { id: Periodicidade; rotulo: string; descricao: string }[] = [
  { id: "semanal",   rotulo: "Semanal",   descricao: "Report semanal de pesquisas, avaliações e leads" },
  { id: "quinzenal", rotulo: "Quinzenal", descricao: "Acompanhamento do mês em andamento" },
  { id: "mensal",    rotulo: "Mensal",    descricao: "Fechamento completo do mês" },
];

export interface NivelSecao {
  id: string;
  rotulo: string;
}

export interface DefinicaoSecao {
  id: string;
  titulo: string;
  descricao: string;
  /** Periodicidades em que a seção existe. */
  tipos: Periodicidade[];
  /** Seção fixa: sempre entra no relatório, não pode ser desligada. */
  fixa?: boolean;
  /** Vem desligada em clínica nova (padrão: ligada). */
  ativaPadrao?: boolean;
  /** Níveis de detalhe, quando a seção tem mais de um. */
  niveis?: NivelSecao[];
  nivelPadrao?: Partial<Record<Periodicidade, string>>;
  /** O que a clínica precisa ter para a seção fazer sentido (ver `Disponibilidade`). */
  requer?: string;
  semDados?: string;
  /** Dicas de diagramação do relatório (PDF/tela do fechamento). */
  grande?: boolean;
  tituloProprio?: boolean;
}

export interface DefinicaoIndicador {
  id: string;
  secao: string;
  rotulo: string;
  /** De onde o número vem, em palavras. */
  fonte: string;
  /** Como é calculado — mostrado na tela de configuração. */
  regra: string;
  /** Periodicidades em que existe (ausente = todas as da seção). */
  tipos?: Periodicidade[];
  /** Não pode ser ocultado. */
  obrigatorio?: boolean;
  /** Indicador de detalhe: some quando a seção está no nível "resumo". */
  detalhe?: boolean;
  /** Chave de disponibilidade exigida (ver `Disponibilidade`). */
  requer?: string;
  /** Explicação mostrada quando a chave exigida falta. */
  semDados?: string;
}

const NIVEIS_RESUMO_COMPLETO: NivelSecao[] = [
  { id: "resumo",   rotulo: "Resumo" },
  { id: "completo", rotulo: "Completo" },
];

export const SECOES: DefinicaoSecao[] = [
  // ── Semanal ────────────────────────────────────────────────────────────────
  {
    id: "semPreConsulta", titulo: "Questionário pré-consulta",
    descricao: "Respostas da semana, motivo principal e de onde o cliente veio",
    tipos: ["semanal"], requer: "preConsulta", semDados: "sem fonte de pré-consulta",
  },
  {
    id: "semNps", titulo: "Pesquisa NPS",
    descricao: "Notas, classificação, avaliação por área, indicações e comentários",
    tipos: ["semanal"], requer: "nps", semDados: "sem fonte de NPS",
  },
  {
    id: "semGoogle", titulo: "Avaliações no Google",
    descricao: "Novas avaliações do período (automáticas ou inseridas à mão)",
    tipos: ["semanal"],
  },
  {
    id: "semLeads", titulo: "Leads",
    descricao: "Total de leads, convertidos, taxa de conversão e meta",
    tipos: ["semanal"],
  },

  // ── Quinzenal e mensal (Sync Financeiro) ───────────────────────────────────
  {
    id: "resultado", titulo: "Resultado do período",
    descricao: "Boxes com faturamento, despesas, resultado, meta, atendimentos e tickets",
    tipos: ["mensal", "quinzenal"], fixa: true,
  },
  {
    id: "grafico", titulo: "Gráfico de faturamento e despesas",
    descricao: "Linhas do ano, mês a mês",
    tipos: ["mensal"], tituloProprio: true,
  },
  {
    id: "ritmo", titulo: "Ritmo do mês",
    descricao: "Faturamento por dia útil, projeção e quanto falta para a meta",
    tipos: ["quinzenal"], fixa: true, tituloProprio: true,
  },
  {
    id: "caixaMes", titulo: "Caixa do mês",
    descricao: "Despesas do mês, média de 3 meses, provisionado e saldo projetado",
    tipos: ["quinzenal"], tituloProprio: true,
  },
  {
    id: "funilLeads", titulo: "Funil de leads",
    descricao: "Leads, agendamentos e conversão",
    tipos: ["mensal", "quinzenal"],
    niveis: NIVEIS_RESUMO_COMPLETO, nivelPadrao: { mensal: "completo", quinzenal: "resumo" },
    requer: "leads", semDados: "sem fonte de Leads", tituloProprio: true,
  },
  {
    id: "funilOrcamentos", titulo: "Funil de orçamentos",
    descricao: "Por valor e por quantidade; cancelados ficam fora da conversão",
    tipos: ["mensal", "quinzenal"],
    niveis: NIVEIS_RESUMO_COMPLETO, nivelPadrao: { mensal: "completo", quinzenal: "resumo" },
    requer: "orcamentos", semDados: "sem fonte de Orçamentos", tituloProprio: true,
  },
  {
    id: "experiencia", titulo: "Experiência do cliente",
    descricao: "NPS, notas por área e avaliações no Google (só o que a fonte tiver)",
    tipos: ["mensal"], tituloProprio: true,
  },
  {
    id: "receitas", titulo: "Receitas detalhadas",
    descricao: "Categorias com valor, quantidade, ticket e variação",
    tipos: ["mensal", "quinzenal"], fixa: true, grande: true,
    niveis: [
      { id: "com_valor", rotulo: "Só categorias com movimento" },
      { id: "todas",     rotulo: "Todas as categorias (12 meses)" },
    ],
    nivelPadrao: { mensal: "todas", quinzenal: "todas" },
  },
  {
    id: "distribuicao", titulo: "Faturamento por profissional, unidade e pagamento",
    descricao: "Participação de cada profissional, unidade e meio de pagamento",
    tipos: ["mensal"], ativaPadrao: false,
  },
  {
    id: "despesas", titulo: "Despesas detalhadas",
    descricao: "Grupos e categorias, com o que mais aumentou",
    tipos: ["mensal"], fixa: true, grande: true,
    niveis: [
      { id: "grupos",     rotulo: "Só grupos" },
      { id: "categorias", rotulo: "Grupos e categorias" },
    ],
    nivelPadrao: { mensal: "categorias" },
  },
  {
    id: "entradas", titulo: "Entradas detalhadas",
    descricao: "Recebimentos por grupo e categoria (só com a fonte de Entradas)",
    tipos: ["mensal"], tituloProprio: true,
    niveis: [
      { id: "grupos",     rotulo: "Só grupos" },
      { id: "categorias", rotulo: "Grupos e categorias" },
      { id: "completo",   rotulo: "Grupos, categorias e fora do resultado" },
    ],
    nivelPadrao: { mensal: "categorias" },
    requer: "entradas", semDados: "sem fonte de Entradas",
  },
  {
    id: "regimes", titulo: "Caixa e competência no ano",
    descricao: "Entradas, saídas e saldo mês a mês",
    tipos: ["mensal"], grande: true,
    niveis: [
      { id: "caixa", rotulo: "Só regime de caixa" },
      { id: "ambos", rotulo: "Caixa e competência" },
    ],
    nivelPadrao: { mensal: "ambos" },
  },
  {
    id: "analise", titulo: "Análise e plano de ação",
    descricao: "Texto do fechamento e ações com responsáveis",
    tipos: ["mensal", "quinzenal"], grande: true, ativaPadrao: false,
  },
];

export const INDICADORES: DefinicaoIndicador[] = [
  // ── Semanal ────────────────────────────────────────────────────────────────
  { id: "sem.pre.respostas", secao: "semPreConsulta", rotulo: "Respostas da semana", fonte: "Pré-consulta",
    regra: "Quantidade de questionários respondidos no período.", obrigatorio: true },
  { id: "sem.pre.motivos", secao: "semPreConsulta", rotulo: "Motivo principal", fonte: "Pré-consulta (motivo)",
    regra: "Os três motivos mais citados, com a participação de cada um.",
    requer: "preConsulta.motivo", semDados: "a fonte de pré-consulta não tem coluna de motivo" },
  { id: "sem.pre.origens", secao: "semPreConsulta", rotulo: "De onde veio", fonte: "Pré-consulta (origem)",
    regra: "As três origens mais citadas, com a participação de cada uma.",
    requer: "preConsulta.origem", semDados: "a fonte de pré-consulta não tem coluna de origem" },
  { id: "sem.pre.analise", secao: "semPreConsulta", rotulo: "Frase de análise", fonte: "Pré-consulta",
    regra: "Uma frase destacando o motivo e a origem mais frequentes." },

  { id: "sem.nps.respostas", secao: "semNps", rotulo: "Respostas recebidas", fonte: "NPS",
    regra: "Quantidade de respostas no período.", obrigatorio: true },
  { id: "sem.nps.notas", secao: "semNps", rotulo: "Distribuição das notas", fonte: "NPS",
    regra: "Quantas respostas cada nota (0 a 10) recebeu." },
  { id: "sem.nps.classificacao", secao: "semNps", rotulo: "Classificação e NPS da semana", fonte: "NPS",
    regra: "Promotores (9–10), neutros (7–8) e detratores (0–6); NPS = % promotores − % detratores." },
  { id: "sem.nps.areas", secao: "semNps", rotulo: "Avaliações por área", fonte: "NPS (notas por área)",
    regra: "Média das notas de profissional, recepção, infraestrutura e enfermagem — só as que a pesquisa tiver." },
  { id: "sem.nps.indicacoes", secao: "semNps", rotulo: "Indicações", fonte: "NPS (indicação)",
    regra: "Contatos indicados por quem respondeu, com o nome de quem indicou.",
    requer: "nps.indicacao", semDados: "a pesquisa não tem coluna de indicação" },
  { id: "sem.nps.comentarios", secao: "semNps", rotulo: "Comentários relevantes", fonte: "NPS (comentário)",
    regra: "Comentários com 35 caracteres ou mais.",
    requer: "nps.comentario", semDados: "a pesquisa não tem coluna de comentário" },

  { id: "sem.google.avaliacoes", secao: "semGoogle", rotulo: "Avaliações do período", fonte: "Avaliações Google",
    regra: "Novas avaliações no período; as inseridas à mão têm prioridade sobre a busca automática.",
    obrigatorio: true },

  { id: "sem.leads.funil", secao: "semLeads", rotulo: "Leads, convertidos e conversão", fonte: "Leads",
    regra: "Leads com data no período; conversão = convertidos ÷ leads. Informado à mão quando não há planilha.",
    obrigatorio: true },
  { id: "sem.leads.meta", secao: "semLeads", rotulo: "Meta de leads", fonte: "Leads e meta do mês",
    regra: "Leads do período sobre a meta proporcional do período." },

  // ── Resultado ──────────────────────────────────────────────────────────────
  { id: "res.faturamento", secao: "resultado", rotulo: "Faturamento", fonte: "Vendas",
    regra: "Soma do valor pago pela data do atendimento, no período.", obrigatorio: true },
  { id: "res.entradas", secao: "resultado", rotulo: "Entradas (recebido)", fonte: "Entradas",
    regra: "Recebimentos operacionais + não operacionais pela data do recebimento. Transferências, empréstimos e aportes ficam fora.",
    tipos: ["mensal"], requer: "entradas", semDados: "o cliente não tem a fonte de Entradas" },
  // Regra Gestfy: despesa conta pela data de VENCIMENTO (no Sync era a de pagamento).
  { id: "res.despesas", secao: "resultado", rotulo: "Despesas", fonte: "Despesas",
    regra: "Soma das despesas pela data de vencimento, no período.",
    tipos: ["mensal"], obrigatorio: true },
  { id: "res.resultado", secao: "resultado", rotulo: "Resultado de caixa / Faturamento x Despesas",
    fonte: "Entradas ou Vendas, e Despesas",
    regra: "Com a fonte de Entradas: entradas − despesas (Resultado de caixa). Sem ela: faturamento − despesas (Faturamento x Despesas).",
    tipos: ["mensal"], obrigatorio: true },
  { id: "res.meta", secao: "resultado", rotulo: "Atingimento da meta", fonte: "Vendas e meta do mês",
    regra: "Faturamento ÷ meta de faturamento do mês.",
    tipos: ["mensal"], requer: "meta", semDados: "sem meta cadastrada no mês" },
  { id: "res.atendidos", secao: "resultado", rotulo: "Clientes atendidos", fonte: "Vendas",
    regra: "Nomes de cliente diferentes atendidos no período." },
  { id: "res.ticket", secao: "resultado", rotulo: "Ticket médio", fonte: "Vendas",
    regra: "Faturamento ÷ clientes atendidos." },
  { id: "res.novos", secao: "resultado", rotulo: "Clientes novos", fonte: "Vendas (coluna 1ª vez)",
    regra: "Clientes atendidos com “1ª vez” = Sim.",
    requer: "vendas.primeiraVez", semDados: "a fonte de Vendas não informa a 1ª vez" },
  { id: "res.ticketNovos", secao: "resultado", rotulo: "Ticket médio dos novos", fonte: "Vendas (coluna 1ª vez)",
    regra: "Faturamento dos clientes novos ÷ quantidade de novos.",
    tipos: ["mensal"], requer: "vendas.primeiraVez", semDados: "a fonte de Vendas não informa a 1ª vez" },

  // ── Funil de leads ─────────────────────────────────────────────────────────
  { id: "leads.funil", secao: "funilLeads", rotulo: "Leads, agendados e conversão", fonte: "Leads",
    regra: "Leads com data de contato no período; conversão = agendados ÷ leads." },
  { id: "leads.servico", secao: "funilLeads", rotulo: "Serviço mais buscado", fonte: "Leads (interesse)",
    regra: "Leads do período por serviço ou queixa.",
    tipos: ["mensal"], detalhe: true, requer: "leads.interesse",
    semDados: "a fonte de Leads não tem coluna de interesse/serviço" },
  { id: "leads.origem", secao: "funilLeads", rotulo: "Origem do lead", fonte: "Leads (origem)",
    regra: "Leads do período por origem (como conheceu).",
    detalhe: true, requer: "leads.origem", semDados: "a fonte de Leads não tem coluna de origem" },
  { id: "leads.canal", secao: "funilLeads", rotulo: "Canal de entrada", fonte: "Leads (canal)",
    regra: "Leads do período por canal (WhatsApp, ligação…).",
    tipos: ["mensal"], detalhe: true, requer: "leads.canal", semDados: "a fonte de Leads não tem coluna de canal" },
  { id: "leads.objecoes", secao: "funilLeads", rotulo: "Motivos de não agendamento", fonte: "Leads (objeção)",
    regra: "Objeções registradas nos leads do período (por que não agendaram).",
    detalhe: true, requer: "leads.objecao", semDados: "a fonte de Leads não tem coluna de objeção" },

  // ── Funil de orçamentos ────────────────────────────────────────────────────
  { id: "orc.valor", secao: "funilOrcamentos", rotulo: "Orçamentos por valor", fonte: "Orçamentos",
    regra: "Valor gerado, fechado e em aberto; conversão em valor = valor fechado ÷ (valor gerado − cancelados)." },
  { id: "orc.quantidade", secao: "funilOrcamentos", rotulo: "Orçamentos por quantidade", fonte: "Orçamentos",
    regra: "Total, fechados, em aberto, não fecharam e cancelados; conversão = fechados ÷ (total − cancelados).",
    tipos: ["mensal"], detalhe: true },
  { id: "orc.status", secao: "funilOrcamentos", rotulo: "Por status", fonte: "Orçamentos (status)",
    regra: "Quantidade de orçamentos por status, como escrito na planilha.",
    tipos: ["mensal"], detalhe: true },
  { id: "orc.motivos", secao: "funilOrcamentos", rotulo: "Motivos de não fechamento", fonte: "Orçamentos (motivo)",
    regra: "Motivos registrados na própria fonte de orçamentos. Nunca usa as objeções dos leads.",
    detalhe: true, requer: "orcamentos.motivo", semDados: "a fonte de Orçamentos não tem coluna de motivo" },

  // ── Experiência do cliente ─────────────────────────────────────────────────
  { id: "exp.nps", secao: "experiencia", rotulo: "NPS", fonte: "NPS",
    regra: "% de promotores (9–10) − % de detratores (0–6).", requer: "nps", semDados: "sem fonte de NPS" },
  { id: "exp.profissional", secao: "experiencia", rotulo: "Nota do profissional", fonte: "NPS",
    regra: "Média das notas do profissional (0 a 5).",
    requer: "nps.profissional", semDados: "a pesquisa não tem nota do profissional" },
  { id: "exp.recepcao", secao: "experiencia", rotulo: "Nota da recepção", fonte: "NPS",
    regra: "Média das notas da recepção (0 a 5).",
    requer: "nps.recepcao", semDados: "a pesquisa não tem nota da recepção" },
  { id: "exp.infraestrutura", secao: "experiencia", rotulo: "Nota da infraestrutura", fonte: "NPS",
    regra: "Média das notas da infraestrutura (0 a 5).",
    requer: "nps.infraestrutura", semDados: "a pesquisa não tem nota da infraestrutura" },
  { id: "exp.enfermagem", secao: "experiencia", rotulo: "Nota da enfermagem", fonte: "NPS",
    regra: "Média das notas da enfermagem (0 a 5).",
    requer: "nps.enfermagem", semDados: "a pesquisa não tem nota da enfermagem" },
  { id: "exp.google", secao: "experiencia", rotulo: "Avaliações no Google", fonte: "Avaliações Google",
    regra: "Quantidade de avaliações no período e nota média.",
    requer: "google", semDados: "sem fonte de avaliações do Google" },

  // ── Distribuição do faturamento ────────────────────────────────────────────
  { id: "dist.profissional", secao: "distribuicao", rotulo: "Por profissional", fonte: "Vendas (profissional)",
    regra: "Faturamento do período por profissional, com participação.",
    requer: "vendas.profissional", semDados: "a fonte de Vendas não informa o profissional" },
  { id: "dist.unidade", secao: "distribuicao", rotulo: "Por unidade", fonte: "Vendas (unidade)",
    regra: "Faturamento do período por unidade, com participação.",
    requer: "vendas.unidade", semDados: "a fonte de Vendas não informa a unidade" },
  { id: "dist.pagamento", secao: "distribuicao", rotulo: "Meio de pagamento", fonte: "Vendas (meio de pagamento)",
    regra: "Faturamento do período por meio de pagamento (parcelas somadas).",
    requer: "vendas.pagamento", semDados: "a fonte de Vendas não informa o meio de pagamento" },
];

const SECAO_POR_ID = new Map(SECOES.map((s) => [s.id, s]));

export function secaoPorId(id: string): DefinicaoSecao | undefined {
  return SECAO_POR_ID.get(id);
}

/** Seções que existem na periodicidade, na ordem padrão. */
export function secoesDa(tipo: Periodicidade): DefinicaoSecao[] {
  return SECOES.filter((s) => s.tipos.includes(tipo));
}

/** Indicadores de uma seção na periodicidade. */
export function indicadoresDa(secaoId: string, tipo: Periodicidade): DefinicaoIndicador[] {
  return INDICADORES.filter((i) => i.secao === secaoId && (!i.tipos || i.tipos.includes(tipo)));
}
