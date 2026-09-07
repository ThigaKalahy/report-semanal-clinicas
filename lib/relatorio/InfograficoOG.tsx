import React from "react";
import type { RelatorioImagemData, DestaqueItem } from "./imagem-tipos";

// ─── Dimensões (quadrado 1:1) ────────────────────────────────────────────────
export const INFOGRAFICO_SIZE = 1080;

// ─── Paleta ──────────────────────────────────────────────────────────────────
const C = {
  bg: "#150A1E",
  bgTopo: "#231033",
  bgBase: "#1B0A28",
  card: "rgba(255,255,255,0.045)",
  cardBorda: "rgba(255,255,255,0.075)",
  laranja: "#F5872F",
  magenta: "#C026D3",
  roxo: "#A855F7",
  lavanda: "#A79BB5",
  branco: "#FFFFFF",
  vermelho: "#F04747",
  vermelhoBg: "rgba(240,71,71,0.07)",
  vermelhoBorda: "rgba(240,71,71,0.45)",
  verde: "#3FBF6E",
  ambar: "#E6A700",
  trilho: "rgba(255,255,255,0.12)",
} as const;

type S = React.CSSProperties;

// ─── Helpers de layout (todos com display:flex explícito) ─────────────────────
function col(extra?: S): S {
  return { display: "flex", flexDirection: "column", ...extra };
}
function row(extra?: S): S {
  return { display: "flex", flexDirection: "row", ...extra };
}

function truncar(texto: string, max: number): string {
  const t = (texto ?? "").trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

// ─── Título de seção ─────────────────────────────────────────────────────────
function SecaoTitulo({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        fontSize: 20,
        fontWeight: 800,
        color: C.laranja,
        letterSpacing: 3,
        textTransform: "uppercase",
        marginBottom: 14,
      }}
    >
      {label}
    </div>
  );
}

// ─── Barra de progresso real (largura = % de atingimento) ────────────────────
function BarraProgresso({ pct }: { pct: number }) {
  const preenchido = Math.max(0, Math.min(100, pct));
  const completo = pct >= 100;
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: 8,
        borderRadius: 99,
        background: C.trilho,
        marginTop: 12,
        marginBottom: 8,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          width: `${preenchido}%`,
          height: 8,
          borderRadius: 99,
          background: completo
            ? `linear-gradient(90deg, ${C.magenta}, ${C.verde})`
            : `linear-gradient(90deg, ${C.magenta}, ${C.laranja})`,
        }}
      />
    </div>
  );
}

// ─── Card de indicador (topo) ────────────────────────────────────────────────
function KpiCard({
  label,
  valor,
  sub,
  perigo = false,
  pct,
}: {
  label: string;
  valor: string;
  sub: string;
  perigo?: boolean;
  pct?: number | null;
}) {
  // Reduz o corpo do número quando o valor é longo (ex: "R$ 158.390")
  const tamanhoValor = valor.length > 10 ? 30 : valor.length > 8 ? 34 : 40;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minWidth: 0,
        background: perigo ? C.vermelhoBg : C.card,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: perigo ? C.vermelhoBorda : C.cardBorda,
        borderRadius: 16,
        paddingTop: 18,
        paddingBottom: 18,
        paddingLeft: 18,
        paddingRight: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 12,
          color: C.lavanda,
          textTransform: "uppercase",
          letterSpacing: 1,
          lineHeight: 1.35,
          height: 33,
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: tamanhoValor,
          fontWeight: 800,
          color: perigo ? C.vermelho : C.branco,
          lineHeight: 1.1,
        }}
      >
        {valor}
      </div>
      {pct != null && <BarraProgresso pct={pct} />}
      <div
        style={{
          display: "flex",
          fontSize: 12,
          color: C.lavanda,
          lineHeight: 1.4,
          marginTop: pct != null ? 0 : 8,
        }}
      >
        {sub}
      </div>
    </div>
  );
}

// ─── Ícone de destaque ───────────────────────────────────────────────────────
function DestaqueIcone({ tipo }: { tipo: DestaqueItem["tipo"] }) {
  const map: Record<DestaqueItem["tipo"], { symbol: string; bg: string; color: string }> = {
    positivo:   { symbol: "+", bg: "rgba(63,191,110,0.16)",  color: C.verde   },
    financeiro: { symbol: "$", bg: "rgba(245,135,47,0.16)",  color: C.laranja },
    atencao:    { symbol: "!", bg: "rgba(230,167,0,0.16)",   color: C.ambar   },
  };
  const { symbol, bg, color } = map[tipo] ?? map.atencao;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 30,
        height: 30,
        borderRadius: 8,
        background: bg,
        fontSize: 15,
        fontWeight: 800,
        color,
        flexShrink: 0,
      }}
    >
      {symbol}
    </div>
  );
}

