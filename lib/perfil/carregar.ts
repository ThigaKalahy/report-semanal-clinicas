import { getSupabaseAdmin } from "@/lib/supabase/server";
import { normalizarFicha } from "./ficha";
import type { FichaCliente } from "./ficha";
import type { PerfilCliente, PerfilClienteInsert, Json } from "@/lib/supabase/types";

/** Linha do banco → ficha usada pela aplicação. */
export function linhaParaFicha(linha: PerfilCliente): FichaCliente {
  const vocab = linha.vocabulario;
  return normalizarFicha({
    cidade: linha.cidade,
    uf: linha.uf,
    segmentoTipo: linha.segmento_tipo ?? "",
    segmento: linha.segmento,
    especialidades: linha.especialidades,
    vocabulario:
      vocab && typeof vocab === "object" && !Array.isArray(vocab)
        ? (vocab as Record<string, string>)
        : {},
    porte: linha.porte ?? "",
    modelo: linha.modelo ?? "",
    perfil: linha.perfil,
    prioridades: linha.prioridades,
    pessoas: linha.pessoas,
    estilo: linha.estilo,
    evitar: linha.evitar,
    atualizadoEm: linha.updated_at,
  });
}

/** Ficha → linha pronta para upsert. */
export function fichaParaLinha(clinicaId: string, ficha: FichaCliente): PerfilClienteInsert {
  const f = normalizarFicha(ficha);
  return {
    clinica_id: clinicaId,
    cidade: f.cidade,
    uf: f.uf,
    segmento_tipo: f.segmentoTipo || null,
    segmento: f.segmento,
    especialidades: f.especialidades,
    vocabulario: f.vocabulario as unknown as Json,
    porte: f.porte || null,
    modelo: f.modelo || null,
    perfil: f.perfil,
    prioridades: f.prioridades,
    pessoas: f.pessoas,
    estilo: f.estilo,
    evitar: f.evitar,
  };
}

/**
 * Ficha da clínica, ou null quando ela ainda não tem uma.
 *
 * Nunca lança: o perfil é um enriquecimento dos textos, então uma falha aqui
 * (tabela ainda não criada, banco fora do ar) não pode derrubar a geração do
 * relatório — só faz valer o vocabulário neutro.
 */
export async function carregarFicha(clinicaId: string): Promise<FichaCliente | null> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("perfis_cliente")
      .select("*")
      .eq("clinica_id", clinicaId)
      .maybeSingle();
    if (error || !data) return null;
    return linhaParaFicha(data as PerfilCliente);
  } catch {
    return null;
  }
}
