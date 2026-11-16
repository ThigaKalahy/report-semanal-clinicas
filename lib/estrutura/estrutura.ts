import {
  SECOES, INDICADORES, secaoPorId, secoesDa, indicadoresDa,
} from "./catalogo";
import type { Periodicidade, DefinicaoIndicador } from "./catalogo";

/**
 * Estrutura do relatório de UMA clínica: para cada periodicidade, a lista de
 * seções na ordem em que aparecem, com liga/desliga, nível de detalhe e
 * indicadores ocultos.
 *
 * Módulo puro. A regra central é `normalizarEstrutura`: tudo que entra (banco,
 * importação do Sync, formulário) passa por ela, então o resto do app pode
 * confiar que a estrutura está completa e válida.
 */

export interface ItemEstrutura {
  id: string;
  ativa: boolean;
  nivel?: string;
  /**
   * Indicadores desligados à mão. Ausente = a seção nunca foi personalizada e
   * segue o padrão do nível (no "resumo", os indicadores de detalhe somem).
   */
  ocultos?: string[];
}

export type Estrutura = Record<Periodicidade, ItemEstrutura[]>;

const TIPOS: Periodicidade[] = ["semanal", "quinzenal", "mensal"];

function itemPadrao(secaoId: string, tipo: Periodicidade): ItemEstrutura {
  const def = secaoPorId(secaoId)!;
  const item: ItemEstrutura = { id: def.id, ativa: def.fixa ? true : def.ativaPadrao ?? true };
  const nivel = def.nivelPadrao?.[tipo] ?? def.niveis?.[0]?.id;
  if (nivel) item.nivel = nivel;
  return item;
}

/** Estrutura de uma clínica que nunca configurou nada. */
export function listaPadrao(tipo: Periodicidade): ItemEstrutura[] {
  return secoesDa(tipo).map((s) => itemPadrao(s.id, tipo));
}

export function estruturaPadrao(): Estrutura {
  return { semanal: listaPadrao("semanal"), quinzenal: listaPadrao("quinzenal"), mensal: listaPadrao("mensal") };
}

/** Mantém só ids de indicadores opcionais da seção, sem repetição. `undefined` se não for lista. */
export function limparOcultos(secaoId: string, tipo: Periodicidade, valor: unknown): string[] | undefined {
  if (!Array.isArray(valor)) return undefined;
  const opcionais = new Set(
    indicadoresDa(secaoId, tipo).filter((i) => !i.obrigatorio).map((i) => i.id),
  );
  return [...new Set(valor.filter((v): v is string => typeof v === "string" && opcionais.has(v)))];
}

function normalizarLista(valor: unknown, tipo: Periodicidade): ItemEstrutura[] {
  const validas = new Set(secoesDa(tipo).map((s) => s.id));
  const vistas = new Set<string>();
  const lista: ItemEstrutura[] = [];

  for (const bruto of Array.isArray(valor) ? valor : []) {
    if (!bruto || typeof bruto !== "object") continue;
    const r = bruto as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : "";
    if (!validas.has(id) || vistas.has(id)) continue;
    vistas.add(id);

    const def = secaoPorId(id)!;
    const padrao = itemPadrao(id, tipo);
    const item: ItemEstrutura = {
      id,
      ativa: def.fixa ? true : typeof r.ativa === "boolean" ? r.ativa : padrao.ativa,
    };
    if (def.niveis) {
      item.nivel = def.niveis.some((n) => n.id === r.nivel) ? (r.nivel as string) : padrao.nivel;
    }
    const ocultos = limparOcultos(id, tipo, r.ocultos);
    if (ocultos) item.ocultos = ocultos;
    lista.push(item);
  }

  // Seção que o catálogo ganhou depois de a clínica salvar: entra logo após a
  // vizinha anterior do catálogo, para não cair toda seção nova no fim.
  const ordemCatalogo = secoesDa(tipo).map((s) => s.id);
  for (let i = 0; i < ordemCatalogo.length; i++) {
    const id = ordemCatalogo[i];
    if (vistas.has(id)) continue;
    let pos = 0;
    for (let j = i - 1; j >= 0; j--) {
      const k = lista.findIndex((x) => x.id === ordemCatalogo[j]);
      if (k >= 0) { pos = k + 1; break; }
    }
    lista.splice(pos, 0, itemPadrao(id, tipo));
    vistas.add(id);
  }
  return lista;
}

