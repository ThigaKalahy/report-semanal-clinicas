import { describe, it, expect } from "vitest";
import { SECOES, INDICADORES, secoesDa, indicadoresDa, secaoPorId } from "../estrutura/catalogo";
import {
  estruturaPadrao, listaPadrao, normalizarEstrutura, ehPadrao, indicadoresLigados,
  moverSecao, alternarIndicador, trocarNivel, limparOcultos, indisponiveis, secoesAtivas,
} from "../estrutura/estrutura";
import { disponibilidadeDasFontes } from "../estrutura/carregar";

const ids = (l: { id: string }[]) => l.map((i) => i.id);

describe("catálogo", () => {
  it("tem as 13 seções do Sync e as 4 do semanal, sem id repetido", () => {
    expect(new Set(ids(SECOES)).size).toBe(SECOES.length);
    expect(SECOES.filter((s) => !s.tipos.includes("semanal"))).toHaveLength(13);
    expect(ids(secoesDa("semanal"))).toEqual(["semPreConsulta", "semNps", "semGoogle", "semLeads"]);
  });

  it("tem os 27 indicadores do Sync, sem id repetido, todos em seção existente", () => {
    expect(new Set(ids(INDICADORES)).size).toBe(INDICADORES.length);
    expect(INDICADORES.filter((i) => !i.id.startsWith("sem."))).toHaveLength(27);
    for (const i of INDICADORES) expect(secaoPorId(i.secao), i.id).toBeDefined();
  });

  it("indicador só aparece em periodicidade que a seção tem", () => {
    for (const i of INDICADORES) {
      const sec = secaoPorId(i.secao)!;
      for (const t of i.tipos ?? []) expect(sec.tipos, i.id).toContain(t);
    }
  });

  it("nível padrão é sempre um nível que existe", () => {
    for (const s of SECOES) {
      for (const nivel of Object.values(s.nivelPadrao ?? {})) {
        expect(s.niveis?.map((n) => n.id), s.id).toContain(nivel);
      }
    }
  });

  it("quinzenal não mostra indicadores só de mensal", () => {
    expect(ids(indicadoresDa("resultado", "quinzenal"))).toEqual([
      "res.faturamento", "res.atendidos", "res.ticket", "res.novos",
    ]);
    expect(ids(indicadoresDa("funilLeads", "quinzenal"))).toEqual([
      "leads.funil", "leads.origem", "leads.objecoes",
    ]);
  });

  it("despesa é descrita pela data de vencimento", () => {
    const d = INDICADORES.find((i) => i.id === "res.despesas")!;
    expect(d.regra).toContain("vencimento");
    expect(d.regra).not.toContain("pagamento");
  });
});

describe("estrutura padrão", () => {
  it("segue a ordem e os padrões do Sync", () => {
    const p = estruturaPadrao();
    expect(p.mensal).toEqual([
      { id: "resultado", ativa: true },
      { id: "grafico", ativa: true },
      { id: "funilLeads", ativa: true, nivel: "completo" },
      { id: "funilOrcamentos", ativa: true, nivel: "completo" },
      { id: "experiencia", ativa: true },
      { id: "receitas", ativa: true, nivel: "todas" },
      { id: "distribuicao", ativa: false },
      { id: "despesas", ativa: true, nivel: "categorias" },
      { id: "entradas", ativa: true, nivel: "categorias" },
      { id: "regimes", ativa: true, nivel: "ambos" },
      { id: "analise", ativa: false },
    ]);
    expect(p.quinzenal).toEqual([
      { id: "resultado", ativa: true },
      { id: "ritmo", ativa: true },
      { id: "caixaMes", ativa: true },
      { id: "funilLeads", ativa: true, nivel: "resumo" },
      { id: "funilOrcamentos", ativa: true, nivel: "resumo" },
      { id: "receitas", ativa: true, nivel: "todas" },
      { id: "analise", ativa: false },
    ]);
    expect(p.semanal.every((s) => s.ativa)).toBe(true);
  });

  it("é reconhecida como padrão; qualquer mudança deixa de ser", () => {
    expect(ehPadrao(estruturaPadrao())).toBe(true);
    const e = estruturaPadrao();
    e.semanal = moverSecao(e.semanal, "semLeads", -1);
    expect(ehPadrao(e)).toBe(false);
  });
});

