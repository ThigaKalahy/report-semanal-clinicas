import { describe, it, expect } from "vitest";
import { isAnonimoTexto, resolverNomePaciente } from "../coletores/nps";

// ── isAnonimoTexto ────────────────────────────────────────────────────────────

describe("isAnonimoTexto", () => {
  it("'Prefiro o anonimato.' → anônimo", () => {
    expect(isAnonimoTexto("Prefiro o anonimato.")).toBe(true);
  });

  it("'Prefiro o anonimato' (sem ponto) → anônimo", () => {
    expect(isAnonimoTexto("Prefiro o anonimato")).toBe(true);
  });

  it("'Anônimo' com acento → anônimo (normalização de diacrítico)", () => {
    expect(isAnonimoTexto("Anônimo")).toBe(true);
  });

  it("'Quero ser anônimo' → anônimo", () => {
    expect(isAnonimoTexto("Quero ser anônimo")).toBe(true);
  });

  it("'João da Silva' (nome normal) → identificado", () => {
    expect(isAnonimoTexto("João da Silva")).toBe(false);
  });

  it("'Pode identificar' → identificado", () => {
    expect(isAnonimoTexto("Pode identificar")).toBe(false);
  });

  it("string vazia → não é anônimo por texto (regra aplicada pelo chamador)", () => {
    expect(isAnonimoTexto("")).toBe(false);
  });
});

// ── resolverNomePaciente ──────────────────────────────────────────────────────

describe("resolverNomePaciente", () => {
  // Coluna NÃO mapeada → comportamento retrocompatível
  it("coluna não mapeada + valor vazio → 'Paciente' (fallback identificado)", () => {
    expect(resolverNomePaciente(false, "", "")).toBe("Paciente");
  });

  it("coluna não mapeada + nome presente → exibe nome normalmente", () => {
    expect(resolverNomePaciente(false, "", "Maria Souza")).toBe("Maria Souza");
  });

  // Coluna MAPEADA → regra de privacidade
  it("coluna mapeada + valor vazio → 'Paciente (anônimo)' (conservador)", () => {
    expect(resolverNomePaciente(true, "", "Maria Souza")).toBe("Paciente (anônimo)");
  });

  it("coluna mapeada + 'Prefiro o anonimato.' → 'Paciente (anônimo)'", () => {
    expect(resolverNomePaciente(true, "Prefiro o anonimato.", "Maria Souza")).toBe("Paciente (anônimo)");
  });

  it("coluna mapeada + 'Prefiro o anonimato' (sem ponto) → 'Paciente (anônimo)'", () => {
    expect(resolverNomePaciente(true, "Prefiro o anonimato", "Maria Souza")).toBe("Paciente (anônimo)");
  });

  it("coluna mapeada + 'Pode identificar' → exibe nome", () => {
    expect(resolverNomePaciente(true, "Pode identificar", "Maria Souza")).toBe("Maria Souza");
  });

  it("coluna mapeada + nome original vazio + não anônimo → 'Paciente' (fallback)", () => {
    expect(resolverNomePaciente(true, "Pode identificar", "")).toBe("Paciente");
  });
});
