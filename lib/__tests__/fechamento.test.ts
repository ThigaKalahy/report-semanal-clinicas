import { describe, it, expect } from "vitest";
import {
  periodoDe, periodoAnterior, rotuloPeriodo, rotuloCurto, dataISO, isoParaBR, periodoSugerido,
  periodoEncerrado, chaveAnoMes,
} from "../fechamento/periodo";
import { grupoDaDespesa, GRUPO_OUTRAS, GRUPOS_DESPESA } from "../fechamento/grupos-despesa";
import { calcularVendas, calcularDespesas, calcularLeads, temInformacao } from "../fechamento/calculos";
import {
  calcularResultado, atingimentoDaMeta, variacao, calcularRitmo, calcularCaixaMes, gerarAlertas, VERSAO_DADOS,
} from "../fechamento/dados";
import type { DadosFechamento } from "../fechamento/dados";
import { serieAnual } from "../fechamento/dados";
import { lerMes } from "../coletores/planilha";
import { montarSecoes, montarTextoFechamento, textoVariacao, brl, pct } from "../fechamento/secoes";
import { calcularEntradas } from "../coletores/entradas-calculo";
import { calcularOrcamentos } from "../coletores/orcamentos-calculo";
import { listaPadrao, normalizarEstrutura } from "../estrutura/estrutura";
import { ETAPAS, proximoStatus, posicaoDoStatus } from "../fechamento/status";
import { SEGMENTOS } from "../perfil/vocabulario";
import {
  brl0, comparar, textoVar, comparacaoDo, cartoesDoResultado, ligadosDa, categoriasDeReceita, linhasDeDespesa,
  maioresAumentos, visaoCaixa, visaoAno,
} from "../fechamento/visao";
import { lerAnalise, escreverAnalise, blocosParaCliente } from "../fechamento/analise";
import { chaveDoAlerta, alertasPendentes, aplicarMeta } from "../fechamento/dados";

const out = [new Date(2026, 9, 1), new Date(2026, 9, 31)] as const;
// espaço não separável que o toLocaleString põe depois de "R$"
const limpo = (s: string) => s.replace(/ /g, " ");

describe("períodos", () => {
  it("mensal cobre o mês inteiro, inclusive fevereiro bissexto", () => {
    const p = periodoDe("mensal", 2028, 2);
    expect([dataISO(p.inicio), dataISO(p.fim), p.quinzena]).toEqual(["2028-02-01", "2028-02-29", null]);
  });

  it("quinzenas: 1 a 15 e 16 ao fim", () => {
    expect(dataISO(periodoDe("quinzenal", 2026, 10, 1).fim)).toBe("2026-10-15");
    const q2 = periodoDe("quinzenal", 2026, 10, 2);
    expect([dataISO(q2.inicio), dataISO(q2.fim)]).toEqual(["2026-10-16", "2026-10-31"]);
    expect(periodoDe("quinzenal", 2026, 10).quinzena).toBe(1);
  });

  it("período anterior volta um mês e vira o ano", () => {
    const a = periodoAnterior(periodoDe("quinzenal", 2026, 1, 2));
    expect([a.ano, a.mes, a.quinzena, dataISO(a.fim)]).toEqual([2025, 12, 2, "2025-12-31"]);
    expect(periodoAnterior(periodoDe("mensal", 2026, 3)).mes).toBe(2);
  });

  it("rótulos em português", () => {
    expect(rotuloPeriodo(periodoDe("mensal", 2026, 10))).toBe("Mensal · outubro/2026");
    expect(rotuloPeriodo(periodoDe("quinzenal", 2026, 10, 1))).toBe("Quinzenal · 1ª quinzena de outubro/2026");
    expect(rotuloCurto(periodoDe("quinzenal", 2026, 3, 2))).toBe("2ª quinzena de março/2026");
    expect(isoParaBR("2026-10-05")).toBe("05/10/2026");
    expect(chaveAnoMes(2026, 3)).toBe("2026-03");
  });

  it("sugere o último período já encerrado", () => {
    const dia16 = new Date(2026, 10, 16);
    expect(rotuloCurto(periodoSugerido("mensal", dia16))).toBe("outubro/2026");
    expect(rotuloCurto(periodoSugerido("quinzenal", dia16))).toBe("1ª quinzena de novembro/2026");
    expect(rotuloCurto(periodoSugerido("quinzenal", new Date(2026, 10, 10)))).toBe("2ª quinzena de outubro/2026");
    expect(rotuloCurto(periodoSugerido("mensal", new Date(2026, 0, 5)))).toBe("dezembro/2025");
    expect(periodoEncerrado(periodoDe("mensal", 2026, 10), dia16)).toBe(true);
    expect(periodoEncerrado(periodoDe("mensal", 2026, 11), dia16)).toBe(false);
  });
});

describe("plano de contas das despesas", () => {
  it("categoria conhecida cai no grupo certo, ignorando caixa e acento", () => {
    expect(grupoDaDespesa("Aluguel")).toBe("Infraestrutura");
    expect(grupoDaDespesa("PRÓ-LABORE")).toBe("Pessoal");
    expect(grupoDaDespesa("trafego pago")).toBe("Marketing");
    expect(grupoDaDespesa("Marketing")).toBe("Marketing");
    expect(grupoDaDespesa("Cafezinho")).toBe(GRUPO_OUTRAS);
  });

  it("nenhuma categoria aparece em dois grupos", () => {
    const todas = GRUPOS_DESPESA.flatMap((g) => g.categorias.map((c) => c.toLowerCase()));
    expect(new Set(todas).size).toBe(todas.length);
  });
});

