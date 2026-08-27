-- =====================================================================
-- 02 — Views preparadas para múltiplas safras
-- Rode DEPOIS de 01_supabase_schema.sql.
-- =====================================================================
-- O schema original (01) não expõe safra_id em v_item_mes / v_item_acumulado
-- e tem v_cc_acumulado / v_curva_mensal fixos numa única safra (o
-- generate_series de v_curva_mensal é literalmente '2026-04-01'..'2027-03-01').
-- Isso funciona enquanto só existe a safra 2026/2027, mas quebra quando
-- 2027/2028 for criada. Este arquivo substitui essas views/consultas por
-- versões que recebem a safra como parâmetro, para o seletor de safra do
-- app funcionar de verdade.

create or replace view v_item_mes as
select
  i.id                as item_id,
  i.codigo,
  i.safra_id,
  i.descricao         as item,
  i.tipo,
  i.status,
  cc.codigo_rm,
  cc.nome             as centro_custo,
  cc.atividade,
  m.competencia,
  m.valor             as orcado,
  coalesce(r.realizado, 0)      as realizado,
  coalesce(r.realizado, 0) - m.valor as desvio,
  case when m.valor = 0 then null
       else round(coalesce(r.realizado,0) / m.valor * 100, 1)
  end                 as pct_execucao
from orcamento_mensal m
join item_orcamento i  on i.id = m.item_orcamento_id
join centro_custo   cc on cc.id = i.centro_custo_id
left join lateral (
  select sum(rl.valor) as realizado
  from realizado rl
  where rl.item_orcamento_id = i.id
    and rl.competencia = m.competencia
) r on true;

create or replace view v_item_acumulado as
select
  i.id            as item_id,
  i.codigo,
  i.safra_id,
  i.descricao     as item,
  i.tipo,
  i.status,
  i.responsavel,
  cc.codigo_rm,
  cc.nome         as centro_custo,
  cc.atividade,
  coalesce(o.orcado, 0)                   as orcado,
  coalesce(r.realizado, 0)                as realizado,
  coalesce(c.comprometido, 0)             as comprometido,
  coalesce(o.orcado,0) - coalesce(r.realizado,0) - coalesce(c.comprometido,0) as saldo,
  case when coalesce(o.orcado,0) = 0 then null
       else round(coalesce(r.realizado,0) / o.orcado * 100, 1)
  end             as pct_execucao,
  case
    when coalesce(o.orcado,0) = 0 and coalesce(r.realizado,0) > 0 then 'SEM ORCAMENTO'
    when coalesce(r.realizado,0) + coalesce(c.comprometido,0) > coalesce(o.orcado,0) then 'ESTOURADO'
    when coalesce(r.realizado,0) >= coalesce(o.orcado,0) * 0.9 then 'ATENCAO'
    else 'OK'
  end             as farol
from item_orcamento i
join centro_custo cc on cc.id = i.centro_custo_id
left join (select item_orcamento_id, sum(valor) orcado
           from orcamento_mensal group by 1) o on o.item_orcamento_id = i.id
left join (select item_orcamento_id, sum(valor) realizado
           from realizado where item_orcamento_id is not null group by 1) r on r.item_orcamento_id = i.id
left join (select item_orcamento_id, sum(valor) comprometido
           from compromisso where status = 'ABERTO' group by 1) c on c.item_orcamento_id = i.id;

-- v_cc_acumulado por safra: orçado vem do item (tem safra_id), realizado vem
-- direto da tabela realizado (também tem safra_id) — continua fechando com
-- o RM mesmo sem amarração item a item.
create or replace function f_cc_acumulado(p_safra_id text)
returns table (
  centro_custo_id uuid,
  codigo_rm text,
  centro_custo text,
  atividade text,
  orcado numeric,
  realizado numeric,
  saldo numeric,
  pct_execucao numeric
)
language sql stable as $$
  select
    cc.id           as centro_custo_id,
    cc.codigo_rm,
    cc.nome         as centro_custo,
    cc.atividade,
    coalesce(o.orcado, 0)    as orcado,
    coalesce(r.realizado, 0) as realizado,
    coalesce(o.orcado,0) - coalesce(r.realizado,0) as saldo,
    case when coalesce(o.orcado,0) = 0 then null
         else round(coalesce(r.realizado,0) / o.orcado * 100, 1)
    end             as pct_execucao
  from centro_custo cc
  left join (
    select i.centro_custo_id, sum(m.valor) orcado
    from orcamento_mensal m
    join item_orcamento i on i.id = m.item_orcamento_id
    where i.safra_id = p_safra_id
    group by 1
  ) o on o.centro_custo_id = cc.id
  left join (
    select centro_custo_id, sum(valor) realizado
    from realizado
    where safra_id = p_safra_id
    group by 1
  ) r on r.centro_custo_id = cc.id;
$$;

-- v_curva_mensal por safra: usa a data_inicio/data_fim reais da safra, em
-- vez de um intervalo fixo.
create or replace function f_curva_mensal(p_safra_id text)
returns table (
  competencia date,
  orcado_mes numeric,
  realizado_mes numeric,
  orcado_acum numeric,
  realizado_acum numeric
)
language sql stable as $$
  with s as (
    select date_trunc('month', data_inicio)::date as ini,
           date_trunc('month', data_fim)::date as fim
    from safra where id = p_safra_id
  ),
  comp as (
    select generate_series((select ini from s), (select fim from s), '1 month')::date as competencia
  ),
  o as (
    select m.competencia, sum(m.valor) orcado
    from orcamento_mensal m
    join item_orcamento i on i.id = m.item_orcamento_id
    where i.safra_id = p_safra_id
    group by 1
  ),
  r as (
    select competencia, sum(valor) realizado
    from realizado
    where safra_id = p_safra_id
    group by 1
  )
  select
    comp.competencia,
    coalesce(o.orcado, 0)     as orcado_mes,
    coalesce(r.realizado, 0)  as realizado_mes,
    sum(coalesce(o.orcado,0))    over (order by comp.competencia) as orcado_acum,
    sum(coalesce(r.realizado,0)) over (order by comp.competencia) as realizado_acum
  from comp
  left join o on o.competencia = comp.competencia
  left join r on r.competencia = comp.competencia
  order by comp.competencia;
$$;

grant execute on function f_cc_acumulado(text) to authenticated, anon;
grant execute on function f_curva_mensal(text) to authenticated, anon;
