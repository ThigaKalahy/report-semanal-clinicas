import { describe, it, expect } from "vitest";
import { avaliarIndicador } from "../checkpoint/avaliar";
import { diasUteisDesde } from "../dias-uteis";
import {
  indicadoresPadrao, resolverAtivos,
  INDICADOR_LIMITE_DIAS_UTEIS, INDICADOR_CADENCIA,
} from "../checkpoint/indicadores";
import type { LeituraFonte } from "../coletores/checkpoint";

const SEM_FERIADO: string[] = [];

// Quinta 15/10/2026 como "hoje" em quase todos os casos.
const HOJE = new Date(2026, 9, 15);

function leitura(over: Partial<LeituraFonte> = {}): LeituraFonte {
  return {
    ultimoLancamento: new Date(2026, 9, 15),
    totalLancamentos: 40,
    lancamentosPeriodo: 12,
    semCategoriaPeriodo: null,
    abasLidas: ["Outubro"],
    mesesSemAba: [],
    ...over,
  };
}

// ── diasUteisDesde ────────────────────────────────────────────────────────────

describe("diasUteisDesde", () => {
  it("lançamento de hoje → 0", () => {
    expect(diasUteisDesde(HOJE, HOJE, SEM_FERIADO)).toBe(0);
  });

  it("ontem (dia útil) → 1", () => {
    expect(diasUteisDesde(new Date(2026, 9, 14), HOJE, SEM_FERIADO)).toBe(1);
  });

  it("sexta → segunda conta 1, o fim de semana não entra", () => {
    const sexta  = new Date(2026, 9, 9);
    const segunda = new Date(2026, 9, 12);
    expect(diasUteisDesde(sexta, segunda, SEM_FERIADO)).toBe(1);
  });

  it("feriado no meio não é contado", () => {
    // 12/10/2026 é segunda; marcada como feriado → terça 13 conta 1
    expect(diasUteisDesde(new Date(2026, 9, 9), new Date(2026, 9, 13), ["2026-10-12"])).toBe(1);
  });

  it("data futura → 0, nunca negativo", () => {
    expect(diasUteisDesde(new Date(2026, 9, 20), HOJE, SEM_FERIADO)).toBe(0);
  });
});

// ── Status automático ─────────────────────────────────────────────────────────

describe("avaliarIndicador — atualização", () => {
  it("lançamento de hoje → ok, sem observação", () => {
    const r = avaliarIndicador({
      leitura: leitura(), temCategoria: false, referencia: HOJE, feriados: SEM_FERIADO,
    });
    expect(r.status).toBe("ok");
    expect(r.observacao).toBe("");
    expect(r.detalhe).toContain("hoje");
  });

  it("2 dias úteis atrás ainda é ok (limite inclusivo)", () => {
    const r = avaliarIndicador({
      leitura: leitura({ ultimoLancamento: new Date(2026, 9, 13) }),
      temCategoria: false, referencia: HOJE, feriados: SEM_FERIADO,
    });
    expect(r.status).toBe("ok");
    expect(r.observacao).toBe("");
  });

  it("3 dias úteis atrás → atenção, com a data e a contagem", () => {
    const r = avaliarIndicador({
      leitura: leitura({ ultimoLancamento: new Date(2026, 9, 12) }),
      temCategoria: false, referencia: HOJE, feriados: SEM_FERIADO,
    });
    expect(r.status).toBe("atencao");
    expect(r.observacao).toBe("Último lançamento em 12/10 (3 dias úteis atrás)");
  });

  it("1 dia útil usa o singular", () => {
    const r = avaliarIndicador({
      leitura: leitura({ ultimoLancamento: new Date(2026, 9, 12) }),
      temCategoria: false, referencia: new Date(2026, 9, 13),
      feriados: SEM_FERIADO, limiteDiasUteis: 0,
    });
    expect(r.observacao).toBe("Último lançamento em 12/10 (1 dia útil atrás)");
  });

  it("planilha sem nenhum lançamento → atenção", () => {
    const r = avaliarIndicador({
      leitura: leitura({ ultimoLancamento: null, totalLancamentos: 0, lancamentosPeriodo: 0 }),
      temCategoria: false, referencia: HOJE, feriados: SEM_FERIADO,
    });
    expect(r.status).toBe("atencao");
    expect(r.observacao).toBe("Sem lançamentos na planilha");
  });
});