describe("vendas", () => {
  const col = { data: "A", valor: "B", categoria: "C", profissional: "D", paciente: "E", primeira_vez: "F", pagamento: "G" };
  const linhas = [
    ["02/10/2026", "R$ 400,00", "Consulta", "Dra. Ana", "Maria Silva", "Sim", "PIX"],
    ["03/10/2026", "600,00", "Consulta", "Dra. Ana", "maria silva", "Sim", "Crédito"],
    ["10/10/2026", "2.000,00", "Procedimento", "Dr. Leo", "João Souza", "Não", "PIX"],
    ["12/10/2026", "1.000,00", "procedimento", "", "Carla Lima", "", "PIX"],
    ["30/09/2026", "999,00", "Consulta", "Dra. Ana", "Fora", "Sim", "PIX"],
    ["", "", "", "", "", "", ""],
    ["15/10/2026", "abc", "Consulta", "Dra. Ana", "X", "", "PIX"],
  ];

  it("soma, agrupa e conta clientes distintos", () => {
    const r = calcularVendas(linhas, col, ...out);
    expect(r.total).toBe(4000);
    expect(r.lancamentos).toBe(4);
    expect(r.linhasIlegiveis).toBe(1);
    expect(r.porCategoria.map((c) => [c.nome, c.valor, c.quantidade, c.ticket])).toEqual([
      ["Procedimento", 3000, 2, 1500], ["Consulta", 1000, 2, 500],
    ]);
    expect(r.porCategoria[0].pct).toBe(0.75);
    expect(r.porProfissional!.map((p) => [p.nome, p.valor])).toEqual([
      ["Dr. Leo", 2000], ["Dra. Ana", 1000], ["Não informado", 1000],
    ]);
    expect(r.porPagamento!.map((p) => [p.nome, p.valor])).toEqual([["PIX", 3400], ["Crédito", 600]]);
    expect(r.porUnidade).toBeNull();
    // Maria aparece duas vezes: é uma cliente só
    expect(r.pacientes).toEqual({
      atendidos: 3, ticketMedio: 1333.33, temInformacaoDeNovos: true,
      novos: 1, faturamentoNovos: 1000, ticketNovos: 1000,
    });
  });

  it("sem as colunas opcionais, não inventa número", () => {
    const r = calcularVendas(linhas, { data: "A", valor: "B" }, ...out);
    expect(r.total).toBe(4000);
    expect(r.porProfissional).toBeNull();
    expect(r.pacientes.atendidos).toBeNull();
    expect(r.pacientes.ticketMedio).toBeNull();
    expect(r.pacientes.temInformacaoDeNovos).toBe(false);
    expect(r.porCategoria).toEqual([{ nome: "Não informado", valor: 4000, quantidade: 4, ticket: 1000, pct: 1 }]);
  });

  it("período vazio não divide por zero", () => {
    const r = calcularVendas([], col, ...out);
    expect(r.total).toBe(0);
    expect(r.pacientes.ticketMedio).toBeNull();
    expect(r.pacientes.ticketNovos).toBeNull();
  });

  it("temInformacao ignora lista só com 'Não informado'", () => {
    expect(temInformacao([{ nome: "Não informado" }])).toBe(false);
    expect(temInformacao([{ nome: "PIX" }])).toBe(true);
    expect(temInformacao(null)).toBe(false);
  });
});

describe("despesas", () => {
  const col = { data: "A", valor: "B", categoria: "C", situacao: "D" };
  const linhas = [
    ["05/10/2026", "5.000,00", "Aluguel", "Pago"],
    ["10/10/2026", "300,00", "Luz", "Pago"],
    ["20/10/2026", "8.000,00", "Salários", "Em aberto"],
    ["25/10/2026", "150,00", "Cafezinho", ""],
    ["05/11/2026", "5.000,00", "Aluguel", ""],
  ];

  it("conta pela data de vencimento, paga ou não, e separa o que está em aberto", () => {
    const r = calcularDespesas(linhas, col, ...out);
    expect(r.total).toBe(13450);
    expect(r.lancamentos).toBe(4);
    expect(r.emAberto).toBe(8000);
    expect(r.pagas).toBe(5450);
    expect(r.porGrupo.map((g) => [g.nome, g.valor])).toEqual([
      ["Infraestrutura", 5300], ["Pessoal", 8000], [GRUPO_OUTRAS, 150],
    ]);
    expect(r.porGrupo[0].categorias.map((c) => c.nome)).toEqual(["Aluguel", "Luz"]);
    expect(r.categoriasForaDoPlano).toEqual(["Cafezinho"]);
  });

  it("sem coluna de situação, pagas e em aberto ficam nulos", () => {
    const r = calcularDespesas(linhas, { data: "A", valor: "B", categoria: "C" }, ...out);
    expect(r.total).toBe(13450);
    expect(r.pagas).toBeNull();
    expect(r.emAberto).toBeNull();
  });

  it("recorte da quinzena", () => {
    const r = calcularDespesas(linhas, col, new Date(2026, 9, 1), new Date(2026, 9, 15));
    expect(r.total).toBe(5300);
  });
});

