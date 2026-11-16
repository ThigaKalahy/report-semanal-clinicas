import { describe, it, expect } from "vitest";
import {
  vocabularioDe, segmentoDoTexto, cap, NEUTRO,
} from "../perfil/vocabulario";
import {
  normalizarFicha, fichaPreenchida, lerFichaGerada, separarSecoes,
  contextoDaFicha, pedidoFicha, FICHA_VAZIA, LIMITES,
} from "../perfil/ficha";
import { buildComentarios } from "../relatorio/montar-imagem-dados";
import { montarPesquisas } from "../relatorio/montar-whatsapp";
import { montarContextoIA } from "../ia/montar-contexto";
import type { ResultadoNPS } from "../coletores/nps";
import type { ResultadoPreConsulta } from "../coletores/pre-consulta";
import type { RelatorioImagemData } from "../relatorio/imagem-tipos";

// ── Vocabulário ───────────────────────────────────────────────────────────────

describe("segmentoDoTexto", () => {
  it("reconhece odontologia, estética, varejo e clínica pelo texto", () => {
    expect(segmentoDoTexto("Odonto Prime")).toBe("odontologia");
    expect(segmentoDoTexto("Espaço de Estética Avançada")).toBe("estetica");
    expect(segmentoDoTexto("Shopping Center Norte")).toBe("varejo");
    expect(segmentoDoTexto("Clínica médica de ginecologia")).toBe("clinica");
  });

  it("ignora acento e caixa", () => {
    expect(segmentoDoTexto("CLÍNICA DERMATOLÓGICA")).toBe("clinica");
  });

  it("texto que não casa com nada devolve vazio", () => {
    expect(segmentoDoTexto("Axem")).toBe("");
    expect(segmentoDoTexto("   ")).toBe("");
  });
});

describe("vocabularioDe", () => {
  it("sem ficha vale o neutro", () => {
    expect(vocabularioDe(null)).toEqual(NEUTRO);
  });

  it("clínica médica fala de pacientes, médicos e procedimentos", () => {
    const v = vocabularioDe({ segmentoTipo: "clinica" });
    expect(v.clientes).toBe("pacientes");
    expect(v.profissional).toBe("médico");
    expect(v.servicos).toBe("procedimentos");
    expect(v.saudacao).toBe("Fala, Drs.!");
  });

  it("varejo troca profissional por loja e muda o gênero", () => {
    const v = vocabularioDe({ segmentoTipo: "varejo" });
    expect(v.profissionais).toBe("lojas");
    expect(v.genero).toBe("a");
  });

  it("sem tipo definido, adivinha pelo texto do segmento", () => {
    expect(vocabularioDe({ segmento: "Consultório odontológico" }).profissional).toBe("dentista");
  });

  it("termo personalizado prevalece sobre o padrão do segmento", () => {
    const v = vocabularioDe({ segmentoTipo: "clinica", vocabulario: { cliente: "Cliente", area: "Ginecologia" } });
    expect(v.cliente).toBe("cliente");       // minúsculas
    expect(v.area).toBe("ginecologia");
    expect(v.profissional).toBe("médico");   // o resto segue o segmento
  });

  it("a saudação personalizada mantém a caixa", () => {
    expect(vocabularioDe({ vocabulario: { saudacao: "Fala, Pri" } }).saudacao).toBe("Fala, Pri");
  });

  it("ignora gênero, chaves desconhecidas, vazios e não-texto", () => {
    const v = vocabularioDe({
      segmentoTipo: "clinica",
      vocabulario: { genero: "a", inventado: "x", cliente: "   ", servico: 42 },
    });
    expect(v.genero).toBe("o");
    expect(v.cliente).toBe("paciente");
    expect(v.servico).toBe("procedimento");
    expect(v).not.toHaveProperty("inventado");
  });

  it("cap põe só a primeira letra em maiúscula", () => {
    expect(cap("paciente")).toBe("Paciente");
    expect(cap("")).toBe("");
  });
});

// ── Ficha ─────────────────────────────────────────────────────────────────────

describe("normalizarFicha", () => {
  it("nulo vira ficha vazia", () => {
    expect(normalizarFicha(null)).toEqual(FICHA_VAZIA);
  });

  it("descarta enum inválido e saneia a UF", () => {
    const f = normalizarFicha({
      segmentoTipo: "padaria" as never, porte: "gigante" as never,
      modelo: "outro" as never, uf: "rj",
    });
    expect(f.segmentoTipo).toBe("");
    expect(f.porte).toBe("");
    expect(f.modelo).toBe("");
    expect(f.uf).toBe("RJ");
  });

  it("corta textos no limite de cada campo", () => {
    const f = normalizarFicha({ perfil: "x".repeat(5000), estilo: "y".repeat(5000) });
    expect(f.perfil).toHaveLength(LIMITES.perfil);
    expect(f.estilo).toHaveLength(LIMITES.estilo);
  });

  it("vocabulário só guarda termos conhecidos e não vazios", () => {
    const f = normalizarFicha({ vocabulario: { cliente: " cliente ", genero: "a", xyz: "1", area: "" } });
    expect(f.vocabulario).toEqual({ cliente: "cliente" });
  });
});