describe("normalizarEstrutura", () => {
  it("lixo vira a estrutura padrão", () => {
    for (const lixo of [null, undefined, 3, "x", [], { mensal: "nada" }]) {
      expect(normalizarEstrutura(lixo)).toEqual(estruturaPadrao());
    }
  });

  it("preserva a ordem salva e completa o que falta", () => {
    const e = normalizarEstrutura({ semanal: [{ id: "semLeads", ativa: true }, { id: "semNps", ativa: false }] });
    expect(ids(e.semanal)).toEqual(["semPreConsulta", "semLeads", "semNps", "semGoogle"]);
    expect(e.semanal.find((s) => s.id === "semNps")!.ativa).toBe(false);
  });

  it("seção nova do catálogo entra depois da vizinha anterior", () => {
    const e = normalizarEstrutura({
      quinzenal: [
        { id: "receitas", ativa: true }, { id: "resultado", ativa: true }, { id: "ritmo", ativa: true },
        { id: "funilLeads", ativa: true }, { id: "funilOrcamentos", ativa: true }, { id: "analise", ativa: true },
      ],
    });
    // caixaMes faltava: entra logo depois de ritmo
    expect(ids(e.quinzenal)).toEqual([
      "receitas", "resultado", "ritmo", "caixaMes", "funilLeads", "funilOrcamentos", "analise",
    ]);
  });

  it("descarta seção desconhecida, repetida ou de outra periodicidade", () => {
    const e = normalizarEstrutura({
      quinzenal: [
        { id: "inventada", ativa: true }, { id: "grafico", ativa: true },
        { id: "resultado", ativa: true }, { id: "resultado", ativa: false },
      ],
    });
    expect(ids(e.quinzenal)).not.toContain("inventada");
    expect(ids(e.quinzenal)).not.toContain("grafico");
    expect(ids(e.quinzenal).filter((i) => i === "resultado")).toHaveLength(1);
  });

  it("seção fixa nunca fica desligada", () => {
    const e = normalizarEstrutura({ mensal: [{ id: "resultado", ativa: false }, { id: "despesas", ativa: false }] });
    expect(e.mensal.find((s) => s.id === "resultado")!.ativa).toBe(true);
    expect(e.mensal.find((s) => s.id === "despesas")!.ativa).toBe(true);
  });

  it("nível inválido volta ao padrão da periodicidade", () => {
    const e = normalizarEstrutura({ quinzenal: [{ id: "funilLeads", ativa: true, nivel: "gigante" }] });
    expect(e.quinzenal.find((s) => s.id === "funilLeads")!.nivel).toBe("resumo");
  });

  it("ocultos: só indicadores opcionais da própria seção", () => {
    const e = normalizarEstrutura({
      mensal: [{ id: "resultado", ativa: true, ocultos: ["res.ticket", "res.faturamento", "leads.funil", 7, "res.ticket"] }],
    });
    expect(e.mensal.find((s) => s.id === "resultado")!.ocultos).toEqual(["res.ticket"]);
  });

  it("é idempotente", () => {
    const e = normalizarEstrutura({
      mensal: [{ id: "analise", ativa: true }, { id: "funilLeads", ativa: true, nivel: "resumo", ocultos: [] }],
    });
    expect(normalizarEstrutura(e)).toEqual(e);
  });

  it("aceita a configuração como vem do Sync", () => {
    const doSync = {
      mensal: [
        { id: "resultado", ativa: true }, { id: "grafico", ativa: true },
        { id: "funilLeads", ativa: true, nivel: "completo" }, { id: "funilOrcamentos", ativa: true, nivel: "completo" },
        { id: "experiencia", ativa: true }, { id: "receitas", ativa: true, nivel: "todas" },
        { id: "distribuicao", ativa: false }, { id: "despesas", ativa: true, nivel: "categorias" },
        { id: "entradas", ativa: true, nivel: "categorias" }, { id: "regimes", ativa: true, nivel: "ambos" },
        { id: "analise", ativa: false },
      ],
      quinzenal: [
        { id: "resultado", ativa: true }, { id: "ritmo", ativa: true }, { id: "caixaMes", ativa: true },
        { id: "funilLeads", ativa: true, nivel: "resumo" }, { id: "funilOrcamentos", ativa: true, nivel: "resumo" },
        { id: "receitas", ativa: true, nivel: "todas" }, { id: "analise", ativa: false },
      ],
      secoes: [],
    };
    const e = normalizarEstrutura(doSync);
    expect(e.mensal).toEqual(doSync.mensal);
    expect(e.quinzenal).toEqual(doSync.quinzenal);
    expect(e.semanal).toEqual(listaPadrao("semanal"));
  });
});

