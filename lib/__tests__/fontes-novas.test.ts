import { describe, it, expect } from "vitest";
import {
  indiceDaColuna, lerData, lerValor, normalizarTexto, contarPorTexto,
} from "../coletores/planilha";
import { calcularEntradas, grupoDaEntrada, situacaoEmAberto } from "../coletores/entradas-calculo";
import { calcularOrcamentos, situacaoDoOrcamento } from "../coletores/orcamentos-calculo";
import { detectarPorTipo, DEFINICOES } from "../fontes/detectar-colunas";
import {
  CAMPOS_EXTRAS, CAMPOS_FONTE_SIMPLES, ROTULO_FONTE, ROTULO_DATA, rotuloDoCampo, ehFonteSimples,
} from "../fontes/campos";
import {
  entradasSchema, orcamentosSchema, leadsSchema, faturamentoSchema, despesaSchema,
} from "../../app/(app)/clinicas/[id]/fontes/_schemas";
import { disponibilidadeDasFontes } from "../estrutura/carregar";
import { indisponiveis } from "../estrutura/estrutura";

const outubro = [new Date(2026, 9, 1), new Date(2026, 9, 31)] as const;
const letras = (d: ReturnType<typeof detectarPorTipo>) =>
  Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v.letra]));

describe("leitura de células", () => {
  it("indiceDaColuna", () => {
    expect(indiceDaColuna("A")).toBe(0);
    expect(indiceDaColuna("ab")).toBe(27);
    expect(indiceDaColuna("")).toBe(-1);
    expect(indiceDaColuna(undefined)).toBe(-1);
    expect(indiceDaColuna("A1")).toBe(-1);
  });

  it("lerData aceita DD/MM/AAAA, com hora, e AAAA-MM-DD; recusa data impossível", () => {
    expect(lerData("05/10/2026")?.getDate()).toBe(5);
    expect(lerData("5/1/2026 14:30:00")?.getMonth()).toBe(0);
    expect(lerData("2026-10-05")?.getMonth()).toBe(9);
    expect(lerData("31/02/2026")).toBeNull();
    expect(lerData("outubro")).toBeNull();
    expect(lerData("")).toBeNull();
  });

  it("lerValor entende o padrão brasileiro e distingue vazio de zero", () => {
    expect(lerValor("R$ 1.234,56")).toBe(1234.56);
    expect(lerValor("1234,5")).toBe(1234.5);
    expect(lerValor("1234.56")).toBe(1234.56);
    expect(lerValor("1.234")).toBe(1234);
    expect(lerValor("0")).toBe(0);
    expect(lerValor("-R$ 50,00")).toBe(-50);
    expect(lerValor("(50,00)")).toBe(-50);
    expect(lerValor("")).toBeNull();
    expect(lerValor("a combinar")).toBeNull();
  });

  it("contarPorTexto junta variações de caixa e acento e ordena por frequência", () => {
    const r = contarPorTexto(["Preço", "preco", "PREÇO", "Distância", ""]);
    expect(r.map((i) => [i.nome, i.quantidade])).toEqual([["Preço", 3], ["Distância", 1], ["Não informado", 1]]);
    expect(r[0].pct).toBeCloseTo(0.6);
    expect(contarPorTexto(["", " "], true)).toEqual([]);
    expect(normalizarTexto("  Não   Fechou ")).toBe("nao fechou");
  });
});

