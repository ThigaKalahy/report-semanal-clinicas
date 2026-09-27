import { describe, it, expect } from "vitest";
import { buildComentarios } from "../relatorio/montar-imagem-dados";
import type { ResultadoNPS } from "../coletores/nps";
import type { ResultadoGoogle } from "../coletores/google-places";

function npsCom(
  comentarios: { nome: string; comentario: string; nota: number | null }[]
): ResultadoNPS {
  return {
    total: comentarios.length,
    notas_gerais: [],
    classificacao: { promotores: 0, neutros: 0, detratores: 0 },
    nps_score: 0,
    medias_por_area: { profissional: null, recepcao: null, infraestrutura: null, enfermagem: null },
    comentarios,
    indicacoes: [],
  };
}

function googleCom(
  avaliacoes: { autor: string; nota: number; texto: string; data: string }[]
): ResultadoGoogle {
  return { total: avaliacoes.length, avaliacoes };
}

// ── Privacidade ───────────────────────────────────────────────────────────────

describe("buildComentarios — anonimato", () => {
  it("repassa 'Paciente (anônimo)' sem vazar o nome original", () => {
    // O coletor de NPS já aplicou resolverNomePaciente; aqui o nome real nem existe.
    const nps = npsCom([
      { nome: "Paciente (anônimo)", comentario: "Atendimento excelente.", nota: 10 },
    ]);
    const [item] = buildComentarios(nps, null);
    expect(item.autor).toBe("Paciente (anônimo)");
  });

  it("comentário sem nome vira 'Paciente', nunca vazio", () => {
    const nps = npsCom([{ nome: "", comentario: "Gostei muito.", nota: 9 }]);
    expect(buildComentarios(nps, null)[0].autor).toBe("Paciente");
  });

  it("avaliação do Google sem autor vira 'Paciente'", () => {
    const google = googleCom([{ autor: "", nota: 5, texto: "Ótimo!", data: "2026-08-25" }]);
    expect(buildComentarios(null, google)[0].autor).toBe("Paciente");
  });
});

// ── Classificação elogio × crítica ────────────────────────────────────────────

describe("buildComentarios — classificação", () => {
  it("NPS nota ≤ 6 (detrator) vai para críticas", () => {
    const nps = npsCom([{ nome: "Ana", comentario: "Demorou demais.", nota: 6 }]);
    expect(buildComentarios(nps, null)[0].critica).toBe(true);
  });

  it("NPS nota 7 e 8 (neutros) ficam no bloco principal", () => {
    const nps = npsCom([
      { nome: "Bia", comentario: "Foi ok.", nota: 7 },
      { nome: "Caio", comentario: "Bom.", nota: 8 },
    ]);
    expect(buildComentarios(nps, null).every((c) => !c.critica)).toBe(true);
  });

  it("NPS nota ≥ 9 (promotor) fica nos elogios", () => {
    const nps = npsCom([{ nome: "Dani", comentario: "Maravilhoso.", nota: 10 }]);
    expect(buildComentarios(nps, null)[0].critica).toBe(false);
  });

  it("NPS sem nota não é tratado como crítica", () => {
    const nps = npsCom([{ nome: "Edu", comentario: "Sem nota aqui.", nota: null }]);
    const [item] = buildComentarios(nps, null);
    expect(item.critica).toBe(false);
    expect(item.nota).toBeNull();
  });

  it("Google nota ≤ 3 vai para críticas; 4 e 5 ficam nos elogios", () => {
    const google = googleCom([
      { autor: "F", nota: 3, texto: "Sala cheia.", data: "" },
      { autor: "G", nota: 4, texto: "Bom atendimento.", data: "" },
      { autor: "H", nota: 5, texto: "Perfeito.", data: "" },
    ]);
    expect(buildComentarios(null, google).map((c) => c.critica)).toEqual([true, false, false]);
  });
});

// ── Filtro de relevância e origem ─────────────────────────────────────────────

describe("buildComentarios — conteúdo", () => {
  it("elogio curto ('muito bom!') aparece nesta página", () => {
    const nps = npsCom([{ nome: "Geovana", comentario: "muito bom!", nota: 9 }]);
    expect(buildComentarios(nps, null)).toHaveLength(1);
  });

  it("descarta vazios e caractere solto", () => {
    const nps = npsCom([
      { nome: "A", comentario: "   ", nota: 10 },
      { nome: "B", comentario: ".", nota: 10 },
      { nome: "C", comentario: "Ok", nota: 10 },
    ]);
    expect(buildComentarios(nps, null).map((c) => c.texto)).toEqual(["Ok"]);
  });

  it("junta NPS e Google, marcando a origem de cada um", () => {
    const nps = npsCom([{ nome: "A", comentario: "Do NPS.", nota: 10 }]);
    const google = googleCom([{ autor: "B", nota: 5, texto: "Do Google.", data: "" }]);
    expect(buildComentarios(nps, google).map((c) => c.origem)).toEqual(["nps", "google"]);
  });

  it("avaliações manuais substituem as da API (mesma regra do WhatsApp)", () => {
    const google = googleCom([{ autor: "API", nota: 5, texto: "Veio da API.", data: "" }]);
    const manual = [{ autor: "Manual", nota: 5, texto: "Digitada à mão.", data: "" }];
    const itens = buildComentarios(null, google, manual);
    expect(itens.map((c) => c.texto)).toEqual(["Digitada à mão."]);
  });

  it("sem NPS e sem Google → lista vazia (página 2 não é gerada)", () => {
    expect(buildComentarios(null, null)).toEqual([]);
  });
});
