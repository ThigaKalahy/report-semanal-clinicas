"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { coletarFechamento } from "@/lib/fechamento/coletar";
import { periodoDe, dataISO } from "@/lib/fechamento/periodo";
import type { TipoFechamento, Quinzena } from "@/lib/fechamento/periodo";
import { montarTextoFechamento } from "@/lib/fechamento/secoes";
import type { AcaoPlano } from "@/lib/fechamento/secoes";
import type { DadosFechamento, DecisaoAlerta } from "@/lib/fechamento/dados";
import { aplicarMeta, chaveDoAlerta } from "@/lib/fechamento/dados";
import { lerAnalise, escreverAnalise } from "@/lib/fechamento/analise";
import { carregarEstrutura } from "@/lib/estrutura/carregar";
import { carregarFicha } from "@/lib/perfil/carregar";
import { contextoDaFicha } from "@/lib/perfil/ficha";
import { vocabularioDe } from "@/lib/perfil/vocabulario";
import { callGemini } from "@/lib/ia/gemini";
import { SYSTEM_PROMPT } from "@/lib/ia/montar-contexto";
import type { Json, StatusFechamento } from "@/lib/supabase/types";

type Resposta<T = object> = ({ ok: true } & T) | { ok: false; erro: string };

const erroDe = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado.");

/** Limpa o plano de ação vindo do navegador. */
function limparAcoes(acoes: unknown): AcaoPlano[] {
  if (!Array.isArray(acoes)) return [];
  return acoes
    .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
    .map((a) => ({
      texto: String(a.texto ?? "").slice(0, 300),
      responsavel: String(a.responsavel ?? "").slice(0, 160),
      prazo: String(a.prazo ?? "").slice(0, 40),
      descricao: String(a.descricao ?? "").slice(0, 600),
      indicador: String(a.indicador ?? "").slice(0, 300),
    }))
    .filter((a) => a.texto.trim())
    .slice(0, 30);
}

export async function criarFechamento(p: {
  clinicaId: string;
  tipo: TipoFechamento;
  ano: number;
  mes: number;
  quinzena?: Quinzena | null;
}): Promise<Resposta<{ id: string; jaExistia: boolean }>> {
  try {
    if (!Number.isInteger(p.ano) || !Number.isInteger(p.mes) || p.mes < 1 || p.mes > 12) {
      return { ok: false, erro: "Período inválido." };
    }
    const periodo = periodoDe(p.tipo, p.ano, p.mes, p.quinzena);
    const db = getSupabaseAdmin();

    let busca = db.from("fechamentos").select("id")
      .eq("clinica_id", p.clinicaId).eq("tipo", periodo.tipo).eq("ano", periodo.ano).eq("mes", periodo.mes);
    busca = periodo.quinzena === null ? busca.is("quinzena", null) : busca.eq("quinzena", periodo.quinzena);
    const { data: existente } = await busca.maybeSingle();
    if (existente) return { ok: true, id: existente.id, jaExistia: true };

    // Lê antes de gravar: se a clínica não existir ou a leitura quebrar por inteiro, nada é criado
    const dados = await coletarFechamento(p.clinicaId, periodo);

    const { data, error } = await db.from("fechamentos").insert({
      clinica_id: p.clinicaId,
      tipo: periodo.tipo,
      ano: periodo.ano,
      mes: periodo.mes,
      quinzena: periodo.quinzena,
      data_inicio: dataISO(periodo.inicio),
      data_fim: dataISO(periodo.fim),
      dados: dados as unknown as Json,
      lido_em: dados.lidoEm,
    }).select("id").single();
    if (error || !data) return { ok: false, erro: error?.message ?? "Não foi possível criar o fechamento." };

    revalidatePath("/fechamentos");
    return { ok: true, id: data.id, jaExistia: false };
  } catch (e) {
    return { ok: false, erro: erroDe(e) };
  }
}

async function carregar(id: string) {
  const { data } = await getSupabaseAdmin().from("fechamentos").select("*").eq("id", id).maybeSingle();
  return data;
}

const CONGELADO = "Este fechamento está concluído: os números, o texto e o plano ficam congelados. Reabra para alterar.";
const congelado = (status: StatusFechamento) => status === "concluido" || status === "enviado";