// ─── Ícone de alerta ─────────────────────────────────────────────────────────
function AlertaIcone() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 26,
        height: 26,
        borderRadius: 7,
        background: "rgba(240,71,71,0.18)",
        fontSize: 14,
        fontWeight: 800,
        color: C.vermelho,
        flexShrink: 0,
      }}
    >
      !
    </div>
  );
}

// ─── Defaults seguros para dados que possam vir incompletos do JSON ───────────
function withDefaults(raw: RelatorioImagemData): RelatorioImagemData {
  const f = raw.visaoGeral?.faturamento;
  const n = raw.visaoGeral?.npsGoogle;
  const com = raw.visaoGeral?.comercial;
  return {
    cabecalho: {
      clinica_nome: raw.cabecalho?.clinica_nome ?? "Clínica",
      tag: raw.cabecalho?.tag ?? "",
      semana: raw.cabecalho?.semana ?? null,
      periodo_ini: raw.cabecalho?.periodo_ini ?? "--",
      periodo_fim: raw.cabecalho?.periodo_fim ?? "--",
    },
    rodape: { mes_ano: raw.rodape?.mes_ano ?? "" },
    visaoGeral: {
      faturamento: {
        is_media:                       f?.is_media                       ?? false,
        realizado_filtro:               f?.realizado_filtro,
        realizado_filtro_from_planilha: f?.realizado_filtro_from_planilha ?? false,
        acumulado:                      f?.acumulado                      ?? "N/A",
        acumulado_from_planilha:        f?.acumulado_from_planilha        ?? false,
        meta_periodo:                   f?.meta_periodo                   ?? "N/A",
        pct_periodo:                    f?.pct_periodo                    ?? null,
        acima_periodo:                  f?.acima_periodo                  ?? false,
        meta_mensal:                    f?.meta_mensal                    ?? "N/A",
        pct_mensal:                     f?.pct_mensal                     ?? null,
        acima_mensal:                   f?.acima_mensal                   ?? false,
      },
      npsGoogle: {
        respostas_nps:     n?.respostas_nps     ?? null,
        avaliacoes_google: n?.avaliacoes_google ?? null,
        meta_nps_meta:     n?.meta_nps_meta     ?? null,
        meta_google_meta:  n?.meta_google_meta  ?? null,
      },
      comercial: {
        conversao_leads:      com?.conversao_leads      ?? "N/A",
        conversao_orcamentos: com?.conversao_orcamentos ?? "N/A",
        total_leads:          com?.total_leads          ?? "N/A",
        total_orcamentos:     com?.total_orcamentos     ?? "N/A",
      },
    },
    destaques: raw.destaques ?? [],
    alertas:   raw.alertas   ?? [],
    acoes:     raw.acoes     ?? [],
  };
}

// ─── Monta os cards de indicador a partir dos dados ──────────────────────────
interface KpiSpec {
  label: string;
  valor: string;
  sub: string;
  perigo?: boolean;
  pct?: number | null;
}