describe("leads", () => {
  const col = { data: "A", convertido: "B", origem: "C", canal: "D", objecao: "E" };
  const linhas = [
    ["02/10/2026", "Agendou", "Instagram", "Whats", ""],
    ["03/10/2026", "agendou", "instagram", "Whats", ""],
    ["04/10/2026", "Não agendou", "Google", "Ligação", "Preço"],
    ["05/10/2026", "", "", "Whats", ""],
    ["01/09/2026", "Agendou", "Google", "Whats", ""],
  ];

  it("conta pelo texto de conversão configurado — 'não agendou' contém 'agendou'", () => {
    // é a regra que o app já usa (célula CONTÉM o texto): o texto escolhido precisa ser inequívoco
    const ingenuo = calcularLeads(linhas, col, ...out, "agendou");
    expect(ingenuo.agendados).toBe(3);
  });

  it("funil e distribuições", () => {
    const r = calcularLeads(
      linhas.map((l) => [l[0], l[1] === "Não agendou" ? "Perdido" : l[1], l[2], l[3], l[4]]), col, ...out, "Agendou",
    );
    expect([r.total, r.agendados, r.conversao]).toEqual([4, 2, 0.5]);
    expect(r.porOrigem!.map((o) => [o.nome, o.quantidade])).toEqual([["Instagram", 2], ["Google", 1], ["Não informado", 1]]);
    expect(r.porCanal!.map((o) => [o.nome, o.quantidade])).toEqual([["Whats", 3], ["Ligação", 1]]);
    expect(r.porObjecao!.map((o) => o.nome)).toEqual(["Preço"]);
    expect(r.porInteresse).toBeNull();
  });

  it("sem leads, conversão nula", () => {
    expect(calcularLeads([], col, ...out).conversao).toBeNull();
  });
});

// ── Retrato completo para as seções ──────────────────────────────────────────

function retrato(tipo: "mensal" | "quinzenal" = "mensal"): DadosFechamento {
  const faturamento = calcularVendas([
    ["02/10/2026", "6.000,00", "Consulta", "Dra. Ana", "Maria", "Sim", "PIX"],
    ["10/10/2026", "4.000,00", "Procedimento", "Dr. Leo", "João", "Não", "Crédito"],
  ], { data: "A", valor: "B", categoria: "C", profissional: "D", paciente: "E", primeira_vez: "F", pagamento: "G" }, ...out);
  const despesas = calcularDespesas([
    ["05/10/2026", "5.000,00", "Aluguel", "Pago"], ["20/10/2026", "1.000,00", "Luz", "Em aberto"],
  ], { data: "A", valor: "B", categoria: "C", situacao: "D" }, ...out);
  const base = {
    versao: VERSAO_DADOS, tipo,
    periodo: { inicio: "2026-10-01", fim: "2026-10-31", rotulo: "Mensal · outubro/2026" },
    lidoEm: "2026-11-16T10:00:00.000Z",
    faturamento, despesas,
    entradas: null,
    orcamentos: calcularOrcamentos([
      ["02/10/2026", "Fechado", "1.000,00", "900,00"], ["03/10/2026", "Em aberto", "500,00", ""],
    ], { data: "A", status: "B", valor_prescricao: "C", valor_venda: "D" }, ...out),
    leads: calcularLeads([["02/10/2026", "Sim", "Instagram"], ["03/10/2026", "Não", "Google"]],
      { data: "A", convertido: "B", origem: "C" }, ...out),
    nps: { respostas: 10, score: 80, promotores: 8, neutros: 2, detratores: 0,
      notas: { profissional: 4.9, recepcao: 4.5, infraestrutura: null, enfermagem: null } },
    google: null,
    meta: 8000,
    anterior: { rotulo: "setembro/2026", faturamento: 8000, despesas: 6000,
      receitasPorCategoria: { consulta: 5000, exames: 3000 }, despesasPorCategoria: { aluguel: 5000, luz: 400 } },
    ritmo: null, caixaMes: null,
    leituras: [
      { fonte: "Vendas", estado: "ok" as const, mensagem: "2 lançamentos" },
      { fonte: "Entradas", estado: "ausente" as const, mensagem: "Fonte não cadastrada" },
    ],
  };
  return { ...base, alertas: gerarAlertas(base) };
}

describe("contas que combinam fontes", () => {
  it("sem Entradas, o resultado é Faturamento x Despesas; com ela, é de caixa", () => {
    const d = retrato();
    expect(calcularResultado(d)).toEqual({ rotulo: "Faturamento x Despesas", base: 10000, despesas: 6000, valor: 4000 });
    const entradas = calcularEntradas([["05/10/2026", "7.500,00"]], { data: "A", valor: "B" }, ...out);
    expect(calcularResultado({ ...d, entradas })).toMatchObject({ rotulo: "Resultado de caixa", valor: 1500 });
    expect(calcularResultado({ ...d, despesas: null })).toBeNull();
  });

  it("atingimento da meta e variação", () => {
    expect(atingimentoDaMeta(retrato())).toBe(1.25);
    expect(atingimentoDaMeta({ ...retrato(), meta: null })).toBeNull();
    expect(variacao(110, 100)).toBeCloseTo(0.1);
    expect(variacao(90, 100)).toBeCloseTo(-0.1);
    expect(variacao(50, 0)).toBeNull();
    expect(variacao(50, null)).toBeNull();
  });

  it("ritmo: média por dia útil, projeção e o que falta", () => {
    const r = calcularRitmo({ faturamentoMes: 50000, diasUteisDecorridos: 10, diasUteisMes: 22, meta: 120000 });
    expect(r.mediaPorDiaUtil).toBe(5000);
    expect(r.projecao).toBe(110000);
    expect(r.faltaParaMeta).toBe(70000);
    expect(r.necessarioPorDiaUtil).toBe(5833.33);
  });

  it("ritmo: meta batida, sem meta e sem dias decorridos", () => {
    const batida = calcularRitmo({ faturamentoMes: 130000, diasUteisDecorridos: 10, diasUteisMes: 22, meta: 120000 });
    expect([batida.faltaParaMeta, batida.necessarioPorDiaUtil]).toEqual([0, null]);
    const semMeta = calcularRitmo({ faturamentoMes: 100, diasUteisDecorridos: 1, diasUteisMes: 20, meta: null });
    expect([semMeta.meta, semMeta.faltaParaMeta]).toEqual([null, null]);
    const zero = calcularRitmo({ faturamentoMes: 0, diasUteisDecorridos: 0, diasUteisMes: 20, meta: 1000 });
    expect([zero.mediaPorDiaUtil, zero.projecao]).toEqual([null, null]);
    const fim = calcularRitmo({ faturamentoMes: 500, diasUteisDecorridos: 20, diasUteisMes: 20, meta: 1000 });
    expect(fim.necessarioPorDiaUtil).toBeNull();
  });

  it("caixa do mês", () => {
    expect(calcularCaixaMes({ despesasAteAData: 30000, despesasDoMes: 80000, projecaoFaturamento: 110000 }))
      .toMatchObject({ despesasAteAData: 30000, provisionado: 50000, despesasDoMes: 80000, saldoProjetado: 30000 });
    expect(calcularCaixaMes({ despesasAteAData: 1, despesasDoMes: 1, projecaoFaturamento: null }).saldoProjetado).toBeNull();
  });
});

