import { normalizarTexto } from "@/lib/coletores/planilha";

/**
 * Plano de contas das despesas (padrão Gestfy, vindo do Sync Financeiro):
 * cada categoria da planilha pertence a um grupo. Categoria que não está no
 * plano cai em "Outras despesas" — aparece no relatório e vira alerta, para
 * ser corrigida na planilha. Módulo puro.
 */

export const GRUPO_OUTRAS = "Outras despesas";

export const GRUPOS_DESPESA: { grupo: string; categorias: string[] }[] = [
  { grupo: "Impostos, Taxas e afins", categorias: [
    "Simples Nacional", "ICMS", "ISS", "PIS", "COFINS", "REFIS", "IRPJ", "IRs Diversos", "CSLL", "IPTU",
    "INSS", "FGTS", "IPVA", "Vigilância Sanitária", "Taxas e Certificados", "Certificados/Certidões",
  ] },
  { grupo: "Despesas Administrativas", categorias: [
    "Desp. Adm. Diversas", "Material de expediente e limpeza", "Assinaturas", "Uniformes", "Seguros",
    "Manutenções", "Obras e Construções", "Viagens", "Transporte (passagens, taxi, Uber, etc)",
    "Saúde Ocupacional", "Segurança e afins",
  ] },
  { grupo: "Despesas Operacionais", categorias: [
    "Desp. Oper. Diversas", "Repasse para Prestadores de Serviços Clínicos", "Devoluções",
    "Sistemas de Gestão", "Material Clínico", "Coleta de Resíduos", "Benefícios para Pacientes",
    "Comissão por Indicação", "Locomoção outras unidades",
  ] },
  { grupo: "Infraestrutura", categorias: ["Aluguel", "Condomínio", "Luz", "Internet", "Telefone", "Água"] },
  { grupo: "Serviços Terceirizados", categorias: [
    "Limpeza", "Contabilidade", "Jurídico", "Consultorias, Assessorias e Mentorias",
    "Cursos, Treinamentos e Workshops", "Gestão", "Prestador de Serviços", "Serviço de Office-Boy",
  ] },
  { grupo: "Pessoal", categorias: [
    "Pró-Labore", "Salários", "Férias", "Vale Transporte e Bilhete Único", "Vale Alimentação", "Rescisões",
    "Acordos Trabalhistas", "Assistência Médica/Odontológica", "Recrutamento de Colaboradores",
    "Bonificações e Comissões", "Benefícios Diversos",
  ] },
  { grupo: "Marketing", categorias: [
    "Social Media", "Gestor de Tráfego", "Tráfego Pago", "Serviços Digitais", "Brindes", "Marketing Visual",
    "Experiência do Cliente",
  ] },
  { grupo: "Despesas Financeiras", categorias: [
    "Despesas Bancárias", "Empréstimos e Consórcios", "Descontos Concedidos", "Taxas de Adm. de Cartão",
  ] },
  { grupo: "Imobilizado", categorias: [
    "Veículos", "Imóveis", "Móveis e Utensílios", "Máquinas e Equipamentos", "Computadores e afins",
    "Ferramentas",
  ] },
  { grupo: "Estoque de Mercadorias", categorias: ["Estoque de Mercadorias"] },
];

const GRUPO_POR_CATEGORIA = new Map<string, string>();
for (const { grupo, categorias } of GRUPOS_DESPESA) {
  for (const c of categorias) GRUPO_POR_CATEGORIA.set(normalizarTexto(c), grupo);
  // o nome do próprio grupo também vale como categoria (planilhas que lançam só o grupo)
  if (!GRUPO_POR_CATEGORIA.has(normalizarTexto(grupo))) GRUPO_POR_CATEGORIA.set(normalizarTexto(grupo), grupo);
}

export function grupoDaDespesa(categoria: string): string {
  return GRUPO_POR_CATEGORIA.get(normalizarTexto(categoria)) ?? GRUPO_OUTRAS;
}

/** Posição do grupo na ordem do plano de contas; "Outras" por último. */
export function ordemDoGrupo(grupo: string): number {
  const i = GRUPOS_DESPESA.findIndex((g) => g.grupo === grupo);
  return i < 0 ? GRUPOS_DESPESA.length : i;
}
