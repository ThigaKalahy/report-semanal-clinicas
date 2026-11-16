import {
  SEGMENTOS, CAMPOS_VOCAB, segmentoDoTexto, vocabularioDe,
} from "./vocabulario";
import type { SegmentoTipo } from "./vocabulario";

/**
 * Ficha do cliente: quem é a clínica e como escrever para ela.
 *
 * Módulo puro (sem I/O), compartilhado pela tela da ficha (cliente) e pela
 * montagem do contexto da IA (servidor).
 */

export type Porte = "ate50" | "50a150" | "150a400" | "400a1000" | "acima1000";
export type Modelo = "particular" | "convenio" | "misto";

export const PORTES: Record<Porte, string> = {
  ate50:     "Até R$ 50 mil/mês",
  "50a150":  "R$ 50 a 150 mil/mês",
  "150a400": "R$ 150 a 400 mil/mês",
  "400a1000": "R$ 400 mil a 1 milhão/mês",
  acima1000: "Acima de R$ 1 milhão/mês",
};

export const MODELOS: Record<Modelo, string> = {
  particular: "Particular",
  convenio:   "Convênio",
  misto:      "Misto (particular e convênio)",
};

export interface FichaCliente {
  cidade: string;
  uf: string;
  segmentoTipo: SegmentoTipo | "";
  segmento: string;
  especialidades: string;
  /** Só os termos personalizados; o resto vem do padrão do segmento. */
  vocabulario: Record<string, string>;
  porte: Porte | "";
  modelo: Modelo | "";
  perfil: string;
  prioridades: string;
  pessoas: string;
  estilo: string;
  evitar: string;
  atualizadoEm: string | null;
}

export const FICHA_VAZIA: FichaCliente = {
  cidade: "", uf: "", segmentoTipo: "", segmento: "", especialidades: "",
  vocabulario: {}, porte: "", modelo: "",
  perfil: "", prioridades: "", pessoas: "", estilo: "", evitar: "",
  atualizadoEm: null,
};

/** Tamanho máximo de cada campo de texto. */
export const LIMITES = {
  cidade: 80,
  segmento: 120,
  especialidades: 400,
  termo: 40,
  perfil: 3000,
  prioridades: 3000,
  pessoas: 2000,
  estilo: 1500,
  evitar: 1500,
} as const;

const corte = (v: unknown, max: number) => String(v ?? "").slice(0, max);

/** Saneia uma ficha vinda de qualquer lugar (formulário, banco, importação). */
export function normalizarFicha(bruta: Partial<FichaCliente> | null | undefined): FichaCliente {
  const b = bruta ?? {};

  const vocabulario: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(b.vocabulario ?? {})) {
    if (!CAMPOS_VOCAB.some((c) => c.k === chave)) continue;
    if (typeof valor !== "string" || !valor.trim()) continue;
    vocabulario[chave] = corte(valor, LIMITES.termo).trim();
  }

  return {
    cidade: corte(b.cidade, LIMITES.cidade).trim(),
    uf: corte(b.uf, 2).toUpperCase().replace(/[^A-Z]/g, ""),
    segmentoTipo: SEGMENTOS.find((s) => s.id === b.segmentoTipo)?.id ?? "",
    segmento: corte(b.segmento, LIMITES.segmento),
    especialidades: corte(b.especialidades, LIMITES.especialidades),
    vocabulario,
    porte: (Object.keys(PORTES) as Porte[]).find((p) => p === b.porte) ?? "",
    modelo: (Object.keys(MODELOS) as Modelo[]).find((m) => m === b.modelo) ?? "",
    perfil: corte(b.perfil, LIMITES.perfil),
    prioridades: corte(b.prioridades, LIMITES.prioridades),
    pessoas: corte(b.pessoas, LIMITES.pessoas),
    estilo: corte(b.estilo, LIMITES.estilo),
    evitar: corte(b.evitar, LIMITES.evitar),
    atualizadoEm: typeof b.atualizadoEm === "string" ? b.atualizadoEm : null,
  };
}

/** A ficha tem conteúdo de verdade (além de cidade/porte)? */
export function fichaPreenchida(f: FichaCliente): boolean {
  return [f.perfil, f.prioridades, f.pessoas, f.estilo, f.especialidades, f.segmento]
    .some((t) => t.trim() !== "");
}

// ─── Ficha gerada por IA: pedido e leitura ───────────────────────────────────

/**
 * Texto para colar num assistente que já conhece o cliente (projeto com
 * instruções, arquivos e conversas). A resposta volta por `lerFichaGerada`.
 */
export function pedidoFicha(clinicaNome: string): string {
  return `Preciso do perfil do cliente ${clinicaNome} para o sistema de relatórios da Gestfy.
Use tudo o que você sabe sobre este cliente neste projeto (instruções, arquivos e conversas).
Regras: tópicos curtos e objetivos; não inclua dados pessoais dos clientes dele; se não souber um item, escreva "não informado".
Responda somente neste formato, mantendo os títulos exatamente assim:

### CIDADE/UF
### SEGMENTO (tipo de negócio)
### ÁREAS DE ATUAÇÃO (especialidades, linhas de serviço ou produto)
### MODELO DE NEGÓCIO (para saúde: particular, convênio ou misto; outros negócios: descreva em uma linha)
### PERFIL E POSICIONAMENTO
### PRIORIDADES E METAS DO MOMENTO
### PESSOAS E PAPÉIS (sócios, gestores, equipe, marketing)
### COMO ESCREVER PARA ESTE CLIENTE (tom, tratamento, o que valorizam)
### ASSUNTOS A EVITAR`;
}