describe("alertas", () => {
  it("aponta o que conferir e ordena por gravidade", () => {
    const d = retrato();
    const base = {
      ...d, meta: null,
      leituras: [...d.leituras, { fonte: "Leads", estado: "erro" as const, mensagem: "aba não encontrada" }],
      faturamento: { ...d.faturamento!, linhasIlegiveis: 3 },
    };
    const a = gerarAlertas(base);
    expect(a[0]).toMatchObject({ gravidade: "erro", area: "Leads" });
    expect(a.map((x) => x.titulo)).toContain("3 linhas de Vendas com data ou valor ilegível");
    expect(a.map((x) => x.titulo)).toContain("Há despesas do período ainda em aberto");
    expect(a.map((x) => x.titulo)).toContain("Sem meta de faturamento no mês");
    const g = a.map((x) => x.gravidade);
    expect(g).toEqual([...g].sort((x, y) => "erro atencao info".indexOf(x) - "erro atencao info".indexOf(y)));
  });

  it("fonte ausente não é alerta; leitura limpa não gera ruído", () => {
    const d = retrato();
    const limpa = gerarAlertas({ ...d, despesas: { ...d.despesas!, emAberto: 0, pagas: d.despesas!.total } });
    expect(limpa).toEqual([]);
  });
});

describe("seções do relatório", () => {
  const vocab = SEGMENTOS.find((s) => s.id === "clinica")!.vocab;

  it("obedece ordem, seções ligadas e periodicidade", () => {
    const s = montarSecoes(retrato(), listaPadrao("mensal"), { vocabulario: vocab });
    expect(s.map((x) => x.id)).toEqual([
      "resultado", "grafico", "funilLeads", "funilOrcamentos", "experiencia", "receitas",
      "despesas", "entradas", "regimes",
    ]);
    const invertida = normalizarEstrutura({ mensal: [{ id: "despesas", ativa: true }, { id: "resultado", ativa: true }] }).mensal;
    expect(montarSecoes(retrato(), invertida)[0].id).toBe("despesas");
  });

  it("resultado: números, variações, meta e vocabulário da clínica", () => {
    const r = montarSecoes(retrato(), listaPadrao("mensal"), { vocabulario: vocab })[0];
    expect(r.titulo).toBe("Resultado do mês");
    const por = Object.fromEntries(r.linhas.map((l) => [l.rotulo, l]));
    expect(limpo(por["Faturamento"].valor)).toBe("R$ 10.000,00");
    expect(por["Faturamento"].extra).toBe("▲ 25,0%");
    expect(por["Faturamento"].tom).toBe("bom");
    // despesa igual ao período anterior: sem tom
    expect(por["Despesas"].extra).toBe("= 0,0%");
    expect(limpo(por["Faturamento x Despesas"].valor)).toBe("R$ 4.000,00");
    expect(por["Atingimento da meta"].valor).toBe("125%");
    expect(por["Pacientes atendidos"].valor).toBe("2");
    expect(por["Pacientes novos"].valor).toBe("1");
    expect(r.nota).toBe("Variações em relação a setembro/2026.");
  });

  it("indicador oculto some; sem ficha usa o vocabulário neutro", () => {
    const lista = normalizarEstrutura({ mensal: [{ id: "resultado", ativa: true, ocultos: ["res.ticket", "res.meta"] }] }).mensal;
    const r = montarSecoes(retrato(), lista)[0];
    const rotulos = r.linhas.map((l) => l.rotulo);
    expect(rotulos).not.toContain("Ticket médio");
    expect(rotulos).not.toContain("Atingimento da meta");
    expect(rotulos).toContain("Clientes atendidos");
  });

  it("seção sem fonte explica o motivo em vez de mostrar zeros", () => {
    const s = montarSecoes(retrato(), listaPadrao("mensal"));
    expect(s.find((x) => x.id === "entradas")!.vazia).toBe("sem fonte de Entradas");
    expect(s.find((x) => x.id === "grafico")!.vazia).toContain("não tem a série do ano");
  });

  it("receitas no nível 'todas' mostra a categoria que zerou; em 'com_valor', não", () => {
    const todas = montarSecoes(retrato(), listaPadrao("mensal")).find((x) => x.id === "receitas")!;
    const nomes = todas.tabelas[0].linhas.map((l) => l[0]);
    expect(nomes).toEqual(["Consulta", "Procedimento", "Exames"]);
    expect(todas.tabelas[0].cabecalho).toContain("Variação");
    expect(todas.tabelas[0].linhas[0].at(-1)).toBe("▲ 20,0%");
    expect(todas.tabelas[0].linhas[1].at(-1)).toBe("nova");

    const lista = normalizarEstrutura({ mensal: [{ id: "receitas", ativa: true, nivel: "com_valor" }] }).mensal;
    const comValor = montarSecoes(retrato(), lista).find((x) => x.id === "receitas")!;
    expect(comValor.tabelas[0].linhas.map((l) => l[0])).toEqual(["Consulta", "Procedimento"]);
  });

  it("despesas: nível 'grupos' não detalha categorias; aponta o que mais aumentou", () => {
    const completo = montarSecoes(retrato(), listaPadrao("mensal")).find((x) => x.id === "despesas")!;
    expect(completo.tabelas.map((t) => t.titulo)).toEqual([
      "Por grupo", "Infraestrutura", "O que mais aumentou (contra setembro/2026)",
    ]);
    expect(completo.tabelas[2].linhas[0][0]).toBe("Luz");
    const lista = normalizarEstrutura({ mensal: [{ id: "despesas", ativa: true, nivel: "grupos" }] }).mensal;
    const soGrupos = montarSecoes(retrato(), lista).find((x) => x.id === "despesas")!;
    expect(soGrupos.tabelas.map((t) => t.titulo)).not.toContain("Infraestrutura");
  });

  it("funil de leads no resumo não traz as tabelas de detalhe", () => {
    const completo = montarSecoes(retrato(), listaPadrao("mensal")).find((x) => x.id === "funilLeads")!;
    expect(completo.tabelas.map((t) => t.titulo)).toEqual(["Origem do lead"]);
    const lista = normalizarEstrutura({ mensal: [{ id: "funilLeads", ativa: true, nivel: "resumo" }] }).mensal;
    const resumo = montarSecoes(retrato(), lista).find((x) => x.id === "funilLeads")!;
    expect(resumo.tabelas).toEqual([]);
    expect(resumo.linhas.map((l) => l.rotulo)).toEqual(["Leads", "Agendados"]);
  });

  it("quinzenal: ritmo e caixa do mês", () => {
    const d = {
      ...retrato("quinzenal"),
      ritmo: calcularRitmo({ faturamentoMes: 10000, diasUteisDecorridos: 11, diasUteisMes: 22, meta: 8000 }),
      caixaMes: calcularCaixaMes({ despesasAteAData: 5000, despesasDoMes: 6000, projecaoFaturamento: 20000 }),
    };
    const s = montarSecoes(d, listaPadrao("quinzenal"));
    expect(s.map((x) => x.id)).toEqual(["resultado", "ritmo", "caixaMes", "funilLeads", "funilOrcamentos", "receitas"]);
    expect(s[0].titulo).toBe("Parcial do mês");
    expect(s[1].linhas.find((l) => l.rotulo === "Meta do mês")).toMatchObject({ valor: "batida", tom: "bom" });
    expect(limpo(s[2].linhas.find((l) => l.rotulo === "Saldo projetado do mês")!.valor)).toBe("R$ 14.000,00");
  });

  it("análise só aparece quando ligada e escrita", () => {
    const lista = normalizarEstrutura({ mensal: [{ id: "analise", ativa: true }] }).mensal;
    const vazia = montarSecoes(retrato(), lista).find((x) => x.id === "analise")!;
    expect(vazia.vazia).toBe("a análise ainda não foi escrita");
    const cheia = montarSecoes(retrato(), lista, {
      analise: "Mês forte.", acoes: [{ texto: "Rever preço", responsavel: "Ana", prazo: "30/11" }, { texto: " ", responsavel: "", prazo: "" }],
    }).find((x) => x.id === "analise")!;
    expect(cheia.texto).toBe("Mês forte.");
    expect(cheia.acoes).toHaveLength(1);
  });
});