describe("entradas", () => {
  const colunas = { data: "A", valor: "B", situacao: "C", categoria: "D" };

  it("classifica a categoria em operacional, não operacional e fora do resultado", () => {
    expect(grupoDaEntrada("PROCEDIMENTOS")).toBe("operacional");
    expect(grupoDaEntrada("Rendimento de aplicação")).toBe("nao_operacional");
    expect(grupoDaEntrada("Receitas Não Operacionais")).toBe("nao_operacional");
    expect(grupoDaEntrada("Transferência entre contas")).toBe("fora");
    expect(grupoDaEntrada("Empréstimo bancário")).toBe("fora");
    expect(grupoDaEntrada("Aporte de sócio")).toBe("fora");
    expect(grupoDaEntrada("")).toBe("operacional");
  });

  it("reconhece o que ainda não foi recebido", () => {
    for (const s of ["Em aberto", "A receber", "Pendente", "Não", "Atrasado", "Previsto"]) {
      expect(situacaoEmAberto(s), s).toBe(true);
    }
    for (const s of ["Recebido", "Sim", "Pago", "OK", ""]) expect(situacaoEmAberto(s), s).toBe(false);
  });

  it("soma pela data do recebimento, separa os grupos e deixa o em aberto de fora", () => {
    const r = calcularEntradas([
      ["05/10/2026", "R$ 1.000,00", "Recebido", "Consultas"],
      ["10/10/2026", "500,00", "Recebido", "consultas"],
      ["12/10/2026", "200,00", "", "Rendimento"],
      ["15/10/2026", "5.000,00", "Recebido", "Aporte de sócio"],
      ["20/10/2026", "300,00", "Em aberto", "Consultas"],
      ["30/09/2026", "999,00", "Recebido", "Consultas"],   // fora do período
      ["01/11/2026", "999,00", "Recebido", "Consultas"],   // fora do período
      ["", "", "", ""],                                     // linha em branco: ignorada
      ["sem data", "100,00", "Recebido", "Consultas"],      // ilegível
      ["21/10/2026", "a definir", "Recebido", "Consultas"], // ilegível
    ], colunas, ...outubro);

    expect(r.total).toBe(1700);
    expect(r.operacionais).toBe(1500);
    expect(r.naoOperacionais).toBe(200);
    expect(r.foraDoResultado).toBe(5000);
    expect(r.lancamentos).toBe(4);
    expect(r.emAberto).toEqual({ valor: 300, quantidade: 1 });
    expect(r.semSituacao).toBe(1);
    expect(r.linhasIlegiveis).toBe(2);
    expect(r.porCategoria.map((c) => [c.nome, c.grupo, c.valor])).toEqual([
      ["Consultas", "operacional", 1500],
      ["Rendimento", "nao_operacional", 200],
      ["Aporte de sócio", "fora", 5000],
    ]);
    expect(r.porCategoria[0].pct).toBeCloseTo(1500 / 1700);
    expect(r.porCategoria[2].pct).toBe(0);
  });

  it("sem coluna de situação nem de categoria, tudo conta como recebido operacional", () => {
    const r = calcularEntradas(
      [["05/10/2026", "100,00"], ["06/10/2026", "50,00"]], { data: "A", valor: "B" }, ...outubro,
    );
    expect(r.total).toBe(150);
    expect(r.semSituacao).toBe(0);
    expect(r.porCategoria).toEqual([{ nome: "Não informado", grupo: "operacional", valor: 150, pct: 1 }]);
  });

  it("período sem nada devolve zeros, não NaN", () => {
    const r = calcularEntradas([], colunas, ...outubro);
    expect(r.total).toBe(0);
    expect(r.porCategoria).toEqual([]);
  });

  it("inclui o primeiro e o último dia do período", () => {
    const r = calcularEntradas(
      [["01/10/2026", "1,00"], ["31/10/2026 23:59:00", "2,00"]], { data: "A", valor: "B" }, ...outubro,
    );
    expect(r.total).toBe(3);
  });
});

