"use server";

import { headers } from "next/headers";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { coletarPreConsulta } from "@/lib/coletores/pre-consulta";
import { coletarNPS } from "@/lib/coletores/nps";
import { coletarAvaliacoesGoogle } from "@/lib/coletores/google-places";
import type { AvaliacaoGoogle } from "@/lib/coletores/google-places";
import { coletarLeads } from "@/lib/coletores/leads";
import type { ResultadoLeads } from "@/lib/coletores/leads";
import { coletarMetas } from "@/lib/coletores/metas";
import { coletarFaturamento } from "@/lib/coletores/faturamento";
import { descreverPerformance, calcularPercentualMeta } from "@/lib/metas";
import { montarPesquisas, montarMetas } from "@/lib/relatorio/montar-whatsapp";
import { montarDadosImagem } from "@/lib/relatorio/montar-imagem-dados";
import type { RelatorioGeradoInsert } from "@/lib/supabase/types";
import type { RelatorioImagemData } from "@/lib/relatorio/imagem-tipos";

interface GerarParams {
  clinicaId: string;
  ini: string;
  fim: string;
  formato: "whatsapp_pesquisas" | "whatsapp_metas" | "imagem";
  googleManual?: string;
  googleManualAvaliacoes?: AvaliacaoGoogle[];
  leadsManual?: { total: number; convertidos: number };
}

function leadsFromManual(m: { total: number; convertidos: number }): ResultadoLeads {
  const { total, convertidos } = m;
  return {
    total,
    convertidos,
    taxa_conversao: total > 0 ? Math.round((convertidos / total) * 1000) / 10 : null,
  };
}

