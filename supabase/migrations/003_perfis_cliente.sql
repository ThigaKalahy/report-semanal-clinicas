-- ============================================================
-- 003_perfis_cliente.sql
-- Perfil do cliente — quem é a clínica e como falar com ela
-- ============================================================
-- Uma ficha por clínica (1:1). Alimenta duas coisas:
--   1. o VOCABULÁRIO dos textos gerados (paciente/cliente,
--      médico/dentista/loja, procedimento/tratamento/venda…);
--   2. o CONTEXTO passado à IA (prioridades, pessoas, tom e
--      assuntos a evitar).
--
-- Clínica sem linha aqui funciona normalmente: vale o vocabulário
-- neutro e a IA trabalha só com os números.
-- ============================================================

create table perfis_cliente (
  clinica_id      uuid        primary key references clinicas (id) on delete cascade,
  cidade          text        not null default '',
  uf              text        not null default '',
  segmento_tipo   text        check (
                    segmento_tipo is null or segmento_tipo in
                    ('clinica', 'odontologia', 'estetica', 'varejo', 'servicos', 'outro')
                  ),
  segmento        text        not null default '',
  especialidades  text        not null default '',
  vocabulario     jsonb       not null default '{}'::jsonb,
  porte           text        check (
                    porte is null or porte in
                    ('ate50', '50a150', '150a400', '400a1000', 'acima1000')
                  ),
  modelo          text        check (
                    modelo is null or modelo in ('particular', 'convenio', 'misto')
                  ),
  perfil          text        not null default '',
  prioridades     text        not null default '',
  pessoas         text        not null default '',
  estilo          text        not null default '',
  evitar          text        not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table  perfis_cliente                is 'Ficha do cliente: segmento, vocabulário dos textos e contexto para a IA';
comment on column perfis_cliente.segmento_tipo  is 'Tipo de negócio; define o vocabulário padrão (clinica | odontologia | estetica | varejo | servicos | outro)';
comment on column perfis_cliente.segmento       is 'Descrição livre do negócio, ex: "Clínica médica especializada em ginecologia integrativa"';
comment on column perfis_cliente.vocabulario    is 'Termos que sobrescrevem o padrão do segmento: {cliente, clientes, profissional, profissionais, servico, servicos, area, areas, saudacao}';
comment on column perfis_cliente.porte          is 'Faixa de faturamento mensal: ate50 | 50a150 | 150a400 | 400a1000 | acima1000 (em R$ mil)';
comment on column perfis_cliente.modelo         is 'Modelo de negócio em saúde: particular | convenio | misto';
comment on column perfis_cliente.estilo         is 'Como escrever para este cliente: tom, tratamento, o que valorizam';
comment on column perfis_cliente.evitar         is 'Assuntos que os textos não devem tocar';

create trigger trg_perfis_cliente_updated_at
  before update on perfis_cliente
  for each row execute function set_updated_at();