describe("orçamentos", () => {
  const colunas = { data: "A", status: "B", valor_prescricao: "C", valor_venda: "D", objecao: "E" };

  it("classifica o status; 'não fechou' não se confunde com 'fechou'", () => {
    expect(situacaoDoOrcamento("Fechado")).toBe("fechado");
    expect(situacaoDoOrcamento("Aprovado")).toBe("fechado");
    expect(situacaoDoOrcamento("Sim")).toBe("fechado");
    expect(situacaoDoOrcamento("Não fechou")).toBe("nao_fechou");
    expect(situacaoDoOrcamento("Não aprovado")).toBe("nao_fechou");
    expect(situacaoDoOrcamento("Perdido")).toBe("nao_fechou");
    expect(situacaoDoOrcamento("Não")).toBe("nao_fechou");
    expect(situacaoDoOrcamento("Em aberto")).toBe("aberto");
    expect(situacaoDoOrcamento("Em negociação")).toBe("aberto");
    expect(situacaoDoOrcamento("Cancelado")).toBe("cancelado");
    expect(situacaoDoOrcamento("")).toBeNull();
    expect(situacaoDoOrcamento("Recall")).toBeNull();
  });

  it("reproduz o exemplo do Sync: 4 orçamentos, 3 fechados, 1 sem status", () => {
    const r = calcularOrcamentos([
      ["02/10/2026", "Fechado", "12.000,00", "11.340,00", ""],
      ["05/10/2026", "Fechado", "11.340,00", "11.340,00", ""],
      ["09/10/2026", "Fechado", "11.340,00", "11.340,00", ""],
      ["12/10/2026", "", "1.140,00", "", ""],
    ], colunas, ...outubro);

    expect(r.total).toBe(4);
    expect(r.fechados).toBe(3);
    expect(r.emAberto).toBe(0);
    expect(r.naoFechou).toBe(0);
    expect(r.cancelados).toBe(0);
    expect(r.valorGerado).toBe(35820);
    expect(r.valorFechado).toBe(34020);
    expect(r.conversaoQuantidade).toBe(0.75);
    expect(r.conversaoValor).toBeCloseTo(0.949748743718593);
    expect(r.porStatus.map((s) => [s.nome, s.quantidade, s.pct])).toEqual([
      ["Fechado", 3, 0.75], ["Não informado", 1, 0.25],
    ]);
    expect(r.porObjecao).toEqual([]);
  });

  it("cancelados ficam fora da conversão, em quantidade e em valor", () => {
    const r = calcularOrcamentos([
      ["02/10/2026", "Fechado", "1.000,00", "900,00", ""],
      ["03/10/2026", "Não fechou", "1.000,00", "", "Preço"],
      ["04/10/2026", "Em aberto", "500,00", "", ""],
      ["05/10/2026", "Cancelado", "2.000,00", "", "Mudou de cidade"],
      ["06/10/2026", "não fechou", "1.000,00", "", "preço"],
    ], colunas, ...outubro);

    expect([r.total, r.fechados, r.naoFechou, r.emAberto, r.cancelados]).toEqual([5, 1, 2, 1, 1]);
    expect(r.valorGerado).toBe(5500);
    expect(r.valorCancelado).toBe(2000);
    expect(r.valorEmAberto).toBe(500);
    expect(r.conversaoQuantidade).toBe(1 / 4);
    expect(r.conversaoValor).toBeCloseTo(900 / 3500);
    expect(r.porObjecao.map((o) => [o.nome, o.quantidade])).toEqual([["Preço", 2], ["Mudou de cidade", 1]]);
  });

  it("sem valor de venda, o fechado vale a prescrição; sem prescrição, vale a venda", () => {
    const r = calcularOrcamentos([
      ["02/10/2026", "Fechado", "1.000,00", "", ""],
      ["03/10/2026", "Fechado", "", "700,00", ""],
    ], colunas, ...outubro);
    expect(r.valorGerado).toBe(1700);
    expect(r.valorFechado).toBe(1700);
  });

  it("sem orçamentos ou só cancelados: conversão é nula, não NaN nem infinito", () => {
    expect(calcularOrcamentos([], colunas, ...outubro).conversaoQuantidade).toBeNull();
    const r = calcularOrcamentos([["02/10/2026", "Cancelado", "100,00", "", ""]], colunas, ...outubro);
    expect(r.conversaoQuantidade).toBeNull();
    expect(r.conversaoValor).toBeNull();
  });

  it("ignora o que está fora do período e conta data ilegível", () => {
    const r = calcularOrcamentos([
      ["30/09/2026", "Fechado", "100,00", "100,00", ""],
      ["??", "Fechado", "100,00", "100,00", ""],
      ["", "", "", "", ""],
    ], colunas, ...outubro);
    expect(r.total).toBe(0);
    expect(r.linhasIlegiveis).toBe(1);
  });
});

