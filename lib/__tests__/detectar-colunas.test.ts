import { describe, it, expect } from "vitest";
import {
  detectarColunas, detectarPorTipo, normalizarCabecalho, letraDaColuna, DEFINICOES,
} from "../fontes/detectar-colunas";

const letras = (d: ReturnType<typeof detectarColunas>) =>
  Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v.letra]));

describe("letraDaColuna", () => {
  it("converte índice em letra, inclusive depois do Z", () => {
    expect(letraDaColuna(0)).toBe("A");
    expect(letraDaColuna(25)).toBe("Z");
    expect(letraDaColuna(26)).toBe("AA");
    expect(letraDaColuna(27)).toBe("AB");
  });
});

describe("normalizarCabecalho", () => {
  it("tira acento, caixa e pontuação", () => {
    expect(normalizarCabecalho("  Valor R$ ")).toBe("valor r");
    expect(normalizarCabecalho("Situação")).toBe("situacao");
    expect(normalizarCabecalho("1ª vez na clínica?")).toBe("1a vez na clinica");
    expect(normalizarCabecalho("Carimbo de data/hora")).toBe("carimbo de data hora");
  });
});

describe("detectarColunas — regras gerais", () => {
  it("igualdade vence aproximação, mesmo vindo depois na planilha", () => {
    // A regra antiga pegava "Forma de pagamento" como valor, por conter "pagamento"
    const d = detectarPorTipo("faturamento", ["Data", "Forma de pagamento", "Valor da consulta", "Valor pago"]);
    expect(d.valor_pago.letra).toBe("D");
    expect(d.valor_pago.exata).toBe(true);
  });

  it("despesa conta pela data de vencimento, mesmo com a de pagamento antes", () => {
    const d = detectarPorTipo("despesa", ["Data Pgto.", "Data Vcto.", "Categoria", "Valor"]);
    expect(d.coluna_data.letra).toBe("B");
  });

  it("sem vencimento na planilha, a data de pagamento vence a genérica", () => {
    const d = detectarPorTipo("despesa", ["Data", "Data de pagamento", "Categoria", "Valor"]);
    expect(d.coluna_data.letra).toBe("B");
  });

  it("uma coluna nunca é dada a dois campos", () => {
    const d = detectarColunas(["Status"], { a: ["status"], b: ["status"] });
    expect(Object.keys(d)).toEqual(["a"]);
  });

  it("ignora acento e caixa", () => {
    const d = detectarPorTipo("despesa", ["DATA PGTO", "CATEGORIA AJUSTADA", "VALOR R$"]);
    expect(letras(d)).toEqual({ coluna_data: "A", categoria: "B", valor_pago: "C" });
  });

  it("marca como aproximada a coluna achada por conter o apelido", () => {
    const d = detectarPorTipo("faturamento", ["Data do lançamento", "Valor total"]);
    expect(d.coluna_data.exata).toBe(false);
    expect(d.valor_pago.exata).toBe(false);
    expect(d.valor_pago.cabecalho).toBe("Valor total");
  });

  it("aproximação só casa no início de palavra", () => {
    // "data" não pode casar com "Validata" nem "nps" com "Dnps"
    const d = detectarColunas(["Validata", "Dnps"], { data: ["data"], nota: ["nps"] });
    expect(d).toEqual({});
  });

  it("campo sem correspondência fica de fora, sem inventar", () => {
    const d = detectarPorTipo("faturamento", ["Data", "Valor pago"]);
    expect(d.profissional).toBeUndefined();
    expect(d.categoria).toBeUndefined();
  });

  it("células vazias no cabeçalho não atrapalham os índices", () => {
    const d = detectarPorTipo("faturamento", ["", "Data", null, "Valor pago"]);
    expect(letras(d)).toEqual({ coluna_data: "B", valor_pago: "D" });
  });

  it("cabeçalho vazio devolve nada", () => {
    expect(detectarPorTipo("nps", [])).toEqual({});
  });
});

describe("detectarColunas — planilhas reais de cada fonte", () => {
  it("vendas no padrão do Sync", () => {
    const d = detectarPorTipo("faturamento", [
      "Data de atendimento", "Paciente", "1ª vez na clínica?", "Categoria",
      "Categoria ajustada", "Profissional responsável", "Meio de pagamento", "Valor pago",
    ]);
    // "Categoria ajustada" (E) vence a "Categoria" bruta (D): é a curadoria da planilha
    expect(letras(d)).toEqual({
      coluna_data: "A", paciente: "B", primeira_vez: "C", categoria: "E",
      profissional: "F", pagamento: "G", valor_pago: "H",
    });
    expect(Object.values(d).every((c) => c.exata)).toBe(true);
  });

  it("despesas: categoria ajustada tem preferência sobre a bruta", () => {
    const d = detectarPorTipo("despesa", ["Data Pgto", "Descrição", "Categoria", "Ajuste_Categoria", "Valor R$", "Pago?"]);
    expect(d.categoria.letra).toBe("D");
    expect(d.valor_pago.letra).toBe("E");
  });

  it("leads: status final antes de status genérico", () => {
    const d = detectarPorTipo("leads", ["Data", "Origem", "Status", "Status final"]);
    expect(d.convertido.letra).toBe("D");
  });

  it("NPS de formulário: nota geral não rouba a coluna das notas por área", () => {
    const d = detectarPorTipo("nps", [
      "Carimbo de data/hora",
      "De 0 a 10, quanto você indicaria a clínica?",
      "Nota da recepção",
      "Nota do profissional",
      "Nota da infraestrutura",
      "Deixe seu comentário",
      "Nome completo",
      "Prefere o anonimato?",
    ]);
    expect(letras(d)).toEqual({
      coluna_data: "A", nota_geral: "B", nota_recepcao: "C", nota_profissional: "D",
      nota_infraestrutura: "E", comentario: "F", nome_paciente: "G", anonimato: "H",
    });
  });

  it("NPS: 'indicaria' (nota) e 'indicação' (contato) não se confundem", () => {
    const d = detectarPorTipo("nps", [
      "Data", "Você indicaria a clínica? (0 a 10)", "Indicação de amigo (nome e telefone)",
    ]);
    expect(d.nota_geral.letra).toBe("B");
    expect(d.indicacao.letra).toBe("C");
  });

  it("pré-consulta de formulário", () => {
    const d = detectarPorTipo("pre_consulta", [
      "Carimbo de data/hora", "Qual o motivo da consulta?", "Como nos conheceu?",
    ]);
    expect(letras(d)).toEqual({ coluna_data: "A", motivo: "B", origem: "C" });
  });
});

describe("DEFINICOES", () => {
  it("toda fonte define a coluna de data", () => {
    for (const def of Object.values(DEFINICOES)) expect(def.coluna_data?.length).toBeGreaterThan(0);
  });
});
