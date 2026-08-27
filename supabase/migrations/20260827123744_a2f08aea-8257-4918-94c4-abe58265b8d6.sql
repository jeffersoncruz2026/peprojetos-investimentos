alter table public.item_orcamento
  add column if not exists codigo_rm_projeto text unique;

create index if not exists ix_item_orcamento_codigo_rm_projeto
  on public.item_orcamento(codigo_rm_projeto);

create or replace view public.v_pendencias as
select
  r.id, r.data_lancamento, r.codigo_cc_origem, r.conta_contabil,
  r.documento, r.historico, r.valor,
  case
    when r.item_orcamento_id is null   then 'SEM ITEM VINCULADO'
    when r.centro_custo_id is null     then 'CENTRO DE CUSTO NAO CADASTRADO'
  end as motivo
from public.realizado r
where r.centro_custo_id is null or r.item_orcamento_id is null;