describe("texto de entrega", () => {
  const vocab = SEGMENTOS.find((s) => s.id === "clinica")!.vocab;
  const lista = normalizarEstrutura({ mensal: [{ id: "analise", ativa: true }] }).mensal;
  const texto = limpo(montarTextoFechamento("Clínica Teste", retrato(), lista, {
    vocabulario: vocab, analise: "Mês forte.", acoes: [{ texto: "Rever preço", responsavel: "Ana", prazo: "30/11" }],
  }));

  it("abre com a clínica, a saudação do perfil e o período em DD/MM/AAAA", () => {
    expect(texto.startsWith("*Clínica Teste*\n\nFala, Drs.!")).toBe(true);
    expect(texto).toContain("Segue o fechamento — *Mensal · outubro/2026*");
    expect(texto).toContain("`Período: 01/10/2026 a 31/10/2026`");
  });

  it("traz os números das seções com dado e omite as vazias", () => {
    expect(texto).toContain("*Resultado do mês*");
    expect(texto).toContain("➤ Faturamento: R$ 10.000,00 (▲ 25,0%)");
    expect(texto).toContain("➤ Atingimento da meta: 125% (meta de R$ 8.000,00)");
    expect(texto).toContain("– Consulta: R$ 6.000,00 · 1 · R$ 6.000,00 · 60% · ▲ 20,0%");
    expect(texto).not.toContain("Entradas detalhadas");
    expect(texto).not.toContain("Gráfico");
    expect(texto).not.toContain("ainda não");
  });

  it("fecha com a análise e o plano de ação", () => {
    expect(texto).toContain("*Análise e plano de ação*\nMês forte.");
    expect(texto).toContain("1. Rever preço — Ana, até 30/11");
  });

  it("formatação brasileira", () => {
    expect(limpo(brl(1234.5))).toBe("R$ 1.234,50");
    expect(pct(0.1234)).toBe("12,3%");
    expect(pct(null)).toBe("—");
    expect(textoVariacao(-0.04)).toBe("▼ 4,0%");
    expect(textoVariacao(null)).toBe("");
  });
});

