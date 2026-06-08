import React from "react";
import type { RelatorioImagemData, DestaqueItem } from "./imagem-tipos";

// ─── Paleta ──────────────────────────────────────────────────────────────────
const C = {
  bg: "#210246",
  bgFim: "#1A0138",
  card: "#440570",
  alerta: "#2F0342",
  laranja: "#F4500F",
  lavanda: "#B9A3D4",
  branco: "#FFFFFF",
  vermelho: "#E53935",
  verde: "#2E9E5B",
  ambar: "#E6A700",
} as const;

type S = React.CSSProperties;

// ─── Helpers de layout (todos com display:flex explícito) ─────────────────────
function col(extra?: S): S {
  return { display: "flex", flexDirection: "column", ...extra };
}
function row(extra?: S): S {
  return { display: "flex", flexDirection: "row", ...extra };
}

// ─── Divisor degradê ─────────────────────────────────────────────────────────
function Divider() {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: 2,
        background: `linear-gradient(90deg, ${C.laranja}, ${C.card})`,
        marginTop: 18,
        marginBottom: 18,
      }}
    />
  );
}

// ─── Título de seção ─────────────────────────────────────────────────────────
function SecaoTitulo({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        fontSize: 18,
        fontWeight: 800,
        color: C.laranja,
        letterSpacing: 3,
        textTransform: "uppercase",
        marginBottom: 16,
      }}
    >
      {label}
    </div>
  );
}

// ─── Rótulo interno de card ───────────────────────────────────────────────────
function CardLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        fontSize: 11,
        color: C.lavanda,
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 4,
      }}
    >
      {label}
    </div>
  );
}

// ─── Status pill: diferença vs meta proporcional (+/-X%) ─────────────────────
function StatusPill({ pct, acima }: { pct: number; acima: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: acima ? C.verde : C.vermelho,
        borderRadius: 4,
        paddingTop: 2,
        paddingBottom: 2,
        paddingLeft: 7,
        paddingRight: 7,
        fontSize: 12,
        fontWeight: 700,
        color: C.branco,
      }}
    >
      {acima ? "+" : "-"}
      {pct}%
    </div>
  );
}

// ─── Atingimento pill: realizado / meta_mensal ("X% da meta") ─────────────────
function AtingimentoPill({ pct, acima }: { pct: number; acima: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: acima ? C.verde : C.vermelho,
        borderRadius: 4,
        paddingTop: 2,
        paddingBottom: 2,
        paddingLeft: 7,
        paddingRight: 7,
        fontSize: 12,
        fontWeight: 700,
        color: C.branco,
      }}
    >
      {pct}% da meta
    </div>
  );
}

// ─── Linha label + valor + pill ───────────────────────────────────────────────
function MetaLinha({
  label,
  valor,
  pct,
  acima,
  tipo = "diferenca",
}: {
  label: string;
  valor: string;
  pct: number | null;
  acima: boolean;
  tipo?: "diferenca" | "atingimento";
}) {
  return (
    <div style={col({ gap: 2 })}>
      <div
        style={{
          display: "flex",
          fontSize: 11,
          color: C.lavanda,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {label}
      </div>
      <div style={row({ alignItems: "center", gap: 8 })}>
        <div style={{ display: "flex", fontSize: 15, fontWeight: 600, color: C.branco }}>
          {valor}
        </div>
        {pct !== null && (
          tipo === "atingimento"
            ? <AtingimentoPill pct={pct} acima={acima} />
            : <StatusPill pct={pct} acima={acima} />
        )}
      </div>
    </div>
  );
}

// ─── Ícone de destaque (substitui emoji ✓ / ⚠️ / $) ─────────────────────────
function DestaqueIcone({ tipo }: { tipo: DestaqueItem["tipo"] }) {
  const map: Record<DestaqueItem["tipo"], { symbol: string; bg: string; color: string }> = {
    positivo:  { symbol: "+",  bg: C.verde   + "33", color: C.verde   },
    financeiro:{ symbol: "$",  bg: C.laranja + "33", color: C.laranja },
    atencao:   { symbol: "!",  bg: C.ambar   + "33", color: C.ambar   },
  };
  const { symbol, bg, color } = map[tipo] ?? map.atencao;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: 6,
        background: bg,
        fontSize: 14,
        fontWeight: 800,
        color,
        flexShrink: 0,
      }}
    >
      {symbol}
    </div>
  );
}

