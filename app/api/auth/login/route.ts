import { NextRequest, NextResponse } from "next/server";
import { createAuthToken, COOKIE_NAME } from "@/lib/auth";

export async function POST(request: NextRequest) {
  let password: string;
  try {
    const body = await request.json();
    password = body.password ?? "";
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword || password !== appPassword) {
    return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
  }

  const token = await createAuthToken(appPassword);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
  });
  return response;
}