/** Relê as planilhas e substitui o retrato. Análise e plano de ação são mantidos. */
export async function lerDeNovo(id: string): Promise<Resposta<{ dados: DadosFechamento }>> {
  const h = await headers();
  if (!checkRateLimit(rateLimitKey(h), 10)) return { ok: false, erro: "Limite de leituras atingido. Aguarde 1 minuto." };
  try {
    const f = await carregar(id);
    if (!f) return { ok: false, erro: "Fechamento não encontrado." };
    if (congelado(f.status)) return { ok: false, erro: CONGELADO };
    const periodo = periodoDe(f.tipo, f.ano, f.mes, f.quinzena as Quinzena | null);
    let dados = await coletarFechamento(f.clinica_id, periodo);
    // o que a pessoa decidiu continua valendo: meta ajustada e decisões da conferência
    const antes = f.dados as unknown as DadosFechamento | null;
    if (antes?.metaOriginal !== undefined && antes.meta) dados = aplicarMeta(dados, antes.meta);
    if (antes?.decisoes?.length) dados = { ...dados, decisoes: antes.decisoes };
    const { error } = await getSupabaseAdmin().from("fechamentos")
      .update({ dados: dados as unknown as Json, lido_em: dados.lidoEm }).eq("id", id);
    if (error) return { ok: false, erro: error.message };
    revalidatePath(`/fechamentos/${id}`);
    revalidatePath("/fechamentos");
    return { ok: true, dados };
  } catch (e) {
    return { ok: false, erro: erroDe(e) };
  }
}

export async function salvarAnalise(id: string, analise: string, acoes: AcaoPlano[]): Promise<Resposta> {
  const f = await carregar(id);
  if (!f) return { ok: false, erro: "Fechamento não encontrado." };
  if (congelado(f.status)) return { ok: false, erro: CONGELADO };
  // normaliza os blocos (observação, destaques, comercial, atenção, contexto)
  const texto = escreverAnalise(lerAnalise(String(analise ?? ""))).slice(0, 12000);
  const { error } = await getSupabaseAdmin().from("fechamentos")
    .update({ analise: texto, acoes: limparAcoes(acoes) as unknown as Json })
    .eq("id", id);
  if (error) return { ok: false, erro: error.message };
  revalidatePath(`/fechamentos/${id}`);
  return { ok: true };
}

/** Registra (ou desfaz, com acao = null) a decisão sobre um alerta da conferência. */
export async function decidirAlerta(
  id: string, alerta: { area: string; titulo: string }, acao: DecisaoAlerta["acao"] | null,
): Promise<Resposta<{ dados: DadosFechamento }>> {
  const f = await carregar(id);
  if (!f?.dados) return { ok: false, erro: "Fechamento não encontrado." };
  if (congelado(f.status)) return { ok: false, erro: CONGELADO };
  const dados = f.dados as unknown as DadosFechamento;
  const chave = chaveDoAlerta(alerta);
  const resto = (dados.decisoes ?? []).filter((x) => x.chave !== chave);
  const decisoes = acao
    ? [...resto, { chave, acao, titulo: String(alerta.titulo).slice(0, 200), em: new Date().toISOString() }]
    : resto;
  const novo = { ...dados, decisoes };
  const { error } = await getSupabaseAdmin().from("fechamentos").update({ dados: novo as unknown as Json }).eq("id", id);
  if (error) return { ok: false, erro: error.message };
  return { ok: true, dados: novo };
}

/** Meta só deste fechamento (null volta à meta cadastrada). Refaz o ritmo sem reler planilha. */
export async function salvarMeta(id: string, meta: number | null): Promise<Resposta<{ dados: DadosFechamento }>> {
  if (meta !== null && (!isFinite(meta) || meta < 0 || meta > 1e10)) return { ok: false, erro: "Meta inválida." };
  const f = await carregar(id);
  if (!f?.dados) return { ok: false, erro: "Fechamento não encontrado." };
  if (congelado(f.status)) return { ok: false, erro: CONGELADO };
  const novo = aplicarMeta(f.dados as unknown as DadosFechamento, meta);
  const { error } = await getSupabaseAdmin().from("fechamentos").update({ dados: novo as unknown as Json }).eq("id", id);
  if (error) return { ok: false, erro: error.message };
  revalidatePath(`/fechamentos/${id}`);
  return { ok: true, dados: novo };
}

const STATUS: StatusFechamento[] = ["em_conferencia", "em_analise", "concluido", "enviado"];

export async function mudarStatus(id: string, status: StatusFechamento): Promise<Resposta<{ enviadoEm: string | null }>> {
  if (!STATUS.includes(status)) return { ok: false, erro: "Estado inválido." };
  const enviadoEm = status === "enviado" ? new Date().toISOString() : null;
  const { error } = await getSupabaseAdmin().from("fechamentos")
    .update({ status, enviado_em: enviadoEm }).eq("id", id);
  if (error) return { ok: false, erro: error.message };
  revalidatePath(`/fechamentos/${id}`);
  revalidatePath("/fechamentos");
  return { ok: true, enviadoEm };
}