// ── Cadência: régua diferente por indicador ──────────────────────────────────

describe("cadência por indicador", () => {
  it("faturamento e despesas cobram lançamento diário (2 dias úteis)", () => {
    expect(INDICADOR_LIMITE_DIAS_UTEIS.faturamento).toBe(2);
    expect(INDICADOR_LIMITE_DIAS_UTEIS.despesas).toBe(2);
    expect(INDICADOR_CADENCIA.faturamento).toBe("diaria");
  });

  it("leads, fechamentos e NPS cobram a semana (5 dias úteis)", () => {
    expect(INDICADOR_LIMITE_DIAS_UTEIS.leads).toBe(5);
    expect(INDICADOR_LIMITE_DIAS_UTEIS.fechamentos).toBe(5);
    expect(INDICADOR_LIMITE_DIAS_UTEIS.nps).toBe(5);
    expect(INDICADOR_CADENCIA.nps).toBe("semanal");
  });

  it("4 dias úteis: ok no semanal, atenção no diário", () => {
    // 09/10 (sexta) → 15/10 (quinta) = 4 dias úteis
    const leitura4 = leitura({ ultimoLancamento: new Date(2026, 9, 9) });
    const base = { leitura: leitura4, temCategoria: false, referencia: HOJE, feriados: SEM_FERIADO };

    expect(avaliarIndicador({ ...base, limiteDiasUteis: INDICADOR_LIMITE_DIAS_UTEIS.nps }).status)
      .toBe("ok");
    expect(avaliarIndicador({ ...base, limiteDiasUteis: INDICADOR_LIMITE_DIAS_UTEIS.faturamento }).status)
      .toBe("atencao");
  });

  it("uma semana inteira sem lançamento acende o alerta também no semanal", () => {
    // 07/10 (quarta) → 15/10 (quinta) = 6 dias úteis
    const r = avaliarIndicador({
      leitura: leitura({ ultimoLancamento: new Date(2026, 9, 7) }),
      temCategoria: false, referencia: HOJE, feriados: SEM_FERIADO,
      limiteDiasUteis: INDICADOR_LIMITE_DIAS_UTEIS.leads,
    });
    expect(r.status).toBe("atencao");
    expect(r.observacao).toBe("Último lançamento em 07/10 (6 dias úteis atrás)");
  });

  it("o detalhe informa a régua aplicada", () => {
    const r = avaliarIndicador({
      leitura: leitura(), temCategoria: false, referencia: HOJE,
      feriados: SEM_FERIADO, limiteDiasUteis: 5,
    });
    expect(r.detalhe).toContain("limite: 5 dias úteis");
    expect(r.limiteDiasUteis).toBe(5);
  });
});

describe("avaliarIndicador — categoria", () => {
  it("todos com categoria → ok", () => {
    const r = avaliarIndicador({
      leitura: leitura({ semCategoriaPeriodo: 0 }),
      temCategoria: true, referencia: HOJE, feriados: SEM_FERIADO,
    });
    expect(r.status).toBe("ok");
    expect(r.detalhe).toContain("categoria preenchida em todos");
  });

  it("lançamentos sem categoria → atenção com a contagem", () => {
    const r = avaliarIndicador({
      leitura: leitura({ semCategoriaPeriodo: 3 }),
      temCategoria: true, referencia: HOJE, feriados: SEM_FERIADO,
    });
    expect(r.status).toBe("atencao");
    expect(r.observacao).toBe("3 lançamentos sem categoria");
  });

  it("indicador sem coluna de categoria ignora a checagem", () => {
    const r = avaliarIndicador({
      leitura: leitura({ semCategoriaPeriodo: null }),
      temCategoria: true, referencia: HOJE, feriados: SEM_FERIADO,
    });
    expect(r.status).toBe("ok");
  });

  it("atraso e categoria falhando acumulam na mesma observação", () => {
    const r = avaliarIndicador({
      leitura: leitura({ ultimoLancamento: new Date(2026, 9, 8), semCategoriaPeriodo: 2 }),
      temCategoria: true, referencia: HOJE, feriados: SEM_FERIADO,
    });
    expect(r.status).toBe("atencao");
    expect(r.observacao).toContain("Último lançamento em 08/10");
    expect(r.observacao).toContain("2 lançamentos sem categoria");
  });
});

