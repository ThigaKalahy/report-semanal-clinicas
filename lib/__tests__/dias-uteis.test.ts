import { describe, it, expect } from "vitest";
import { diasUteisDoMes, diasUteisDecorridos } from "../dias-uteis";

// Janeiro 2025 começa na quarta-feira (01/01) e vai até sexta-feira (31/01)
// Dias úteis sem feriados: 23

describe("diasUteisDoMes", () => {
  it("janeiro 2025 sem feriados = 23", () => {
    expect(diasUteisDoMes(1, 2025, [])).toBe(23);
  });

  it("janeiro 2025 com 01/01 feriado = 22", () => {
    expect(diasUteisDoMes(1, 2025, ["2025-01-01"])).toBe(22);
  });

  it("fevereiro 2025 sem feriados = 20", () => {
    // Fev 2025: começa sábado, 28 dias; 20 dias úteis
    expect(diasUteisDoMes(2, 2025, [])).toBe(20);
  });

  it("dezembro 2025 sem feriados = 23", () => {
    expect(diasUteisDoMes(12, 2025, [])).toBe(23);
  });

  it("dezembro 2025 com natal (25/12) feriado = 22", () => {
    expect(diasUteisDoMes(12, 2025, ["2025-12-25"])).toBe(22);
  });

  it("ignora feriado em outro mês", () => {
    // Feriado em fevereiro não afeta janeiro
    expect(diasUteisDoMes(1, 2025, ["2025-02-14"])).toBe(23);
  });

  it("múltiplos feriados em dias úteis", () => {
    // Tira 01/01 e 06/01 (segunda-feira) = -2
    expect(diasUteisDoMes(1, 2025, ["2025-01-01", "2025-01-06"])).toBe(21);
  });

  it("feriado em fim de semana não subtrai", () => {
    // Jan 4 é sábado — não deveria reduzir o total
    expect(diasUteisDoMes(1, 2025, ["2025-01-04"])).toBe(23);
  });
});

// Diasúteis decorridos em janeiro 2025:
// Jan 1 (Qua), 2 (Qui), 3 (Sex), 6 (Seg), 7 (Ter), 8 (Qua), 9 (Qui), 10 (Sex) = 8 até dia 10

describe("diasUteisDecorridos", () => {
  it("até 10/01/2025 (sexta) = 8 dias úteis", () => {
    expect(diasUteisDecorridos(new Date(2025, 0, 10), [])).toBe(8);
  });

  it("até 10/01/2025 com 01/01 feriado = 7", () => {
    expect(diasUteisDecorridos(new Date(2025, 0, 10), ["2025-01-01"])).toBe(7);
  });

  it("até 01/01/2025 = 1 (é dia útil)", () => {
    expect(diasUteisDecorridos(new Date(2025, 0, 1), [])).toBe(1);
  });

  it("até 01/01/2025 com feriado = 0", () => {
    expect(diasUteisDecorridos(new Date(2025, 0, 1), ["2025-01-01"])).toBe(0);
  });

  it("até 04/01/2025 (sábado) = 3", () => {
    // Dias úteis até sábado 04/01: Qua 1, Qui 2, Sex 3 = 3
    expect(diasUteisDecorridos(new Date(2025, 0, 4), [])).toBe(3);
  });

  it("até 05/01/2025 (domingo) = 3", () => {
    // Domingo não conta, total permanece 3
    expect(diasUteisDecorridos(new Date(2025, 0, 5), [])).toBe(3);
  });

  it("até 31/01/2025 (sexta) = 23 (mês completo)", () => {
    expect(diasUteisDecorridos(new Date(2025, 0, 31), [])).toBe(23);
  });
});
