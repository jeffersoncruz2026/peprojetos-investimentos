create table if not exists public.safra (
  id text primary key,
  data_inicio date not null,
  data_fim date not null,
  status text not null default 'ABERTA' check (status in ('ABERTA','CONGELADA','ENCERRADA'))
);

create table if not exists public.centro_custo (
  id uuid primary key default gen_random_uuid(),
  codigo_rm text not null unique,
  nome text not null,
  atividade text not null check (atividade in ('SERINGUEIRA','PECUARIA','AGRICOLA','ADMINISTRACAO','OFICINA','VEICULOS E MECANIZADOS','VENDA DE VEICULOS','CUSTEIO')),
  codigo_pai text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.conta_investimento (
  conta text primary key,
  descricao text,
  ativa boolean not null default true
);

create table if not exists public.item_orcamento (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  safra_id text not null references public.safra(id),
  centro_custo_id uuid not null references public.centro_custo(id),
  descricao text not null,
  tipo text not null default 'INVESTIMENTO' check (tipo in ('INVESTIMENTO','DESINVESTIMENTO','CUSTEIO')),
  status text not null default 'PLANEJADO' check (status in ('PLANEJADO','APROVADO','EM_ANDAMENTO','CONCLUIDO','CANCELADO','A_ORCAR')),
  responsavel text,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (safra_id, codigo)
);

create table if not exists public.orcamento_mensal (
  id uuid primary key default gen_random_uuid(),
  item_orcamento_id uuid not null references public.item_orcamento(id) on delete cascade,
  competencia date not null,
  valor numeric(14,2) not null default 0,
  unique (item_orcamento_id, competencia)
);
create index if not exists ix_orc_mensal_comp on public.orcamento_mensal(competencia);

create table if not exists public.orcamento_revisao (
  id uuid primary key default gen_random_uuid(),
  item_orcamento_id uuid not null references public.item_orcamento(id) on delete cascade,
  competencia date not null,
  valor_anterior numeric(14,2) not null,
  valor_novo numeric(14,2) not null,
  motivo text not null,
  usuario text,
  created_at timestamptz not null default now()
);

create table if not exists public.importacao (
  id uuid primary key default gen_random_uuid(),
  arquivo text not null,
  competencia date,
  linhas integer not null default 0,
  valor_total numeric(14,2) not null default 0,
  usuario text,
  created_at timestamptz not null default now()
);

create table if not exists public.realizado (
  id uuid primary key default gen_random_uuid(),
  importacao_id uuid references public.importacao(id) on delete set null,
  safra_id text not null references public.safra(id),
  centro_custo_id uuid references public.centro_custo(id),
  codigo_cc_origem text not null,
  conta_contabil text,
  data_lancamento date not null,
  competencia date not null,
  documento text,
  historico text,
  valor numeric(14,2) not null,
  item_orcamento_id uuid references public.item_orcamento(id),
  chave_rm text unique,
  created_at timestamptz not null default now()
);
create index if not exists ix_real_cc_comp on public.realizado(centro_custo_id, competencia);
create index if not exists ix_real_item on public.realizado(item_orcamento_id);

create table if not exists public.compromisso (
  id uuid primary key default gen_random_uuid(),
  item_orcamento_id uuid not null references public.item_orcamento(id) on delete cascade,
  descricao text not null,
  fornecedor text,
  numero_pedido text,
  valor numeric(14,2) not null,
  data_prevista date,
  status text not null default 'ABERTO' check (status in ('ABERTO','FATURADO','CANCELADO')),
  created_at timestamptz not null default now()
);

create or replace view public.v_pendencias as
select
  r.id, r.data_lancamento, r.codigo_cc_origem, r.conta_contabil,
  r.documento, r.historico, r.valor,
  case
    when r.centro_custo_id is null then 'CENTRO DE CUSTO NAO CADASTRADO'
    when r.item_orcamento_id is null then 'SEM ITEM VINCULADO'
  end as motivo
from public.realizado r
where r.centro_custo_id is null or r.item_orcamento_id is null;

create or replace view public.v_item_mes as
select
  i.id as item_id,
  i.codigo,
  i.safra_id,
  i.descricao as item,
  i.tipo,
  i.status,
  cc.codigo_rm,
  cc.nome as centro_custo,
  cc.atividade,
  m.competencia,
  m.valor as orcado,
  coalesce(r.realizado, 0) as realizado,
  coalesce(r.realizado, 0) - m.valor as desvio,
  case when m.valor = 0 then null else round(coalesce(r.realizado,0) / m.valor * 100, 1) end as pct_execucao
from public.orcamento_mensal m
join public.item_orcamento i on i.id = m.item_orcamento_id
join public.centro_custo cc on cc.id = i.centro_custo_id
left join lateral (
  select sum(rl.valor) as realizado
  from public.realizado rl
  where rl.item_orcamento_id = i.id and rl.competencia = m.competencia
) r on true;

create or replace view public.v_item_acumulado as
select
  i.id as item_id,
  i.codigo,
  i.safra_id,
  i.descricao as item,
  i.tipo,
  i.status,
  i.responsavel,
  cc.codigo_rm,
  cc.nome as centro_custo,
  cc.atividade,
  coalesce(o.orcado, 0) as orcado,
  coalesce(r.realizado, 0) as realizado,
  coalesce(c.comprometido, 0) as comprometido,
  coalesce(o.orcado,0) - coalesce(r.realizado,0) - coalesce(c.comprometido,0) as saldo,
  case when coalesce(o.orcado,0) = 0 then null else round(coalesce(r.realizado,0) / o.orcado * 100, 1) end as pct_execucao,
  case
    when coalesce(o.orcado,0) = 0 and coalesce(r.realizado,0) > 0 then 'SEM ORCAMENTO'
    when coalesce(r.realizado,0) + coalesce(c.comprometido,0) > coalesce(o.orcado,0) then 'ESTOURADO'
    when coalesce(r.realizado,0) >= coalesce(o.orcado,0) * 0.9 then 'ATENCAO'
    else 'OK'
  end as farol
from public.item_orcamento i
join public.centro_custo cc on cc.id = i.centro_custo_id
left join (select item_orcamento_id, sum(valor) orcado from public.orcamento_mensal group by 1) o on o.item_orcamento_id = i.id
left join (select item_orcamento_id, sum(valor) realizado from public.realizado where item_orcamento_id is not null group by 1) r on r.item_orcamento_id = i.id
left join (select item_orcamento_id, sum(valor) comprometido from public.compromisso where status = 'ABERTO' group by 1) c on c.item_orcamento_id = i.id;

create or replace function public.f_cc_acumulado(p_safra_id text)
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
language sql stable
security invoker
set search_path = public
as $$
  select
    cc.id as centro_custo_id,
    cc.codigo_rm,
    cc.nome as centro_custo,
    cc.atividade,
    coalesce(o.orcado, 0) as orcado,
    coalesce(r.realizado, 0) as realizado,
    coalesce(o.orcado,0) - coalesce(r.realizado,0) as saldo,
    case when coalesce(o.orcado,0) = 0 then null else round(coalesce(r.realizado,0) / o.orcado * 100, 1) end as pct_execucao
  from public.centro_custo cc
  left join (
    select i.centro_custo_id, sum(m.valor) orcado
    from public.orcamento_mensal m
    join public.item_orcamento i on i.id = m.item_orcamento_id
    where i.safra_id = p_safra_id
    group by 1
  ) o on o.centro_custo_id = cc.id
  left join (
    select centro_custo_id, sum(valor) realizado
    from public.realizado
    where safra_id = p_safra_id
    group by 1
  ) r on r.centro_custo_id = cc.id;
$$;

create or replace function public.f_curva_mensal(p_safra_id text)
returns table (
  competencia date,
  orcado_mes numeric,
  realizado_mes numeric,
  orcado_acum numeric,
  realizado_acum numeric
)
language sql stable
security invoker
set search_path = public
as $$
  with s as (
    select date_trunc('month', data_inicio)::date as ini,
           date_trunc('month', data_fim)::date as fim
    from public.safra where id = p_safra_id
  ),
  comp as (
    select generate_series((select ini from s), (select fim from s), '1 month')::date as competencia
  ),
  o as (
    select m.competencia, sum(m.valor) orcado
    from public.orcamento_mensal m
    join public.item_orcamento i on i.id = m.item_orcamento_id
    where i.safra_id = p_safra_id
    group by 1
  ),
  r as (
    select competencia, sum(valor) realizado
    from public.realizado
    where safra_id = p_safra_id
    group by 1
  )
  select
    comp.competencia,
    coalesce(o.orcado, 0) as orcado_mes,
    coalesce(r.realizado, 0) as realizado_mes,
    sum(coalesce(o.orcado,0)) over (order by comp.competencia) as orcado_acum,
    sum(coalesce(r.realizado,0)) over (order by comp.competencia) as realizado_acum
  from comp
  left join o on o.competencia = comp.competencia
  left join r on r.competencia = comp.competencia
  order by comp.competencia;
$$;

grant execute on function public.f_cc_acumulado(text) to authenticated;
grant execute on function public.f_curva_mensal(text) to authenticated;

alter table public.safra enable row level security;
grant select, insert, update, delete on public.safra to authenticated;
grant all on public.safra to service_role;
create policy "auth_full_safra" on public.safra for all to authenticated using (true) with check (true);

alter table public.centro_custo enable row level security;
grant select, insert, update, delete on public.centro_custo to authenticated;
grant all on public.centro_custo to service_role;
create policy "auth_full_centro_custo" on public.centro_custo for all to authenticated using (true) with check (true);

alter table public.conta_investimento enable row level security;
grant select, insert, update, delete on public.conta_investimento to authenticated;
grant all on public.conta_investimento to service_role;
create policy "auth_full_conta_investimento" on public.conta_investimento for all to authenticated using (true) with check (true);

alter table public.item_orcamento enable row level security;
grant select, insert, update, delete on public.item_orcamento to authenticated;
grant all on public.item_orcamento to service_role;
create policy "auth_full_item_orcamento" on public.item_orcamento for all to authenticated using (true) with check (true);

alter table public.orcamento_mensal enable row level security;
grant select, insert, update, delete on public.orcamento_mensal to authenticated;
grant all on public.orcamento_mensal to service_role;
create policy "auth_full_orcamento_mensal" on public.orcamento_mensal for all to authenticated using (true) with check (true);

alter table public.orcamento_revisao enable row level security;
grant select, insert, update, delete on public.orcamento_revisao to authenticated;
grant all on public.orcamento_revisao to service_role;
create policy "auth_full_orcamento_revisao" on public.orcamento_revisao for all to authenticated using (true) with check (true);

alter table public.importacao enable row level security;
grant select, insert, update, delete on public.importacao to authenticated;
grant all on public.importacao to service_role;
create policy "auth_full_importacao" on public.importacao for all to authenticated using (true) with check (true);

alter table public.realizado enable row level security;
grant select, insert, update, delete on public.realizado to authenticated;
grant all on public.realizado to service_role;
create policy "auth_full_realizado" on public.realizado for all to authenticated using (true) with check (true);

alter table public.compromisso enable row level security;
grant select, insert, update, delete on public.compromisso to authenticated;
grant all on public.compromisso to service_role;
create policy "auth_full_compromisso" on public.compromisso for all to authenticated using (true) with check (true);

alter view public.v_pendencias set (security_invoker = on);
alter view public.v_item_mes set (security_invoker = on);
alter view public.v_item_acumulado set (security_invoker = on);
grant select on public.v_pendencias to authenticated;
grant select on public.v_item_mes to authenticated;
grant select on public.v_item_acumulado to authenticated;

insert into public.safra (id, data_inicio, data_fim)
values ('2026/2027', '2026-04-01', '2027-03-31')
on conflict (id) do nothing;