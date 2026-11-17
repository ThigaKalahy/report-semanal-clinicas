// Importa as fontes de dados que os clientes têm no Sync Financeiro (app do
// Fernando) e que ainda não existem aqui.
//
// Uso:
//   node scripts/importar-sync-fontes.mjs            → simula e mostra o que faria
//   node scripts/importar-sync-fontes.mjs --gravar   → grava de verdade
//
// Regras:
//   - casa as clínicas pelo NOME (sem acento nem caixa);
//   - nunca sobrescreve: se a clínica já tem aquela fonte aqui, a nossa fica como está;
//   - as colunas são reconhecidas pelo cabeçalho da planilha, com a MESMA detecção
//     do formulário de fontes; os ajustes manuais feitos no Sync valem por cima;
//   - despesa: a data é a de VENCIMENTO (regra Gestfy). No Sync era a de pagamento,
//     que aqui vira a coluna opcional "data de pagamento";
//   - Vendas e Despesas do Sync ficam em uma aba só: entram como "aba única";
//   - planilha que a conta de serviço não consegue abrir, ou fonte sem coluna
//     obrigatória, é pulada e listada no fim — nada é gravado pela metade.
//
// Entrada: .import-sync/configurar-bruto.json (fora do git — contém dados de clientes).
// Requer Node 24+ (importa a detecção direto do .ts).

import { readFileSync } from "node:fs";
import { google } from "googleapis";
import { detectarPorTipo } from "../lib/fontes/detectar-colunas.ts";

const GRAVAR = process.argv.includes("--gravar");

for (const linha of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = linha.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !CHAVE || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / GOOGLE_SERVICE_ACCOUNT_JSON no .env.local");
  process.exit(1);
}
const H = { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, "Content-Type": "application/json" };
const credenciais = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
const planilhas = google.sheets({
  version: "v4",
  auth: new google.auth.GoogleAuth({ credentials: credenciais, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] }),
});

const chaveNome = (s) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(caminho, init) {
  const r = await fetch(`${URL_BASE}/rest/v1/${caminho}`, { headers: H, ...init });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${r.status} em ${caminho}: ${texto.slice(0, 200)}`);
  return texto ? JSON.parse(texto) : null;
}

/**
 * Para cada fonte do Sync: o tipo daqui, se usa aba única, as colunas
 * obrigatórias e como os nomes de campo de lá viram os daqui.
 */
const FONTES = {
  vendas: {
    tipo: "faturamento", rotulo: "Vendas", abaUnica: true, obrigatorias: ["coluna_data", "valor_pago", "categoria"],
    de: { data: "coluna_data", valor: "valor_pago", grupo: "categoria", profissional: "profissional",
      paciente: "paciente", primeiraVez: "primeira_vez", pagamento: "pagamento", unidade: "unidade" },
  },
  despesas: {
    tipo: "despesa", rotulo: "Despesas", abaUnica: true, obrigatorias: ["coluna_data", "valor_pago", "categoria"],
    de: { dataVencimento: "coluna_data", dataPagamento: "data_pagamento", valor: "valor_pago", categoria: "categoria",
      pago: "situacao", periodicidade: "periodicidade", competencia: "competencia", centroCusto: "centro_custo",
      descricao: "descricao" },
  },
  leads: {
    tipo: "leads", rotulo: "Leads", obrigatorias: ["coluna_data"],
    de: { data: "coluna_data", status: "convertido", origem: "origem", canal: "canal", interesse: "interesse",
      objecao: "objecao", responsavel: "responsavel" },
  },
  nps: {
    tipo: "nps", rotulo: "NPS", obrigatorias: ["coluna_data", "nota_geral"],
    // no Sync, "indicacao" é a nota de 0 a 10 (quanto indicaria)
    de: { data: "coluna_data", indicacao: "nota_geral", profissional: "nota_profissional", recepcao: "nota_recepcao",
      infraestrutura: "nota_infraestrutura", enfermagem: "nota_enfermagem" },
  },
  entradas: {
    tipo: "entradas", rotulo: "Entradas", obrigatorias: ["coluna_data", "valor"],
    de: { data: "coluna_data", valor: "valor", situacao: "situacao", categoria: "categoria", forma: "forma",
      competencia: "competencia", descricao: "descricao" },
  },
  orcamentos: {
    tipo: "orcamentos", rotulo: "Orçamentos", obrigatorias: ["coluna_data", "status"],
    de: { data: "coluna_data", status: "status", paciente: "paciente", profissional: "profissional",
      prescricao: "prescricao", valorVenda: "valor_venda", valorPrescricao: "valor_prescricao", objecao: "objecao" },
  },
};

async function cabecalhoDe(sheetId, aba) {
  const r = await planilhas.spreadsheets.values.get({
    spreadsheetId: sheetId, range: `'${aba.replace(/'/g, "''")}'!A1:AZ1`,
  });
  return r.data.values?.[0] ?? [];
}