/** Títulos reconhecidos na resposta, já sem acento e em maiúsculas. */
const TITULOS: Record<string, string[]> = {
  local:          ["CIDADE"],
  segmento:       ["SEGMENTO"],
  especialidades: ["AREAS DE ATUACAO", "ESPECIALIDADES"],
  modelo:         ["MODELO"],
  perfil:         ["PERFIL"],
  prioridades:    ["PRIORIDADES"],
  pessoas:        ["PESSOAS"],
  estilo:         ["COMO ESCREVER"],
  evitar:         ["ASSUNTOS A EVITAR", "EVITAR"],
};

function chaveDeTitulo(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Quebra o texto colado em seções, pelos títulos "### X", "**X**" ou "X:". */
export function separarSecoes(texto: string): Record<string, string> {
  const secoes: Record<string, string[]> = {};
  let atual: string | null = null;

  for (const linha of texto.replace(/\r/g, "").split("\n")) {
    const m =
      linha.match(/^\s*(?:#{1,4}\s*|\*\*)([^*#]+?)(?:\*\*)?\s*:?\s*$/) ??
      linha.match(/^\s*([A-ZÀ-Ú][A-ZÀ-Ú0-9 /,()-]{3,}):\s*$/);
    const titulo = m ? chaveDeTitulo(m[1]) : "";
    const campo = titulo
      ? Object.keys(TITULOS).find((k) => TITULOS[k].some((t) => titulo.startsWith(t)))
      : undefined;

    if (campo) {
      atual = campo;
      secoes[campo] = secoes[campo] ?? [];
      continue;
    }
    if (atual) secoes[atual].push(linha);
  }

  const resultado: Record<string, string> = {};
  for (const [campo, linhas] of Object.entries(secoes)) {
    const corpo = linhas.join("\n").trim();
    if (corpo) resultado[campo] = corpo;
  }
  return resultado;
}

/**
 * Lê a resposta do assistente e preenche a ficha por cima da atual. Itens
 * marcados "não informado" são ignorados — nunca apagam o que já estava lá.
 *
 * @returns a ficha resultante e quantos campos foram reconhecidos.
 */
export function lerFichaGerada(
  texto: string,
  atual: FichaCliente,
): { ficha: FichaCliente; achados: number } {
  const secoes = separarSecoes(texto);
  const util = (v?: string) =>
    v && !/^n[aã]o informado\.?$/i.test(v.trim()) ? v.trim() : "";

  const nova: Partial<FichaCliente> = { ...atual };
  let achados = 0;

  const local = util(secoes.local);
  if (local) {
    achados++;
    const m = local.match(/^(.*?)[\s/,-]+([A-Za-z]{2})\.?$/);
    if (m) {
      nova.cidade = m[1].replace(/^[-•\s]+/, "").trim();
      nova.uf = m[2].toUpperCase();
    } else {
      nova.cidade = local;
    }
  }

  const modelo = chaveDeTitulo(util(secoes.modelo));
  if (modelo) {
    achados++;
    if (modelo.includes("MISTO") || (modelo.includes("PARTICULAR") && modelo.includes("CONVENIO"))) {
      nova.modelo = "misto";
    } else if (modelo.includes("CONVENIO")) {
      nova.modelo = "convenio";
    } else if (modelo.includes("PARTICULAR")) {
      nova.modelo = "particular";
    }
  }

  const textos = ["segmento", "especialidades", "perfil", "prioridades", "pessoas", "estilo", "evitar"] as const;
  for (const campo of textos) {
    const v = util(secoes[campo]);
    if (v) {
      nova[campo] = v;
      achados++;
    }
  }

  if (!nova.segmentoTipo && nova.segmento) {
    nova.segmentoTipo = segmentoDoTexto(nova.segmento);
  }

  return { ficha: normalizarFicha(nova), achados };
}

// ─── Contexto para a IA ──────────────────────────────────────────────────────

/**
 * Bloco de texto com o que a IA precisa saber do cliente. Devolve "" quando a
 * ficha não tem nada útil — o prompt segue só com os números.
 */
export function contextoDaFicha(ficha: FichaCliente | null | undefined): string {
  if (!ficha) return "";
  const linhas: string[] = [];
  const v = vocabularioDe(ficha);

  const local = [ficha.cidade, ficha.uf].filter(Boolean).join("/");
  if (ficha.segmento.trim()) linhas.push(`Negócio: ${ficha.segmento.trim()}`);
  if (local) linhas.push(`Local: ${local}`);
  if (ficha.especialidades.trim()) linhas.push(`Áreas de atuação: ${ficha.especialidades.trim()}`);
  if (ficha.modelo) linhas.push(`Modelo: ${MODELOS[ficha.modelo]}`);
  if (ficha.porte) linhas.push(`Porte: ${PORTES[ficha.porte]}`);

  const blocos: [string, string][] = [
    ["Perfil e posicionamento", ficha.perfil],
    ["Prioridades e metas do momento", ficha.prioridades],
    ["Pessoas e papéis", ficha.pessoas],
    ["Como escrever para este cliente", ficha.estilo],
    ["Assuntos a evitar", ficha.evitar],
  ];
  for (const [titulo, corpo] of blocos) {
    if (corpo.trim()) linhas.push("", `${titulo}:`, corpo.trim());
  }

  // O vocabulário só entra quando há ficha: sem ela não há por que mudar os termos
  if (linhas.length === 0 && !ficha.segmentoTipo && Object.keys(ficha.vocabulario).length === 0) {
    return "";
  }

  linhas.push(
    "",
    `Vocabulário: chame quem compra de "${v.cliente}" (plural "${v.clientes}"), ` +
    `quem atende de "${v.profissional}" (plural "${v.profissionais}") e o que é vendido de ` +
    `"${v.servico}" (plural "${v.servicos}").`,
  );

  return ["PERFIL DO CLIENTE:", ...linhas].join("\n");
}
