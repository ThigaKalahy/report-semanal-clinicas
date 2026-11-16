-- ============================================================
-- 006_fechamentos.sql
-- Fechamentos mensais e quinzenais
-- ============================================================
-- Um fechamento é o relatório financeiro de UMA clínica para UM
-- período:
--   mensal    = o mês inteiro (quinzena nula);
--   quinzenal = 1ª quinzena (dia 1 a 15) ou 2ª (dia 16 ao fim).
--
-- Fluxo (status):
--   em_conferencia → em_analise → concluido → enviado
--
-- "dados" guarda o retrato do que foi lido das planilhas e
-- calculado (lib/fechamento/dados.ts). O relatório é montado só a
-- partir dele: reabrir um fechamento antigo não relê planilha.
-- ============================================================

create table fechamentos (
  id           uuid        primary key default gen_random_uuid(),
  clinica_id   uuid        not null references clinicas (id) on delete cascade,
  tipo         text        not null check (tipo in ('mensal', 'quinzenal')),
  ano          int         not null check (ano between 2000 and 2100),
  mes          int         not null check (mes between 1 and 12),
  quinzena     int         check (quinzena in (1, 2)),
  data_inicio  date        not null,
  data_fim     date        not null,
  status       text        not null default 'em_conferencia'
                           check (status in ('em_conferencia', 'em_analise', 'concluido', 'enviado')),
  dados        jsonb,
  analise      text        not null default '',
  acoes        jsonb       not null default '[]'::jsonb,
  texto        text        not null default '',
  lido_em      timestamptz,
  enviado_em   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- mensal não tem quinzena; quinzenal sempre tem
  check ((tipo = 'mensal' and quinzena is null) or (tipo = 'quinzenal' and quinzena is not null))
);

-- Um fechamento por clínica, tipo e período
create unique index idx_fechamentos_periodo
  on fechamentos (clinica_id, tipo, ano, mes, coalesce(quinzena, 0));

create index idx_fechamentos_lista on fechamentos (ano desc, mes desc, clinica_id);

comment on table  fechamentos         is 'Fechamento financeiro mensal ou quinzenal de uma clínica';
comment on column fechamentos.status  is 'em_conferencia | em_analise | concluido | enviado';
comment on column fechamentos.dados   is 'Retrato do que foi lido e calculado para o período (lib/fechamento/dados.ts)';
comment on column fechamentos.acoes   is 'Plano de ação: lista de {texto, responsavel, prazo}';
comment on column fechamentos.texto   is 'Texto de entrega (WhatsApp), editável antes do envio';

create trigger trg_fechamentos_updated_at
  before update on fechamentos
  for each row execute function set_updated_at();