const bruto = JSON.parse(readFileSync(".import-sync/configurar-bruto.json", "utf8"));
let clinicas, existentes;
try {
  clinicas = await api("clinicas?select=id,nome");
  existentes = await api("fontes_dados?select=id,clinica_id,tipo,sheet_id,aba_nome,coluna_data,mapeamento");
} catch (e) {
  console.error("Não consegui ler o banco:", e.cause?.code ?? e.message);
  process.exit(1);
}
const porNome = new Map(clinicas.map((c) => [chaveNome(c.nome), c]));
const jaTem = new Set(existentes.map((e) => `${e.clinica_id}:${e.tipo}`));

console.log(GRAVAR ? "MODO GRAVAÇÃO\n" : "SIMULAÇÃO (use --gravar para gravar)\n");

// --completar: nas fontes que JÁ existem aqui e usam a MESMA planilha do Sync,
// preenche só o que está vazio — colunas opcionais sem letra (paciente, 1ª vez…)
// e a aba única como alternativa para os meses sem aba mensal. Nada preenchido muda.
if (process.argv.includes("--completar")) {
  let mudadas = 0;
  for (const item of Object.values(bruto)) {
    const nome = item.perfil?.clinicaNome;
    const padrao = item.componentes?.[0]?.padraoInicial ?? {};
    const nossa = nome && porNome.get(chaveNome(nome));
    if (!nossa) continue;
    for (const [chave, fonteSync] of Object.entries(padrao)) {
      const def = FONTES[chave];
      if (!def || !fonteSync?.sheetId) continue;
      const aqui = existentes.find((e) => e.clinica_id === nossa.id && e.tipo === def.tipo);
      if (!aqui) continue;
      if (aqui.sheet_id !== fonteSync.sheetId) {
        console.log(`${nome} · ${def.rotulo}: planilha diferente da do Sync — mantida como está`);
        continue;
      }
      const mapa = { ...(aqui.mapeamento ?? {}) };
      const novidades = [];
      for (const [campoSync, letra] of Object.entries(fonteSync.colunas ?? {})) {
        let nosso = def.de[campoSync];
        if (!nosso || nosso === "coluna_data" || !/^[A-Z]+$/.test(String(letra))) continue;
        if (def.tipo === "despesa" && nosso === "data_pagamento" && letra === aqui.coluna_data) continue;
        if (typeof mapa[nosso] === "string" && mapa[nosso].trim()) continue; // já preenchido aqui
        mapa[nosso] = letra;
        novidades.push(`${nosso} ${letra}`);
      }
      const temAbaMes = mapa.abas_mensais && Object.keys(mapa.abas_mensais).length > 0;
      if (def.abaUnica && fonteSync.aba && !String(mapa.aba_base ?? "").trim() && temAbaMes) {
        mapa.aba_base = fonteSync.aba;
        novidades.push(`aba única "${fonteSync.aba}" para os meses sem aba`);
      }
      if (!novidades.length) continue;
      if (GRAVAR) await api(`fontes_dados?id=eq.${aqui.id}`, { method: "PATCH", body: JSON.stringify({ mapeamento: mapa }) });
      console.log(`${nome} · ${def.rotulo}: ${GRAVAR ? "completada" : "seria completada"} com ${novidades.join(", ")}`);
      mudadas++;
    }
  }
  console.log(`\n${mudadas} fonte(s) ${GRAVAR ? "completada(s)" : "a completar"}.`);
  process.exit(0);
}

let criadas = 0;
const semAcesso = [];
const incompletas = [];

