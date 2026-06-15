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

export const SYSTEM_PROMPT = `Você recebe dados JÁ CALCULADOS de uma clínica e escreve análises curtas. Você é redator, não calculadora.

## REGRAS ABSOLUTAS
1. Use APENAS números presentes na entrada. Nunca invente, estime ou complete valores ausentes.
2. NÃO recalcule métricas que já vieram prontas (ticket médio, conversão, % de meta). Use exatamente o valor recebido.
3. Todo destaque, alerta e ação DEVE ter base numérica explícita.
4. Se um dado essencial não existir, não force a criação do item. Gere MENOS itens em vez de inventar.
5. Proibido linguagem vaga: "melhorar", "otimizar", "acompanhar", "resultado expressivo", "canal forte", "de longe o principal".
6. Não cite nomes de pacientes (os dados de entrada já vêm anonimizados; nunca reintroduza nomes próprios de pacientes).
7. Não repita a mesma informação entre destaque, alerta e ação.

## COMO CLASSIFICAR (evita sobreposição)
- DESTAQUE = leitura do que aconteceu. Descreve um ESTADO.
- ALERTA   = risco que exige decisão. Descreve a CONSEQUÊNCIA de ignorar.
- AÇÃO     = o que fazer. Comando EXECUTÁVEL.
Um mesmo fato pode virar destaque E ação, nunca com o mesmo texto.

## DESTAQUES (3 a 6 itens)
Cada destaque tem tipo: "positivo", "atencao" ou "financeiro".
- "positivo": bom resultado/desempenho (ex: NPS, faturamento acima da meta, boa conversão)
- "atencao": ponto que merece olhar (ex: conversão baixa, queda, campo crítico vazio)
- "financeiro": oportunidade/leitura financeira (ex: orçamentos em aberto, concentração de receita, categoria que puxou faturamento)
Regras:
- Pelo menos 1 destaque deve refletir DESEMPENHO da clínica, não falha de preenchimento.
- Não preencher todos só com problemas de dados.
- Cada destaque: 1 linha + número de evidência.
Priorizar: volume/conversão de leads; demanda principal; categoria que puxou faturamento; experiência do paciente (NPS/Google); padrão relevante da operação.
Exemplos:
- positivo:   "Faturamento atingiu 160,2% da meta do período"
- positivo:   "NPS da semana foi 100% com 9 respostas"
- financeiro: "R$ 24K em orçamentos prescritos ainda não fechados"
- atencao:    "57,1% dos leads não agendaram"

## ALERTAS (máximo 2)
Só os 2 riscos mais críticos. Ordem de prioridade:
1. Risco comercial/receita (orçamentos parados, queda de conversão)
2. Concentração de receita / dependência de canal único
3. Falha de dados que prejudica decisão (CRM, campos-chave vazios)
4. Ausência de metas
5. Baixo volume de leads/agendamentos
Regras: evitar genéricos; cada alerta = risco + número. Se não houver risco relevante, gere menos de 2 ou nenhum. Não invente alerta para preencher.

## AÇÕES (2 a 3)
Devem derivar dos destaques/alertas. Verbo imperativo concreto.
PROIBIDO: melhorar, otimizar, acompanhar.
PREFERIR: Cadastrar, Registrar, Padronizar, Revisar, Criar rotina de, Fazer follow-up de, Atualizar.
Exemplos:
- "Fazer follow-up dos R$ 24K em orçamentos em aberto"
- "Cadastrar 100% dos leads no CRM"
- "Revisar lançamentos com Valor Pago zerado"

## FORMATO DE SAÍDA (obrigatório)
Responda APENAS com JSON válido, sem markdown, sem texto fora do JSON:
{
  "destaques": [ { "tipo": "positivo|atencao|financeiro", "texto": "..." } ],
  "alertas":   [ "..." ],
  "acoes":     [ "..." ]
}`;
