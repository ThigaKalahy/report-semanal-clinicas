import { format } from "date-fns";
import { formatValor } from "@/lib/format";
import type { ResultadoPreConsulta } from "@/lib/coletores/pre-consulta";
import type { ResultadoNPS, Indicacao } from "@/lib/coletores/nps";
import type { ResultadoGoogle, AvaliacaoGoogle } from "@/lib/coletores/google-places";
import type { ResultadoLeads } from "@/lib/coletores/leads";
import type { ResultadoMeta } from "@/lib/coletores/metas";
import { NEUTRO, SEGMENTOS } from "@/lib/perfil/vocabulario";
import type { Vocabulario } from "@/lib/perfil/vocabulario";
import { listaPadrao, indicadoresLigados } from "@/lib/estrutura/estrutura";
import type { ItemEstrutura } from "@/lib/estrutura/estrutura";

// Sem ficha de perfil, os textos continuam como sempre foram: falando de pacientes.
const VOCAB_PADRAO: Vocabulario = SEGMENTOS.find((s) => s.id === "clinica")?.vocab ?? NEUTRO;

// Limite de relevância deste relatório: comentários mais curtos que isto não
// entram no WhatsApp. O coletor devolve todos os comentários não vazios — o
// corte é de quem consome, e a página de feedbacks do infográfico usa um limite
// mais permissivo, para não descartar elogios curtos ("muito bom!").
// Declarado aqui (e não em nps.ts) porque este módulo também é importado pelo
// componente de cliente: importar um valor do coletor arrastaria o googleapis
// para o bundle do navegador.
const MIN_CARACTERES_COMENTARIO = 35;

export const SEPARATOR = "—- ENVIAR SEPARADO";

function fmtDate(d: Date): string {
  return format(d, "dd/MM");
}