describe("detecção de colunas das fontes novas", () => {
  it("entradas no padrão do Sync", () => {
    const d = detectarPorTipo("entradas", [
      "Data Receb.", "Cliente/Forneced/Descrição", "Categoria", "Forma Receb.", "Vl Receb R$", "Status Recebido",
      "Data de competência",
    ]);
    expect(letras(d)).toEqual({
      coluna_data: "A", descricao: "B", categoria: "C", forma: "D", valor: "E", situacao: "F", competencia: "G",
    });
  });

  it("orçamentos no padrão do Sync", () => {
    const d = detectarPorTipo("orcamentos", [
      "Data da consulta", "Nome paciente", "Médico responsável", "Prescrição de tratamentos?",
      "Valor prescrição", "Fechamento", "Valor da venda", "Objeção do orçamento",
    ]);
    expect(letras(d)).toEqual({
      coluna_data: "A", paciente: "B", profissional: "C", prescricao: "D",
      valor_prescricao: "E", status: "F", valor_venda: "G", objecao: "H",
    });
  });

  it("orçamentos: 'Valor da prescrição' não é tomado como a pergunta de prescrição", () => {
    const d = detectarPorTipo("orcamentos", ["Data", "Status", "Valor da prescrição", "Valor fechado"]);
    expect(d.valor_prescricao.letra).toBe("C");
    expect(d.valor_venda.letra).toBe("D");
    expect(d.prescricao).toBeUndefined();
  });

  it("leads: colunas opcionais novas", () => {
    const d = detectarPorTipo("leads", [
      "Data 1º contato", "Nome", "Origem", "Canal", "Interesse", "Status final", "Objeção (caso não agende)", "Responsável",
    ]);
    expect(letras(d)).toEqual({
      coluna_data: "A", origem: "C", canal: "D", interesse: "E", convertido: "F", objecao: "G", responsavel: "H",
    });
  });

  it("despesas: vencimento vira a data e o pagamento fica como coluna à parte", () => {
    const d = detectarPorTipo("despesa", [
      "Data Pgto.", "Data Vcto.", "Descrição", "Categoria", "Valor R$", "Pago?", "Periodicidade", "Centro de custo",
    ]);
    expect(letras(d)).toEqual({
      coluna_data: "B", data_pagamento: "A", descricao: "C", categoria: "D", valor_pago: "E",
      situacao: "F", periodicidade: "G", centro_custo: "H",
    });
  });

  it("despesas só com data de pagamento: ela é a data, e não sobra para o campo à parte", () => {
    const d = detectarPorTipo("despesa", ["Data de pagamento", "Categoria", "Valor"]);
    expect(d.coluna_data.letra).toBe("A");
    expect(d.data_pagamento).toBeUndefined();
  });
});

describe("catálogo de campos das fontes", () => {
  const esquemas = {
    entradas: entradasSchema, orcamentos: orcamentosSchema,
    leads: leadsSchema, faturamento: faturamentoSchema, despesa: despesaSchema,
  } as const;

  it("todo campo do catálogo existe no esquema e na detecção da sua fonte", () => {
    const porTipo = { ...CAMPOS_FONTE_SIMPLES, ...CAMPOS_EXTRAS } as Record<string, { chave: string }[]>;
    for (const [tipo, campos] of Object.entries(porTipo)) {
      const chavesEsquema = Object.keys(esquemas[tipo as keyof typeof esquemas].shape);
      const chavesDeteccao = Object.keys(DEFINICOES[tipo as keyof typeof DEFINICOES]);
      for (const c of campos) {
        expect(chavesEsquema, `${tipo}.${c.chave} no esquema`).toContain(c.chave);
        expect(chavesDeteccao, `${tipo}.${c.chave} na detecção`).toContain(c.chave);
      }
    }
  });

  it("toda fonte tem rótulo e rótulo de data", () => {
    for (const tipo of Object.keys(DEFINICOES)) {
      expect(ROTULO_FONTE[tipo as keyof typeof ROTULO_FONTE], tipo).toBeTruthy();
      expect(ROTULO_DATA[tipo as keyof typeof ROTULO_DATA], tipo).toBeTruthy();
    }
  });

  it("rotuloDoCampo cobre campos novos, antigos e desconhecidos", () => {
    expect(rotuloDoCampo("orcamentos", "valor_venda")).toBe("Valor da venda");
    expect(rotuloDoCampo("faturamento", "primeira_vez")).toBe("1ª vez (cliente novo)");
    expect(rotuloDoCampo("nps", "nota_geral")).toBe("Nota geral");
    expect(rotuloDoCampo("nps", "campo_novo")).toBe("campo novo");
    expect(ehFonteSimples("entradas")).toBe(true);
    expect(ehFonteSimples("leads")).toBe(false);
  });

  it("esquemas das fontes novas exigem o essencial e aceitam o opcional vazio", () => {
    const base = { sheet_id: "abc", aba_nome: "Base", coluna_data: "A", linha_inicial: 2 };
    const vazios = { situacao: "", categoria: "", forma: "", competencia: "", descricao: "" };
    expect(entradasSchema.safeParse({ ...base, ...vazios, valor: "E" }).success).toBe(true);
    expect(entradasSchema.safeParse({ ...base, ...vazios, valor: "" }).success).toBe(false);
    const vaziosOrc = { valor_prescricao: "", valor_venda: "", paciente: "", profissional: "", prescricao: "", objecao: "" };
    expect(orcamentosSchema.safeParse({ ...base, ...vaziosOrc, status: "F" }).success).toBe(true);
    expect(orcamentosSchema.safeParse({ ...base, ...vaziosOrc, status: "f1" }).success).toBe(false);
  });
});

