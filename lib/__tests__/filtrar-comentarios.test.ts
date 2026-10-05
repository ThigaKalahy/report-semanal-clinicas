import { describe, it, expect } from "vitest";
import {
  filtrarComentarios, contarPalavras, parsePalavras, parseLimite,
  filtroAtivo, FILTRO_VAZIO,
} from "../relatorio/filtrar-comentarios";
import type { ComentarioItem } from "../relatorio/imagem-tipos";

function com(texto: string, critica = false): ComentarioItem {
  return { texto, autor: "Paciente", origem: "nps", nota: critica ? 4 : 10, critica };
}

const LISTA: ComentarioItem[] = [
  com("muito bom!"),                                              // 2 palavras
  com("O atendimento do médico foi excelente e muito atencioso"), // 9 palavras
  com("Demorei quase uma hora para ser atendida", true),          // 7 palavras
  com("Gostei"),                                                  // 1 palavra
  com("A recepção poderia ser mais rápida no agendamento"),       // 8 palavras
];

describe("contarPalavras", () => {
  it("conta palavras ignorando espaços extras", () => {
    expect(contarPalavras("  dois   espaços  ")).toBe(2);
  });
  it("texto vazio conta zero", () => {
    expect(contarPalavras("   ")).toBe(0);
  });
});

describe("parseLimite", () => {
  it("vazio vira null (sem filtro)", () => {
    expect(parseLimite("")).toBeNull();
  });
  it("zero e negativo viram null", () => {
    expect(parseLimite("0")).toBeNull();
    expect(parseLimite("-3")).toBeNull();
  });
  it("número válido é aceito", () => {
    expect(parseLimite(" 12 ")).toBe(12);
  });
});

describe("parsePalavras", () => {
  it("separa por vírgula, ponto-e-vírgula e quebra de linha", () => {
    expect(parsePalavras("médico, demora; recepção")).toEqual(["médico", "demora", "recepção"]);
  });
  it("campo vazio não vira termo", () => {
    expect(parsePalavras("  ,  ")).toEqual([]);
  });
});

describe("filtrarComentarios", () => {
  it("sem filtro devolve todos, na ordem de coleta", () => {
    expect(filtrarComentarios(LISTA, FILTRO_VAZIO)).toEqual([0, 1, 2, 3, 4]);
  });

  it("mínimo de palavras corta os curtos", () => {
    expect(filtrarComentarios(LISTA, { ...FILTRO_VAZIO, minPalavras: 5 })).toEqual([1, 2, 4]);
  });

  it("máximo de palavras corta os longos", () => {
    expect(filtrarComentarios(LISTA, { ...FILTRO_VAZIO, maxPalavras: 2 })).toEqual([0, 3]);
  });

  it("palavra específica casa sem acento e sem caixa", () => {
    expect(filtrarComentarios(LISTA, { ...FILTRO_VAZIO, palavras: ["MEDICO"] })).toEqual([1]);
  });

  it("vários termos são OU, não E", () => {
    expect(filtrarComentarios(LISTA, { ...FILTRO_VAZIO, palavras: ["médico", "recepção"] }))
      .toEqual([1, 4]);
  });

  it("teto de comentários corta os primeiros N da ordem de coleta", () => {
    expect(filtrarComentarios(LISTA, { ...FILTRO_VAZIO, maxComentarios: 2 })).toEqual([0, 1]);
  });

  it("teto é aplicado depois dos demais filtros", () => {
    // minPalavras deixa [1,2,4]; o teto de 2 fica com os dois primeiros
    expect(filtrarComentarios(LISTA, { ...FILTRO_VAZIO, minPalavras: 5, maxComentarios: 2 }))
      .toEqual([1, 2]);
  });

  it("filtro que não casa com nada devolve lista vazia", () => {
    expect(filtrarComentarios(LISTA, { ...FILTRO_VAZIO, palavras: ["estacionamento"] })).toEqual([]);
  });

  it("comentário vazio nunca passa", () => {
    expect(filtrarComentarios([com("   ")], FILTRO_VAZIO)).toEqual([]);
  });

  it("lista vazia devolve lista vazia", () => {
    expect(filtrarComentarios([], FILTRO_VAZIO)).toEqual([]);
  });
});

describe("filtroAtivo", () => {
  it("filtro vazio é inativo", () => {
    expect(filtroAtivo(FILTRO_VAZIO)).toBe(false);
  });
  it("qualquer campo preenchido ativa", () => {
    expect(filtroAtivo({ ...FILTRO_VAZIO, maxComentarios: 5 })).toBe(true);
    expect(filtroAtivo({ ...FILTRO_VAZIO, palavras: ["x"] })).toBe(true);
  });
});