for (const item of Object.values(bruto)) {
  const nome = item.perfil?.clinicaNome;
  const padrao = item.componentes?.[0]?.padraoInicial ?? {};
  if (!nome || Object.keys(padrao).length === 0) continue;

  const nossa = porNome.get(chaveNome(nome));
  if (!nossa) { console.log(`- ${nome}: sem clínica de mesmo nome no nosso banco — pulada`); continue; }
  console.log(nome);

  for (const [chave, fonteSync] of Object.entries(padrao)) {
    const def = FONTES[chave];
    if (!def || !fonteSync?.sheetId || !fonteSync?.aba) continue;
    if (jaTem.has(`${nossa.id}:${def.tipo}`)) { console.log(`  - ${def.rotulo}: já temos — mantida a nossa`); continue; }

    let cabecalho;
    try {
      cabecalho = await cabecalhoDe(fonteSync.sheetId, fonteSync.aba);
      await espera(700); // respeita a cota de leitura do Google
    } catch (e) {
      const motivo = /permission/i.test(e.message) ? "sem permissão de leitura" : e.message.slice(0, 90);
      console.log(`  ! ${def.rotulo}: não abriu a planilha (${motivo}) — pulada`);
      semAcesso.push({ clinica: nome, fonte: def.rotulo, sheetId: fonteSync.sheetId, aba: fonteSync.aba, motivo });
      continue;
    }

    // 1) detecção pelo cabeçalho  2) ajustes manuais do Sync por cima
    const colunas = Object.fromEntries(Object.entries(detectarPorTipo(def.tipo, cabecalho)).map(([k, v]) => [k, v.letra]));
    const aproximadas = Object.entries(detectarPorTipo(def.tipo, cabecalho)).filter(([, v]) => !v.exata).map(([k]) => k);
    for (const [campoSync, letra] of Object.entries(fonteSync.colunas ?? {})) {
      const nosso = def.de[campoSync];
      if (nosso && /^[A-Z]+$/.test(String(letra))) colunas[nosso] = letra;
    }
    // Despesa sem coluna de vencimento: a data de pagamento é a única data que existe
    if (def.tipo === "despesa" && !colunas.coluna_data && colunas.data_pagamento) {
      colunas.coluna_data = colunas.data_pagamento;
      delete colunas.data_pagamento;
    }
    if (def.tipo === "despesa" && colunas.coluna_data === colunas.data_pagamento) delete colunas.data_pagamento;

    const faltando = def.obrigatorias.filter((c) => !colunas[c]);
    if (faltando.length > 0) {
      console.log(`  ! ${def.rotulo}: coluna obrigatória não encontrada (${faltando.join(", ")}) — pulada`);
      incompletas.push({ clinica: nome, fonte: def.rotulo, faltando, cabecalho: cabecalho.slice(0, 20).join(" | ") });
      continue;
    }

    const { coluna_data, ...mapeamento } = colunas;
    if (def.tipo === "leads") mapeamento.valor_conversao = "sim";
    if (def.abaUnica) { mapeamento.aba_base = fonteSync.aba; mapeamento.abas_mensais = {}; }
    const linha = {
      clinica_id: nossa.id, tipo: def.tipo, sheet_id: fonteSync.sheetId,
      aba_nome: def.abaUnica ? "" : fonteSync.aba, coluna_data, mapeamento, ativo: true,
    };

    const resumo = [`aba "${fonteSync.aba}"`, `data ${coluna_data}`,
      ...Object.entries(mapeamento).filter(([, v]) => typeof v === "string" && /^[A-Z]+$/.test(v)).map(([k, v]) => `${k} ${v}`)].join(", ");
    if (GRAVAR) await api("fontes_dados", { method: "POST", body: JSON.stringify(linha) });
    console.log(`  + ${def.rotulo}: ${GRAVAR ? "criada" : "seria criada"} (${resumo})`);
    if (aproximadas.length) console.log(`      reconhecidas por aproximação — confira: ${aproximadas.join(", ")}`);
    if (def.tipo === "leads") console.log(`      confira na fonte o texto que indica conversão (ficou "sim")`);
    if (def.tipo === "orcamentos") console.log(`      rode "Testar leitura" e ensine as palavras de status que ficarem sem classificação`);
    criadas++;
  }
}

console.log(`\n${criadas} fonte(s) ${GRAVAR ? "criada(s)" : "a criar"}.`);
if (semAcesso.length) {
  console.log(`\n${semAcesso.length} planilha(s) que a conta de serviço não abre. Compartilhe com ${credenciais.client_email} (leitor) e rode de novo:`);
  for (const s of semAcesso) console.log(`  - ${s.clinica} · ${s.fonte}: https://docs.google.com/spreadsheets/d/${s.sheetId} (aba "${s.aba}") — ${s.motivo}`);
}
if (incompletas.length) {
  console.log(`\n${incompletas.length} fonte(s) sem coluna obrigatória — cadastre à mão pela tela de fontes:`);
  for (const s of incompletas) console.log(`  - ${s.clinica} · ${s.fonte}: falta ${s.faltando.join(", ")}\n      cabeçalho: ${s.cabecalho}`);
}
