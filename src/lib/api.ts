import { supabase } from "@/lib/supabaseClient";
import type {
  CentroCusto,
  Compromisso,
  ItemOrcamento,
  OrcamentoMensal,
  Realizado,
  Remanejamento,
  VCcAcumulado,
  VCurvaMensal,
  VItemAcumulado,
  VItemMes,
  VPendencia,
} from "@/lib/types";

export async function fetchCurvaMensal(safraId: string): Promise<VCurvaMensal[]> {
  const { data, error } = await supabase.rpc("f_curva_mensal", { p_safra_id: safraId });
  if (error) throw error;
  return (data ?? []) as VCurvaMensal[];
}

export async function fetchCcAcumulado(safraId: string): Promise<VCcAcumulado[]> {
  const { data, error } = await supabase.rpc("f_cc_acumulado", { p_safra_id: safraId });
  if (error) throw error;
  return (data ?? []) as VCcAcumulado[];
}

export async function fetchItemAcumulado(safraId: string): Promise<VItemAcumulado[]> {
  const { data, error } = await supabase
    .from("v_item_acumulado")
    .select("*")
    .eq("safra_id", safraId);
  if (error) throw error;
  return (data ?? []) as VItemAcumulado[];
}

export async function fetchItemAcumuladoPorCc(
  safraId: string,
  codigoRm: string
): Promise<VItemAcumulado[]> {
  const { data, error } = await supabase
    .from("v_item_acumulado")
    .select("*")
    .eq("safra_id", safraId)
    .eq("codigo_rm", codigoRm);
  if (error) throw error;
  return (data ?? []) as VItemAcumulado[];
}

export async function fetchItemMesPorItem(itemId: string): Promise<VItemMes[]> {
  const { data, error } = await supabase
    .from("v_item_mes")
    .select("*")
    .eq("item_id", itemId)
    .order("competencia", { ascending: true });
  if (error) throw error;
  return (data ?? []) as VItemMes[];
}

export async function fetchItemOrcamento(itemId: string): Promise<ItemOrcamento | null> {
  const { data, error } = await supabase
    .from("item_orcamento")
    .select("*")
    .eq("id", itemId)
    .maybeSingle();
  if (error) throw error;
  return data as ItemOrcamento | null;
}

export async function fetchCentroCusto(centroCustoId: string): Promise<CentroCusto | null> {
  const { data, error } = await supabase
    .from("centro_custo")
    .select("*")
    .eq("id", centroCustoId)
    .maybeSingle();
  if (error) throw error;
  return data as CentroCusto | null;
}

export async function fetchCentrosCusto(): Promise<CentroCusto[]> {
  const { data, error } = await supabase.from("centro_custo").select("*").order("nome");
  if (error) throw error;
  return (data ?? []) as CentroCusto[];
}