describe("fichaPreenchida", () => {
  it("só cidade e porte não contam como preenchida", () => {
    expect(fichaPreenchida({ ...FICHA_VAZIA, cidade: "Rio", porte: "50a150" })).toBe(false);
  });
  it("qualquer texto de contexto conta", () => {
    expect(fichaPreenchida({ ...FICHA_VAZIA, prioridades: "Bater a meta" })).toBe(true);
  });
});

// ── Ficha colada de um assistente ─────────────────────────────────────────────

const RESPOSTA = `### CIDADE/UF
Rio de Janeiro/RJ

### SEGMENTO (tipo de negócio)
Clínica médica especializada em ginecologia

### ÁREAS DE ATUAÇÃO (especialidades, linhas de serviço ou produto)
Ginecologia integrativa, saúde hormonal

### MODELO DE NEGÓCIO (para saúde: particular, convênio ou misto; outros negócios: descreva em uma linha)
Misto (particular e convênio)

### PERFIL E POSICIONAMENTO
Atendimento individualizado.

### PRIORIDADES E METAS DO MOMENTO
- Meta de faturamento: R$ 68.000

### PESSOAS E PAPÉIS (sócios, gestores, equipe, marketing)
não informado

### COMO ESCREVER PARA ESTE CLIENTE (tom, tratamento, o que valorizam)
Tom próximo e objetivo.

### ASSUNTOS A EVITAR
Não informado.`;

describe("lerFichaGerada", () => {
  it("o pedido gerado contém todos os títulos que o leitor reconhece", () => {
    const secoes = separarSecoes(pedidoFicha("Axem") + "\nx");
    // só o último título recebe o "x"; o importante é o pedido citar o cliente
    expect(pedidoFicha("Axem")).toContain("Axem");
    expect(Object.keys(secoes)).toContain("evitar");
  });

  it("preenche os campos pelos títulos", () => {
    const { ficha, achados } = lerFichaGerada(RESPOSTA, FICHA_VAZIA);
    expect(ficha.cidade).toBe("Rio de Janeiro");
    expect(ficha.uf).toBe("RJ");
    expect(ficha.segmento).toBe("Clínica médica especializada em ginecologia");
    expect(ficha.segmentoTipo).toBe("clinica");   // adivinhado pela descrição
    expect(ficha.modelo).toBe("misto");
    expect(ficha.prioridades).toContain("R$ 68.000");
    expect(ficha.estilo).toBe("Tom próximo e objetivo.");
    expect(achados).toBe(7);
  });

  it('"não informado" nunca apaga o que já estava na ficha', () => {
    const atual = { ...FICHA_VAZIA, pessoas: "Dra. Ana: sócia", evitar: "Falar de preço" };
    const { ficha } = lerFichaGerada(RESPOSTA, atual);
    expect(ficha.pessoas).toBe("Dra. Ana: sócia");
    expect(ficha.evitar).toBe("Falar de preço");
  });

  it("aceita títulos em negrito e com dois-pontos", () => {
    const { ficha } = lerFichaGerada("**PERFIL E POSICIONAMENTO**\nBoutique.\n\nPRIORIDADES:\nCrescer.", FICHA_VAZIA);
    expect(ficha.perfil).toBe("Boutique.");
    expect(ficha.prioridades).toBe("Crescer.");
  });

  it("texto sem título reconhecido não muda nada", () => {
    const { ficha, achados } = lerFichaGerada("um texto qualquer\nsem títulos", FICHA_VAZIA);
    expect(achados).toBe(0);
    expect(ficha).toEqual(FICHA_VAZIA);
  });

  it("não sobrescreve um segmento já escolhido à mão", () => {
    const atual = { ...FICHA_VAZIA, segmentoTipo: "estetica" as const };
    expect(lerFichaGerada(RESPOSTA, atual).ficha.segmentoTipo).toBe("estetica");
  });
});

// ── Contexto para a IA ────────────────────────────────────────────────────────