describe("disponibilidade com as fontes novas", () => {
  it("cadastrar Entradas e Orçamentos destrava as seções e indicadores", () => {
    const fora = indisponiveis(disponibilidadeDasFontes([
      { tipo: "entradas", mapeamento: { valor: "E" } },
      { tipo: "orcamentos", mapeamento: { status: "F", objecao: "H" } },
      { tipo: "faturamento", mapeamento: { valor_pago: "H", primeira_vez: "C", unidade: "K", pagamento: "G" } },
      { tipo: "leads", mapeamento: { origem: "C", canal: "D", interesse: "E", objecao: "G" } },
    ], false));
    for (const id of [
      "entradas", "res.entradas", "funilOrcamentos", "orc.motivos", "res.novos", "res.ticketNovos",
      "dist.unidade", "dist.pagamento", "leads.origem", "leads.canal", "leads.servico", "leads.objecoes",
    ]) expect(fora[id], id).toBeUndefined();
  });

  it("orçamentos sem coluna de motivo: só o indicador de motivos fica indisponível", () => {
    const fora = indisponiveis(disponibilidadeDasFontes([{ tipo: "orcamentos", mapeamento: { status: "F" } }], false));
    expect(fora.funilOrcamentos).toBeUndefined();
    expect(fora["orc.motivos"]).toBeDefined();
  });
});

describe("palavras próprias da clínica", () => {
  it("orçamentos: termos da clínica valem antes da regra geral", () => {
    const termos = { fechado: "Protocolo completo; contratou", aberto: "avaliando" };
    expect(situacaoDoOrcamento("Protocolo completo - Recaptação", termos)).toBe("fechado");
    expect(situacaoDoOrcamento("AVALIANDO proposta", termos)).toBe("aberto");
    expect(situacaoDoOrcamento("Protocolo completo")).toBeNull();
    // o que a clínica não ensinou continua na regra geral
    expect(situacaoDoOrcamento("Cancelado", termos)).toBe("cancelado");
    expect(situacaoDoOrcamento("Em negociação", termos)).toBe("aberto");
  });

  it("orçamentos: status sem classificação é listado, e some quando a clínica ensina a palavra", () => {
    const linhas = [
      ["02/10/2026", "Protocolo completo", "1.000,00", "1.000,00"],
      ["03/10/2026", "Protocolo completo", "1.000,00", "800,00"],
      ["04/10/2026", "Em negociação", "500,00", ""],
      ["05/10/2026", "", "500,00", ""],
    ];
    const colunas = { data: "A", status: "B", valor_prescricao: "C", valor_venda: "D" };
    const semTermos = calcularOrcamentos(linhas, colunas, ...outubro);
    expect(semTermos.fechados).toBe(0);
    expect(semTermos.statusSemSituacao.map((s) => [s.nome, s.quantidade])).toEqual([["Protocolo completo", 2]]);

    const comTermos = calcularOrcamentos(linhas, colunas, ...outubro, { fechado: "protocolo completo" });
    expect(comTermos.fechados).toBe(2);
    expect(comTermos.valorFechado).toBe(1800);
    expect(comTermos.conversaoQuantidade).toBe(0.5);
    expect(comTermos.statusSemSituacao).toEqual([]);
  });

  it("entradas: termos da clínica mandam a categoria para fora do resultado", () => {
    expect(grupoDaEntrada("Resgate de aplicação", { fora: "resgate" })).toBe("fora");
    expect(grupoDaEntrada("Venda de equipamento", { nao_operacional: "venda de equipamento" })).toBe("nao_operacional");
    expect(grupoDaEntrada("Resgate de aplicação")).toBe("operacional");
    expect(grupoDaEntrada("Consultas", { fora: "", nao_operacional: "  " })).toBe("operacional");
  });
});
