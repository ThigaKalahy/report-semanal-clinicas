-- ============================================================
-- 002_checkpoint_indicadores.sql
-- Checkpoint — quais indicadores cada clínica acompanha
-- ============================================================
-- O checkpoint confere, antes de gerar os reports, se as
-- planilhas da clínica estão em dia. Cada clínica acompanha um
-- subconjunto de uma lista fixa de 5 indicadores.
--
-- Clínica sem nenhuma linha aqui ainda não foi configurada: a
-- aplicação sugere, como padrão, os indicadores cuja fonte de
-- dados já existe (ex.: tem fonte de faturamento → Faturamento).
-- ============================================================

create table checkpoint_indicadores (
  id          uuid        primary key default gen_random_uuid(),
  clinica_id  uuid        not null references clinicas (id) on delete cascade,
  indicador   text        not null check (
                indicador in ('leads', 'fechamentos', 'nps', 'faturamento', 'despesas')
              ),
  ativo       boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (clinica_id, indicador)
);

comment on table  checkpoint_indicadores            is 'Indicadores acompanhados por clínica na tela de Checkpoint';
comment on column checkpoint_indicadores.indicador  is 'Lista fixa: leads | fechamentos | nps | faturamento | despesas';
comment on column checkpoint_indicadores.ativo      is 'false = indicador desligado para esta clínica (a linha é mantida para preservar a escolha)';

create trigger trg_checkpoint_indicadores_updated_at
  before update on checkpoint_indicadores
  for each row execute function set_updated_at();

create index idx_checkpoint_indicadores_clinica on checkpoint_indicadores (clinica_id);