describe("fluxo de estados", () => {
  it("anda na ordem e para no enviado", () => {
    expect(ETAPAS.map((e) => e.status)).toEqual(["em_conferencia", "em_analise", "concluido", "enviado"]);
    expect(proximoStatus("em_conferencia")).toBe("em_analise");
    expect(proximoStatus("concluido")).toBe("enviado");
    expect(proximoStatus("enviado")).toBeNull();
    expect(posicaoDoStatus("concluido")).toBe(2);
  });
});

describe("linhas sem valor lançado", () => {
  it("valor em branco com data não é linha ilegível; traço contábil vale zero", () => {
    const r = calcularVendas([
      ["02/10/2026", "100,00"],
      ["03/10/2026", ""],        // agendado, ainda sem valor: fora, sem alerta
      ["04/10/2026", "R$ -"],    // zero no formato contábil
      ["", "50,00"],             // valor sem data: isto sim é ilegível
    ], { data: "A", valor: "B" }, ...out);
    expect([r.total, r.lancamentos, r.linhasIlegiveis]).toEqual([100, 2, 1]);
  });

  it("vale também para despesas", () => {
    const r = calcularDespesas([["05/10/2026", ""], ["06/10/2026", "10,00"]], { data: "A", valor: "B" }, ...out);
    expect([r.total, r.lancamentos, r.linhasIlegiveis]).toEqual([10, 1, 0]);
  });
});

describe("série do ano", () => {
  const anual = [
    { mes: "2026-08", faturamento: 9000, recebido: null, despesas: 5000, despesasCompetencia: 5500 },
    { mes: "2026-09", faturamento: 8000, recebido: null, despesas: 6000, despesasCompetencia: 5000 },
    { mes: "2026-10", faturamento: 10000, recebido: null, despesas: 6000, despesasCompetencia: 6500 },
  ];

  it("gráfico: uma série por indicador, meses abreviados", () => {
    const g = montarSecoes({ ...retrato(), anual }, listaPadrao("mensal")).find((x) => x.id === "grafico")!;
    expect(g.vazia).toBeUndefined();
    expect(g.grafico).toEqual({
      meses: ["ago", "set", "out"],
      series: [{ nome: "Faturamento", valores: [9000, 8000, 10000] }, { nome: "Despesas", valores: [5000, 6000, 6000] }],
    });
  });

  it("caixa e competência: mês a mês com total; nível 'caixa' esconde a competência", () => {
    const ambos = montarSecoes({ ...retrato(), anual }, listaPadrao("mensal")).find((x) => x.id === "regimes")!;
    const t = ambos.tabelas[0];
    expect(t.cabecalho).toEqual(["Mês", "Faturamento", "Saídas", "Saldo", "Saídas (competência)", "Saldo (competência)"]);
    expect(t.linhas.map((l) => l[0])).toEqual(["ago", "set", "out", "Total"]);
    expect(t.linhas.at(-1)!.map(limpo)).toEqual(["Total", "R$ 27.000,00", "R$ 17.000,00", "R$ 10.000,00", "R$ 17.000,00", "R$ 10.000,00"]);
    expect(limpo(t.linhas[0][3])).toBe("R$ 4.000,00");

    const lista = normalizarEstrutura({ mensal: [{ id: "regimes", ativa: true, nivel: "caixa" }] }).mensal;
    const caixa = montarSecoes({ ...retrato(), anual }, lista).find((x) => x.id === "regimes")!;
    expect(caixa.tabelas[0].cabecalho).toEqual(["Mês", "Faturamento", "Saídas", "Saldo"]);
  });

  it("com a fonte de Entradas, a coluna de entrada é o recebido", () => {
    const comRecebido = anual.map((m) => ({ ...m, recebido: m.faturamento - 1000 }));
    const r = montarSecoes({ ...retrato(), anual: comRecebido }, listaPadrao("mensal")).find((x) => x.id === "regimes")!;
    expect(r.tabelas[0].cabecalho[1]).toBe("Entradas");
    expect(limpo(r.tabelas[0].linhas[0][1])).toBe("R$ 8.000,00");
  });

  it("fechamento importado: a série vem do formato do Sync", () => {
    const origem = {
      sistema: "sync" as const, id: "x", importadoEm: "2026-11-16T00:00:00Z",
      anual: [
        { mes: "2026-09", entradas: 100, recebido: 90, saidasCaixa: 40, saidasCompetencia: 50 },
        { mes: "2026-10", entradas: 200, saidasCaixa: 60 },
        "lixo",
      ],
    };
    expect(serieAnual({ origem })).toEqual([
      { mes: "2026-09", faturamento: 100, recebido: 90, despesas: 40, despesasCompetencia: 50 },
      { mes: "2026-10", faturamento: 200, recebido: null, despesas: 60, despesasCompetencia: null },
    ]);
    // a série própria tem precedência sobre a de origem
    expect(serieAnual({ anual, origem })).toBe(anual);
    const g = montarSecoes({ ...retrato(), origem }, listaPadrao("mensal")).find((x) => x.id === "grafico")!;
    expect(g.grafico!.meses).toEqual(["set", "out"]);
  });

  it("no texto do WhatsApp o gráfico não entra e o ano vai resumido no total", () => {
    const texto = limpo(montarTextoFechamento("Clínica Teste", { ...retrato(), anual }, listaPadrao("mensal")));
    expect(texto).not.toContain("Gráfico");
    expect(texto).toContain("*Caixa e competência no ano*\n➤ Faturamento no ano: R$ 27.000,00\n➤ Saídas no ano: R$ 17.000,00\n➤ Saldo no ano: R$ 10.000,00");
    expect(texto).not.toContain("– ago:");
  });

  it("caixa do mês: média dos meses anteriores que deu para ler", () => {
    const c = calcularCaixaMes({ despesasAteAData: 3000, despesasDoMes: 6600, projecaoFaturamento: 10000, despesasMesesAnteriores: [5000, 6000, 7000] });
    expect([c.mediaDespesas, c.mesesDaMedia]).toEqual([6000, 3]);
    expect(calcularCaixaMes({ despesasAteAData: 1, despesasDoMes: 1, projecaoFaturamento: null }).mediaDespesas).toBeNull();
    const d = { ...retrato("quinzenal"), caixaMes: c, ritmo: null };
    const s = montarSecoes(d, listaPadrao("quinzenal")).find((x) => x.id === "caixaMes")!;
    const media = s.linhas.find((l) => l.rotulo === "Média dos 3 meses anteriores")!;
    expect(limpo(media.valor)).toBe("R$ 6.000,00");
    expect(media.extra).toBe("mês atual ▲ 10,0%");
  });
});

