import type { RelatorioImagemData } from "@/lib/relatorio/imagem-tipos";

function isNA(v: string | number | null | undefined): boolean {
  return v === null || v === undefined || String(v) === "N/A" || String(v) === "";
}

export function montarContextoIA(dados: RelatorioImagemData): string {
  const { cabecalho, rodape, visaoGeral } = dados;
  const fat = visaoGeral.faturamento;
  const ng  = visaoGeral.npsGoogle;
  const com = visaoGeral.comercial;
  const sup = dados.faturamento_suplementar;

  const lines: string[] = [
    `Clínica: ${cabecalho.clinica_nome}`,
    `Período: ${cabecalho.periodo_ini} a ${cabecalho.periodo_fim} (${rodape.mes_ano})`,
  ];

  if (!isNA(fat.acumulado)) {
    lines.push("", "FATURAMENTO:");
    lines.push(`  Acumulado do período: ${fat.acumulado}`);
    if (!isNA(fat.meta_periodo)) {
      lines.push(`  Meta do período: ${fat.meta_periodo}`);
      if (fat.pct_periodo !== null)
        lines.push(`  Variação vs meta: ${fat.acima_periodo ? "+" : "-"}${fat.pct_periodo}%`);
    }
    if (!isNA(fat.meta_mensal)) {
      lines.push(`  Meta mensal: ${fat.meta_mensal}`);
      if (fat.pct_mensal !== null)
        lines.push(`  Atingimento da meta mensal: ${fat.pct_mensal}%`);
    }
  }

  if (sup?.por_categoria) {
    const cats = Object.entries(sup.por_categoria).slice(0, 3);
    if (cats.length > 0) {
      lines.push("  Top categorias de faturamento:");
      for (const [nome, g] of cats)
        lines.push(`    - ${nome}: ${g.pct_do_total.toFixed(0)}%`);
    }
  }

  if (sup?.por_profissional) {
    const profs = Object.entries(sup.por_profissional).slice(0, 3);
    if (profs.length > 0) {
      lines.push("  Top profissionais:");
      for (const [nome, g] of profs)
        lines.push(`    - ${nome}: ${g.pct_do_total.toFixed(0)}%`);
    }
  }

  const hasNPS = ng.respostas_nps !== null || ng.avaliacoes_google !== null;
  if (hasNPS) {
    lines.push("", "NPS / GOOGLE:");
    if (ng.respostas_nps !== null) {
      lines.push(`  Respostas NPS: ${ng.respostas_nps}`);
      if (ng.meta_nps_meta !== null) lines.push(`  Meta NPS: ${ng.meta_nps_meta}`);
    }
    if (ng.avaliacoes_google !== null) {
      lines.push(`  Avaliações Google: ${ng.avaliacoes_google}`);
      if (ng.meta_google_meta !== null) lines.push(`  Meta avaliações Google: ${ng.meta_google_meta}`);
    }
  }

  const hasComercial =
    !isNA(com.total_leads) || !isNA(com.conversao_leads) ||
    !isNA(com.total_orcamentos) || !isNA(com.conversao_orcamentos);
  if (hasComercial) {
    lines.push("", "COMERCIAL:");
    if (!isNA(com.total_leads))          lines.push(`  Total de leads: ${com.total_leads}`);
    if (!isNA(com.conversao_leads))      lines.push(`  Conversão de leads: ${com.conversao_leads}`);
    if (!isNA(com.total_orcamentos))     lines.push(`  Total de orçamentos: ${com.total_orcamentos}`);
    if (!isNA(com.conversao_orcamentos)) lines.push(`  Conversão de orçamentos: ${com.conversao_orcamentos}`);
  }

  return lines.join("\n");
}

export const SYSTEM_PROMPT = `Você é um analista especialista em gestão de clínicas médicas e estéticas. Receberá dados já calculados de uma clínica para um período específico. Sua tarefa é escrever textos curtos de análise para um infográfico de relatório semanal.

REGRAS ABSOLUTAS (não negociáveis):
1. NUNCA calcule, estime, invente ou crie números. Todo número no seu texto DEVE existir exatamente nos dados fornecidos.
2. Se um dado não foi fornecido, não o mencione. Não presuma nem extrapole.
3. Não compare com períodos fora dos dados (ex: nunca diga "cresceu X% vs semana passada" se não foi informado).
4. Escreva em português do Brasil. Tom profissional. Textos curtos: no máximo 2 linhas, ideal 1.

TOM POR SEÇÃO:
- destaques: positivo e celebratório quando os resultados forem bons; factual quando neutros. Cite o dado específico que justifica.
- alertas: sóbrio e direto, sem alarmismo. Só crie se houver dado real que justifique (abaixo de meta, etc.). Se tudo estiver bem retorne alertas como lista vazia.
- acoes: práticas e acionáveis. Comandos diretos baseados nos dados.

TIPOS de destaque disponíveis: "positivo" (conquista, resultado acima da meta), "financeiro" (resultado financeiro específico), "atencao" (algo que merece atenção — use com parcimônia).

FORMATO DE SAÍDA (JSON puro, sem markdown, sem nenhum texto fora do JSON):
{"destaques":[{"tipo":"positivo"|"financeiro"|"atencao","texto":"..."}],"alertas":["..."],"acoes":["..."]}
Quantidade: destaques 2-3, alertas 0-2, acoes 2-3.`;
