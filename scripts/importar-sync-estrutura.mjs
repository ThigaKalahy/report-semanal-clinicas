// Importa a estrutura do relatório (mensal e quinzenal) de cada cliente do
// Sync Financeiro (app do Fernando).
//
// Uso:
//   node scripts/importar-sync-estrutura.mjs            → simula e mostra o que faria
//   node scripts/importar-sync-estrutura.mjs --gravar   → grava de verdade
//
// Regras:
//   - casa as clínicas pelo NOME (sem acento nem caixa); os ids dos dois bancos são diferentes;
//   - nunca sobrescreve: clínica que já tem estrutura salva aqui é pulada;
//   - cliente que no Sync estava na estrutura padrão não vira linha — aqui o padrão
//     já é o mesmo, e sem linha a clínica acompanha o padrão se ele evoluir;
//   - o semanal não existe no Sync: fica no padrão deste app;
//   - o app valida tudo de novo ao ler (lib/estrutura/estrutura.ts), então um id
//     desconhecido que passe por aqui é descartado lá, sem quebrar nada.
//
// Entrada: .import-sync/configurar-bruto.json (fora do git — contém dados de clientes).

import { readFileSync } from "node:fs";

const GRAVAR = process.argv.includes("--gravar");

for (const linha of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = linha.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !CHAVE) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local");
  process.exit(1);
}
const H = { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, "Content-Type": "application/json" };

const chaveNome = (s) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// Estrutura padrão do Sync — a mesma de lib/estrutura/catalogo.ts
const PADRAO = {
  mensal: [
    { id: "resultado", ativa: true }, { id: "grafico", ativa: true },
    { id: "funilLeads", ativa: true, nivel: "completo" }, { id: "funilOrcamentos", ativa: true, nivel: "completo" },
    { id: "experiencia", ativa: true }, { id: "receitas", ativa: true, nivel: "todas" },
    { id: "distribuicao", ativa: false }, { id: "despesas", ativa: true, nivel: "categorias" },
    { id: "entradas", ativa: true, nivel: "categorias" }, { id: "regimes", ativa: true, nivel: "ambos" },
    { id: "analise", ativa: false },
  ],
  quinzenal: [
    { id: "resultado", ativa: true }, { id: "ritmo", ativa: true }, { id: "caixaMes", ativa: true },
    { id: "funilLeads", ativa: true, nivel: "resumo" }, { id: "funilOrcamentos", ativa: true, nivel: "resumo" },
    { id: "receitas", ativa: true, nivel: "todas" }, { id: "analise", ativa: false },
  ],
};

/** Mantém só os campos que o app conhece, em ordem estável (para comparar). */
function limparLista(lista) {
  if (!Array.isArray(lista)) return [];
  return lista
    .filter((i) => i && typeof i.id === "string")
    .map((i) => {
      const item = { id: i.id, ativa: i.ativa !== false };
      if (typeof i.nivel === "string" && i.nivel) item.nivel = i.nivel;
      if (Array.isArray(i.ocultos)) item.ocultos = i.ocultos.filter((o) => typeof o === "string");
      return item;
    });
}

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Em palavras, o que difere do padrão. */
function diferencas(tipo, lista) {
  const padrao = PADRAO[tipo];
  const notas = [];
  if (!igual(lista.map((i) => i.id), padrao.map((i) => i.id))) notas.push("ordem");
  for (const item of lista) {
    const p = padrao.find((x) => x.id === item.id);
    if (!p) { notas.push(`${item.id} (seção fora do padrão)`); continue; }
    if (item.ativa !== p.ativa) notas.push(`${item.id} ${item.ativa ? "ligada" : "desligada"}`);
    if ((item.nivel ?? "") !== (p.nivel ?? "")) notas.push(`${item.id} nível ${item.nivel}`);
    if (item.ocultos?.length) notas.push(`${item.id} oculta ${item.ocultos.join(", ")}`);
  }
  return notas;
}

async function api(caminho, init) {
  const r = await fetch(`${URL_BASE}/rest/v1/${caminho}`, { headers: H, ...init });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${r.status} em ${caminho}: ${texto.slice(0, 200)}`);
  return texto ? JSON.parse(texto) : null;
}

const bruto = JSON.parse(readFileSync(".import-sync/configurar-bruto.json", "utf8"));

let clinicas, existentes;
try {
  clinicas = await api("clinicas?select=id,nome");
} catch (e) {
  console.error("Não consegui ler o banco:", e.cause?.code ?? e.message);
  console.error("Confira se o projeto Supabase está ativo.");
  process.exit(1);
}
try {
  existentes = await api("estruturas_relatorio?select=clinica_id");
} catch (e) {
  if (GRAVAR) {
    console.error("A tabela estruturas_relatorio não respondeu:", e.message);
    console.error("Rode antes a migração supabase/migrations/004_estruturas_relatorio.sql.");
    process.exit(1);
  }
  // Na simulação dá para seguir: sem a tabela, nenhuma clínica tem estrutura salva
  console.log("AVISO: a tabela estruturas_relatorio ainda não existe (migração 004 pendente).\n");
  existentes = [];
}

const porNome = new Map(clinicas.map((c) => [chaveNome(c.nome), c]));
const jaTem = new Set(existentes.map((e) => e.clinica_id));

console.log(GRAVAR ? "MODO GRAVAÇÃO\n" : "SIMULAÇÃO (use --gravar para gravar)\n");

let criados = 0;
for (const item of Object.values(bruto)) {
  const nome = item.perfil?.clinicaNome;
  const comp = (item.componentes ?? []).find((c) => c?.inicial?.mensal || c?.inicial?.quinzenal);
  if (!nome || !comp) continue;

  const mensal = limparLista(comp.inicial.mensal);
  const quinzenal = limparLista(comp.inicial.quinzenal);

  // Seções e fontes personalizadas (com fórmula) ficam para o bloco de extras
  const personalizadas = (comp.inicial.secoes?.length ?? 0) + (comp.extrasFontes?.length ?? 0);
  const aviso = personalizadas ? ` [tem ${personalizadas} seção/fonte personalizada — não importada neste bloco]` : "";

  const nossa = porNome.get(chaveNome(nome));
  if (!nossa) { console.log(`- ${nome}: sem clínica de mesmo nome no nosso banco — pulada${aviso}`); continue; }
  if (jaTem.has(nossa.id)) { console.log(`- ${nome}: já tem estrutura aqui — mantida a nossa${aviso}`); continue; }

  const notas = [
    ...diferencas("mensal", mensal).map((n) => `mensal: ${n}`),
    ...diferencas("quinzenal", quinzenal).map((n) => `quinzenal: ${n}`),
  ];
  if (notas.length === 0) { console.log(`- ${nome}: estrutura padrão no Sync — nada a importar${aviso}`); continue; }

  if (GRAVAR) {
    await api("estruturas_relatorio", {
      method: "POST",
      body: JSON.stringify({ clinica_id: nossa.id, config: { mensal, quinzenal } }),
    });
    console.log(`+ ${nome}: importada${aviso}`);
  } else {
    console.log(`+ ${nome}: seria importada${aviso}`);
  }
  for (const n of notas) console.log(`    ${n}`);
  criados++;
}

console.log(`\n${criados} estrutura(s) ${GRAVAR ? "importada(s)" : "a importar"}.`);
