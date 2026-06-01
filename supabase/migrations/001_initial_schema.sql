-- ============================================================
-- 001_initial_schema.sql
-- Schema inicial — Relatório Semanal de Clínicas (Gestfy)
-- ============================================================
-- Segurança: RLS desabilitado intencionalmente.
-- Este é um app interno sem usuários individuais.
-- A proteção ocorre via APP_PASSWORD no proxy (Next.js):
-- um cookie HMAC-SHA256 é validado em toda requisição antes
-- de qualquer dado chegar ao banco.
-- ============================================================

-- ─── Helper: updated_at automático ───────────────────────────────────────────

create or replace function set_updated_at()
returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── 1. clinicas ─────────────────────────────────────────────────────────────

create table clinicas (
  id              uuid        primary key default gen_random_uuid(),
  nome            text        not null,
  slug            text        not null unique,
  tag_curta       text,
  google_place_id text,
  ativa           boolean     not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table  clinicas                  is 'Cadastro das clínicas participantes dos relatórios semanais';
comment on column clinicas.slug             is 'Identificador URL-safe único, ex: axem-paulista';
comment on column clinicas.tag_curta        is 'Sigla exibida no cabeçalho do infográfico, ex: AXEM';
comment on column clinicas.google_place_id  is 'Place ID do Google Maps; usado para buscar nota e avaliações via Places API';

create trigger trg_clinicas_updated_at
  before update on clinicas
  for each row execute function set_updated_at();

create index idx_clinicas_ativa on clinicas (ativa);

-- ─── 2. fontes_dados ─────────────────────────────────────────────────────────

create table fontes_dados (
  id           uuid primary key default gen_random_uuid(),
  clinica_id   uuid not null references clinicas (id) on delete cascade,
  tipo         text not null check (tipo in ('pre_consulta', 'nps')),
  sheet_id     text not null,
  aba_nome     text not null,
  coluna_data  text not null,
  mapeamento   jsonb not null,
  ativo        boolean not null default true,
  unique (clinica_id, tipo)
);

comment on table  fontes_dados            is 'Configuração das planilhas Google Sheets por clínica e tipo de pesquisa';
comment on column fontes_dados.tipo       is 'pre_consulta = pesquisa pré-consulta; nps = pesquisa pós-consulta (Net Promoter Score)';
comment on column fontes_dados.sheet_id   is 'ID da planilha extraído da URL: docs.google.com/spreadsheets/d/{sheet_id}/';
comment on column fontes_dados.aba_nome   is 'Nome exato da aba (sheet) dentro da planilha';
comment on column fontes_dados.coluna_data is 'Nome ou letra da coluna que contém a data/hora de resposta';
comment on column fontes_dados.mapeamento is 'JSON mapeando campos semânticos para colunas, ex: {"nota_geral": "C", "comentario": "F"}';

create index idx_fontes_dados_clinica on fontes_dados (clinica_id);

-- ─── 3. tipos_meta ───────────────────────────────────────────────────────────

create table tipos_meta (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  unidade          text not null,
  formato          text not null check (
                     formato in ('moeda_brl', 'numero_inteiro', 'numero_decimal', 'percentual')
                   ),
  ordem_exibicao   int  not null default 0,
  created_at       timestamptz not null default now()
);

comment on table  tipos_meta                  is 'Definição dos tipos de indicadores/metas acompanhados por clínica';
comment on column tipos_meta.unidade          is 'Unidade de medida exibida, ex: R$, respostas, pontos, estrelas';
comment on column tipos_meta.formato          is 'Como formatar: moeda_brl=R$ 1.234,56 | numero_inteiro=1.234 | numero_decimal=4,8 | percentual=12,3%';
comment on column tipos_meta.ordem_exibicao   is 'Ordem de exibição no infográfico; menor número = aparece primeiro';

-- ─── 4. metas ────────────────────────────────────────────────────────────────

create table metas (
  id                       uuid    primary key default gen_random_uuid(),
  clinica_id               uuid    not null references clinicas   (id) on delete cascade,
  tipo_meta_id             uuid    not null references tipos_meta (id) on delete cascade,
  mes                      int     not null check (mes between 1 and 12),
  ano                      int     not null,
  valor_meta_mensal        numeric not null,
  valor_realizado          numeric not null default 0,
  valor_realizado_semana   numeric not null default 0,
  data_referencia          date,
  unique (clinica_id, tipo_meta_id, mes, ano)
);

comment on table  metas                          is 'Metas mensais e realizados por clínica e tipo de indicador';
comment on column metas.valor_meta_mensal        is 'Meta definida para o mês inteiro';
comment on column metas.valor_realizado          is 'Valor acumulado real até data_referencia (todo o mês corrente)';
comment on column metas.valor_realizado_semana   is 'Incremento realizado apenas na semana do relatório; exibido no infográfico';
comment on column metas.data_referencia          is 'Data de corte da apuração; normalmente o último dia da semana do relatório';

create index idx_metas_clinica         on metas (clinica_id);
create index idx_metas_mes_ano         on metas (mes, ano);
create index idx_metas_clinica_periodo on metas (clinica_id, mes, ano);

-- ─── 5. feriados ─────────────────────────────────────────────────────────────

create table feriados (
  data       date primary key,
  descricao  text not null,
  uf         text
);

comment on table  feriados     is 'Calendário de feriados para excluir da contagem de dias úteis nos relatórios';
comment on column feriados.uf  is 'Sigla do estado (SP, RJ…) para feriados estaduais; NULL = feriado nacional';

-- ─── 6. relatorios_gerados ───────────────────────────────────────────────────

create table relatorios_gerados (
  id                  uuid        primary key default gen_random_uuid(),
  clinica_id          uuid        not null references clinicas (id) on delete cascade,
  formato             text        not null check (
                        formato in ('whatsapp_pesquisas', 'whatsapp_metas', 'imagem')
                      ),
  data_inicio         date,
  data_fim            date,
  conteudo_markdown   text,
  dados_json          jsonb,
  gerado_em           timestamptz not null default now()
);

comment on table  relatorios_gerados                   is 'Histórico de relatórios gerados; conteúdo completo armazenado para reuso e auditoria';
comment on column relatorios_gerados.formato           is 'whatsapp_pesquisas=texto NPS/pré-consulta | whatsapp_metas=texto de metas | imagem=dados do infográfico';
comment on column relatorios_gerados.conteudo_markdown is 'Texto formatado para WhatsApp (emojis, negrito *asterisco*); preenchido nos formatos whatsapp_*';
comment on column relatorios_gerados.dados_json        is 'Estrutura JSON completa do infográfico para renderização; preenchida no formato imagem';

create index idx_relatorios_clinica   on relatorios_gerados (clinica_id);
create index idx_relatorios_gerado_em on relatorios_gerados (clinica_id, gerado_em desc);

-- ─── Seeds: tipos_meta ────────────────────────────────────────────────────────
-- Descomente e execute após criar as tabelas.
-- Cada clínica pode usar qualquer subconjunto destes tipos.

/*
insert into tipos_meta (nome, unidade, formato, ordem_exibicao) values
  ('Faturamento',          'R$',         'moeda_brl',      1),
  ('NPS — Respostas',      'respostas',  'numero_inteiro',  2),
  ('Nota NPS Recepção',    'pontos',     'numero_decimal',  3),
  ('Nota Google',          'estrelas',   'numero_decimal',  4);
*/
