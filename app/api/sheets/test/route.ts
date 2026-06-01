import { NextRequest, NextResponse } from "next/server";
import { getSheetsClient } from "@/lib/google/sheets";
import { checkRateLimit, rateLimitKey, tooManyRequests } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  if (!checkRateLimit(rateLimitKey(request.headers))) return tooManyRequests();

  let sheet_id: string, aba_nome: string;
  try {
    const body = await request.json();
    sheet_id = body.sheet_id ?? "";
    aba_nome = body.aba_nome ?? "";
  } catch {
    return NextResponse.json({ ok: false, erro: "Requisição inválida" }, { status: 400 });
  }

  if (!sheet_id || !aba_nome) {
    return NextResponse.json(
      { ok: false, erro: "sheet_id e aba_nome são obrigatórios" },
      { status: 400 }
    );
  }

  try {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheet_id,
      range: `${aba_nome}!A1:Z1`,
    });
    const primeira_linha = res.data.values?.[0] ?? [];
    return NextResponse.json({ ok: true, primeira_linha });
  } catch (err: unknown) {
    const e = err as { code?: number; status?: number; message?: string };
    const code = e.code ?? e.status;
    const msg = e.message ?? "";

    if (code === 404) {
      return NextResponse.json({
        ok: false,
        erro: "Planilha não encontrada. Verifique o sheet_id.",
      });
    }
    if (code === 403) {
      let clientEmail = "<email da service account>";
      try {
        const sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "{}");
        if (sa.client_email) clientEmail = sa.client_email;
      } catch { /* ignore */ }
      return NextResponse.json({
        ok: false,
        erro: `Sem permissão. Compartilhe a planilha com: ${clientEmail}`,
      });
    }
    if (msg.includes("Unable to parse range") || msg.includes("Requested entity was not found")) {
      return NextResponse.json({
        ok: false,
        erro: `Aba "${aba_nome}" não encontrada na planilha.`,
      });
    }

    return NextResponse.json({ ok: false, erro: msg || "Erro desconhecido" });
  }
}
