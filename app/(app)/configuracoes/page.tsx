export const revalidate = 0;

import { redirect } from "next/navigation";

export default function ConfiguracoesPage() {
  redirect("/configuracoes/tipos-meta");
}
