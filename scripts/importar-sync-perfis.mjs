// Importa os perfis de cliente raspados do Sync Financeiro (app do Fernando).
//
// Uso:
//   node scripts/importar-sync-perfis.mjs            → simula e mostra o que faria
//   node scripts/importar-sync-perfis.mjs --gravar   → grava de verdade
//
// Regras:
//   - casa as clínicas pelo NOME (sem acento nem caixa); os ids dos dois bancos são diferentes;
//   - nunca sobrescreve: clínica que já tem perfil no nosso banco é pulada;
//   - ficha sem nenhum conteúdo no Sync não vira linha vazia aqui.
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

const SEGMENTOS = ["clinica", "odontologia", "estetica", "varejo", "servicos", "outro"];
const PORTES = ["ate50", "50a150", "150a400", "400a1000", "acima1000"];
const MODELOS = ["particular", "convenio", "misto"];
const TERMOS = ["cliente", "clientes", "profissional", "profissionais", "servico", "servicos", "area", "areas", "saudacao"];
const corte = (v, n) => String(v ?? "").slice(0, n);

function paraLinha(clinicaId, f) {
  const vocabulario = {};
  for (const k of TERMOS) {
    const v = f.vocabulario?.[k];
    if (typeof v === "string" && v.trim()) vocabulario[k] = corte(v, 40).trim();
  }
  return {
    clinica_id: clinicaId,
    cidade: corte(f.cidade, 80).trim(),
    uf: corte(f.uf, 2).toUpperCase().replace(/[^A-Z]/g, ""),
    segmento_tipo: SEGMENTOS.includes(f.segmentoTipo) ? f.segmentoTipo : null,
    segmento: corte(f.segmento, 120),
    especialidades: corte(f.especialidades, 400),
    vocabulario,
    porte: PORTES.includes(f.porte) ? f.porte : null,
    modelo: MODELOS.includes(f.modelo) ? f.modelo : null,
    perfil: corte(f.perfil, 3000),
    prioridades: corte(f.prioridades, 3000),
    pessoas: corte(f.pessoas, 2000),
    estilo: corte(f.estilo, 1500),
    evitar: corte(f.evitar, 1500),
  };
}

const temConteudo = (l) =>
  Boolean(
    l.cidade || l.segmento_tipo || l.segmento || l.especialidades || l.porte || l.modelo ||
    l.perfil || l.prioridades || l.pessoas || l.estilo || l.evitar ||
    Object.keys(l.vocabulario).length,
  );

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
  existentes = await api("perfis_cliente?select=clinica_id");
} catch (e) {
  console.error("Não consegui ler o banco:", e.cause?.code ?? e.message);
  console.error("Confira se o projeto Supabase está ativo e se a migração 003 já foi rodada.");
  process.exit(1);
}

const porNome = new Map(clinicas.map((c) => [chaveNome(c.nome), c]));
const jaTem = new Set(existentes.map((e) => e.clinica_id));

console.log(GRAVAR ? "MODO GRAVAÇÃO\n" : "SIMULAÇÃO (use --gravar para gravar)\n");

let criados = 0;
for (const item of Object.values(bruto)) {
  const nome = item.perfil?.clinicaNome;
  const ficha = item.perfil?.inicial;
  if (!nome || !ficha) continue;

  const nossa = porNome.get(chaveNome(nome));
  if (!nossa) { console.log(`- ${nome}: sem clínica de mesmo nome no nosso banco — pulada`); continue; }
  if (jaTem.has(nossa.id)) { console.log(`- ${nome}: já tem perfil aqui — mantido o nosso`); continue; }

  const linha = paraLinha(nossa.id, ficha);
  if (!temConteudo(linha)) { console.log(`- ${nome}: ficha vazia no Sync — nada a importar`); continue; }

  const resumo = [
    linha.segmento_tipo && `segmento=${linha.segmento_tipo}`,
    linha.porte && `porte=${linha.porte}`,
    linha.modelo && `modelo=${linha.modelo}`,
    Object.keys(linha.vocabulario).length && `${Object.keys(linha.vocabulario).length} termos`,
    linha.perfil && `perfil ${linha.perfil.length}c`,
    linha.prioridades && `prioridades ${linha.prioridades.length}c`,
  ].filter(Boolean).join(", ");

  if (GRAVAR) {
    await api("perfis_cliente", { method: "POST", body: JSON.stringify(linha) });
    console.log(`+ ${nome}: importado (${resumo})`);
  } else {
    console.log(`+ ${nome}: seria importado (${resumo})`);
  }
  criados++;
}

console.log(`\n${criados} perfil(is) ${GRAVAR ? "importado(s)" : "a importar"}.`);
