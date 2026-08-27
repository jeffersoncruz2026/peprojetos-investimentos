import { supabase } from "@/lib/supabaseClient";
import type {
  CentroCusto,
  Compromisso,
  ItemOrcamento,
  OrcamentoMensal,
  Realizado,
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

export async function fetchOrcamentoMensalPorItens(itemIds: string[]): Promise<OrcamentoMensal[]> {
  if (itemIds.length === 0) return [];
  const { data, error } = await supabase
    .from("orcamento_mensal")
    .select("*")
    .in("item_orcamento_id", itemIds);
  if (error) throw error;
  return (data ?? []) as OrcamentoMensal[];
}

export async function fetchChavesExistentes(chaves: string[]): Promise<Set<string>> {
  if (chaves.length === 0) return new Set();
  const found = new Set<string>();
  const CHUNK = 500;
  for (let i = 0; i < chaves.length; i += CHUNK) {
    const slice = chaves.slice(i, i + CHUNK);
    const { data, error } = await supabase.from("realizado").select("chave_rm").in("chave_rm", slice);
    if (error) throw error;
    for (const row of data ?? []) found.add(row.chave_rm as string);
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
}

export async function criarCentroCustoEReprocessar(params: {
  codigoRm: string;
  nome: string;
  atividade: string;
}): Promise<void> {
  const { data: cc, error: ccError } = await supabase
    .from("centro_custo")
    .insert({ codigo_rm: params.codigoRm, nome: params.nome, atividade: params.atividade })
    .select()
    .single();
  if (ccError) throw ccError;

  const { error: updateError } = await supabase
    .from("realizado")
    .update({ centro_custo_id: cc.id })
    .eq("codigo_cc_origem", params.codigoRm)
    .is("centro_custo_id", null);
  if (updateError) throw updateError;
}

export async function vincularItemEmLote(realizadoIds: string[], itemOrcamentoId: string): Promise<void> {
  const { error } = await supabase
    .from("realizado")
    .update({ item_orcamento_id: itemOrcamentoId })
    .in("id", realizadoIds);
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