export async function gerarRelatorioWhatsapp(
  params: GerarParams
): Promise<{ texto: string; erros: string[] }> {
  const h = await headers();
  if (!checkRateLimit(rateLimitKey(h), 10)) {
    return { texto: "", erros: ["Limite de requisições atingido. Aguarde 1 minuto."] };
  }

  const { clinicaId, ini, fim, formato, googleManual, googleManualAvaliacoes, leadsManual } = params;
  const erros: string[] = [];

  const db = getSupabaseAdmin();

  const [iniY, iniM, iniD] = ini.split("-").map(Number);
  const [fimY, fimM, fimD] = fim.split("-").map(Number);
  const dataInicio = new Date(iniY, iniM - 1, iniD);
  const dataFim    = new Date(fimY, fimM - 1, fimD);

  const { data: clinica } = await db
    .from("clinicas")
    .select("*")
    .eq("id", clinicaId)
    .single();

  if (!clinica) return { texto: "", erros: ["Clínica não encontrada."] };

  let texto = "";

  if (formato === "whatsapp_pesquisas") {
    const { data: fontes } = await db
      .from("fontes_dados")
      .select("*")
      .eq("clinica_id", clinicaId);

    const fontePre  = fontes?.find((f) => f.tipo === "pre_consulta") ?? null;
    const fonteNps  = fontes?.find((f) => f.tipo === "nps")          ?? null;
    const fonteLead = fontes?.find((f) => f.tipo === "leads")        ?? null;

    const [preResult, npsResult, googleResult, metasResult] = await Promise.allSettled([
      fontePre
        ? coletarPreConsulta(fontePre, dataInicio, dataFim)
        : Promise.reject(new Error("Fonte Pré-Consulta não configurada")),
      fonteNps
        ? coletarNPS(fonteNps, dataInicio, dataFim)
        : Promise.reject(new Error("Fonte NPS não configurada")),
      clinica.google_place_id
        ? coletarAvaliacoesGoogle(clinica.google_place_id, dataInicio, dataFim)
        : Promise.reject(new Error("Google Place ID não configurado")),
      coletarMetas(clinicaId, dataFim),
    ]);

    const pre    = preResult.status    === "fulfilled" ? preResult.value    : null;
    const nps    = npsResult.status    === "fulfilled" ? npsResult.value    : null;
    const google = googleResult.status === "fulfilled" ? googleResult.value : null;
    const metas  = metasResult.status  === "fulfilled" ? metasResult.value  : [];

    if (preResult.status    === "rejected")
      erros.push(`Pré-Consulta: ${(preResult.reason as Error).message}`);
    if (npsResult.status    === "rejected")
      erros.push(`NPS: ${(npsResult.reason as Error).message}`);
    if (googleResult.status === "rejected") {
      erros.push(
        `Google: A consulta automática está indisponível (${(googleResult.reason as Error).message}). ` +
        `Confira as avaliações da semana no Google e insira manualmente no campo acima.`
      );
    } else if (google && google.total === 0 && !googleManualAvaliacoes?.length) {
      erros.push(
        `Google: A busca automática não encontrou avaliações neste período — a API do Google ` +
        `limita a ~5 avaliações curadas e pode não incluir as mais recentes. ` +
        `Confira no Google e insira manualmente se houver novas avaliações.`
      );
    }

    // Leads: manual prevalece; caso contrário, tenta planilha
    let leads: ResultadoLeads | null = null;
    if (leadsManual) {
      leads = leadsFromManual(leadsManual);
    } else if (fonteLead) {
      leads = await coletarLeads(fonteLead, dataInicio, dataFim).catch((e: Error) => {
        erros.push(`Leads: ${e.message}`);
        return null;
      });
    }

    const metaLeads = metas.find((m) => m.tipo_nome.toLowerCase().includes("lead")) ?? null;

    texto = montarPesquisas(
      clinica.nome,
      pre,
      nps,
      google,
      googleManual ?? null,
      dataInicio,
      dataFim,
      googleManualAvaliacoes,
      leads,
      metaLeads,
    );

  } else if (formato === "whatsapp_metas") {
    const [metasResult, { data: fontesData }] = await Promise.all([
      coletarMetas(clinicaId, dataFim).catch((err: Error) => {
        erros.push(`Metas: ${err.message}`);
        return [];
      }),
      db.from("fontes_dados").select("*").eq("clinica_id", clinicaId),
    ]);

    const fonteFaturamento = fontesData?.find((f) => f.tipo === "faturamento") ?? null;

    let metas = metasResult;

    // Se há planilha de faturamento, substitui o realizado da meta de faturamento
    if (fonteFaturamento) {
      const fatResult = await coletarFaturamento(fonteFaturamento, dataInicio, dataFim).catch(() => null);
      if (fatResult != null) {
        metas = metas.map((m) => {
          if (!m.tipo_nome.toLowerCase().includes("faturamento")) return m;
          const newRealizado = fatResult.total_faturado;
          const performance  = descreverPerformance(newRealizado, m.meta_periodo, m.meta_mensal, m.tipo_comportamento);
          const pct_mensal   = calcularPercentualMeta(newRealizado, m.meta_mensal);
          return { ...m, realizado: newRealizado, performance, pct_mensal };
        });
      }
    }

    texto = montarMetas(clinica.nome, metas, dataInicio, dataFim);
  }

  if (texto) {
    const insert: RelatorioGeradoInsert = {
      clinica_id:         clinicaId,
      formato:            formato as "whatsapp_pesquisas" | "whatsapp_metas",
      data_inicio:        ini,
      data_fim:           fim,
      conteudo_markdown:  texto,
    };
    await db.from("relatorios_gerados").insert(insert);
  }

  return { texto, erros };
}

