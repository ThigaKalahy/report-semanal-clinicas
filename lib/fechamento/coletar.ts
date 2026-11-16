import { getSupabaseAdmin } from "@/lib/supabase/server";
import { readSheetRange } from "@/lib/google/sheets";
import { coletarNPS } from "@/lib/coletores/nps";
import { coletarAvaliacoesGoogle } from "@/lib/coletores/google-places";
import { coletarMetas } from "@/lib/coletores/metas";
import { coletarEntradas, coletarOrcamentos } from "@/lib/coletores/fontes-simples";
import { normalizarTexto, indiceDaColuna, lerValor, lerMes } from "@/lib/coletores/planilha";
import { calcularEntradas } from "@/lib/coletores/entradas-calculo";
import { diasUteisDoMes, diasUteisDecorridos } from "@/lib/dias-uteis";
import type { FonteDados, Json } from "@/lib/supabase/types";
import { calcularVendas, calcularDespesas, calcularLeads } from "./calculos";
import type { ResultadoVendas, ResultadoDespesas } from "./calculos";
import {
  VERSAO_DADOS, calcularRitmo, calcularCaixaMes, gerarAlertas,
} from "./dados";
import type { DadosFechamento, LeituraFonte, Comparativo, MesAnual } from "./dados";
import {
  periodoAnterior, rotuloPeriodo, rotuloCurto, dataISO, chaveAnoMes, ultimoDiaDoMes,
} from "./periodo";
import type { PeriodoFechamento } from "./periodo";

/**
 * Lê todas as fontes da clínica para o período e monta o retrato do fechamento.
 * Uma fonte que falha não derruba as outras: vira uma leitura com erro, que
 * aparece na conferência.
 */

function mapa(m: Json): Record<string, unknown> {
  return m && typeof m === "object" && !Array.isArray(m) ? (m as Record<string, unknown>) : {};
}
const txt = (v: unknown) => (typeof v === "string" ? v : "");
const aspas = (aba: string) => `'${aba.replace(/'/g, "''")}'`;

/**
 * Linhas de dados de Faturamento/Despesa para um mês. Essas fontes guardam uma
 * aba por mês (`abas_mensais`); quando a planilha tem uma aba única com tudo,
 * ela fica em `aba_base`.
 */
async function linhasDoMes(fonte: FonteDados, ano: number, mes: number): Promise<unknown[][]> {
  const m = mapa(fonte.mapeamento);
  const abas = mapa(m.abas_mensais as Json);
  // Planilha de aba única ("SAIDAS", "Base") costuma estar cadastrada em um mês
  // só: se todas as entradas apontam para a mesma aba, ela vale para qualquer mês.
  const nomes = [...new Set(Object.values(abas).map(txt).filter(Boolean))];
  const abaUnica = nomes.length === 1 && !/\d/.test(nomes[0]) ? nomes[0] : "";
  const aba = txt(abas[chaveAnoMes(ano, mes)]) || txt(m.aba_base) || abaUnica;
  if (!aba) {
    throw new Error(`não há aba configurada para ${String(mes).padStart(2, "0")}/${ano} — confira as abas mensais da fonte`);
  }
  // Cada aba é lida uma vez por fechamento: a série do ano e as comparações
  // pedem os mesmos meses várias vezes, e a planilha de aba única é sempre a mesma.
  const chave = `${fonte.id}:${aba}`;
  let lida = cacheAbas.get(chave);
  if (!lida) {
    const linhaInicial = Math.max(2, parseInt(txt(m.linha_inicial) || "2", 10) || 2);
    lida = readSheetRange(fonte.sheet_id, `${aspas(aba)}!A:AZ`).then((rows) => (rows ?? []).slice(linhaInicial - 1));
    cacheAbas.set(chave, lida);
    lida.catch(() => cacheAbas.delete(chave));
  }
  return lida;
}

const cacheAbas = new Map<string, Promise<unknown[][]>>();

async function linhasDaAba(fonte: FonteDados): Promise<unknown[][]> {
  const m = mapa(fonte.mapeamento);
  const rows = (await readSheetRange(fonte.sheet_id, `${aspas(fonte.aba_nome)}!A:AZ`)) ?? [];
  const linhaInicial = Math.max(2, parseInt(txt(m.linha_inicial) || "2", 10) || 2);
  return rows.slice(linhaInicial - 1);
}

