import { ImageResponse } from "next/og";
import { CheckpointOG, CHECKPOINT_LARGURA, temConteudo } from "@/lib/checkpoint/CheckpointOG";
import type { CheckpointImagemData } from "@/lib/checkpoint/CheckpointOG";
import { loadFonts, loadLogoSrc } from "@/lib/relatorio/og-assets";
import { checkRateLimit, rateLimitKey, tooManyRequests } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

const W = CHECKPOINT_LARGURA;

// O checkpoint é um retrato do momento — não fica salvo em lugar nenhum. Por
// isso a imagem é gerada por POST, com os dados da tela no corpo, e devolvida
// direto como PNG, em vez de ser buscada por id como os relatórios.
const MAX_BODY = 512 * 1024;

function errResp(msg: string, status = 500) {
  return new Response(msg, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(rateLimitKey(req.headers))) return tooManyRequests();

  try {
    const bruto = await req.text();
    if (bruto.length > MAX_BODY) return errResp("Conteudo grande demais", 413);

    let dados: CheckpointImagemData;
    try {
      dados = JSON.parse(bruto) as CheckpointImagemData;
    } catch {
      return errResp("JSON invalido", 400);
    }

    if (!temConteudo(dados)) return errResp("Sem clinicas para gerar a imagem", 400);

    const [fonts, logoSrc] = await Promise.all([loadFonts(), loadLogoSrc()]);

    return new ImageResponse(CheckpointOG({ dados, logoSrc, largura: W }), {
      width: W,
      height: undefined,
      fonts,
    });
  } catch (err: unknown) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error("[checkpoint-imagem] CRASH", e);
    return errResp(e.stack ?? e.message);
  }
}