export async function prepararDadosImagem(params: {
  clinicaId: string;
  ini: string;
  fim: string;
  leadsManual?: { total: number; convertidos: number };
}): Promise<{ dados: RelatorioImagemData; erros: string[] }> {
  const h = await headers();
  if (!checkRateLimit(rateLimitKey(h), 10)) {
    return { dados: {} as RelatorioImagemData, erros: ["Limite de requisições atingido. Aguarde 1 minuto."] };
  }

  const { clinicaId, ini, fim, leadsManual } = params;
  const erros: string[] = [];
  const db = getSupabaseAdmin();

  const [iniY, iniM, iniD] = ini.split("-").map(Number);
  const [fimY, fimM, fimD] = fim.split("-").map(Number);
  const dataInicio = new Date(iniY, iniM - 1, iniD);
  const dataFim    = new Date(fimY, fimM - 1, fimD);

  const { data: clinica } = await db
    .from("clinicas")
    .select("*")
    .eq("id", clinicaId)
    .single();

  if (!clinica) {
    return { dados: {} as RelatorioImagemData, erros: ["Clínica não encontrada."] };
  }

  const { data: fontes } = await db
    .from("fontes_dados")
    .select("*")
    .eq("clinica_id", clinicaId);

  const fontePre         = fontes?.find((f) => f.tipo === "pre_consulta") ?? null;
  const fonteNps         = fontes?.find((f) => f.tipo === "nps")          ?? null;
  const fonteLead        = fontes?.find((f) => f.tipo === "leads")        ?? null;
  const fonteFaturamento = fontes?.find((f) => f.tipo === "faturamento")  ?? null;

  const [preResult, npsResult, googleResult, metasResult, fatResult] = await Promise.allSettled([
    fontePre
      ? coletarPreConsulta(fontePre, dataInicio, dataFim)
      : Promise.reject(new Error("Fonte Pré-Consulta não configurada")),
    fonteNps
      ? coletarNPS(fonteNps, dataInicio, dataFim)
      : Promise.reject(new Error("Fonte NPS não configurada")),
    clinica.google_place_id
      ? coletarAvaliacoesGoogle(clinica.google_place_id, dataInicio, dataFim)
      : Promise.reject(new Error("Google Place ID não configurado")),
    coletarMetas(clinicaId, dataFim),
    fonteFaturamento
      ? coletarFaturamento(fonteFaturamento, dataInicio, dataFim)
      : Promise.reject(new Error("Fonte de faturamento não configurada")),
  ]);

  const pre    = preResult.status    === "fulfilled" ? preResult.value    : null;
  const nps    = npsResult.status    === "fulfilled" ? npsResult.value    : null;
  const google = googleResult.status === "fulfilled" ? googleResult.value : null;
  const metas  = metasResult.status  === "fulfilled" ? metasResult.value  : [];
  // Faturamento da planilha: null se fonte não configurada ou erro de leitura (sem expor erro ao usuário)
  const fatColetado = fatResult.status === "fulfilled" ? fatResult.value : null;

  if (preResult.status    === "rejected")
    erros.push(`Pré-Consulta: ${(preResult.reason as Error).message}`);
  if (npsResult.status    === "rejected")
    erros.push(`NPS: ${(npsResult.reason as Error).message}`);
  if (googleResult.status === "rejected")
    erros.push(`Google: ${(googleResult.reason as Error).message}`);
  if (metasResult.status  === "rejected")
    erros.push(`Metas: ${(metasResult.reason as Error).message}`);
  // Expõe erro de faturamento apenas quando a fonte está configurada (aba faltando etc.)
  if (fonteFaturamento && fatResult.status === "rejected")
    erros.push(`Faturamento: ${(fatResult.reason as Error).message}`);

  // Leads: manual prevalece; caso contrário, tenta planilha
  let leads: ResultadoLeads | null = null;
  if (leadsManual) {
    leads = leadsFromManual(leadsManual);
  } else if (fonteLead) {
    leads = await coletarLeads(fonteLead, dataInicio, dataFim).catch((e: Error) => {
      erros.push(`Leads: ${e.message}`);
      return null;
    });
  }

  const dados = montarDadosImagem(
    clinica,
    pre,
    nps,
    google,
    metas,
    dataInicio,
    dataFim,
    leads,
    fatColetado?.total_faturado    ?? null,
    fatColetado?.por_categoria     ?? null,
  );

  return { dados, erros };
}

export async function salvarRelatorioImagem(params: {
  clinicaId: string;
  ini: string;
  fim: string;
  dados: RelatorioImagemData;
  relatorioId?: string;
}): Promise<{ id: string }> {
  const { clinicaId, ini, fim, dados, relatorioId } = params;
  const db = getSupabaseAdmin();

  if (relatorioId) {
    await db
      .from("relatorios_gerados")
      .update({ dados_json: dados as unknown as import("@/lib/supabase/types").Json })
      .eq("id", relatorioId);
    return { id: relatorioId };
  }

  const insert: RelatorioGeradoInsert = {
    clinica_id:  clinicaId,
    formato:     "imagem",
    data_inicio: ini,
    data_fim:    fim,
    dados_json:  dados as unknown as import("@/lib/supabase/types").Json,
  };

  const { data } = await db
    .from("relatorios_gerados")
    .insert(insert)
    .select("id")
    .single();

  return { id: data?.id ?? "" };
}
