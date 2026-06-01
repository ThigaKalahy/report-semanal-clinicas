"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { feriadoSchema } from "./_schemas";

// Feriados nacionais brasileiros 2026 e 2027
const FERIADOS_NACIONAIS = [
  // 2026
  { data: "2026-01-01", descricao: "Confraternização Universal", uf: null },
  { data: "2026-04-03", descricao: "Sexta-feira Santa", uf: null },
  { data: "2026-04-21", descricao: "Tiradentes", uf: null },
  { data: "2026-05-01", descricao: "Dia do Trabalho", uf: null },
  { data: "2026-06-04", descricao: "Corpus Christi", uf: null },
  { data: "2026-09-07", descricao: "Independência do Brasil", uf: null },
  { data: "2026-10-12", descricao: "Nossa Senhora Aparecida", uf: null },
  { data: "2026-11-02", descricao: "Finados", uf: null },
  { data: "2026-11-15", descricao: "Proclamação da República", uf: null },
  { data: "2026-11-20", descricao: "Consciência Negra", uf: null },
  { data: "2026-12-25", descricao: "Natal", uf: null },
  // 2027
  { data: "2027-01-01", descricao: "Confraternização Universal", uf: null },
  { data: "2027-03-26", descricao: "Sexta-feira Santa", uf: null },
  { data: "2027-04-21", descricao: "Tiradentes", uf: null },
  { data: "2027-05-01", descricao: "Dia do Trabalho", uf: null },
  { data: "2027-05-27", descricao: "Corpus Christi", uf: null },
  { data: "2027-09-07", descricao: "Independência do Brasil", uf: null },
  { data: "2027-10-12", descricao: "Nossa Senhora Aparecida", uf: null },
  { data: "2027-11-02", descricao: "Finados", uf: null },
  { data: "2027-11-15", descricao: "Proclamação da República", uf: null },
  { data: "2027-11-20", descricao: "Consciência Negra", uf: null },
  { data: "2027-12-25", descricao: "Natal", uf: null },
];

export async function importarFeriadosNacionais() {
  const db = getSupabaseAdmin();
  const { error } = await db
    .from("feriados")
    .upsert(FERIADOS_NACIONAIS, { onConflict: "data" });
  if (error) return { error: error.message };
  revalidatePath("/configuracoes/feriados");
  return { ok: true, count: FERIADOS_NACIONAIS.length };
}

export async function createFeriado(data: unknown) {
  const parsed = feriadoSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const db = getSupabaseAdmin();
  const { error } = await db.from("feriados").upsert(
    {
      data: parsed.data.data,
      descricao: parsed.data.descricao,
      uf: parsed.data.uf?.trim() || null,
    },
    { onConflict: "data" }
  );
  if (error) return { error: error.message };
  revalidatePath("/configuracoes/feriados");
  return { ok: true };
}

export async function deleteFeriado(data: string) {
  const db = getSupabaseAdmin();
  const { error } = await db.from("feriados").delete().eq("data", data);
  if (error) return { error: error.message };
  revalidatePath("/configuracoes/feriados");
  return { ok: true };
}