describe("avaliarIndicador — manual e falhas", () => {
  it("sem fonte configurada nasce em branco e marcado como manual", () => {
    const r = avaliarIndicador({
      leitura: null, temCategoria: false, referencia: HOJE, feriados: SEM_FERIADO,
    });
    expect(r.status).toBeNull();
    expect(r.observacao).toBe("");
    expect(r.automatico).toBe(false);
    expect(r.detalhe).toContain("preencher manualmente");
  });

  it("erro de leitura vira atenção, com a causa na observação", () => {
    const r = avaliarIndicador({
      leitura: null, erro: "Aba não encontrada", temCategoria: false,
      referencia: HOJE, feriados: SEM_FERIADO,
    });
    expect(r.status).toBe("atencao");
    expect(r.observacao).toContain("Aba não encontrada");
    expect(r.automatico).toBe(true);
  });

  it("mês sem aba mapeada entra como alerta", () => {
    const r = avaliarIndicador({
      leitura: leitura({ mesesSemAba: ["2026-10"] }),
      temCategoria: true, referencia: HOJE, feriados: SEM_FERIADO,
    });
    expect(r.status).toBe("atencao");
    expect(r.observacao).toContain("Aba não mapeada para out/2026");
  });

  it("nenhuma observação contém null, undefined ou NaN", () => {
    const casos = [
      avaliarIndicador({ leitura: null, temCategoria: false, referencia: HOJE, feriados: SEM_FERIADO }),
      avaliarIndicador({ leitura: leitura({ ultimoLancamento: null }), temCategoria: true, referencia: HOJE, feriados: SEM_FERIADO }),
      avaliarIndicador({ leitura: leitura({ semCategoriaPeriodo: 1 }), temCategoria: true, referencia: HOJE, feriados: SEM_FERIADO }),
    ];
    for (const c of casos) {
      expect(c.observacao + c.detalhe).not.toMatch(/null|undefined|NaN/);
    }
  });
});

// ── Indicadores ativos por clínica ────────────────────────────────────────────

describe("indicadoresPadrao / resolverAtivos", () => {
  it("sugere os indicadores cuja fonte já existe", () => {
    expect(indicadoresPadrao(["nps", "faturamento"])).toEqual(["nps", "faturamento"]);
  });

  it("fechamentos nunca entra no padrão — não tem fonte própria", () => {
    expect(indicadoresPadrao(["leads", "nps", "faturamento", "despesa"]))
      .toEqual(["leads", "nps", "faturamento", "despesas"]);
  });

  it("clínica sem fonte alguma não liga nada por padrão", () => {
    expect(indicadoresPadrao([])).toEqual([]);
  });

  it("sem linhas salvas vale o padrão", () => {
    expect(resolverAtivos([], ["nps"])).toEqual(["nps"]);
  });

  it("com linhas salvas vale o banco, não o padrão", () => {
    const linhas = [
      { indicador: "fechamentos" as const, ativo: true },
      { indicador: "nps" as const, ativo: false },
    ];
    expect(resolverAtivos(linhas, ["nps", "faturamento"])).toEqual(["fechamentos"]);
  });

  it("resultado respeita a ordem fixa da lista", () => {
    const linhas = [
      { indicador: "despesas" as const, ativo: true },
      { indicador: "leads" as const, ativo: true },
    ];
    expect(resolverAtivos(linhas, [])).toEqual(["leads", "despesas"]);
  });
});