export async function fetchLancamentosPorItem(itemId: string): Promise<Realizado[]> {
  const { data, error } = await supabase
    .from("realizado")
    .select("*")
    .eq("item_orcamento_id", itemId)
    .order("data_lancamento", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Realizado[];
}

export async function fetchCompromissosPorItem(itemId: string): Promise<Compromisso[]> {
  const { data, error } = await supabase
    .from("compromisso")
    .select("*")
    .eq("item_orcamento_id", itemId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Compromisso[];
}

export async function fetchPendencias(): Promise<VPendencia[]> {
  const { data, error } = await supabase
    .from("v_pendencias")
    .select("*")
    .order("data_lancamento", { ascending: false });
  if (error) throw error;
  return (data ?? []) as VPendencia[];
}

export async function fetchItensOrcamentoPorSafra(safraId: string): Promise<ItemOrcamento[]> {
  const { data, error } = await supabase
    .from("item_orcamento")
    .select("*")
    .eq("safra_id", safraId)
    .order("codigo");
  if (error) throw error;
  return (data ?? []) as ItemOrcamento[];
}

export interface ItemComCodigoProjeto {
  id: string;
  codigo_rm_projeto: string;
  centro_custo_id: string;
}

export async function fetchItensComCodigoProjeto(safraId: string): Promise<ItemComCodigoProjeto[]> {
  const { data, error } = await supabase
    .from("item_orcamento")
    .select("id, codigo_rm_projeto, centro_custo_id")
    .eq("safra_id", safraId)
    .not("codigo_rm_projeto", "is", null);
  if (error) throw error;
  return (data ?? []) as ItemComCodigoProjeto[];
}

export async function criarItemOrcamentoComMeses(params: {
  safraId: string;
  codigo: string;
  codigoRmProjeto: string | null;
  descricao: string;
  centroCustoId: string;
  meses: { competencia: string; valor: number }[];
}): Promise<void> {
  const { data: item, error: itemError } = await supabase
    .from("item_orcamento")
    .insert({
      codigo: params.codigo,
      codigo_rm_projeto: params.codigoRmProjeto,
      safra_id: params.safraId,
      centro_custo_id: params.centroCustoId,
      descricao: params.descricao,
    })
    .select()
    .single();
  if (itemError) throw itemError;

  const somaPorMes = new Map<string, number>();
  for (const m of params.meses) {
    somaPorMes.set(m.competencia, (somaPorMes.get(m.competencia) ?? 0) + m.valor);
  }
  const linhas = [...somaPorMes.entries()].map(([competencia, valor]) => ({
    item_orcamento_id: item.id,
    competencia,
    valor,
  }));
  const { error: mensalError } = await supabase.from("orcamento_mensal").insert(linhas);
  if (mensalError) throw mensalError;
}

export async function criarItemOrcamento(params: {
  safraId: string;
  codigoRmProjeto: string;
  descricao: string;
  centroCustoId: string;
  competencia: string;
  valor: number;
}): Promise<void> {
  const { data: existente, error: existeError } = await supabase
    .from("item_orcamento")
    .select("id, descricao")
    .eq("codigo_rm_projeto", params.codigoRmProjeto)
    .maybeSingle();
  if (existeError) throw existeError;
  if (existente) {
    throw new Error(
      `O CODCCUSTO ${params.codigoRmProjeto} já está cadastrado no item "${existente.descricao}".`
    );
  }

  await criarItemOrcamentoComMeses({
    safraId: params.safraId,
    codigo: params.codigoRmProjeto,
    codigoRmProjeto: params.codigoRmProjeto,
    descricao: params.descricao,
    centroCustoId: params.centroCustoId,
    meses: [{ competencia: params.competencia, valor: params.valor }],
  });
}

export async function atualizarItemOrcamento(params: {
  id: string;
  codigoRmProjeto: string;
  descricao: string;
  centroCustoId: string;
}): Promise<void> {
  const { data: existente, error: existeError } = await supabase
    .from("item_orcamento")
    .select("id, descricao")
    .eq("codigo_rm_projeto", params.codigoRmProjeto)
    .neq("id", params.id)
    .maybeSingle();
  if (existeError) throw existeError;
  if (existente) {
    throw new Error(
      `O CODCCUSTO ${params.codigoRmProjeto} já está cadastrado no item "${existente.descricao}".`
    );
  }

  const { error } = await supabase
    .from("item_orcamento")
    .update({
      codigo_rm_projeto: params.codigoRmProjeto,
      descricao: params.descricao,
      centro_custo_id: params.centroCustoId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id);
  if (error) throw error;
}

// Registra uma solicitação de remanejamento (status PENDENTE) — só move o
// orçado quando o administrador aprova (aprovarRemanejamento). Bloqueia no
// banco se o valor pedido for maior que o saldo orçado atual do item de
// origem naquele mês.
export async function solicitarRemanejamento(params: {
  safraId: string;
  itemOrigemId: string;
  itemDestinoId: string;
  competencia: string;
  valor: number;
  motivo: string;
  usuario: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc("f_solicitar_remanejamento", {
    p_safra_id: params.safraId,
    p_item_origem_id: params.itemOrigemId,
    p_item_destino_id: params.itemDestinoId,
    p_competencia: params.competencia,
    p_valor: params.valor,
    p_motivo: params.motivo,
    p_usuario: params.usuario,
  });
  if (error) throw error;
}

// Aprova uma solicitação PENDENTE: debita o item de origem, credita o
// destino e grava o histórico em orcamento_revisao. Só o e-mail
// configurado em ADMIN_EMAIL pode aprovar — a função no banco recusa
// qualquer outro usuário, então isGestor/isAdmin na UI é só conveniência,
// não a única trava.
export async function aprovarRemanejamento(remanejamentoId: string, usuario: string): Promise<void> {
  const { error } = await supabase.rpc("f_aprovar_remanejamento", {
    p_remanejamento_id: remanejamentoId,
    p_usuario: usuario,
  });
  if (error) throw error;
}

export async function rejeitarRemanejamento(
  remanejamentoId: string,
  usuario: string,
  motivo: string
): Promise<void> {
  const { error } = await supabase.rpc("f_rejeitar_remanejamento", {
    p_remanejamento_id: remanejamentoId,
    p_usuario: usuario,
    p_motivo: motivo,
  });
  if (error) throw error;
}

export async function fetchRemanejamentosPorSafra(safraId: string): Promise<Remanejamento[]> {
  const { data, error } = await supabase
    .from("remanejamento")
    .select("*")
    .eq("safra_id", safraId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Remanejamento[];
}

export async function fetchOrcamentoMensalPorItens(itemIds: string[]): Promise<OrcamentoMensal[]> {
  if (itemIds.length === 0) return [];
  const { data, error } = await supabase
    .from("orcamento_mensal")
    .select("*")
    .in("item_orcamento_id", itemIds);
  if (error) throw error;
  return (data ?? []) as OrcamentoMensal[];
}

// Busca as chave_rm já existentes pelo período (data_lancamento) do arquivo
// sendo importado, em vez de mandar as milhares de chaves do arquivo num
// .in(...) — um extrato real tem dezenas de milhares de linhas, e um filtro
// .in() desse tamanho estoura o limite de tamanho da URL da requisição.
export async function fetchChavesExistentesPorPeriodo(dataMin: string, dataMax: string): Promise<Set<string>> {
  const found = new Set<string>();
  const PAGE = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("realizado")
      .select("chave_rm")
      .gte("data_lancamento", dataMin)
      .lte("data_lancamento", dataMax)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    for (const row of data ?? []) found.add(row.chave_rm as string);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return found;
}

interface NovaLinhaRealizado {
  safra_id: string;
  centro_custo_id: string | null;
  codigo_cc_origem: string;
  conta_contabil: string | null;
  data_lancamento: string;
  competencia: string;
  documento: string | null;
  historico: string | null;
  valor: number;
  chave_rm: string;
  item_orcamento_id: string | null;
}

export async function criarCentroCusto(params: {
  codigoRm: string;
  nome: string;
  atividade: string;
}): Promise<CentroCusto> {
  const { data, error } = await supabase
    .from("centro_custo")
    .insert({ codigo_rm: params.codigoRm, nome: params.nome, atividade: params.atividade })
    .select()
    .single();
  if (error) throw error;
  return data as CentroCusto;
}

export async function criarCentroCustoEReprocessar(params: {
  codigoRm: string;
  nome: string;
  atividade: string;
}): Promise<void> {
  const cc = await criarCentroCusto(params);

  const { error: updateError } = await supabase
    .from("realizado")
    .update({ centro_custo_id: cc.id })
    .eq("codigo_cc_origem", params.codigoRm)
    .is("centro_custo_id", null);
  if (updateError) throw updateError;
}

export async function vincularItemEmLote(
  realizadoIds: string[],
  itemOrcamentoId: string,
  centroCustoId: string
): Promise<void> {
  const { error } = await supabase
    .from("realizado")
    .update({ item_orcamento_id: itemOrcamentoId, centro_custo_id: centroCustoId })
    .in("id", realizadoIds);
  if (error) throw error;
}

// Ensina o vínculo: da próxima vez que este projeto do RM aparecer na
// importação, já casa direto com o item sem passar por Pendências.
export async function aprenderCodigoProjeto(itemOrcamentoId: string, codigoRmProjeto: string): Promise<void> {
  const { error } = await supabase
    .from("item_orcamento")
    .update({ codigo_rm_projeto: codigoRmProjeto })
    .eq("id", itemOrcamentoId);
  if (error) throw error;
}

export async function confirmarImportacao(params: {
  arquivo: string;
  usuario: string | null;
  linhas: NovaLinhaRealizado[];
}): Promise<void> {
  const valorTotal = params.linhas.reduce((s, l) => s + l.valor, 0);
  const { data: importacao, error: importError } = await supabase
    .from("importacao")
    .insert({
      arquivo: params.arquivo,
      linhas: params.linhas.length,
      valor_total: valorTotal,
      usuario: params.usuario,
    })
    .select()
    .single();
  if (importError) throw importError;

  const CHUNK = 500;
  for (let i = 0; i < params.linhas.length; i += CHUNK) {
    const slice = params.linhas.slice(i, i + CHUNK).map((l) => ({ ...l, importacao_id: importacao.id }));
    const { error } = await supabase.from("realizado").insert(slice);
    if (error) throw error;
  }
}
