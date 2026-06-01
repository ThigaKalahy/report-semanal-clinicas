import { format } from "date-fns";
import { formatValor } from "@/lib/format";
import type { ResultadoPreConsulta } from "@/lib/coletores/pre-consulta";
import type { ResultadoNPS } from "@/lib/coletores/nps";
import type { ResultadoGoogle } from "@/lib/coletores/google-places";
import type { ResultadoMeta } from "@/lib/coletores/metas";

export const SEPARATOR = "—- ENVIAR SEPARADO";

function fmtDate(d: Date): string {
  return format(d, "dd/MM");
}

function fmtMedia(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// ── Block builders ────────────────────────────────────────────────────────────

function blocoPreConsulta(
  clinicaNome: string,
  pre: ResultadoPreConsulta | null,
  ini: Date,
  fim: Date
): string {
  const lines: string[] = [];
  lines.push(`*${clinicaNome}*`);
  lines.push("");
  lines.push(`*Report semanal: (avaliações, questionários e metas):*`);
  lines.push(`\`Período analisado: ${fmtDate(ini)} até ${fmtDate(fim)}\``);

  if (!pre) {
    lines.push("");
    lines.push(`*📄 Questionário Pré-Consulta:*`);
    lines.push(`Dados não disponíveis.`);
    return lines.join("\n");
  }

  lines.push("");
  lines.push(`*📄 Questionário Pré-Consulta:*`);
  lines.push(`\`${pre.total} respostas essa semana\``);

  if (pre.motivos.length > 0) {
    lines.push("");
    const motivoStr = pre.motivos
      .slice(0, 3)
      .map((m) => `${m.nome} (${m.pct}%)`)
      .join(", ");
    lines.push(`_➤ Motivo principal>_ ${motivoStr}`);
  }
  if (pre.origens.length > 0) {
    const origemStr = pre.origens
      .slice(0, 3)
      .map((o) => `${o.nome} (${o.pct}%)`)
      .join(", ");
    lines.push(`_➤ De onde veio>_ ${origemStr}`);
  }

  const analysis: string[] = [];
  if (pre.motivos.length > 0) {
    const top = pre.motivos[0];
    analysis.push(`${top.nome} foi o motivo mais frequente com ${top.pct}% das respostas.`);
  }
  if (pre.origens.length > 0) {
    const top = pre.origens[0];
    analysis.push(`A maioria dos pacientes chegou por ${top.nome.toLowerCase()} (${top.pct}%).`);
  }
  if (analysis.length > 0) {
    lines.push("");
    lines.push(analysis.join(" "));
  }

  return lines.join("\n");
}

function blocoNPS(nps: ResultadoNPS): string {
  const lines: string[] = [];
  lines.push(`*🔍 Pesquisa NPS:*`);
  lines.push(`➤ ${nps.total} respostas recebidas`);

  if (nps.notas_gerais.length > 0) {
    lines.push("");
    lines.push(`➤ NPS Geral:`);
    for (const { nota, count } of nps.notas_gerais) {
      lines.push(`– ${count}x nota ${nota}`);
    }
  }

  const { promotores, neutros, detratores } = nps.classificacao;
  const partes: string[] = [];
  if (promotores > 0) partes.push(`🟢 ${promotores} Promotores`);
  if (neutros > 0) partes.push(`🟡 ${neutros} Neutros`);
  if (detratores > 0) partes.push(`🔴 ${detratores} Detratores`);
  if (partes.length > 0) {
    lines.push("");
    lines.push(`➤ Classificação:`);
    lines.push(partes.join(" / "));
    lines.push(`NPS da semana: ${nps.nps_score}`);
  }

  const areas = [
    { emoji: "🧑‍⚕️", nome: "Profissional de saúde", media: nps.medias_por_area.profissional },
    { emoji: "🧑‍💼", nome: "Recepção", media: nps.medias_por_area.recepcao },
    { emoji: "🏥", nome: "Infraestrutura", media: nps.medias_por_area.infraestrutura },
    { emoji: "💉", nome: "Enfermagem", media: nps.medias_por_area.enfermagem },
  ].filter((a) => a.media !== null);

  if (areas.length > 0) {
    lines.push("");
    lines.push(`📋 Avaliações por área:`);
    lines.push("");
    for (const { emoji, nome, media } of areas) {
      lines.push(`${emoji} ${nome}:`);
      lines.push(media === 5 ? `🟢 Todas notas 5` : `🟢 Média: ${fmtMedia(media!)}`);
    }
  }

  if (nps.comentarios.length > 0) {
    lines.push("");
    lines.push(`💬 Comentários relevantes:`);
    for (const { nome, comentario } of nps.comentarios) {
      lines.push(`${nome.toUpperCase()}: "${comentario}"`);
    }
  }

  return lines.join("\n").trimEnd();
}

function blocoGoogle(google: ResultadoGoogle | null, googleManual: string | null): string {
  const lines: string[] = [];
  lines.push(`*⭐ Avaliação Google:*`);

  if (googleManual?.trim()) {
    lines.push(googleManual.trim());
    return lines.join("\n");
  }

  if (!google) {
    lines.push(`➤ Não foi possível obter avaliações Google automaticamente.`);
    return lines.join("\n");
  }

  lines.push(`➤ ${google.total} novas avaliações neste período`);
  for (const av of google.avaliacoes) {
    const estrelas = "⭐".repeat(Math.min(Math.max(Math.round(av.nota), 0), 5));
    lines.push(`${estrelas} *${av.autor}*: "${av.texto}"`);
  }

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
  fim: Date
): string {
  const blocos: string[] = [];

  blocos.push(blocoPreConsulta(clinicaNome, pre, ini, fim));
  if (nps) blocos.push(blocoNPS(nps));
  blocos.push(blocoGoogle(google, googleManual));

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
