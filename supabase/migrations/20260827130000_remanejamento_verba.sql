create table if not exists public.remanejamento (
  id uuid primary key default gen_random_uuid(),
  safra_id text not null references public.safra(id),
  item_origem_id uuid not null references public.item_orcamento(id),
  item_destino_id uuid not null references public.item_orcamento(id),
  competencia date not null,
  valor numeric(14,2) not null check (valor > 0),
  motivo text not null,
  usuario text,
  created_at timestamptz not null default now(),
  check (item_origem_id <> item_destino_id)
);

alter table public.remanejamento enable row level security;
grant select, insert, update, delete on public.remanejamento to authenticated;
grant all on public.remanejamento to service_role;
create policy "auth_full_remanejamento" on public.remanejamento for all to authenticated using (true) with check (true);

-- Move o valor de um item de orçamento para outro num mesmo mês: debita a
-- competência do item de origem, credita a mesma competência no item de
-- destino, e grava tanto o par de linhas em orcamento_revisao (para manter
-- o histórico por item consistente com o resto do app) quanto uma linha em
-- remanejamento (para o histórico dedicado da tela de remanejamento).
-- security invoker porque a RLS de orcamento_mensal/orcamento_revisao/
-- remanejamento já libera tudo para authenticated (mesmo modelo do resto
-- do schema) — não há motivo para elevar privilégio.
create or replace function public.f_remanejar_verba(
  p_safra_id text,
  p_item_origem_id uuid,
  p_item_destino_id uuid,
  p_competencia date,
  p_valor numeric,
  p_motivo text,
  p_usuario text
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_valor_origem numeric;
  v_valor_destino numeric;
begin
  if p_item_origem_id = p_item_destino_id then
    raise exception 'Item de origem e destino devem ser diferentes';
  end if;
  if p_valor <= 0 then
    raise exception 'Valor do remanejamento deve ser maior que zero';
  end if;

  select coalesce(valor, 0) into v_valor_origem from public.orcamento_mensal
    where item_orcamento_id = p_item_origem_id and competencia = p_competencia;
  v_valor_origem := coalesce(v_valor_origem, 0);

  select coalesce(valor, 0) into v_valor_destino from public.orcamento_mensal
    where item_orcamento_id = p_item_destino_id and competencia = p_competencia;
  v_valor_destino := coalesce(v_valor_destino, 0);

  insert into public.orcamento_mensal (item_orcamento_id, competencia, valor)
    values (p_item_origem_id, p_competencia, v_valor_origem - p_valor)
    on conflict (item_orcamento_id, competencia) do update set valor = excluded.valor;

  insert into public.orcamento_mensal (item_orcamento_id, competencia, valor)
    values (p_item_destino_id, p_competencia, v_valor_destino + p_valor)
    on conflict (item_orcamento_id, competencia) do update set valor = excluded.valor;

  insert into public.orcamento_revisao (item_orcamento_id, competencia, valor_anterior, valor_novo, motivo, usuario)
    values (p_item_origem_id, p_competencia, v_valor_origem, v_valor_origem - p_valor,
      'Remanejamento (saída): ' || p_motivo, p_usuario);

  insert into public.orcamento_revisao (item_orcamento_id, competencia, valor_anterior, valor_novo, motivo, usuario)
    values (p_item_destino_id, p_competencia, v_valor_destino, v_valor_destino + p_valor,
      'Remanejamento (entrada): ' || p_motivo, p_usuario);

  insert into public.remanejamento (safra_id, item_origem_id, item_destino_id, competencia, valor, motivo, usuario)
    values (p_safra_id, p_item_origem_id, p_item_destino_id, p_competencia, p_valor, p_motivo, p_usuario);
end;
$$;

grant execute on function public.f_remanejar_verba(text, uuid, uuid, date, numeric, text, text) to authenticated;
