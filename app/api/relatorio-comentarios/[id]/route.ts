import { ImageResponse } from "next/og";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { ComentariosOG, COMENTARIOS_LARGURA, temComentarios } from "@/lib/relatorio/ComentariosOG";
import { loadFonts, loadLogoSrc } from "@/lib/relatorio/og-assets";
import type { RelatorioImagemData } from "@/lib/relatorio/imagem-tipos";
import { checkRateLimit, rateLimitKey, tooManyRequests } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

// Página 2 do infográfico: feedbacks dos pacientes. Mesma largura da página 1,
// altura resolvida pelo Satori a partir do conteúdo.
const W = COMENTARIOS_LARGURA;

function errResp(msg: string, status = 500) {
  return new Response(msg, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkRateLimit(rateLimitKey(_req.headers))) return tooManyRequests();

  let id = "(desconhecido)";
  try {
    id = (await params).id;

    const db = getSupabaseAdmin();
    const { data: relatorio, error } = await db
      .from("relatorios_gerados")
      .select("*")
      .eq("id", id)
      .eq("formato", "imagem")
      .single();

    if (error || !relatorio) {
      return errResp(`Relatorio nao encontrado: id=${id}`, 404);
    }

    if (!relatorio.dados_json) {
      return errResp(`dados_json e nulo para id=${id}`, 400);
    }

    const dados = relatorio.dados_json as unknown as RelatorioImagemData;

    if (!temComentarios(dados)) {
      return errResp(`Sem comentarios para gerar a pagina de feedbacks: id=${id}`, 404);
    }

    const [fonts, logoSrc] = await Promise.all([loadFonts(), loadLogoSrc()]);

    return new ImageResponse(ComentariosOG({ dados, logoSrc, largura: W }), {
      width: W,
      height: undefined,
      fonts,
    });
  } catch (err: unknown) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error(`[relatorio-comentarios] CRASH id=${id}`, e);
    return errResp(e.stack ?? e.message);
  }
}
