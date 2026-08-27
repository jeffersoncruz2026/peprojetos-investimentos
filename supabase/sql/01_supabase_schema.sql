-- =====================================================================
-- CONTROLE DE INVESTIMENTOS — SAFRA 2026/2027
-- Schema para Supabase (Postgres) — projeto Lovable
-- Grupo Otávio Lage
-- =====================================================================
-- Ordem de execução: rode este arquivo inteiro no SQL Editor do Supabase.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABELAS DE CADASTRO
-- ---------------------------------------------------------------------

create table if not exists safra (
  id            text primary key,              -- '2026/2027'
  data_inicio   date not null,                 -- 2026-04-01
  data_fim      date not null,                 -- 2027-03-31
  status        text not null default 'ABERTA' -- ABERTA | CONGELADA | ENCERRADA
    check (status in ('ABERTA','CONGELADA','ENCERRADA'))
);

create table if not exists centro_custo (
  id            uuid primary key default gen_random_uuid(),
  codigo_rm     text not null unique,          -- '001.01.01.001' — código real do RM
  nome          text not null,                 -- 'FAZENDA PORTEIRAS - SERINGAL'
  atividade     text not null                  -- SERINGUEIRA | PECUARIA | AGRICOLA | ...
    check (atividade in ('SERINGUEIRA','PECUARIA','AGRICOLA','ADMINISTRACAO',
                         'OFICINA','VEICULOS E MECANIZADOS','VENDA DE VEICULOS','CUSTEIO')),
  codigo_pai    text,                          -- centro de custo pai, se houver hierarquia
  ativo         boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Contas contábeis de imobilizado que caracterizam investimento (1.3.xx).
-- Serve para o filtro automático do realizado vindo do RM.
create table if not exists conta_investimento (
  conta         text primary key,              -- '1.3.02.34.0050'
  descricao     text,
  ativa         boolean not null default true
);

-- ---------------------------------------------------------------------
-- 2. ORÇAMENTO
-- ---------------------------------------------------------------------

create table if not exists item_orcamento (
  id              uuid primary key default gen_random_uuid(),
  codigo          text not null,               -- 'I005'
  safra_id        text not null references safra(id),
  centro_custo_id uuid not null references centro_custo(id),
  descricao       text not null,               -- 'Caixas'
  tipo            text not null default 'INVESTIMENTO'
    check (tipo in ('INVESTIMENTO','DESINVESTIMENTO','CUSTEIO')),
  status          text not null default 'PLANEJADO'
    check (status in ('PLANEJADO','APROVADO','EM_ANDAMENTO','CONCLUIDO','CANCELADO','A_ORCAR')),
  responsavel     text,
  observacao      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (safra_id, codigo)
);

-- Orçado por mês. É a única fonte do "orçado": o total é sempre soma daqui.
create table if not exists orcamento_mensal (
  id                uuid primary key default gen_random_uuid(),
  item_orcamento_id uuid not null references item_orcamento(id) on delete cascade,
  competencia       date not null,             -- sempre dia 1: 2026-04-01
  valor             numeric(14,2) not null default 0,
  unique (item_orcamento_id, competencia)
);
create index if not exists ix_orc_mensal_comp on orcamento_mensal(competencia);

-- Histórico de remanejamento/revisão do orçado (quem mudou, de quanto para quanto).
create table if not exists orcamento_revisao (
  id                uuid primary key default gen_random_uuid(),
  item_orcamento_id uuid not null references item_orcamento(id) on delete cascade,
  competencia       date not null,
  valor_anterior    numeric(14,2) not null,
  valor_novo        numeric(14,2) not null,
  motivo            text not null,
  usuario           text,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. REALIZADO (importado do RM)
-- ---------------------------------------------------------------------

create table if not exists importacao (
  id            uuid primary key default gen_random_uuid(),
  arquivo       text not null,
  competencia   date,
  linhas        integer not null default 0,
  valor_total   numeric(14,2) not null default 0,
  usuario       text,
  created_at    timestamptz not null default now()
);

create table if not exists realizado (
  id                uuid primary key default gen_random_uuid(),
  importacao_id     uuid references importacao(id) on delete set null,
  safra_id          text not null references safra(id),
  centro_custo_id   uuid references centro_custo(id),
  codigo_cc_origem  text not null,             -- como veio do RM, mesmo se não bater no cadastro
  conta_contabil    text,
  data_lancamento   date not null,
  competencia       date not null,             -- date_trunc('month', data_lancamento)
  documento         text,
  historico         text,
  valor             numeric(14,2) not null,
  item_orcamento_id uuid references item_orcamento(id), -- amarração manual ao item
  chave_rm          text unique,               -- idempotência: evita importar 2x o mesmo lançamento
  created_at        timestamptz not null default now()
);
create index if not exists ix_real_cc_comp on realizado(centro_custo_id, competencia);
create index if not exists ix_real_item     on realizado(item_orcamento_id);

-- Compromissos já assumidos mas ainda não contabilizados (pedido de compra aprovado).
-- É o que evita estourar o orçamento sem perceber.
create table if not exists compromisso (
  id                uuid primary key default gen_random_uuid(),
  item_orcamento_id uuid not null references item_orcamento(id) on delete cascade,
  descricao         text not null,
  fornecedor        text,
  numero_pedido     text,
  valor             numeric(14,2) not null,
  data_prevista     date,
  status            text not null default 'ABERTO'
    check (status in ('ABERTO','FATURADO','CANCELADO')),
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. VIEWS DE ACOMPANHAMENTO
-- ---------------------------------------------------------------------

-- Orçado x realizado por item e mês (linha por item x competência)
create or replace view v_item_mes as
select
  i.id                as item_id,
  i.codigo,
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

-- Acumulado por item na safra (é a tela principal do app)
create or replace view v_item_acumulado as
select
  i.id            as item_id,
  i.codigo,
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

-- Consolidado por centro de custo (o nível que SEMPRE fecha com o RM,
-- mesmo que ninguém amarre o lançamento no item)
create or replace view v_cc_acumulado as
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
left join (select i.centro_custo_id, sum(m.valor) orcado
           from orcamento_mensal m join item_orcamento i on i.id = m.item_orcamento_id
           group by 1) o on o.centro_custo_id = cc.id
left join (select centro_custo_id, sum(valor) realizado
           from realizado group by 1) r on r.centro_custo_id = cc.id;

-- Curva do orçado x realizado mês a mês (gráfico da home)
create or replace view v_curva_mensal as
select
  comp.competencia,
  coalesce(o.orcado, 0)     as orcado_mes,
  coalesce(r.realizado, 0)  as realizado_mes,
  sum(coalesce(o.orcado,0))    over (order by comp.competencia) as orcado_acum,
  sum(coalesce(r.realizado,0)) over (order by comp.competencia) as realizado_acum
from (select generate_series('2026-04-01'::date, '2027-03-01'::date, '1 month') as competencia) comp
left join (select competencia, sum(valor) orcado from orcamento_mensal group by 1) o
       on o.competencia = comp.competencia
left join (select competencia, sum(valor) realizado from realizado group by 1) r
       on r.competencia = comp.competencia;

-- Lançamentos do RM que não conseguiram ser classificados — a fila de trabalho do controller
create or replace view v_pendencias as
select
  r.id, r.data_lancamento, r.codigo_cc_origem, r.conta_contabil,
  r.documento, r.historico, r.valor,
  case
    when r.centro_custo_id is null   then 'CENTRO DE CUSTO NAO CADASTRADO'
    when r.item_orcamento_id is null then 'SEM ITEM VINCULADO'
  end as motivo
from realizado r
where r.centro_custo_id is null or r.item_orcamento_id is null;

-- ---------------------------------------------------------------------
-- 5. SEGURANÇA (RLS) — ajuste conforme a política de acesso do grupo
-- ---------------------------------------------------------------------
alter table centro_custo      enable row level security;
alter table item_orcamento    enable row level security;
alter table orcamento_mensal  enable row level security;
alter table realizado         enable row level security;
alter table compromisso       enable row level security;
alter table importacao        enable row level security;
alter table orcamento_revisao enable row level security;

-- Política inicial: qualquer usuário autenticado lê e escreve.
-- Troque por políticas por centro de custo quando definir os perfis.
do $$
declare t text;
begin
  foreach t in array array['centro_custo','item_orcamento','orcamento_mensal',
                           'realizado','compromisso','importacao','orcamento_revisao']
  loop
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true)',
      'auth_full_'||t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6. CARGA INICIAL
-- ---------------------------------------------------------------------
insert into safra (id, data_inicio, data_fim)
values ('2026/2027', '2026-04-01', '2027-03-31')
on conflict (id) do nothing;

-- Os centros de custo, itens e o orçado mensal vêm do arquivo
-- seed_orcamento_mensal.csv (127 itens / 190 linhas mês a mês).
-- Importe o CSV numa tabela temporária e rode o bloco abaixo.
--
-- create table tmp_orcamento (
--   id_item text, codigo_cc text, unidade text, atividade text,
--   item text, competencia text, valor numeric
-- );
-- (importe o CSV pelo Table Editor do Supabase)
--
-- insert into centro_custo (codigo_rm, nome, atividade)
-- select distinct codigo_cc, unidade, atividade from tmp_orcamento
-- on conflict (codigo_rm) do nothing;
--
-- insert into item_orcamento (codigo, safra_id, centro_custo_id, descricao)
-- select distinct t.id_item, '2026/2027', cc.id, t.item
-- from tmp_orcamento t join centro_custo cc on cc.codigo_rm = t.codigo_cc
-- on conflict (safra_id, codigo) do nothing;
--
-- insert into orcamento_mensal (item_orcamento_id, competencia, valor)
-- select i.id, (t.competencia || '-01')::date, t.valor
-- from tmp_orcamento t
-- join item_orcamento i on i.codigo = t.id_item and i.safra_id = '2026/2027'
-- on conflict (item_orcamento_id, competencia) do update set valor = excluded.valor;
--
-- drop table tmp_orcamento;
