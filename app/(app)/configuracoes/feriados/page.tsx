import { getSupabaseAdmin } from "@/lib/supabase/server";
import { FeriadosClient } from "./_components/feriados-client";

export default async function FeriadosPage() {
  const db = getSupabaseAdmin();
  const { data: feriados } = await db
    .from("feriados")
    .select("*")
    .order("data", { ascending: true });

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <FeriadosClient feriados={feriados ?? []} />
    </div>
  );
}