describe("mês de competência", () => {
  it("lê os formatos comuns de planilha", () => {
    expect(lerMes("15/10/2026")).toBe("2026-10");
    expect(lerMes("10/2026")).toBe("2026-10");
    expect(lerMes("2026-10")).toBe("2026-10");
    expect(lerMes("out/2026")).toBe("2026-10");
    expect(lerMes("Outubro de 2026")).toBe("2026-10");
    expect(lerMes("Out26")).toBe("2026-10");
    expect(lerMes("3/26")).toBe("2026-03");
    expect(lerMes("13/2026")).toBeNull();
    expect(lerMes("xyz/2026")).toBeNull();
    expect(lerMes("")).toBeNull();
  });
});

describe("visão dos indicadores e do PDF", () => {
  const sem = (t: string) => t.replace(/\u00a0/g, " ");

  it("formatos: valor sem centavos, variação com sinal e 'novo'", () => {
    expect(sem(brl0(28419.4))).toBe("R$ 28.419");
    expect(sem(brl0(-2621.88))).toBe("-R$ 2.622");
    expect(textoVar(comparar(110, 100))).toBe("+10,0%");
    expect(textoVar(comparar(76, 100))).toBe("−24,0%");
    expect(textoVar(comparar(300, 0))).toBe("novo");
    expect(comparar(120, 100, false).tom).toBe("ruim");
    expect(comparar(80, 100, false).tom).toBe("bom");
    expect(comparar(5, null).valor).toBeNull();
  });

  it("comparação: mês anterior no mensal; mesmos dias no quinzenal", () => {
    expect(comparacaoDo(retrato())).toMatchObject({ curto: "setembro", coluna: "set", colunaAtual: "outubro" });
    const q = { ...retrato("quinzenal"), periodo: { inicio: "2026-11-01", fim: "2026-11-15", rotulo: "" } };
    expect(comparacaoDo(q)).toMatchObject({ curto: "1–15 de out", coluna: "1–15 out", colunaAtual: "1–15 nov", extenso: "(dia 1 ao 15) de outubro" });
  });

  it("cartões do resultado seguem a estrutura e trazem a variação", () => {
    const d = retrato();
    const ids = cartoesDoResultado(d, ligadosDa(listaPadrao("mensal"), "mensal")).map((c) => c.id);
    expect(ids.slice(0, 4)).toEqual(["fat", "desp", "res", "meta"]);
    const fat = cartoesDoResultado(d, ligadosDa(listaPadrao("mensal"), "mensal"))[0];
    expect(textoVar(fat.variacao!)).toBe("+25,0%");
    // "Despesas" é fixo no catálogo; a meta pode ser escondida
    const lista = normalizarEstrutura({ mensal: [{ id: "resultado", ativa: true, ocultos: ["res.despesas", "res.meta"] }] }).mensal;
    const sem = cartoesDoResultado(d, ligadosDa(lista, "mensal")).map((c) => c.id);
    expect(sem).toContain("desp");
    expect(sem).not.toContain("meta");
  });

  it("receitas: categoria que sumiu aparece zerada, com o nome da planilha", () => {
    const d = retrato();
    d.anterior = { ...d.anterior!, nomesCategorias: { exames: "Exames Laboratoriais" }, quantidadePorCategoria: { consulta: 4 } };
    const l = categoriasDeReceita(d);
    expect(l.map((x) => x.nome)).toEqual(["Consulta", "Procedimento", "Exames Laboratoriais"]);
    expect(textoVar(l[0].variacao)).toBe("+20,0%");
    expect(l[0].ticketAntes).toBe(1250);
    expect(textoVar(l[1].variacao)).toBe("novo");
    expect(l[2]).toMatchObject({ valor: 0, antes: 3000 });
  });

  it("despesas: grupo soma o anterior inteiro, inclusive categoria que sumiu; aumentos de 10% e R$ 300", () => {
    const d = retrato();
    d.anterior = { ...d.anterior!, despesasPorCategoria: { aluguel: 5000, luz: 400, agua: 250 }, nomesCategorias: { agua: "Água" } };
    const l = linhasDeDespesa(d);
    const infra = l.find((x) => x.grupo && x.nome === "Infraestrutura")!;
    expect(infra.antes).toBe(5650);
    expect(l.find((x) => x.nome === "Água")).toMatchObject({ valor: 0, antes: 250, grupo: false });
    expect(l.find((x) => x.nome === "Luz")!.aumentou).toBe(true); // 400 → 1.000
    expect(l.find((x) => x.nome === "Aluguel")!.aumentou).toBe(false);
    const aum = maioresAumentos(d, comparacaoDo(d));
    expect(aum.map((a) => a.nome)).toEqual(["Luz"]);
    expect(aum[0].texto).toBe("+150,0% vs setembro");
  });

  it("caixa do mês: provisionado pela média (como no Sync); sem média, pelos vencimentos", () => {
    const base = { ...retrato("quinzenal"), periodo: { inicio: "2026-11-01", fim: "2026-11-15", rotulo: "" } };
    const ritmo = calcularRitmo({ faturamentoMes: 38230, diasUteisDecorridos: 9, diasUteisMes: 19, meta: 68000 });
    const comMedia = visaoCaixa({ ...base, ritmo, caixaMes: calcularCaixaMes({
      despesasAteAData: 25925, despesasDoMes: 30000, projecaoFaturamento: ritmo.projecao, despesasMesesAnteriores: [60000, 65000, 70750],
    }) })!;
    expect(comMedia.provisionado).toBeCloseTo(65250 - 25925, 2);
    expect(comMedia.mesesDaMedia).toEqual(["ago", "set", "out"]);
    expect(comMedia.saldoProjetado).toBeCloseTo(ritmo.projecao! - 65250, 2);
    expect(comMedia.saldoPeriodo).toBe(base.faturamento!.total - 25925);
    const semMedia = visaoCaixa({ ...base, ritmo, caixaMes: calcularCaixaMes({ despesasAteAData: 5000, despesasDoMes: 6000, projecaoFaturamento: 20000 }) })!;
    expect([semMedia.provisionado, semMedia.regraProvisionado]).toEqual([1000, "vencimentos até o fim do mês"]);
  });

  it("série do ano com variação mês a mês e saldos", () => {
    const anual = [
      { mes: "2026-09", faturamento: 8000, recebido: null, despesas: 6000, despesasCompetencia: 5000 },
      { mes: "2026-10", faturamento: 10000, recebido: null, despesas: 6600, despesasCompetencia: null },
    ];
    const v = visaoAno({ ...retrato(), anual })!;
    expect(v.linhas.map((l) => l.rotulo)).toEqual(["Setembro", "Outubro"]);
    expect(textoVar(v.linhas[1].varFaturamento)).toBe("+25,0%");
    expect(v.linhas[1].saldo).toBe(3400);
    expect(v.temCompetencia).toBe(true);
  });
});