/** Monta o texto de entrega a partir do retrato e da estrutura da clínica, e o salva. */
export async function gerarTexto(id: string): Promise<Resposta<{ texto: string }>> {
  try {
    const f = await carregar(id);
    if (!f) return { ok: false, erro: "Fechamento não encontrado." };
    // concluído sem texto (ex.: importado do Sync): pode gerar uma vez, a partir dos números congelados
    if (congelado(f.status) && f.texto?.trim()) return { ok: false, erro: CONGELADO };
    if (!f.dados) return { ok: false, erro: "Este fechamento ainda não tem leitura. Leia as planilhas primeiro." };
    const db = getSupabaseAdmin();
    const [{ data: clinica }, { estrutura }, ficha] = await Promise.all([
      db.from("clinicas").select("nome").eq("id", f.clinica_id).single(),
      carregarEstrutura(f.clinica_id),
      carregarFicha(f.clinica_id),
    ]);
    const texto = montarTextoFechamento(
      clinica?.nome ?? "", f.dados as unknown as DadosFechamento, estrutura[f.tipo],
      { vocabulario: vocabularioDe(ficha), analise: f.analise, acoes: limparAcoes(f.acoes) },
    );
    const { error } = await db.from("fechamentos").update({ texto }).eq("id", id);
    if (error) return { ok: false, erro: error.message };
    return { ok: true, texto };
  } catch (e) {
    return { ok: false, erro: erroDe(e) };
  }
}

export async function salvarTexto(id: string, texto: string): Promise<Resposta> {
  const f = await carregar(id);
  if (!f) return { ok: false, erro: "Fechamento não encontrado." };
  if (congelado(f.status)) return { ok: false, erro: CONGELADO };
  const { error } = await getSupabaseAdmin().from("fechamentos")
    .update({ texto: String(texto ?? "").slice(0, 20000) }).eq("id", id);
  return error ? { ok: false, erro: error.message } : { ok: true };
}

export async function excluirFechamento(id: string): Promise<Resposta> {
  const { error } = await getSupabaseAdmin().from("fechamentos").delete().eq("id", id);
  if (error) return { ok: false, erro: error.message };
  revalidatePath("/fechamentos");
  return { ok: true };
}

/**
 * Rascunho de análise pela IA. Ela recebe o próprio texto do fechamento (números
 * já calculados) e o perfil do cliente; devolve leitura, alertas e ações — que
 * a pessoa revisa antes de salvar. Nada é gravado aqui.
 */
export async function sugerirAnalise(id: string): Promise<Resposta<{ analise: string; acoes: AcaoPlano[] }>> {
  const h = await headers();
  if (!checkRateLimit(rateLimitKey(h), 10)) return { ok: false, erro: "Limite de requisições atingido. Aguarde 1 minuto." };
  try {
    const f = await carregar(id);
    if (!f?.dados) return { ok: false, erro: "Este fechamento ainda não tem leitura." };
    const db = getSupabaseAdmin();
    const [{ data: clinica }, { estrutura }, ficha] = await Promise.all([
      db.from("clinicas").select("nome").eq("id", f.clinica_id).single(),
      carregarEstrutura(f.clinica_id),
      carregarFicha(f.clinica_id),
    ]);
    // Todas as seções com dado entram no contexto, mesmo as desligadas no relatório
    const lista = estrutura[f.tipo].map((s) => ({ ...s, ativa: s.id !== "analise" }));
    const numeros = montarTextoFechamento(clinica?.nome ?? "", f.dados as unknown as DadosFechamento, lista, {
      vocabulario: vocabularioDe(ficha),
    });
    const contexto = [
      `DADOS DO FECHAMENTO (${f.tipo}):`, numeros, contextoDaFicha(ficha),
    ].filter(Boolean).join("\n\n");

    const s = await callGemini(SYSTEM_PROMPT, contexto);
    // a observação e o contexto ficam com o que já foi escrito; a IA preenche destaques e atenção
    const atual = lerAnalise(f.analise);
    const analise = escreverAnalise({
      ...atual,
      destaques: s.destaques.map((d) => `- ${d.texto}`).join("\n") || atual.destaques,
      atencao: s.alertas.map((a) => `- ${a}`).join("\n") || atual.atencao,
    });
    return {
      ok: true,
      analise,
      acoes: s.acoes.map((texto) => ({ texto, responsavel: "", prazo: "", descricao: "", indicador: "" })),
    };
  } catch (e) {
    return { ok: false, erro: erroDe(e) };
  }
}