/** Aceita qualquer coisa e devolve uma estrutura completa e válida. */
export function normalizarEstrutura(valor: unknown): Estrutura {
  const r = valor && typeof valor === "object" ? (valor as Record<string, unknown>) : {};
  return {
    semanal: normalizarLista(r.semanal, "semanal"),
    quinzenal: normalizarLista(r.quinzenal, "quinzenal"),
    mensal: normalizarLista(r.mensal, "mensal"),
  };
}

/** A estrutura é exatamente a padrão? (nada personalizado) */
export function ehPadrao(estrutura: Estrutura): boolean {
  return JSON.stringify(normalizarEstrutura(estrutura)) === JSON.stringify(estruturaPadrao());
}

/** O indicador está ligado nesta seção? */
export function indicadorLigado(item: ItemEstrutura, ind: DefinicaoIndicador): boolean {
  if (ind.obrigatorio) return true;
  if (item.ocultos) return !item.ocultos.includes(ind.id);
  return !(ind.detalhe && item.nivel === "resumo");
}

/** Ids dos indicadores ligados na seção. */
export function indicadoresLigados(item: ItemEstrutura, tipo: Periodicidade): Set<string> {
  return new Set(indicadoresDa(item.id, tipo).filter((i) => indicadorLigado(item, i)).map((i) => i.id));
}

/** Seções ativas da periodicidade, na ordem configurada. */
export function secoesAtivas(estrutura: Estrutura, tipo: Periodicidade): ItemEstrutura[] {
  return estrutura[tipo].filter((i) => i.ativa);
}

/** Move a seção uma posição para cima (-1) ou para baixo (+1). */
export function moverSecao(lista: ItemEstrutura[], id: string, direcao: -1 | 1): ItemEstrutura[] {
  const de = lista.findIndex((i) => i.id === id);
  const para = de + direcao;
  if (de < 0 || para < 0 || para >= lista.length) return lista;
  const nova = [...lista];
  [nova[de], nova[para]] = [nova[para], nova[de]];
  return nova;
}

/**
 * Liga ou desliga um indicador. Ao mexer pela primeira vez, congela o estado
 * atual em `ocultos` — a partir daí a seção deixa de seguir o padrão do nível.
 */
export function alternarIndicador(
  item: ItemEstrutura, tipo: Periodicidade, indicadorId: string, ligado: boolean,
): ItemEstrutura {
  const todos = indicadoresDa(item.id, tipo);
  const ind = todos.find((i) => i.id === indicadorId);
  if (!ind || ind.obrigatorio) return item;
  const ocultos = new Set(todos.filter((i) => !indicadorLigado(item, i)).map((i) => i.id));
  if (ligado) ocultos.delete(indicadorId); else ocultos.add(indicadorId);
  return { ...item, ocultos: todos.map((i) => i.id).filter((id) => ocultos.has(id)) };
}

/** Troca o nível e volta os indicadores ao padrão dele. */
export function trocarNivel(item: ItemEstrutura, nivel: string): ItemEstrutura {
  const def = secaoPorId(item.id);
  if (!def?.niveis?.some((n) => n.id === nivel)) return item;
  const { ocultos: _descartados, ...resto } = item;
  void _descartados;
  return { ...resto, nivel };
}

// ── Disponibilidade ──────────────────────────────────────────────────────────

/**
 * O que a clínica tem cadastrado, por chave ("nps", "leads.origem",
 * "vendas.profissional"…). Chave ausente = não tem.
 */
export type Disponibilidade = Record<string, boolean>;

/** id (de seção ou de indicador) → por que não há dado para ele. */
export function indisponiveis(disp: Disponibilidade): Record<string, string> {
  const fora: Record<string, string> = {};
  for (const s of SECOES) if (s.requer && !disp[s.requer]) fora[s.id] = s.semDados ?? "sem dados na fonte";
  for (const i of INDICADORES) if (i.requer && !disp[i.requer]) fora[i.id] = i.semDados ?? "sem dados na fonte";
  return fora;
}

export { TIPOS as TIPOS_ESTRUTURA };