// ─── Ícone de alerta (substitui emoji 🚨) ────────────────────────────────────
function AlertaIcone() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        borderRadius: 4,
        background: C.vermelho,
        fontSize: 12,
        fontWeight: 800,
        color: C.branco,
        flexShrink: 0,
      }}
    >
      !
    </div>
  );
}

// ─── Card genérico ────────────────────────────────────────────────────────────
function CardBox({ children, style }: { children: React.ReactNode; style?: S }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: C.card,
        borderRadius: 20,
        paddingTop: 20,
        paddingBottom: 20,
        paddingLeft: 24,
        paddingRight: 24,
        gap: 8,
        ...style,
      }}
    >
      {children}
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
      tag: raw.cabecalho?.tag ?? "TAG",
      periodo_ini: raw.cabecalho?.periodo_ini ?? "--",
      periodo_fim: raw.cabecalho?.periodo_fim ?? "--",
    },
    rodape: { mes_ano: raw.rodape?.mes_ano ?? "" },
    visaoGeral: {
      faturamento: {
        is_media:      f?.is_media      ?? false,
        acumulado:     f?.acumulado     ?? "N/A",
        meta_periodo:  f?.meta_periodo  ?? "N/A",
        pct_periodo:   f?.pct_periodo   ?? null,
        acima_periodo: f?.acima_periodo ?? false,
        meta_mensal:   f?.meta_mensal   ?? "N/A",
        pct_mensal:    f?.pct_mensal    ?? null,
        acima_mensal:  f?.acima_mensal  ?? false,
      },
      npsGoogle: {
        // Suporta dados antigos (meta_nps_realizado era separado de respostas_nps)
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

// ─── Componente principal ─────────────────────────────────────────────────────
export function InfograficoOG({
  dados: rawDados,
  logoSrc,
  height,
}: {
  dados: RelatorioImagemData;
  logoSrc?: string | null;
  height: number;
}) {
  const dados = withDefaults(rawDados);
  const { cabecalho, rodape, visaoGeral, destaques, alertas, acoes } = dados;
  const fat = visaoGeral.faturamento;
  const ng  = visaoGeral.npsGoogle;
  const com = visaoGeral.comercial;

  // Truncate long clinic names so the header stays on one line
  const nome = cabecalho.clinica_nome || "Clínica";
  const nomeTruncado = nome.length > 30 ? nome.slice(0, 27) + "..." : nome;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 800,
        height: height,
        background: `linear-gradient(180deg, ${C.bg} 80%, ${C.bgFim} 100%)`,
        fontFamily: "Inter",
        paddingTop: 36,
        paddingBottom: 36,
        paddingLeft: 40,
        paddingRight: 40,
      }}
    >
      {/* ── Cabeçalho ── */}
      <div
        style={row({
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
        })}
      >
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoSrc} width={120} height={36} alt="Gestfy" style={{ objectFit: "contain" }} />
        ) : (
          <div style={{ display: "flex", fontSize: 22, fontWeight: 800, color: C.branco, letterSpacing: 1 }}>
            gestfy
          </div>
        )}
        <div style={col({ alignItems: "flex-end", gap: 4, maxWidth: 540 })}>
          <div
            style={{
              display: "flex",
              fontSize: 13,
              fontWeight: 800,
              color: C.laranja,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            REPORT SEMANAL — [{nomeTruncado}]
          </div>
          <div style={{ display: "flex", fontSize: 12, color: C.lavanda }}>
            {cabecalho.periodo_ini} até {cabecalho.periodo_fim}
          </div>
        </div>
      </div>

      <Divider />

      {/* ── Visão Geral ── */}
      <SecaoTitulo label="VISÃO GERAL" />

      {(() => {
        const isNA = (v: string) => v === "N/A";

        // ── Faturamento ──────────────────────────────────────────────────────
        const fatVisible = !isNA(fat.acumulado);
        const showMetaPeriodo = fatVisible && !fat.is_media && !isNA(fat.meta_periodo);

        // ── NPS / Google ─────────────────────────────────────────────────────
        const npsVisible =
          ng.respostas_nps !== null ||
          ng.avaliacoes_google !== null ||
          ng.meta_nps_meta !== null ||
          ng.meta_google_meta !== null;

        // ── Comercial ────────────────────────────────────────────────────────
        const comercialRows = [
          { label: "Conversão de leads",      val: com.conversao_leads      },
          { label: "Conversão de orçamentos", val: com.conversao_orcamentos },
          { label: "Total de leads",           val: com.total_leads          },
          { label: "Total de orçamentos",      val: com.total_orcamentos     },
        ].filter((r) => !isNA(r.val));
        const comercialVisible = comercialRows.length > 0;

        return (
          <div style={col({ gap: 16, marginBottom: 8 })}>
            {/* Faturamento */}
            {fatVisible && (
              <CardBox>
                <CardLabel label="FATURAMENTO x META" />
                <div style={col({ gap: 10 })}>
                  {showMetaPeriodo && (
                    <MetaLinha
                      label="Acumulado x Meta do período"
                      valor={`${fat.acumulado} × ${fat.meta_periodo}`}
                      pct={fat.pct_periodo}
                      acima={fat.acima_periodo}
                    />
                  )}
                  {!showMetaPeriodo && (
                    <MetaLinha
                      label="Acumulado"
                      valor={fat.acumulado}
                      pct={null}
                      acima={false}
                    />
                  )}
                  <MetaLinha
                    label="Meta mensal"
                    valor={fat.meta_mensal}
                    pct={fat.pct_mensal}
                    acima={fat.acima_mensal}
                    tipo="atingimento"
                  />
                </div>
              </CardBox>
            )}

            {/* NPS / Google */}
            {npsVisible && (
              <CardBox>
                <CardLabel label="NPS / GOOGLE" />
                <div style={col({ gap: 8 })}>
                  {(ng.respostas_nps !== null || ng.avaliacoes_google !== null) && (
                    <div style={row({ gap: 32 })}>
                      {ng.respostas_nps !== null && (
                        <div style={col({ gap: 2 })}>
                          <div style={{ display: "flex", fontSize: 11, color: C.lavanda }}>Respostas NPS</div>
                          <div style={{ display: "flex", fontSize: 18, fontWeight: 800, color: C.branco }}>
                            {String(ng.respostas_nps)}
                          </div>
                        </div>
                      )}
                      {ng.avaliacoes_google !== null && (
                        <div style={col({ gap: 2 })}>
                          <div style={{ display: "flex", fontSize: 11, color: C.lavanda }}>Avaliações Google</div>
                          <div style={{ display: "flex", fontSize: 18, fontWeight: 800, color: C.branco }}>
                            {String(ng.avaliacoes_google)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {ng.meta_nps_meta !== null && (() => {
                    const pct = ng.respostas_nps !== null && ng.meta_nps_meta > 0
                      ? Math.round(ng.respostas_nps / ng.meta_nps_meta * 100) : null;
                    return (
                      <MetaLinha
                        label="Meta NPS"
                        valor={`${ng.respostas_nps !== null ? String(ng.respostas_nps) : "—"} / ${ng.meta_nps_meta}`}
                        pct={pct}
                        acima={(pct ?? 0) >= 100}
                        tipo="atingimento"
                      />
                    );
                  })()}
                  {ng.meta_google_meta !== null && (() => {
                    const pct = ng.avaliacoes_google !== null && ng.meta_google_meta > 0
                      ? Math.round(ng.avaliacoes_google / ng.meta_google_meta * 100) : null;
                    return (
                      <MetaLinha
                        label="Meta Google"
                        valor={`${ng.avaliacoes_google !== null ? String(ng.avaliacoes_google) : "—"} / ${ng.meta_google_meta}`}
                        pct={pct}
                        acima={(pct ?? 0) >= 100}
                        tipo="atingimento"
                      />
                    );
                  })()}
                </div>
              </CardBox>
            )}

            {/* Comercial */}
            {comercialVisible && (
              <CardBox>
                <CardLabel label="COMERCIAL E CONVERSÃO" />
                <div style={col({ gap: 8 })}>
                  {comercialRows.map(({ label, val }) => (
                    <div key={label} style={row({ justifyContent: "space-between", alignItems: "center" })}>
                      <div style={{ display: "flex", fontSize: 13, color: C.lavanda }}>{label}</div>
                      <div style={{ display: "flex", fontSize: 15, fontWeight: 600, color: C.branco }}>{val}</div>
                    </div>
                  ))}
                </div>
              </CardBox>
            )}
          </div>
        );
      })()}

      {/* ── Destaques ── */}
      {destaques.length > 0 && (
        <div style={col()}>
          <Divider />
          <SecaoTitulo label="PRINCIPAIS DESTAQUES" />
          <div style={col({ gap: 10, marginBottom: 8 })}>
            {destaques.map((d, i) => (
              <div key={i} style={row({ gap: 12, alignItems: "flex-start" })}>
                <DestaqueIcone tipo={d.tipo} />
                <div style={{ display: "flex", fontSize: 14, color: C.branco, lineHeight: 1.5, paddingTop: 4 }}>
                  {d.texto}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Alertas ── */}
      {alertas.length > 0 && (
        <div style={col()}>
          <Divider />
          <SecaoTitulo label="ALERTAS" />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              background: C.alerta,
              borderLeftWidth: 4,
              borderLeftStyle: "solid",
              borderLeftColor: C.vermelho,
              borderTopRightRadius: 12,
              borderBottomRightRadius: 12,
              paddingTop: 16,
              paddingBottom: 16,
              paddingLeft: 20,
              paddingRight: 20,
              gap: 10,
              marginBottom: 8,
            }}
          >
            {alertas.map((a, i) => (
              <div key={i} style={row({ gap: 10, alignItems: "flex-start" })}>
                <AlertaIcone />
                <div style={{ display: "flex", fontSize: 14, color: C.branco, lineHeight: 1.5 }}>
                  {a}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Ações Sugeridas ── */}
      {acoes.length > 0 && (
        <div style={col()}>
          <Divider />
          <SecaoTitulo label="AÇÕES SUGERIDAS" />
          <div style={col({ gap: 10, marginBottom: 8 })}>
            {acoes.map((a, i) => (
              <div key={i} style={row({ gap: 14, alignItems: "flex-start" })}>
                <div
                  style={{
                    display: "flex",
                    fontSize: 15,
                    fontWeight: 800,
                    color: C.laranja,
                    minWidth: 28,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div style={{ display: "flex", fontSize: 14, color: C.branco, lineHeight: 1.5 }}>
                  {a}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Rodapé ── */}
      <Divider />
      <div style={row({ justifyContent: "space-between", alignItems: "center" })}>
        <div style={{ display: "flex", fontSize: 16, fontWeight: 800, color: C.branco, opacity: 0.3 }}>
          gestfy
        </div>
        <div style={{ display: "flex", fontSize: 12, color: C.lavanda }}>
          {rodape.mes_ano}
        </div>
      </div>
    </div>
  );
}
