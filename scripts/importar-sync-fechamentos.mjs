// Importa os fechamentos (mensais e quinzenais) salvos no Sync Financeiro (app
// do Fernando): números, alertas, análise, plano de ação e estado.
//
// Uso:
//   node scripts/importar-sync-fechamentos.mjs            → simula e mostra o que faria
//   node scripts/importar-sync-fechamentos.mjs --gravar   → grava de verdade
//
// Regras:
//   - casa as clínicas pelo NOME (sem acento nem caixa);
//   - nunca sobrescreve: se já existe aqui um fechamento da mesma clínica, tipo e
//     período, o nosso fica como está;
//   - os NÚMEROS entram como o Sync calculou — não são recalculados. Isso inclui a
//     regra de lá para despesa (data de PAGAMENTO). O fechamento importado leva um
//     aviso dizendo isso; "Ler planilhas de novo" recalcula pela regra daqui;
//   - fechamento concluído/enviado usa o retrato congelado que o Sync guardou;
//   - o texto de entrega não é importado (lá ele é montado na hora): gere aqui.
//
// Entrada: .import-sync/fechamentos.json (fora do git — contém dados de clientes).

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
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

async function api(caminho, init) {
  const r = await fetch(`${URL_BASE}/rest/v1/${caminho}`, { headers: H, ...init });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${r.status} em ${caminho}: ${texto.slice(0, 200)}`);
  return texto ? JSON.parse(texto) : null;
}

// ── Conversão do formato do Sync para o daqui (lib/fechamento/dados.ts) ──────

const n = (v) => (typeof v === "number" && isFinite(v) ? v : 0);
const nOuNulo = (v) => (typeof v === "number" && isFinite(v) ? v : null);
const lista = (v) => (Array.isArray(v) ? v : []);
const temNome = (itens) => lista(itens).some((i) => i?.nome && i.nome !== "Não informado");
const itensValor = (itens) => lista(itens).map((i) => ({ nome: String(i.nome ?? ""), valor: n(i.valor), pct: n(i.pct) }));
const itensQtd = (itens) => lista(itens).map((i) => ({ nome: String(i.nome ?? ""), quantidade: n(i.quantidade), pct: n(i.pct) }));

function rotuloCurto(tipo, ano, mes, quinzena) {
  const m = `${MESES[mes - 1]}/${ano}`;
  return tipo === "mensal" ? m : `${quinzena}ª quinzena de ${m}`;
}

function periodoDe(tipo, inicioISO) {
  const [ano, mes, dia] = inicioISO.split("-").map(Number);
  return { ano, mes, quinzena: tipo === "quinzenal" ? (dia <= 15 ? 1 : 2) : null };
}

function converterVendas(fat, pac) {
  if (!fat) return null;
  return {
    total: n(fat.total),
    lancamentos: n(fat.lancamentos),
    porCategoria: lista(fat.porGrupo)
      .filter((c) => n(c.valor) !== 0 || n(c.quantidade) !== 0)
      .map((c) => ({ nome: String(c.nome ?? ""), valor: n(c.valor), quantidade: n(c.quantidade), ticket: n(c.ticket), pct: n(c.pct) }))
      .sort((a, b) => b.valor - a.valor),
    porProfissional: temNome(fat.porProfissional) ? itensValor(fat.porProfissional) : null,
    porPagamento: temNome(fat.porPagamento) ? itensValor(fat.porPagamento) : null,
    porUnidade: temNome(fat.porUnidade) ? itensValor(fat.porUnidade) : null,
    pacientes: {
      atendidos: nOuNulo(pac?.atendidos),
      ticketMedio: nOuNulo(pac?.ticketMedio),
      temInformacaoDeNovos: !!pac?.temInformacaoDeNovos,
      novos: pac?.temInformacaoDeNovos ? nOuNulo(pac.novos) : null,
      faturamentoNovos: pac?.temInformacaoDeNovos ? nOuNulo(pac.faturamentoNovos) : null,
      ticketNovos: pac?.temInformacaoDeNovos ? nOuNulo(pac.ticketNovos) : null,
    },
    linhasIlegiveis: 0,
  };
}

function converterDespesas(d) {
  if (!d) return null;
  return {
    total: n(d.total),
    lancamentos: n(d.lancamentos),
    pagas: null,
    emAberto: null,
    // o Sync lista o plano de contas inteiro, zerado: aqui ficam só grupos e categorias com valor
    porGrupo: lista(d.porGrupo).filter((g) => n(g.valor) !== 0).map((g) => ({
      nome: String(g.nome ?? ""), valor: n(g.valor), pct: n(g.pct),
      categorias: itensValor(lista(g.categorias).filter((c) => n(c.valor) !== 0)).sort((a, b) => b.valor - a.valor),
    })),
    categoriasForaDoPlano: [],
    linhasIlegiveis: 0,
  };
}

function converterEntradas(e) {
  if (!e) return null;
  return {
    total: n(e.total), operacionais: n(e.operacionais), naoOperacionais: n(e.naoOperacionais),
    foraDoResultado: n(e.foraDoResultado), lancamentos: n(e.lancamentos),
    emAberto: { valor: n(e.emAberto?.valor), quantidade: n(e.emAberto?.quantidade) },
    semSituacao: n(e.semSituacao),
    porCategoria: lista(e.porCategoria).map((c) => ({
      nome: String(c.nome ?? ""), valor: n(c.valor), pct: n(c.pct),
      grupo: ["operacional", "nao_operacional", "fora"].includes(c.grupo) ? c.grupo : "operacional",
    })),
    linhasIlegiveis: 0,
  };
}

function converterOrcamentos(o) {
  if (!o) return null;
  return {
    total: n(o.total), fechados: n(o.fechados), emAberto: n(o.emAberto), naoFechou: n(o.naoFechou), cancelados: n(o.cancelados),
    valorGerado: n(o.valorGerado), valorFechado: n(o.valorFechado), valorEmAberto: n(o.valorEmAberto), valorCancelado: n(o.valorCancelado),
    conversaoQuantidade: nOuNulo(o.conversaoQuantidade), conversaoValor: nOuNulo(o.conversaoValor),
    porStatus: itensQtd(o.porStatus), porObjecao: itensQtd(o.porObjecao),
    statusSemSituacao: [], linhasIlegiveis: 0,
  };
}

function converterLeads(l) {
  if (!l) return null;
  const ou = (itens) => (temNome(itens) ? itensQtd(itens) : null);
  return {
    total: n(l.total), agendados: n(l.agendados), conversao: nOuNulo(l.conversao),
    porOrigem: ou(l.porOrigem), porCanal: ou(l.porCanal), porInteresse: ou(l.porInteresse), porObjecao: ou(l.porObjecao),
    linhasIlegiveis: 0,
  };
}

function porCategoria(itens) {
  const r = {};
  for (const i of itens) if (n(i.valor) !== 0) r[chaveNome(i.nome)] = n(i.valor);
  return r;
}

const ROTULO_FONTE = { vendas: "Vendas", despesas: "Despesas", entradas: "Entradas", orcamentos: "Orçamentos", leads: "Leads", nps: "NPS", google: "Avaliações Google" };
const GRAVIDADES = ["erro", "atencao", "info"];

function converterDados(pagina) {
  const fe = pagina.fechamento;
  // concluído/enviado: o retrato congelado; senão, o que estava salvo + o contexto da página
  const base = fe.snapshot ?? pagina;
  const ind = fe.snapshot?.indicadores ?? fe.indicadores ?? pagina.indicadores ?? {};
  const ant = base.anterior ?? null;
  const rit = base.ritmo ?? null;
  const { ano, mes, quinzena } = periodoDe(fe.tipo, fe.inicio);
  const antPeriodo = ant?.periodo?.inicio ? periodoDe(fe.tipo, ant.periodo.inicio) : null;

  const meta = nOuNulo(ind.meta?.valor) ?? nOuNulo(fe.meta_ajustada) ?? nOuNulo(base.metaMensal);

  const alertas = lista(fe.snapshot?.alertas ?? fe.alertas).map((a) => ({
    gravidade: GRAVIDADES.includes(a.gravidade) ? a.gravidade : "atencao",
    area: String(a.area ?? "Geral"), titulo: String(a.titulo ?? ""), descricao: String(a.descricao ?? ""),
  }));
  alertas.push({
    gravidade: "info", area: "Importação", titulo: "Fechamento importado do Sync Financeiro",
    descricao: "Os números são os calculados no Sync, onde a despesa contava pela data de pagamento. “Ler planilhas de novo” recalcula tudo pela regra deste app (data de vencimento).",
  });

  return {
    versao: 1,
    tipo: fe.tipo,
    periodo: {
      inicio: fe.inicio, fim: fe.fim,
      rotulo: `${fe.tipo === "mensal" ? "Mensal" : "Quinzenal"} · ${rotuloCurto(fe.tipo, ano, mes, quinzena)}`,
    },
    lidoEm: base.lidoEm && base.lidoEm !== "$undefined" && fe.snapshot ? base.lidoEm : fe.calculado_em ?? fe.atualizado_em,
    faturamento: converterVendas(ind.faturamento, ind.pacientes),
    despesas: converterDespesas(ind.despesas),
    entradas: converterEntradas(ind.entradas),
    orcamentos: converterOrcamentos(ind.orcamentos),
    leads: converterLeads(ind.leads),
    nps: ind.nps
      ? {
          respostas: n(ind.nps.respostas), score: n(ind.nps.nps), promotores: n(ind.nps.promotores),
          neutros: n(ind.nps.neutros), detratores: n(ind.nps.detratores),
          notas: {
            profissional: nOuNulo(ind.nps.notas?.profissional), recepcao: nOuNulo(ind.nps.notas?.recepcao),
            infraestrutura: nOuNulo(ind.nps.notas?.infraestrutura), enfermagem: nOuNulo(ind.nps.notas?.enfermagem),
          },
        }
      : null,
    google: ind.google
      ? { total: n(ind.google.total ?? ind.google.quantidade), media: nOuNulo(ind.google.media ?? ind.google.nota) }
      : null,
    meta,
    anterior: ant && antPeriodo
      ? {
          rotulo: rotuloCurto(fe.tipo, antPeriodo.ano, antPeriodo.mes, antPeriodo.quinzena),
          faturamento: nOuNulo(ant.faturamento?.total),
          despesas: nOuNulo(ant.despesas?.total),
          receitasPorCategoria: porCategoria(lista(ant.faturamento?.porGrupo)),
          despesasPorCategoria: porCategoria(lista(ant.despesas?.porGrupo).flatMap((g) => lista(g.categorias))),
        }
      : null,
    ritmo: fe.tipo === "quinzenal" && rit
      ? {
          faturamentoMes: n(rit.faturamento), diasUteisDecorridos: n(rit.diasUteisDecorridos), diasUteisMes: n(rit.diasUteisMes),
          mediaPorDiaUtil: nOuNulo(rit.faturamentoPorDia), projecao: nOuNulo(rit.projecaoMes), meta: nOuNulo(rit.meta),
          faltaParaMeta: nOuNulo(rit.faltaMeta), necessarioPorDiaUtil: nOuNulo(rit.necessarioPorDia),
        }
      : null,
    caixaMes: fe.tipo === "quinzenal" && rit && typeof rit.despesasPagas === "number"
      ? {
          despesasAteAData: n(rit.despesasPagas), provisionado: n(rit.provisionado),
          despesasDoMes: Math.round((n(rit.despesasPagas) + n(rit.provisionado)) * 100) / 100,
          saldoProjetado: nOuNulo(rit.saldoProjetado),
        }
      : null,
    leituras: lista(base.fontes).map((f) => {
      const erro = f.erro && f.erro !== "$undefined" ? String(f.erro) : "";
      return {
        fonte: ROTULO_FONTE[f.fonte] ?? String(f.fonte),
        estado: erro ? "erro" : "ok",
        mensagem: erro || `${n(f.linhas)} linhas lidas no Sync`,
      };
    }),
    alertas,
    origem: { sistema: "sync", id: fe.id, importadoEm: new Date().toISOString(), anual: lista(base.anual) },
  };
}

/** Os blocos de texto do Sync viram uma análise só, com subtítulos. */
function converterAnalise(texto) {
  const t = texto ?? {};
  const partes = [];
  if (String(t.observacao ?? "").trim()) partes.push(t.observacao.trim());
  for (const [chave, titulo] of [["destaques", "Destaques"], ["comercial", "Comercial"], ["atencao", "Pontos de atenção"], ["contexto", "Contexto"]]) {
    if (String(t[chave] ?? "").trim()) partes.push(`${titulo}:\n${t[chave].trim()}`);
  }
  return partes.join("\n\n").slice(0, 8000);
}

function converterAcoes(acoes) {
  return lista(acoes).map((a) => {
    const titulo = String(a.titulo ?? "").trim();
    const descricao = String(a.descricao ?? "").trim();
    const m = String(a.prazo ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return {
      texto: [titulo, descricao].filter(Boolean).join(" — ").slice(0, 500),
      responsavel: String(a.responsavel ?? "").slice(0, 80),
      prazo: m ? `${m[3]}/${m[2]}/${m[1]}` : String(a.prazo ?? "").slice(0, 40),
    };
  }).filter((a) => a.texto);
}

const STATUS = { conferencia: "em_conferencia", analise: "em_analise", concluido: "concluido", enviado: "enviado" };

// ── Importação ───────────────────────────────────────────────────────────────

const paginas = Object.values(JSON.parse(readFileSync(".import-sync/fechamentos.json", "utf8")));
let clinicas, existentes;
try {
  clinicas = await api("clinicas?select=id,nome");
  existentes = await api("fechamentos?select=clinica_id,tipo,ano,mes,quinzena");
} catch (e) {
  console.error("Não consegui ler o banco:", e.cause?.code ?? e.message);
  console.error("Confira se a migração 006 já foi rodada.");
  process.exit(1);
}
const porNome = new Map(clinicas.map((c) => [chaveNome(c.nome), c]));
const chaveF = (f) => `${f.clinica_id}:${f.tipo}:${f.ano}:${f.mes}:${f.quinzena ?? 0}`;
const jaTem = new Set(existentes.map(chaveF));

console.log(GRAVAR ? "MODO GRAVAÇÃO\n" : "SIMULAÇÃO (use --gravar para gravar)\n");

paginas.sort((a, b) => a.clinicaNome.localeCompare(b.clinicaNome, "pt-BR") || a.fechamento.inicio.localeCompare(b.fechamento.inicio));
let criados = 0;
for (const pagina of paginas) {
  const fe = pagina.fechamento;
  const { ano, mes, quinzena } = periodoDe(fe.tipo, fe.inicio);
  const rotulo = `${pagina.clinicaNome} · ${fe.tipo} · ${rotuloCurto(fe.tipo, ano, mes, quinzena)}`;

  const nossa = porNome.get(chaveNome(pagina.clinicaNome));
  if (!nossa) { console.log(`- ${rotulo}: sem clínica de mesmo nome no nosso banco — pulado`); continue; }
  const status = STATUS[fe.status];
  if (!status) { console.log(`- ${rotulo}: estado desconhecido no Sync (${fe.status}) — pulado`); continue; }

  const linha = {
    clinica_id: nossa.id, tipo: fe.tipo, ano, mes, quinzena,
    data_inicio: fe.inicio, data_fim: fe.fim, status,
    dados: converterDados(pagina),
    analise: converterAnalise(fe.texto),
    acoes: converterAcoes(fe.acoes),
    texto: "",
    lido_em: fe.calculado_em ?? null,
    enviado_em: status === "enviado" ? fe.enviado_em ?? fe.atualizado_em ?? null : null,
  };
  if (jaTem.has(chaveF(linha))) { console.log(`- ${rotulo}: já existe aqui — mantido o nosso`); continue; }

  const d = linha.dados;
  const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const resumo = [
    status.replace("em_", "em "),
    d.faturamento ? `faturamento ${brl(d.faturamento.total)}` : "sem vendas",
    d.despesas ? `despesas ${brl(d.despesas.total)}` : null,
    linha.analise ? `análise ${linha.analise.length}c` : null,
    linha.acoes.length ? `${linha.acoes.length} ações` : null,
    fe.snapshot ? "retrato congelado" : null,
  ].filter(Boolean).join(", ");

  if (GRAVAR) await api("fechamentos", { method: "POST", body: JSON.stringify(linha) });
  jaTem.add(chaveF(linha));
  console.log(`+ ${rotulo}: ${GRAVAR ? "importado" : "seria importado"} (${resumo})`);
  criados++;
}

console.log(`\n${criados} fechamento(s) ${GRAVAR ? "importado(s)" : "a importar"}.`);
