-- Referência original desta migração — veja
-- supabase/migrations/20260827140000_solicitacoes_remanejamento.sql para o
-- que de fato é aplicado num projeto já conectado pelo Lovable.
--
-- Remanejamento de verba passa a exigir aprovação: em vez de mover o
-- orçado na hora, a solicitação fica PENDENTE até o administrador
-- aprovar (executa o débito/crédito) ou rejeitar (só registra o motivo).
alter table public.remanejamento
  add column if not exists status text not null default 'PENDENTE'
    check (status in ('PENDENTE', 'APROVADO', 'REJEITADO')),
  add column if not exists decidido_por text,
  add column if not exists decidido_em timestamptz,
  add column if not exists motivo_decisao text;

-- f_remanejar_verba executava a transferência direto; substituída por
-- f_solicitar_remanejamento (só registra o pedido) + f_aprovar_remanejamento
-- / f_rejeitar_remanejamento (decidem o pedido).
drop function if exists public.f_remanejar_verba(text, uuid, uuid, date, numeric, text, text);

-- Registra uma solicitação de remanejamento (status PENDENTE) — não move
-- o orçado ainda. Bloqueia (raise exception) se o valor pedido for maior
-- que o saldo orçado atual do item de origem naquele mês; a mesma
-- validação é repetida em f_aprovar_remanejamento, pois o saldo pode
-- mudar entre a solicitação e a decisão do administrador.
create or replace function public.f_solicitar_remanejamento(
  p_safra_id text,
  p_item_origem_id uuid,
  p_item_destino_id uuid,
  p_competencia date,
  p_valor numeric,
  p_motivo text,
  p_usuario text
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_saldo_origem numeric;
  v_id uuid;
begin
  if p_item_origem_id = p_item_destino_id then
    raise exception 'Item de origem e destino devem ser diferentes';
  end if;
  if p_valor <= 0 then
    raise exception 'Valor do remanejamento deve ser maior que zero';
  end if;

  select coalesce(valor, 0) into v_saldo_origem from public.orcamento_mensal
    where item_orcamento_id = p_item_origem_id and competencia = p_competencia;
  v_saldo_origem := coalesce(v_saldo_origem, 0);

  if p_valor > v_saldo_origem then
    raise exception 'Valor do remanejamento (%) maior que o saldo orçado disponível no item de origem (%)', p_valor, v_saldo_origem;
  end if;

  insert into public.remanejamento
    (safra_id, item_origem_id, item_destino_id, competencia, valor, motivo, usuario, status)
    values (p_safra_id, p_item_origem_id, p_item_destino_id, p_competencia, p_valor, p_motivo, p_usuario, 'PENDENTE')
    returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.f_solicitar_remanejamento(text, uuid, uuid, date, numeric, text, text) to authenticated;

-- Só o e-mail configurado como administrador (ADMIN_EMAIL,
-- src/lib/config.ts) pode aprovar/rejeitar — diferente do resto do app
-- (que só distingue GESTOR/LEITURA no cliente), aqui é uma fronteira de
-- autoridade real, então é checada aqui também, não só na UI.
create or replace function public.f_aprovar_remanejamento(
  p_remanejamento_id uuid,
  p_usuario text
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.remanejamento%rowtype;
  v_saldo_origem numeric;
  v_saldo_destino numeric;
begin
  if p_usuario is null or lower(p_usuario) <> 'jeffersoncardosomb@gmail.com' then
    raise exception 'Apenas o administrador pode aprovar remanejamentos';
  end if;

  select * into v_row from public.remanejamento where id = p_remanejamento_id for update;
  if not found then
    raise exception 'Solicitação de remanejamento não encontrada';
  end if;
  if v_row.status <> 'PENDENTE' then
    raise exception 'Esta solicitação já foi %', v_row.status;
  end if;

  select coalesce(valor, 0) into v_saldo_origem from public.orcamento_mensal
    where item_orcamento_id = v_row.item_origem_id and competencia = v_row.competencia;
  v_saldo_origem := coalesce(v_saldo_origem, 0);
  if v_row.valor > v_saldo_origem then
    raise exception 'Valor da solicitação (%) maior que o saldo orçado disponível no item de origem (%)', v_row.valor, v_saldo_origem;
  end if;

  select coalesce(valor, 0) into v_saldo_destino from public.orcamento_mensal
    where item_orcamento_id = v_row.item_destino_id and competencia = v_row.competencia;
  v_saldo_destino := coalesce(v_saldo_destino, 0);

  insert into public.orcamento_mensal (item_orcamento_id, competencia, valor)
    values (v_row.item_origem_id, v_row.competencia, v_saldo_origem - v_row.valor)
    on conflict (item_orcamento_id, competencia) do update set valor = excluded.valor;

  insert into public.orcamento_mensal (item_orcamento_id, competencia, valor)
    values (v_row.item_destino_id, v_row.competencia, v_saldo_destino + v_row.valor)
    on conflict (item_orcamento_id, competencia) do update set valor = excluded.valor;

  insert into public.orcamento_revisao (item_orcamento_id, competencia, valor_anterior, valor_novo, motivo, usuario)
    values (v_row.item_origem_id, v_row.competencia, v_saldo_origem, v_saldo_origem - v_row.valor,
      'Remanejamento (saída): ' || v_row.motivo, p_usuario);

  insert into public.orcamento_revisao (item_orcamento_id, competencia, valor_anterior, valor_novo, motivo, usuario)
    values (v_row.item_destino_id, v_row.competencia, v_saldo_destino, v_saldo_destino + v_row.valor,
      'Remanejamento (entrada): ' || v_row.motivo, p_usuario);

  update public.remanejamento
    set status = 'APROVADO', decidido_por = p_usuario, decidido_em = now()
    where id = p_remanejamento_id;
end;
$$;

grant execute on function public.f_aprovar_remanejamento(uuid, text) to authenticated;

create or replace function public.f_rejeitar_remanejamento(
  p_remanejamento_id uuid,
  p_usuario text,
  p_motivo text
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status text;
begin
  if p_usuario is null or lower(p_usuario) <> 'jeffersoncardosomb@gmail.com' then
    raise exception 'Apenas o administrador pode rejeitar remanejamentos';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'Motivo da rejeição é obrigatório';
  end if;

  select status into v_status from public.remanejamento where id = p_remanejamento_id for update;
  if not found then
    raise exception 'Solicitação de remanejamento não encontrada';
  end if;
  if v_status <> 'PENDENTE' then
    raise exception 'Esta solicitação já foi %', v_status;
  end if;

  update public.remanejamento
    set status = 'REJEITADO', decidido_por = p_usuario, decidido_em = now(), motivo_decisao = p_motivo
    where id = p_remanejamento_id;
end;
$$;

grant execute on function public.f_rejeitar_remanejamento(uuid, text, text) to authenticated;