describe("conferência: decisões e meta ajustada", () => {
  it("a chave do alerta ignora os números, e a decisão tira o alerta das pendências", () => {
    expect(chaveDoAlerta({ area: "Vendas", titulo: "3 linhas de Vendas com data ilegível" }))
      .toBe(chaveDoAlerta({ area: "Vendas", titulo: "4 linhas de Vendas com data ilegível" }));
    const d = retrato();
    const p = alertasPendentes(d);
    expect(p.every((a) => a.gravidade !== "info")).toBe(true);
    if (p.length) {
      const decidido = { ...d, decisoes: [{ chave: chaveDoAlerta(p[0]), acao: "ciente" as const, titulo: p[0].titulo, em: "" }] };
      expect(alertasPendentes(decidido)).toHaveLength(p.length - 1);
    }
  });

  it("meta ajustada refaz o ritmo e guarda a original; null volta à cadastrada", () => {
    const d = { ...retrato("quinzenal"), meta: 60000, ritmo: calcularRitmo({ faturamentoMes: 30000, diasUteisDecorridos: 10, diasUteisMes: 20, meta: 60000 }) };
    const a = aplicarMeta(d, 80000);
    expect([a.meta, a.metaOriginal, a.ritmo!.faltaParaMeta]).toEqual([80000, 60000, 50000]);
    const b = aplicarMeta(a, null);
    expect([b.meta, b.metaOriginal, b.ritmo!.faltaParaMeta]).toEqual([60000, undefined, 30000]);
  });
});

describe("texto da análise em blocos", () => {
  it("lê subtítulos (inclusive os do Sync) e o texto sem subtítulo vira a observação", () => {
    const t = lerAnalise("Fala, Pri!\nTudo certo.\n\nDestaques:\n- Tirzepatida subiu\n\n### PONTOS DE ATENÇÃO\n- Meta\n\nContexto:\n- férias");
    expect(t).toEqual({ observacao: "Fala, Pri!\nTudo certo.", destaques: "- Tirzepatida subiu", comercial: "", atencao: "- Meta", contexto: "- férias" });
    expect(lerAnalise(escreverAnalise(t))).toEqual(t);
    expect(blocosParaCliente(t).map((b) => b.titulo)).toEqual(["Observação", "Principais destaques", "Pontos de atenção"]);
  });

  it("o contexto não vai para o texto do cliente", () => {
    const texto = montarTextoFechamento("Clínica", retrato(), normalizarEstrutura({ mensal: [{ id: "analise", ativa: true }] }).mensal, {
      analise: escreverAnalise({ observacao: "Bom mês.", destaques: "", comercial: "", atencao: "", contexto: "segredo interno" }),
    });
    expect(texto).toContain("Bom mês.");
    expect(texto).not.toContain("segredo interno");
  });
});