function montarKpis(dados: RelatorioImagemData): KpiSpec[] {
  const fat = dados.visaoGeral.faturamento;
  const ng  = dados.visaoGeral.npsGoogle;
  const com = dados.visaoGeral.comercial;
  const isNA = (v?: string | null) => !v || v === "N/A" || v === "—";

  const kpis: KpiSpec[] = [];

  // 1 — Faturamento no período selecionado
  if (!isNA(fat.realizado_filtro)) {
    kpis.push({
      label: "Faturamento no período",
      valor: fat.realizado_filtro!,
      sub: isNA(fat.meta_periodo)
        ? "Período avaliado"
        : `Meta do período: ${fat.meta_periodo}`,
    });
  }

  // 2 — Acumulado no mês, com barra de progresso real da meta mensal
  if (!isNA(fat.acumulado)) {
    const pct = fat.pct_mensal;
    kpis.push({
      label: "Acumulado no mês",
      valor: fat.acumulado,
      pct: pct,
      sub: pct != null ? `${pct}% da meta mensal` : "Sem meta mensal definida",
    });
  }

  // 3 — Respostas NPS
  if (ng.respostas_nps !== null) {
    const meta = ng.meta_nps_meta;
    const pct = meta && meta > 0 ? Math.round((ng.respostas_nps / meta) * 100) : null;
    kpis.push({
      label: "Respostas NPS",
      valor: String(ng.respostas_nps),
      sub: pct != null ? `${pct}% da meta (${meta})` : "No período avaliado",
      perigo: ng.respostas_nps === 0,
    });
  }

  // 4 — Avaliações Google
  if (ng.avaliacoes_google !== null) {
    const meta = ng.meta_google_meta;
    const pct = meta && meta > 0 ? Math.round((ng.avaliacoes_google / meta) * 100) : null;
    kpis.push({
      label: "Avaliações Google",
      valor: String(ng.avaliacoes_google),
      sub: ng.avaliacoes_google === 0
        ? "Nenhuma nova avaliação"
        : pct != null ? `${pct}% da meta (${meta})` : "No período avaliado",
      perigo: ng.avaliacoes_google === 0,
    });
  }

  // 5 — Total de leads
  if (!isNA(com.total_leads)) {
    const zero = com.total_leads.trim() === "0";
    kpis.push({
      label: "Total de leads",
      valor: com.total_leads,
      sub: zero
        ? "Sem registro no CRM"
        : isNA(com.conversao_leads)
          ? "No período avaliado"
          : `Conversão de ${com.conversao_leads}`,
      perigo: zero,
    });
  }

  return kpis.slice(0, 5);
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function InfograficoOG({
  dados: rawDados,
  logoSrc,
  size = INFOGRAFICO_SIZE,
}: {
  dados: RelatorioImagemData;
  logoSrc?: string | null;
  size?: number;
}) {
  const dados = withDefaults(rawDados);
  const { cabecalho, rodape } = dados;

  const kpis = montarKpis(dados);
  const destaques = dados.destaques.slice(0, 5);
  const acoes     = dados.acoes.filter((a) => a.trim()).slice(0, 4);
  const alertas   = dados.alertas.filter((a) => a.trim()).slice(0, 4);

  // Corpo do texto encolhe quando há muito conteúdo, para caber no quadrado
  const totalItens = destaques.length + acoes.length + alertas.length;
  const fonteItem = totalItens > 10 ? 16 : totalItens > 8 ? 17 : 18;

  const nome = cabecalho.clinica_nome || "Clínica";
  const nomeTruncado = nome.length > 28 ? nome.slice(0, 27) + "…" : nome;
  const selo = cabecalho.semana != null ? `SEMANA ${cabecalho.semana}` : (cabecalho.tag || "");

  const temColunaDireita = acoes.length > 0 || alertas.length > 0;
  const temColunaEsquerda = destaques.length > 0;
  // Com 3+ destaques os cards dividem a altura da coluna; com poucos, altura natural
  const esticarDestaques = destaques.length >= 3;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: size,
        height: size,
        background: `linear-gradient(155deg, ${C.bgTopo} 0%, ${C.bg} 45%, ${C.bgBase} 100%)`,
        fontFamily: "Inter",
        paddingTop: 40,
        paddingBottom: 34,
        paddingLeft: 44,
        paddingRight: 44,
      }}
    >
      {/* ── Cabeçalho ── */}
      <div style={row({ alignItems: "center", gap: 18 })}>
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoSrc}
            width={44}
            height={44}
            alt="Gestfy"
            style={{ objectFit: "contain", flexShrink: 0 }}
          />
        ) : null}

        <div style={col({ flex: 1, minWidth: 0, gap: 6 })}>
          <div style={row({ alignItems: "baseline", gap: 10 })}>
            <div
              style={{
                display: "flex",
                fontSize: 30,
                fontWeight: 800,
                color: C.laranja,
                letterSpacing: 1,
              }}
            >
              REPORT SEMANAL —
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 30,
                fontWeight: 800,
                color: C.branco,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              {nomeTruncado}
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 16, color: C.lavanda }}>
            {cabecalho.periodo_ini} até {cabecalho.periodo_fim} · Comparativo com meta do período
          </div>
        </div>

        {selo && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
              borderWidth: 2,
              borderStyle: "solid",
              borderColor: C.laranja,
              borderRadius: 99,
              background: "rgba(245,135,47,0.10)",
              paddingTop: 9,
              paddingBottom: 9,
              paddingLeft: 20,
              paddingRight: 20,
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: 2,
              color: C.laranja,
              textTransform: "uppercase",
            }}
          >
            {selo}
          </div>
        )}
      </div>

      {/* ── Divisor ── */}
      <div
        style={{
          display: "flex",
          width: "100%",
          height: 1,
          marginTop: 22,
          marginBottom: 22,
          background: `linear-gradient(90deg, rgba(245,135,47,0.55), rgba(255,255,255,0.06))`,
        }}
      />

      {/* ── Indicadores ── */}
      {kpis.length > 0 && (
        <div style={row({ gap: 12 })}>
          {kpis.map((k, i) => (
            <KpiCard
              key={i}
              label={k.label}
              valor={k.valor}
              sub={k.sub}
              perigo={k.perigo}
              pct={k.pct}
            />
          ))}
        </div>
      )}

      {/* ── Corpo: destaques | (ações + alertas) ── */}
      <div style={row({ flex: 1, gap: 24, marginTop: 26, overflow: "hidden" })}>
        {/* Coluna esquerda — Principais destaques */}
        {temColunaEsquerda && (
          <div style={col({ flex: temColunaDireita ? 1.25 : 1, minWidth: 0 })}>
            <SecaoTitulo label="Principais destaques" />
            <div style={col({ gap: 12, flex: 1 })}>
              {destaques.map((d, i) => (
                <div
                  key={i}
                  style={row({
                    gap: 14,
                    flex: esticarDestaques ? 1 : undefined,
                    alignItems: "center",
                    background: C.card,
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: C.cardBorda,
                    borderRadius: 12,
                    paddingTop: 16,
                    paddingBottom: 16,
                    paddingLeft: 18,
                    paddingRight: 18,
                  })}
                >
                  <DestaqueIcone tipo={d.tipo} />
                  <div
                    style={{
                      display: "flex",
                      flex: 1,
                      minWidth: 0,
                      fontSize: fonteItem,
                      color: C.branco,
                      lineHeight: 1.45,
                    }}
                  >
                    {truncar(d.texto, 130)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Coluna direita — Ações sugeridas e, abaixo, Alertas */}
        {temColunaDireita && (
          <div style={col({ flex: 1, minWidth: 0, gap: 24 })}>
            {acoes.length > 0 && (
              <div style={col()}>
                <SecaoTitulo label="Ações sugeridas" />
                <div
                  style={col({
                    background: C.card,
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: C.cardBorda,
                    borderRadius: 14,
                    paddingTop: 18,
                    paddingBottom: 18,
                    paddingLeft: 20,
                    paddingRight: 20,
                    gap: 18,
                  })}
                >
                  {acoes.map((a, i) => (
                    <div key={i} style={row({ gap: 14, alignItems: "flex-start" })}>
                      <div
                        style={{
                          display: "flex",
                          width: 40,
                          flexShrink: 0,
                          fontSize: 22,
                          fontWeight: 800,
                          color: C.roxo,
                        }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          width: 1,
                          alignSelf: "stretch",
                          background: "rgba(255,255,255,0.12)",
                          flexShrink: 0,
                        }}
                      />
                      <div
                        style={{
                          display: "flex",
                          flex: 1,
                          minWidth: 0,
                          fontSize: fonteItem,
                          color: C.branco,
                          lineHeight: 1.45,
                          paddingLeft: 4,
                        }}
                      >
                        {truncar(a, 120)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {alertas.length > 0 && (
              <div style={col({ flex: 1 })}>
                <SecaoTitulo label="Alertas" />
                <div
                  style={col({
                    flex: 1,
                    background: C.vermelhoBg,
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: C.vermelhoBorda,
                    borderRadius: 14,
                    paddingTop: 16,
                    paddingBottom: 16,
                    paddingLeft: 18,
                    paddingRight: 18,
                    gap: 12,
                  })}
                >
                  {alertas.map((a, i) => (
                    <div key={i} style={row({ gap: 12, alignItems: "flex-start" })}>
                      <AlertaIcone />
                      <div
                        style={{
                          display: "flex",
                          flex: 1,
                          minWidth: 0,
                          fontSize: fonteItem,
                          color: C.branco,
                          lineHeight: 1.45,
                          paddingTop: 2,
                        }}
                      >
                        {truncar(a, 120)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Rodapé ── */}
      <div style={row({ justifyContent: "space-between", alignItems: "center", marginTop: 20 })}>
        <div style={{ display: "flex", fontSize: 16, fontWeight: 800, color: C.branco, opacity: 0.35 }}>
          gestfy
        </div>
        <div style={{ display: "flex", fontSize: 14, color: C.lavanda, opacity: 0.8 }}>
          {rodape.mes_ano}
        </div>
      </div>
    </div>
  );
}