function fmtMedia(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// ── Block builders ────────────────────────────────────────────────────────────

/** Abre o report. Vai colado na primeira seção, na mesma mensagem. */
function cabecalho(clinicaNome: string, ini: Date, fim: Date): string {
  return [
    `*${clinicaNome}*`,
    "",
    `*Report semanal: (avaliações, questionários e metas):*`,
    `\`Período analisado: ${fmtDate(ini)} até ${fmtDate(fim)}\``,
  ].join("\n");
}

function blocoPreConsulta(
  pre: ResultadoPreConsulta | null,
  vocab: Vocabulario,
  on: Set<string>,
): string {
  const lines: string[] = [];
  lines.push(`*📄 Questionário Pré-Consulta:*`);

  if (!pre) {
    lines.push(`Dados não disponíveis.`);
    return lines.join("\n");
  }

  lines.push(`\`${pre.total} respostas essa semana\``);

  const motivos = on.has("sem.pre.motivos") ? pre.motivos : [];
  const origens = on.has("sem.pre.origens") ? pre.origens : [];

  if (motivos.length > 0 || origens.length > 0) lines.push("");
  if (motivos.length > 0) {
    const motivoStr = motivos.slice(0, 3).map((m) => `${m.nome} (${m.pct}%)`).join(", ");
    lines.push(`_➤ Motivo principal>_ ${motivoStr}`);
  }
  if (origens.length > 0) {
    const origemStr = origens.slice(0, 3).map((o) => `${o.nome} (${o.pct}%)`).join(", ");
    lines.push(`_➤ De onde veio>_ ${origemStr}`);
  }

  // A frase de análise só fala do que está visível acima
  const analysis: string[] = [];
  if (on.has("sem.pre.analise")) {
    if (motivos.length > 0) {
      const top = motivos[0];
      analysis.push(`${top.nome} foi o motivo mais frequente com ${top.pct}% das respostas.`);
    }
    if (origens.length > 0) {
      const top = origens[0];
      analysis.push(`A maioria dos ${vocab.clientes} chegou por ${top.nome.toLowerCase()} (${top.pct}%).`);
    }
  }
  if (analysis.length > 0) {
    lines.push("");
    lines.push(analysis.join(" "));
  }

  return lines.join("\n");
}

function blocoNPS(nps: ResultadoNPS, on: Set<string>): string {
  const lines: string[] = [];
  lines.push(`*🔍 Pesquisa NPS:*`);
  lines.push(`➤ ${nps.total} respostas recebidas`);

  if (on.has("sem.nps.notas") && nps.notas_gerais.length > 0) {
    lines.push("");
    lines.push(`➤ NPS Geral:`);
    for (const { nota, count } of nps.notas_gerais) {
      lines.push(`– ${count}x nota ${nota}`);
    }
  }

  const { promotores, neutros, detratores } = nps.classificacao;
  const partes: string[] = [];
  if (promotores > 0) partes.push(`🟢 ${promotores} Promotores`);
  if (neutros > 0)    partes.push(`🟡 ${neutros} Neutros`);
  if (detratores > 0) partes.push(`🔴 ${detratores} Detratores`);
  if (on.has("sem.nps.classificacao") && partes.length > 0) {
    lines.push("");
    lines.push(`➤ Classificação:`);
    lines.push(partes.join(" / "));
    lines.push(`NPS da semana: ${nps.nps_score}`);
  }

  const areas = [
    { emoji: "🧑‍⚕️", nome: "Profissional de saúde", media: nps.medias_por_area.profissional },
    { emoji: "🧑‍💼", nome: "Recepção",               media: nps.medias_por_area.recepcao },
    { emoji: "🏥",   nome: "Infraestrutura",         media: nps.medias_por_area.infraestrutura },
    { emoji: "💉",   nome: "Enfermagem",              media: nps.medias_por_area.enfermagem },
  ].filter((a) => a.media !== null);

  if (on.has("sem.nps.areas") && areas.length > 0) {
    lines.push("");
    lines.push(`📋 Avaliações por área:`);
    lines.push("");
    for (const { emoji, nome, media } of areas) {
      lines.push(`${emoji} ${nome}:`);
      lines.push(media === 5 ? `🟢 Todas notas 5` : `🟢 Média: ${fmtMedia(media!)}`);
    }
  }

  if (on.has("sem.nps.indicacoes") && nps.indicacoes && nps.indicacoes.length > 0) {
    lines.push("");
    lines.push(`☎️ *Indicações*`);
    for (const ind of nps.indicacoes as Indicacao[]) {
      if (ind.usa_bruto) {
        lines.push(`${ind.texto_indicacao}, indicado por ${ind.indicado_por}`);
      } else {
        const quem = ind.nome_indicado ? `${ind.nome_indicado} ${ind.numero}` : ind.numero;
        lines.push(`${quem}, indicado por ${ind.indicado_por}`);
      }
    }
  }

  // O coletor devolve todos os comentários; aqui fica o corte de relevância do WhatsApp.
  const comentariosRelevantes = nps.comentarios.filter(
    (c) => c.comentario.length >= MIN_CARACTERES_COMENTARIO
  );
  if (on.has("sem.nps.comentarios") && comentariosRelevantes.length > 0) {
    lines.push("");
    lines.push(`💬 Comentários relevantes:`);
    for (const { nome, comentario } of comentariosRelevantes) {
      lines.push(`${nome.toUpperCase()}: "${comentario}"`);
    }
  }

  return lines.join("\n").trimEnd();
}

function blocoLeads(leads: ResultadoLeads, metaLeads: ResultadoMeta | null, on: Set<string>): string {
  const lines: string[] = [];
  lines.push(`*📈 Leads*`);
  lines.push(`➤ Total de leads: ${leads.total}`);
  lines.push(`➤ Convertidos: ${leads.convertidos}`);
  const taxa = leads.taxa_conversao !== null
    ? `${leads.taxa_conversao.toFixed(1)}%`
    : "—";
  lines.push(`➤ Taxa de conversão: ${taxa}`);

  if (metaLeads && on.has("sem.leads.meta")) {
    lines.push(
      `➤ Meta de leads: ${formatValor(leads.total, metaLeads.tipo_formato)}/${formatValor(metaLeads.meta_periodo, metaLeads.tipo_formato)} \`${metaLeads.performance.texto_curto}\``
    );
  }

  return lines.join("\n");
}

function renderAvaliacoes(avaliacoes: AvaliacaoGoogle[]): string[] {
  return avaliacoes.map((av) => {
    const estrelas = "⭐".repeat(Math.min(Math.max(Math.round(av.nota), 0), 5));
    return `${estrelas} *${av.autor}*: "${av.texto}"`;
  });
}

function blocoGoogle(
  google: ResultadoGoogle | null,
  googleManual: string | null,
  googleManualAvaliacoes?: AvaliacaoGoogle[]
): string {
  const lines: string[] = [];
  lines.push(`*⭐ Avaliação Google:*`);

  if (googleManualAvaliacoes && googleManualAvaliacoes.length > 0) {
    lines.push(`➤ ${googleManualAvaliacoes.length} avaliação(ões) inseridas manualmente`);
    lines.push(...renderAvaliacoes(googleManualAvaliacoes));
    return lines.join("\n");
  }

  if (googleManual?.trim()) {
    lines.push(googleManual.trim());
    return lines.join("\n");
  }

  if (!google) {
    lines.push(`➤ Não foi possível obter avaliações Google automaticamente.`);
    return lines.join("\n");
  }

  lines.push(`➤ ${google.total} novas avaliações neste período`);
  lines.push(...renderAvaliacoes(google.avaliacoes));

  return lines.join("\n");
}

// ── Public API ────────────────────────────────────────────────────────────────

export function montarPesquisas(
  clinicaNome: string,
  pre: ResultadoPreConsulta | null,
  nps: ResultadoNPS | null,
  google: ResultadoGoogle | null,
  googleManual: string | null,
  ini: Date,
  fim: Date,
  googleManualAvaliacoes?: AvaliacaoGoogle[],
  leads?: ResultadoLeads | null,
  metaLeads?: ResultadoMeta | null,
  vocabulario?: Vocabulario | null,
  /**
   * Seções do semanal desta clínica, na ordem em que devem sair (já
   * normalizadas). Sem isto vale a estrutura padrão — o report de sempre.
   */
  estrutura?: ItemEstrutura[] | null,
): string {
  const blocos: string[] = [];
  const vocab = vocabulario ?? VOCAB_PADRAO;

  for (const item of estrutura ?? listaPadrao("semanal")) {
    if (!item.ativa) continue;
    const on = indicadoresLigados(item, "semanal");
    switch (item.id) {
      case "semPreConsulta":
        blocos.push(blocoPreConsulta(pre, vocab, on));
        break;
      case "semNps":
        if (nps) blocos.push(blocoNPS(nps, on));
        break;
      case "semGoogle":
        blocos.push(blocoGoogle(google, googleManual, googleManualAvaliacoes));
        break;
      case "semLeads":
        if (leads) blocos.push(blocoLeads(leads, metaLeads ?? null, on));
        break;
    }
  }

  // O cabeçalho abre a primeira mensagem, seja qual for a seção que vem primeiro
  const topo = cabecalho(clinicaNome, ini, fim);
  if (blocos.length === 0) return topo;
  blocos[0] = `${topo}\n\n${blocos[0]}`;

  return blocos.join(`\n\n${SEPARATOR}\n\n`);
}

export function montarMetas(
  clinicaNome: string,
  metas: ResultadoMeta[],
  ini: Date,
  fim: Date
): string {
  const lines: string[] = [];
  lines.push(`*${clinicaNome}*`);
  lines.push("");
  lines.push(`*🎯 Evolução das Metas*`);
  lines.push(`\`Período: ${fmtDate(ini)} até ${fmtDate(fim)}\``);

  if (metas.length === 0) {
    lines.push("");
    lines.push("Nenhuma meta cadastrada para este período.");
    return lines.join("\n");
  }

  for (const meta of metas) {
    lines.push("");
    lines.push(`➤ *${meta.tipo_nome}:*`);
    lines.push(`Realizado: ${formatValor(meta.realizado, meta.tipo_formato)}`);
    lines.push(
      `Meta do período: ${formatValor(meta.meta_periodo, meta.tipo_formato)} \`${meta.performance.texto_curto}\``
    );
    lines.push(
      `Meta mensal: ${formatValor(meta.meta_mensal, meta.tipo_formato)} \`${Math.round(meta.pct_mensal)}% da meta\``
    );
  }

  return lines.join("\n");
}
