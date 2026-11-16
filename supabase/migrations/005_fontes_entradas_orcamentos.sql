-- ============================================================
-- 005_fontes_entradas_orcamentos.sql
-- Duas fontes de dados novas: Entradas e Orçamentos
-- ============================================================
-- fontes_dados.tipo passa a aceitar:
--   entradas   = recebimentos (o que entrou no caixa), pela data
--                do recebimento;
--   orcamentos = orçamentos gerados, com status de fechamento.
--
-- As duas usam UMA aba ("Base"), como Leads: aba_nome guarda a
-- aba, coluna_data a coluna da data, e mapeamento as demais
-- colunas (ver lib/fontes/campos.ts).
--
-- Também passam a existir colunas opcionais novas no mapeamento
-- de Faturamento, Despesa e Leads (1ª vez, unidade, meio de
-- pagamento, origem, canal…). São chaves do JSON — não exigem
-- mudança de esquema.
--
-- A restrição antiga é localizada pelo conteúdo, e não pelo nome,
-- porque ela já foi alterada fora das migrações.
-- ============================================================

do $$
declare
  r record;
begin
  for r in
    select conname
      from pg_constraint
     where conrelid = 'fontes_dados'::regclass
       and contype  = 'c'
       and pg_get_constraintdef(oid) ilike '%tipo%'
  loop
    execute format('alter table fontes_dados drop constraint %I', r.conname);
  end loop;
end $$;

alter table fontes_dados
  add constraint fontes_dados_tipo_check
  check (tipo in ('pre_consulta', 'nps', 'leads', 'faturamento', 'despesa', 'entradas', 'orcamentos'));

comment on column fontes_dados.tipo is
  'pre_consulta | nps | leads | faturamento | despesa | entradas (recebimentos) | orcamentos';