const mensagemDe = (e: unknown) => (e instanceof Error ? e.message : "erro desconhecido");

export async function coletarFechamento(
  clinicaId: string, periodo: PeriodoFechamento,
): Promise<DadosFechamento> {
  const db = getSupabaseAdmin();
  const [{ data: clinica }, { data: fontesBrutas }, { data: feriadosBrutos }] = await Promise.all([
    db.from("clinicas").select("id, nome, google_place_id").eq("id", clinicaId).single(),
    db.from("fontes_dados").select("*").eq("clinica_id", clinicaId),
    db.from("feriados").select("data"),
  ]);
  if (!clinica) throw new Error("Clínica não encontrada.");
  cacheAbas.clear(); // leitura nova: nada de planilha guardada de um fechamento anterior

  const fontes = (fontesBrutas ?? []) as FonteDados[];
  const fonte = (tipo: FonteDados["tipo"]) => fontes.find((f) => f.tipo === tipo) ?? null;
  const feriados = (feriadosBrutos ?? []).map((f) => f.data);
  const leituras: LeituraFonte[] = [];
  const { inicio, fim, ano, mes } = periodo;
  const anterior = periodoAnterior(periodo);
  const primeiroDia = new Date(ano, mes - 1, 1);
  const ultimoDia = new Date(ano, mes - 1, ultimoDiaDoMes(ano, mes));
  const quinzenal = periodo.tipo === "quinzenal";

  /** Roda a leitura de uma fonte registrando o desfecho; devolve null se não deu. */
  async function ler<T>(nome: string, existe: boolean, fn: () => Promise<T>, descrever: (r: T) => string): Promise<T | null> {
    if (!existe) {
      leituras.push({ fonte: nome, estado: "ausente", mensagem: "Fonte não cadastrada para esta clínica." });
      return null;
    }
    try {
      const r = await fn();
      leituras.push({ fonte: nome, estado: "ok", mensagem: descrever(r) });
      return r;
    } catch (e) {
      leituras.push({ fonte: nome, estado: "erro", mensagem: mensagemDe(e) });
      return null;
    }
  }

  // ── Vendas ──
  const fFat = fonte("faturamento");
  const mFat = mapa(fFat?.mapeamento ?? null);
  const colVendas = {
    data: fFat?.coluna_data ?? "", valor: txt(mFat.valor_pago), categoria: txt(mFat.categoria),
    profissional: txt(mFat.profissional), paciente: txt(mFat.paciente), primeira_vez: txt(mFat.primeira_vez),
    pagamento: txt(mFat.pagamento), unidade: txt(mFat.unidade),
  };
  let faturamentoMes: number | null = null;
  const faturamento = await ler<ResultadoVendas>("Vendas", !!fFat, async () => {
    const linhas = await linhasDoMes(fFat!, ano, mes);
    if (quinzenal) faturamentoMes = calcularVendas(linhas, colVendas, primeiroDia, fim).total;
    return calcularVendas(linhas, colVendas, inicio, fim);
  }, (r) => `${r.lancamentos} lançamentos no período`);

  // ── Despesas ──
  const fDesp = fonte("despesa");
  const mDesp = mapa(fDesp?.mapeamento ?? null);
  const colDesp = {
    data: fDesp?.coluna_data ?? "", valor: txt(mDesp.valor_pago),
    categoria: txt(mDesp.categoria), situacao: txt(mDesp.situacao),
  };
  let despesasAteAData: number | null = null;
  let despesasDoMes: number | null = null;
  const despesas = await ler<ResultadoDespesas>("Despesas", !!fDesp, async () => {
    const linhas = await linhasDoMes(fDesp!, ano, mes);
    if (quinzenal) {
      despesasAteAData = calcularDespesas(linhas, colDesp, primeiroDia, fim).total;
      despesasDoMes = calcularDespesas(linhas, colDesp, primeiroDia, ultimoDia).total;
    }
    return calcularDespesas(linhas, colDesp, inicio, fim);
  }, (r) => `${r.lancamentos} lançamentos com vencimento no período`);

  // ── Período anterior (base das variações) — falha aqui não é erro do fechamento ──
  const comparativo: Comparativo = {
    rotulo: rotuloCurto(anterior), faturamento: null, despesas: null,
    receitasPorCategoria: {}, despesasPorCategoria: {},
  };
  if (fFat && faturamento) {
    try {
      const r = calcularVendas(await linhasDoMes(fFat, anterior.ano, anterior.mes), colVendas, anterior.inicio, anterior.fim);
      comparativo.faturamento = r.total;
      for (const c of r.porCategoria) comparativo.receitasPorCategoria[normalizarTexto(c.nome)] = c.valor;
    } catch { /* sem aba do mês anterior: as variações ficam em branco */ }
  }
  if (fDesp && despesas) {
    try {
      const r = calcularDespesas(await linhasDoMes(fDesp, anterior.ano, anterior.mes), colDesp, anterior.inicio, anterior.fim);
      comparativo.despesas = r.total;
      for (const g of r.porGrupo) for (const c of g.categorias) {
        comparativo.despesasPorCategoria[normalizarTexto(c.nome)] = c.valor;
      }
    } catch { /* idem */ }
  }

  // ── Entradas e Orçamentos ──
  const fEnt = fonte("entradas");
  const entradas = await ler("Entradas", !!fEnt, () => coletarEntradas(fEnt!, inicio, fim),
    (r) => `${r.lancamentos} recebimentos no período`);
  const fOrc = fonte("orcamentos");
  const orcamentos = await ler("Orçamentos", !!fOrc, () => coletarOrcamentos(fOrc!, inicio, fim),
    (r) => `${r.total} orçamentos no período`);

  // ── Leads ──
  const fLeads = fonte("leads");
  const mLeads = mapa(fLeads?.mapeamento ?? null);
  const leads = await ler("Leads", !!fLeads, async () => calcularLeads(
    await linhasDaAba(fLeads!),
    {
      data: fLeads!.coluna_data, convertido: txt(mLeads.convertido), origem: txt(mLeads.origem),
      canal: txt(mLeads.canal), interesse: txt(mLeads.interesse), objecao: txt(mLeads.objecao),
    },
    inicio, fim, txt(mLeads.valor_conversao) || "sim",
  ), (r) => `${r.total} leads no período`);

  // ── NPS e Google ──
  const fNps = fonte("nps");
  const npsBruto = await ler("NPS", !!fNps, () => coletarNPS(fNps!, inicio, fim),
    (r) => `${r.total} respostas no período`);
  const googleBruto = await ler("Avaliações Google", !!clinica.google_place_id,
    () => coletarAvaliacoesGoogle(clinica.google_place_id!, inicio, fim),
    (r) => `${r.total} avaliações encontradas (a busca do Google devolve no máximo 5)`);

  // ── Meta de faturamento do mês ──
  let meta: number | null = null;
  try {
    const metas = await coletarMetas(clinicaId, fim);
    const m = metas.find((x) => x.tipo_nome.toLowerCase().includes("faturamento"));
    if (m && m.meta_mensal > 0) meta = m.meta_mensal;
  } catch { /* sem meta: os indicadores de meta ficam em branco */ }

  // ── Série do ano (mensal): base do gráfico e da visão de caixa e competência ──
  const anual: MesAnual[] = [];
  if (!quinzenal && (fFat || fDesp || fEnt)) {
    const iComp = indiceDaColuna(txt(mDesp.competencia));
    const iValorDesp = indiceDaColuna(colDesp.valor);
    const competencia = new Map<string, number>();
    const abasSomadas = new Set<unknown[][]>();
    const mEnt = mapa(fEnt?.mapeamento ?? null);
    let linhasEntradas: unknown[][] | null = null;
    if (fEnt && entradas) { try { linhasEntradas = await linhasDaAba(fEnt); } catch { /* sem série de recebido */ } }

    for (let m = 1; m <= mes; m++) {
      const de = new Date(ano, m - 1, 1);
      const ate = new Date(ano, m - 1, ultimoDiaDoMes(ano, m));
      const item: MesAnual = { mes: chaveAnoMes(ano, m), faturamento: null, recebido: null, despesas: null, despesasCompetencia: null };
      if (fFat && faturamento) {
        try { item.faturamento = calcularVendas(await linhasDoMes(fFat, ano, m), colVendas, de, ate).total; } catch { /* mês sem aba */ }
      }
      if (fDesp && despesas) {
        try {
          const linhas = await linhasDoMes(fDesp, ano, m);
          item.despesas = calcularDespesas(linhas, colDesp, de, ate).total;
          // competência: soma cada aba uma vez só, pelo mês escrito na coluna
          if (iComp >= 0 && !abasSomadas.has(linhas)) {
            abasSomadas.add(linhas);
            for (const l of linhas) {
              const quando = lerMes(l[iComp]);
              const valor = lerValor(l[iValorDesp]);
              if (quando && valor !== null) competencia.set(quando, (competencia.get(quando) ?? 0) + valor);
            }
          }
        } catch { /* mês sem aba */ }
      }
      if (linhasEntradas) {
        item.recebido = calcularEntradas(
          linhasEntradas,
          { data: fEnt!.coluna_data, valor: txt(mEnt.valor), situacao: txt(mEnt.situacao), categoria: txt(mEnt.categoria) },
          de, ate, { fora: txt(mEnt.termos_fora), nao_operacional: txt(mEnt.termos_nao_operacional) },
        ).total;
      }
      anual.push(item);
    }
    if (iComp >= 0) {
      for (const item of anual) {
        if (item.despesas !== null) item.despesasCompetencia = Math.round((competencia.get(item.mes) ?? 0) * 100) / 100;
      }
    }
  }

  // ── Média de despesas dos 3 meses anteriores (quinzenal) ──
  const despesasMesesAnteriores: number[] = [];
  if (quinzenal && fDesp && despesas) {
    for (let k = 1; k <= 3; k++) {
      const d = new Date(ano, mes - 1 - k, 1);
      const [a, m] = [d.getFullYear(), d.getMonth() + 1];
      try {
        const linhas = await linhasDoMes(fDesp, a, m);
        const r = calcularDespesas(linhas, colDesp, d, new Date(a, m - 1, ultimoDiaDoMes(a, m)));
        if (r.lancamentos > 0) despesasMesesAnteriores.push(r.total);
      } catch { /* mês sem aba: fica fora da média */ }
    }
  }

  // ── Ritmo e caixa do mês (quinzenal) ──
  const ritmo = quinzenal && faturamentoMes !== null
    ? calcularRitmo({
        faturamentoMes,
        diasUteisDecorridos: diasUteisDecorridos(fim, feriados),
        diasUteisMes: diasUteisDoMes(mes, ano, feriados),
        meta,
      })
    : null;
  const caixaMes = quinzenal && despesasAteAData !== null && despesasDoMes !== null
    ? calcularCaixaMes({
        despesasAteAData, despesasDoMes, projecaoFaturamento: ritmo?.projecao ?? null, despesasMesesAnteriores,
      })
    : null;

  const semAlertas: Omit<DadosFechamento, "alertas"> = {
    versao: VERSAO_DADOS,
    tipo: periodo.tipo,
    periodo: { inicio: dataISO(inicio), fim: dataISO(fim), rotulo: rotuloPeriodo(periodo) },
    lidoEm: new Date().toISOString(),
    faturamento,
    despesas,
    entradas,
    orcamentos,
    leads,
    nps: npsBruto
      ? {
          respostas: npsBruto.total,
          score: npsBruto.nps_score,
          promotores: npsBruto.classificacao.promotores,
          neutros: npsBruto.classificacao.neutros,
          detratores: npsBruto.classificacao.detratores,
          notas: { ...npsBruto.medias_por_area },
        }
      : null,
    google: googleBruto
      ? {
          total: googleBruto.total,
          media: googleBruto.avaliacoes.length > 0
            ? Math.round((googleBruto.avaliacoes.reduce((s, a) => s + a.nota, 0) / googleBruto.avaliacoes.length) * 10) / 10
            : null,
        }
      : null,
    meta,
    anterior: faturamento || despesas ? comparativo : null,
    ritmo,
    caixaMes,
    leituras,
    ...(anual.length > 0 ? { anual } : {}),
  };

  return { ...semAlertas, alertas: gerarAlertas(semAlertas) };
}
