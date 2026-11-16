import { describe, it, expect } from "vitest";
import { montarPesquisas, SEPARATOR } from "../relatorio/montar-whatsapp";
import type { ResultadoPreConsulta } from "../coletores/pre-consulta";
import type { ResultadoNPS } from "../coletores/nps";
import type { ResultadoGoogle } from "../coletores/google-places";
import type { ResultadoLeads } from "../coletores/leads";
import type { ResultadoMeta } from "../coletores/metas";

const ini = new Date(2026, 10, 9);
const fim = new Date(2026, 10, 15);

const pre: ResultadoPreConsulta = {
  total: 12,
  motivos: [
    { nome: "Emagrecimento", count: 6, pct: 50 },
    { nome: "Check-up", count: 4, pct: 33 },
    { nome: "Reposição hormonal", count: 2, pct: 17 },
  ],
  origens: [
    { nome: "Instagram", count: 7, pct: 58 },
    { nome: "Indicação", count: 5, pct: 42 },
  ],
};

const nps: ResultadoNPS = {
  total: 8,
  notas_gerais: [{ nota: 10, count: 6 }, { nota: 8, count: 1 }, { nota: 5, count: 1 }],
  classificacao: { promotores: 6, neutros: 1, detratores: 1 },
  nps_score: 63,
  medias_por_area: { profissional: 5, recepcao: 4.6, infraestrutura: null, enfermagem: null },
  comentarios: [
    { nome: "Maria", comentario: "Atendimento excelente, equipe muito atenciosa do começo ao fim.", nota: 10 },
    { nome: "João", comentario: "Muito bom!", nota: 10 },
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

const completo = () =>
  montarPesquisas("Clínica Teste", pre, nps, google, null, ini, fim, undefined, leads, metaLeads);

describe("report semanal — referência (estrutura padrão)", () => {
  it("relatório completo sai como sempre saiu", () => {
    expect(completo()).toMatchSnapshot();
  });

  it("sem pré-consulta, sem NPS e sem Google", () => {
    expect(montarPesquisas("Clínica Teste", null, null, null, null, ini, fim)).toMatchSnapshot();
  });

  it("Google digitado à mão", () => {
    expect(
      montarPesquisas("Clínica Teste", pre, null, null, "➤ 3 avaliações novas, todas 5 estrelas", ini, fim),
    ).toMatchSnapshot();
  });

  it("usa o separador entre as mensagens", () => {
    expect(completo().split(SEPARATOR)).toHaveLength(4);
  });
});
