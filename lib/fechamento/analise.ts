/**
 * Texto da análise do fechamento, em blocos — o mesmo formato do Sync:
 * observação, principais destaques, indicadores comerciais, pontos de atenção e
 * o contexto do período (este é só de apoio, não vai para o cliente).
 *
 * Fica guardado como texto único em `fechamentos.analise`, com um subtítulo por
 * bloco. Análises antigas, sem subtítulo, viram a observação. Módulo puro.
 */

export interface TextoAnalise {
  observacao: string;
  destaques: string;
  comercial: string;
  atencao: string;
  contexto: string;
}

export type BlocoAnalise = keyof TextoAnalise;

export const BLOCOS_ANALISE: { chave: BlocoAnalise; titulo: string; ajuda: string; linhas: number; paraCliente: boolean }[] = [
  { chave: "observacao", titulo: "Observação", ajuda: "2 a 4 parágrafos: o resumo do período, comparado ao anterior.", linhas: 8, paraCliente: true },
  { chave: "destaques", titulo: "Principais destaques", ajuda: "Um item por linha, começando com “- Tema:”, sempre com número.", linhas: 5, paraCliente: true },
  { chave: "comercial", titulo: "Indicadores comerciais", ajuda: "Leads, orçamentos, marketing e experiência.", linhas: 5, paraCliente: true },
  { chave: "atencao", titulo: "Pontos de atenção", ajuda: "O que precisa de cuidado no próximo período.", linhas: 4, paraCliente: true },
];

export const TEXTO_VAZIO: TextoAnalise = { observacao: "", destaques: "", comercial: "", atencao: "", contexto: "" };

const TITULO_CONTEXTO = "Contexto do período";

/** Subtítulos reconhecidos (sem acento, minúsculos) → bloco. */
const SUBTITULOS: Record<string, BlocoAnalise> = {
  "observacao": "observacao",
  "principais destaques": "destaques",
  "destaques": "destaques",
  "indicadores comerciais": "comercial",
  "comercial": "comercial",
  "pontos de atencao": "atencao",
  "atencao": "atencao",
  "contexto do periodo": "contexto",
  "contexto": "contexto",
};

function subtituloDe(linha: string): BlocoAnalise | null {
  const limpo = linha
    .trim()
    .replace(/^#+\s*/, "")
    .replace(/^[*_]+|[*_]+$/g, "")
    .replace(/:$/, "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  return SUBTITULOS[limpo] ?? null;
}

export function lerAnalise(texto: string | null | undefined): TextoAnalise {
  const t: TextoAnalise = { ...TEXTO_VAZIO };
  let atual: BlocoAnalise = "observacao";
  const partes: Record<BlocoAnalise, string[]> = { observacao: [], destaques: [], comercial: [], atencao: [], contexto: [] };
  for (const linha of String(texto ?? "").split(/\r?\n/)) {
    const bloco = subtituloDe(linha);
    if (bloco) { atual = bloco; continue; }
    partes[atual].push(linha);
  }
  for (const k of Object.keys(partes) as BlocoAnalise[]) t[k] = partes[k].join("\n").trim();
  return t;
}

export function escreverAnalise(t: TextoAnalise): string {
  const blocos: string[] = [];
  for (const b of BLOCOS_ANALISE) {
    const v = t[b.chave].trim();
    if (v) blocos.push(`${b.titulo}:\n${v}`);
  }
  if (t.contexto.trim()) blocos.push(`${TITULO_CONTEXTO}:\n${t.contexto.trim()}`);
  return blocos.join("\n\n");
}

/** Só o que vai para o cliente (sem o contexto interno). */
export function blocosParaCliente(t: TextoAnalise): { titulo: string; texto: string }[] {
  return BLOCOS_ANALISE
    .map((b) => ({ titulo: b.titulo, texto: t[b.chave].trim() }))
    .filter((b) => b.texto);
}

export function analiseVazia(t: TextoAnalise): boolean {
  return BLOCOS_ANALISE.every((b) => !t[b.chave].trim());
}
