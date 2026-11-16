import { describe, it, expect } from "vitest";
import { montarPesquisas, SEPARATOR } from "../relatorio/montar-whatsapp";
import { listaPadrao, normalizarEstrutura } from "../estrutura/estrutura";
import type { ItemEstrutura } from "../estrutura/estrutura";
import type { ResultadoPreConsulta } from "../coletores/pre-consulta";
import type { ResultadoNPS } from "../coletores/nps";
import type { ResultadoGoogle } from "../coletores/google-places";
import type { ResultadoLeads } from "../coletores/leads";
import type { ResultadoMeta } from "../coletores/metas";

const ini = new Date(2026, 10, 9);
const fim = new Date(2026, 10, 15);

const pre: ResultadoPreConsulta = {
  total: 12,
  motivos: [{ nome: "Emagrecimento", count: 6, pct: 50 }, { nome: "Check-up", count: 6, pct: 50 }],
  origens: [{ nome: "Instagram", count: 7, pct: 58 }, { nome: "Indicação", count: 5, pct: 42 }],
};

const nps: ResultadoNPS = {
  total: 8,
  notas_gerais: [{ nota: 10, count: 6 }, { nota: 8, count: 1 }, { nota: 5, count: 1 }],
  classificacao: { promotores: 6, neutros: 1, detratores: 1 },
  nps_score: 63,
  medias_por_area: { profissional: 5, recepcao: 4.6, infraestrutura: null, enfermagem: null },
  comentarios: [
    { nome: "Maria", comentario: "Atendimento excelente, equipe muito atenciosa do começo ao fim.", nota: 10 },
  ],
  indicacoes: [
    { texto_indicacao: "Ana 11 99999-0000", indicado_por: "Maria", nome_indicado: "Ana", numero: "(11) 99999-0000", usa_bruto: false },
  ],
};

const google: ResultadoGoogle = {
  total: 1,
  avaliacoes: [{ autor: "Carla", nota: 5, texto: "Recomendo demais.", data: "2026-11-12" }],
};

const leads: ResultadoLeads = { total: 40, convertidos: 10, taxa_conversao: 25 };

const metaLeads = {
  tipo_nome: "Leads", tipo_formato: "numero", tipo_unidade: "", tipo_comportamento: "maior_melhor",
  realizado: 40, realizado_semana: 40, meta_periodo: 50, meta_mensal: 200,
  performance: { texto_curto: "80% da meta" }, pct_mensal: 20,
} as unknown as ResultadoMeta;

const com = (semanal: unknown): ItemEstrutura[] => normalizarEstrutura({ semanal }).semanal;
const gerar = (estrutura?: ItemEstrutura[]) =>
  montarPesquisas("Clínica Teste", pre, nps, google, null, ini, fim, undefined, leads, metaLeads, null, estrutura);

describe("report semanal — estrutura por clínica", () => {
  it("estrutura padrão explícita é igual a não passar estrutura", () => {
    expect(gerar(listaPadrao("semanal"))).toBe(gerar());
  });

  it("seção desligada some, e o separador acompanha", () => {
    const t = gerar(com([{ id: "semGoogle", ativa: false }]));
    expect(t).not.toContain("Avaliação Google");
    expect(t.split(SEPARATOR)).toHaveLength(3);
  });

  it("o cabeçalho abre a primeira seção, seja qual for", () => {
    const t = gerar(com([{ id: "semLeads", ativa: true }, { id: "semPreConsulta", ativa: false }]));
    const primeira = t.split(SEPARATOR)[0];
    expect(primeira.startsWith("*Clínica Teste*")).toBe(true);
    expect(primeira).toContain("Período analisado: 09/11 até 15/11");
    expect(primeira).toContain("*📈 Leads*");
    expect(t).not.toContain("Pré-Consulta");
    expect(t.match(/Período analisado/g)).toHaveLength(1);
  });

  it("respeita a ordem configurada", () => {
    const t = gerar(com([
      { id: "semLeads", ativa: true }, { id: "semGoogle", ativa: true },
      { id: "semNps", ativa: true }, { id: "semPreConsulta", ativa: true },
    ]));
    const pos = ["📈 Leads", "⭐ Avaliação Google", "🔍 Pesquisa NPS", "📄 Questionário"].map((s) => t.indexOf(s));
    expect(pos.every((p) => p >= 0)).toBe(true);
    expect(pos).toEqual([...pos].sort((a, b) => a - b));
  });

  it("tudo desligado: sobra só o cabeçalho", () => {
    const t = gerar(listaPadrao("semanal").map((s) => ({ ...s, ativa: false })));
    expect(t).toContain("*Clínica Teste*");
    expect(t).not.toContain(SEPARATOR);
  });

  it("indicadores ocultos do NPS", () => {
    const t = gerar(com([
      { id: "semNps", ativa: true, ocultos: ["sem.nps.notas", "sem.nps.comentarios", "sem.nps.indicacoes"] },
    ]));
    expect(t).toContain("8 respostas recebidas");
    expect(t).toContain("NPS da semana: 63");
    expect(t).toContain("Avaliações por área");
    expect(t).not.toContain("6x nota 10");
    expect(t).not.toContain("Comentários relevantes");
    expect(t).not.toContain("Indicações");
  });

  it("pré-consulta: a frase de análise só fala do que está visível", () => {
    const semOrigem = gerar(com([{ id: "semPreConsulta", ativa: true, ocultos: ["sem.pre.origens"] }]));
    expect(semOrigem).toContain("Motivo principal");
    expect(semOrigem).not.toContain("De onde veio");
    expect(semOrigem).toContain("Emagrecimento foi o motivo mais frequente");
    expect(semOrigem).not.toContain("chegou por");

    const semAnalise = gerar(com([{ id: "semPreConsulta", ativa: true, ocultos: ["sem.pre.analise"] }]));
    expect(semAnalise).toContain("De onde veio");
    expect(semAnalise).not.toContain("foi o motivo mais frequente");
  });

  it("pré-consulta só com o total não deixa linha em branco sobrando", () => {
    const t = gerar(com([
      { id: "semPreConsulta", ativa: true, ocultos: ["sem.pre.motivos", "sem.pre.origens", "sem.pre.analise"] },
    ]));
    expect(t.split(SEPARATOR)[0].trimEnd().endsWith("`12 respostas essa semana`")).toBe(true);
  });

  it("leads sem a linha de meta", () => {
    const t = gerar(com([{ id: "semLeads", ativa: true, ocultos: ["sem.leads.meta"] }]));
    expect(t).toContain("Taxa de conversão: 25.0%");
    expect(t).not.toContain("Meta de leads");
  });
});
