-- =====================================================================
-- 03 — Vínculo do realizado pelo projeto/obra do RM
-- Rode DEPOIS de 01_supabase_schema.sql e 02_safra_aware_views.sql.
-- =====================================================================
-- O extrato real de custos do TOTVS RM não vem por centro de custo de
-- fazenda (formato "001.01.01.001" usado no orçamento) — vem por
-- projeto/obra ("CODCCUSTO" tipo "99.00.1314", com "NOMECUSTO" descrevendo
-- o projeto, ex. "FAZ. AROEIRA - CORRECAO DE SOLO COM GRID 1/3"). Cada
-- projeto do RM corresponde 1:1 a um item_orcamento (não a um centro de
-- custo), e nem todo projeto do RM é investimento (a planilha real mistura
-- obras de CAPEX com rateios de despesa, marketing, RH etc.) — por isso o
-- vínculo é sempre manual na primeira vez (tela Pendências) e fica salvo
-- para as próximas importações.

alter table item_orcamento
  add column if not exists codigo_rm_projeto text unique;

create index if not exists ix_item_orcamento_codigo_rm_projeto
  on item_orcamento(codigo_rm_projeto);

-- Corrige a ordem do motivo: com o vínculo direto por projeto, um
-- lançamento sem item vinculado nunca teve centro_custo_id preenchido por
-- um caminho separado (ele vem sempre do item, quando vinculado) — então
-- "SEM ITEM VINCULADO" precisa ser verificado antes de "CENTRO DE CUSTO
-- NAO CADASTRADO", senão todo lançamento pendente cairia na aba errada.
create or replace view v_pendencias as
select
  r.id, r.data_lancamento, r.codigo_cc_origem, r.conta_contabil,
  r.documento, r.historico, r.valor,
  case
    when r.item_orcamento_id is null   then 'SEM ITEM VINCULADO'
    when r.centro_custo_id is null     then 'CENTRO DE CUSTO NAO CADASTRADO'
  end as motivo
from realizado r
where r.centro_custo_id is null or r.item_orcamento_id is null;