describe("indicadores ligados", () => {
  it("no resumo, os de detalhe somem; no completo, aparecem", () => {
    const resumo = { id: "funilLeads", ativa: true, nivel: "resumo" };
    const completo = { id: "funilLeads", ativa: true, nivel: "completo" };
    expect([...indicadoresLigados(resumo, "mensal")]).toEqual(["leads.funil"]);
    expect(indicadoresLigados(completo, "mensal").size).toBe(5);
  });

  it("ocultos manda mais que o nível", () => {
    const item = { id: "funilLeads", ativa: true, nivel: "resumo", ocultos: ["leads.canal"] };
    const on = indicadoresLigados(item, "mensal");
    expect(on.has("leads.origem")).toBe(true);
    expect(on.has("leads.canal")).toBe(false);
  });

  it("obrigatório continua ligado mesmo se vier em ocultos", () => {
    const item = { id: "resultado", ativa: true, ocultos: ["res.faturamento"] };
    expect(indicadoresLigados(item, "mensal").has("res.faturamento")).toBe(true);
  });

  it("alternar congela o estado do nível e muda só o indicador pedido", () => {
    const resumo = { id: "funilLeads", ativa: true, nivel: "resumo" };
    const depois = alternarIndicador(resumo, "mensal", "leads.origem", true);
    expect([...indicadoresLigados(depois, "mensal")]).toEqual(["leads.funil", "leads.origem"]);
    const volta = alternarIndicador(depois, "mensal", "leads.origem", false);
    expect([...indicadoresLigados(volta, "mensal")]).toEqual(["leads.funil"]);
  });

  it("alternar ignora indicador obrigatório ou de outra seção", () => {
    const item = { id: "resultado", ativa: true };
    expect(alternarIndicador(item, "mensal", "res.faturamento", false)).toBe(item);
    expect(alternarIndicador(item, "mensal", "leads.funil", false)).toBe(item);
  });

  it("trocar o nível descarta a personalização de indicadores", () => {
    const item = { id: "funilLeads", ativa: true, nivel: "resumo", ocultos: [] as string[] };
    expect(trocarNivel(item, "completo")).toEqual({ id: "funilLeads", ativa: true, nivel: "completo" });
    expect(trocarNivel(item, "inexistente")).toBe(item);
  });

  it("limparOcultos devolve undefined quando não é lista", () => {
    expect(limparOcultos("resultado", "mensal", "res.ticket")).toBeUndefined();
    expect(limparOcultos("resultado", "mensal", [])).toEqual([]);
  });
});

describe("ordem e seções ativas", () => {
  it("mover respeita as pontas", () => {
    const l = listaPadrao("semanal");
    expect(moverSecao(l, "semPreConsulta", -1)).toBe(l);
    expect(moverSecao(l, "semLeads", 1)).toBe(l);
    expect(ids(moverSecao(l, "semLeads", -1))).toEqual(["semPreConsulta", "semNps", "semLeads", "semGoogle"]);
  });

  it("secoesAtivas mantém a ordem e tira as desligadas", () => {
    expect(ids(secoesAtivas(estruturaPadrao(), "mensal"))).not.toContain("distribuicao");
  });
});

describe("disponibilidade", () => {
  it("clínica sem fonte nenhuma: tudo que depende de fonte fica indisponível", () => {
    const fora = indisponiveis(disponibilidadeDasFontes([], false));
    expect(fora.semNps).toBe("sem fonte de NPS");
    expect(fora.funilOrcamentos).toBe("sem fonte de Orçamentos");
    expect(fora["exp.google"]).toBe("sem fonte de avaliações do Google");
    expect(fora["res.meta"]).toBeUndefined();
    expect(fora.resultado).toBeUndefined();
  });

  it("lê as colunas mapeadas nas fontes", () => {
    const fora = indisponiveis(disponibilidadeDasFontes([
      { tipo: "nps", mapeamento: { nota_geral: "B", nota_recepcao: "C", comentario: "F" } },
      { tipo: "faturamento", mapeamento: { valor_pago: "H", profissional: "F" } },
      { tipo: "leads", mapeamento: { convertido: "D" } },
    ], true));
    expect(fora.semNps).toBeUndefined();
    expect(fora["exp.recepcao"]).toBeUndefined();
    expect(fora["exp.profissional"]).toBe("a pesquisa não tem nota do profissional");
    expect(fora["sem.nps.indicacoes"]).toBe("a pesquisa não tem coluna de indicação");
    expect(fora["dist.profissional"]).toBeUndefined();
    expect(fora["dist.unidade"]).toBeDefined();
    expect(fora.funilLeads).toBeUndefined();
    expect(fora["leads.origem"]).toBeDefined();
    expect(fora["exp.google"]).toBeUndefined();
  });
});
