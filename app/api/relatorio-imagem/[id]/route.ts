import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { InfograficoOG, INFOGRAFICO_SIZE } from "@/lib/relatorio/InfograficoOG";
import type { RelatorioImagemData } from "@/lib/relatorio/imagem-tipos";
import { checkRateLimit, rateLimitKey, tooManyRequests } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

// Infográfico quadrado (1:1) — mesma medida para largura e altura.
const SIZE = INFOGRAFICO_SIZE;

async function loadFonts() {
  const fontDir = join(process.cwd(), "public", "fonts");
  const names = [
    "Inter_28pt-Regular.ttf",
    "Inter_28pt-SemiBold.ttf",
    "Inter_28pt-ExtraBold.ttf",
  ];
  const buffers = await Promise.all(
    names.map(async (name) => {
      const path = join(fontDir, name);
      try {
        return await readFile(path);
      } catch {
        throw new Error(`Fonte nao encontrada: ${path}`);
      }
    })
  );
  return [
    { name: "Inter", data: buffers[0], weight: 400 as const, style: "normal" as const },
    { name: "Inter", data: buffers[1], weight: 600 as const, style: "normal" as const },
    { name: "Inter", data: buffers[2], weight: 800 as const, style: "normal" as const },
  ];
}

async function loadLogoSrc(): Promise<string | null> {
  try {
    const data = await readFile(join(process.cwd(), "public", "gestfy-logo.png"));
    return `data:image/png;base64,${data.toString("base64")}`;
  } catch {
    return null;
  }
}

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

    if (!dados.cabecalho || !dados.visaoGeral) {
      return errResp(`dados_json invalido (sem cabecalho/visaoGeral): ${JSON.stringify(dados).slice(0, 200)}`, 400);
    }

    const [fonts, logoSrc] = await Promise.all([loadFonts(), loadLogoSrc()]);

    return new ImageResponse(InfograficoOG({ dados, logoSrc, size: SIZE }), {
      width: SIZE,
      height: SIZE,
      fonts,
    });
  } catch (err: unknown) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error(`[relatorio-imagem] CRASH id=${id}`, e);
    return errResp(e.stack ?? e.message);
  }
}
