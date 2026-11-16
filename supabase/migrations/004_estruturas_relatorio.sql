-- ============================================================
-- 004_estruturas_relatorio.sql
-- Estrutura do relatório por clínica
-- ============================================================
-- Uma linha por clínica (1:1) com a configuração dos relatórios
-- nas três periodicidades:
--
--   config = {
--     "semanal":   [ { "id": "semPreConsulta", "ativa": true, "ocultos": ["sem.pre.analise"] }, … ],
--     "quinzenal": [ { "id": "resultado", "ativa": true }, { "id": "funilLeads", "ativa": true, "nivel": "resumo" }, … ],
--     "mensal":    [ … ]
--   }
--
-- A ORDEM da lista é a ordem das seções no relatório. "ocultos"
-- guarda os indicadores desligados à mão; ausente = a seção segue
-- o padrão do nível.
--
-- O catálogo de seções e indicadores mora no código
-- (lib/estrutura/catalogo.ts). Clínica sem linha aqui usa a
-- estrutura padrão — os relatórios saem como sempre saíram.
-- ============================================================

create table estruturas_relatorio (
  clinica_id  uuid        primary key references clinicas (id) on delete cascade,
  config      jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table  estruturas_relatorio        is 'Estrutura dos relatórios por clínica: seções, ordem, nível e indicadores, por periodicidade';
comment on column estruturas_relatorio.config is '{semanal, quinzenal, mensal}: listas de {id, ativa, nivel?, ocultos?} na ordem de exibição';

create trigger trg_estruturas_relatorio_updated_at
  before update on estruturas_relatorio
  for each row execute function set_updated_at();