const DADOS: RelatorioImagemData = {
  cabecalho: { clinica_nome: "Axem", tag: "AX", periodo_ini: "09/11", periodo_fim: "15/11" },
  rodape: { mes_ano: "Novembro/2026" },
  visaoGeral: {
    faturamento: {
      is_media: false, acumulado: "R$ 58.390", meta_periodo: "N/A", pct_periodo: null,
      acima_periodo: false, meta_mensal: "N/A", pct_mensal: null, acima_mensal: false,
    },
    npsGoogle: { respostas_nps: null, avaliacoes_google: null, meta_nps_meta: null, meta_google_meta: null },
    comercial: { conversao_leads: "N/A", conversao_orcamentos: "N/A", total_leads: "N/A", total_orcamentos: "N/A" },
  },
  destaques: [], alertas: [], acoes: [],
};

describe("contextoDaFicha / montarContextoIA", () => {
  it("ficha vazia não gera bloco de perfil", () => {
    expect(contextoDaFicha(FICHA_VAZIA)).toBe("");
    expect(contextoDaFicha(null)).toBe("");
    expect(montarContextoIA(DADOS, FICHA_VAZIA)).not.toContain("PERFIL DO CLIENTE");
  });

  it("sem ficha, o contexto é idêntico ao de antes", () => {
    expect(montarContextoIA(DADOS, null)).toBe(montarContextoIA(DADOS));
  });

  it("ficha preenchida entra com rótulos, tom e vocabulário", () => {
    const ficha = normalizarFicha({
      segmentoTipo: "clinica", segmento: "Clínica de ginecologia", cidade: "Rio de Janeiro", uf: "RJ",
      modelo: "misto", porte: "50a150", estilo: "Tom próximo.", evitar: "Protocolos antigos.",
    });
    const ctx = montarContextoIA(DADOS, ficha);
    expect(ctx).toContain("PERFIL DO CLIENTE:");
    expect(ctx).toContain("Local: Rio de Janeiro/RJ");
    expect(ctx).toContain("Modelo: Misto (particular e convênio)");
    expect(ctx).toContain("Como escrever para este cliente:\nTom próximo.");
    expect(ctx).toContain("Assuntos a evitar:\nProtocolos antigos.");
    expect(ctx).toContain('"paciente"');
    expect(ctx).not.toMatch(/null|undefined|NaN/);
  });

  it("só o segmento já basta para orientar o vocabulário", () => {
    const ctx = contextoDaFicha(normalizarFicha({ segmentoTipo: "varejo" }));
    expect(ctx).toContain('"loja"');
  });
});

// ── Aplicação nos textos de hoje ──────────────────────────────────────────────

function nps(comentarios: ResultadoNPS["comentarios"]): ResultadoNPS {
  return {
    total: comentarios.length, notas_gerais: [],
    classificacao: { promotores: 0, neutros: 0, detratores: 0 }, nps_score: 0,
    medias_por_area: { profissional: null, recepcao: null, infraestrutura: null, enfermagem: null },
    comentarios, indicacoes: [],
  };
}

describe("vocabulário nos comentários do infográfico", () => {
  const base = nps([
    { nome: "Paciente (anônimo)", comentario: "Muito bom!", nota: 10 },
    { nome: "", comentario: "Gostei bastante.", nota: 9 },
    { nome: "Ana Lima", comentario: "Recomendo.", nota: 10 },
  ]);

  it("sem termo, mantém 'Paciente' como sempre foi", () => {
    expect(buildComentarios(base, null).map(c => c.autor))
      .toEqual(["Paciente (anônimo)", "Paciente", "Ana Lima"]);
  });

  it("com termo, troca só a palavra genérica — o sigilo continua", () => {
    expect(buildComentarios(base, null, null, "cliente").map(c => c.autor))
      .toEqual(["Cliente (anônimo)", "Cliente", "Ana Lima"]);
  });
});

describe("vocabulário no texto de WhatsApp", () => {
  const pre = {
    total: 10,
    motivos: [{ nome: "Consulta", count: 6, pct: 60 }],
    origens: [{ nome: "Instagram", count: 7, pct: 70 }],
  } as unknown as ResultadoPreConsulta;
  const ini = new Date(2026, 10, 9), fim = new Date(2026, 10, 15);

  it("sem perfil, continua falando de pacientes", () => {
    const t = montarPesquisas("Axem", pre, null, null, null, ini, fim);
    expect(t).toContain("A maioria dos pacientes chegou por instagram");
  });

  it("com perfil de varejo, fala de clientes", () => {
    const t = montarPesquisas(
      "Shopping X", pre, null, null, null, ini, fim,
      undefined, null, null, vocabularioDe({ segmentoTipo: "varejo" }),
    );
    expect(t).toContain("A maioria dos clientes chegou por instagram");
  });
});
