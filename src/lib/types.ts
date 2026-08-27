// Tipos alinhados ao schema Supabase (01_supabase_schema.sql)

export type SafraStatus = "ABERTA" | "CONGELADA" | "ENCERRADA";

export interface Safra {
  id: string;
  data_inicio: string;
  data_fim: string;
  status: SafraStatus;
}

export type Atividade =
  | "SERINGUEIRA"
  | "PECUARIA"
  | "AGRICOLA"
  | "ADMINISTRACAO"
  | "OFICINA"
  | "VEICULOS E MECANIZADOS"
  | "VENDA DE VEICULOS"
  | "CUSTEIO";

export const ATIVIDADES: Atividade[] = [
  "SERINGUEIRA",
  "PECUARIA",
  "AGRICOLA",
  "ADMINISTRACAO",
  "OFICINA",
  "VEICULOS E MECANIZADOS",
  "VENDA DE VEICULOS",
  "CUSTEIO",
];

export interface CentroCusto {
  id: string;
  codigo_rm: string;
  nome: string;
  atividade: Atividade;
  codigo_pai: string | null;
  ativo: boolean;
  created_at: string;
}

export type ItemTipo = "INVESTIMENTO" | "DESINVESTIMENTO" | "CUSTEIO";
export type ItemStatus =
  | "PLANEJADO"
  | "APROVADO"
  | "EM_ANDAMENTO"
  | "CONCLUIDO"
  | "CANCELADO"
  | "A_ORCAR";

export interface ItemOrcamento {
  id: string;
  codigo: string;
  safra_id: string;
  centro_custo_id: string;
  descricao: string;
  tipo: ItemTipo;
  status: ItemStatus;
  responsavel: string | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
  // Código do projeto/obra no TOTVS RM (ex.: "99.00.1314"), aprendido na
  // tela de Pendências na primeira vez que um lançamento é vinculado.
  codigo_rm_projeto: string | null;
}

export interface OrcamentoMensal {
  id: string;
  item_orcamento_id: string;
  competencia: string; // yyyy-mm-01
  valor: number;
}

export interface OrcamentoRevisao {
  id: string;
  item_orcamento_id: string;
  competencia: string;
  valor_anterior: number;
  valor_novo: number;
  motivo: string;
  usuario: string | null;
  created_at: string;
}

export interface Remanejamento {
  id: string;
  safra_id: string;
  item_origem_id: string;
  item_destino_id: string;
  competencia: string;
  valor: number;
  motivo: string;
  usuario: string | null;
  created_at: string;
}

export interface Importacao {
  id: string;
  arquivo: string;
  competencia: string | null;
  linhas: number;
  valor_total: number;
  usuario: string | null;
  created_at: string;
}

export interface Realizado {
  id: string;
  importacao_id: string | null;
  safra_id: string;
  centro_custo_id: string | null;
  codigo_cc_origem: string;
  conta_contabil: string | null;
  data_lancamento: string;
  competencia: string;
  documento: string | null;
  historico: string | null;
  valor: number;
  item_orcamento_id: string | null;
  chave_rm: string;
  created_at: string;
}

export type CompromissoStatus = "ABERTO" | "FATURADO" | "CANCELADO";

export interface Compromisso {
  id: string;
  item_orcamento_id: string;
  descricao: string;
  fornecedor: string | null;
  numero_pedido: string | null;
  valor: number;
  data_prevista: string | null;
  status: CompromissoStatus;
  created_at: string;
}

// ---- Views ----

export interface VItemMes {
  item_id: string;
  codigo: string;
  item: string;
  tipo: ItemTipo;
  status: ItemStatus;
  codigo_rm: string;
  centro_custo: string;
  atividade: Atividade;
  competencia: string;
  orcado: number;
  realizado: number;
  desvio: number;
  pct_execucao: number | null;
}

export type Farol = "OK" | "ATENCAO" | "ESTOURADO" | "SEM ORCAMENTO";

export interface VItemAcumulado {
  item_id: string;
  codigo: string;
  item: string;
  tipo: ItemTipo;
  status: ItemStatus;
  responsavel: string | null;
  codigo_rm: string;
  centro_custo: string;
  atividade: Atividade;
  orcado: number;
  realizado: number;
  comprometido: number;
  saldo: number;
  pct_execucao: number | null;
  farol: Farol;
}

export interface VCcAcumulado {
  centro_custo_id: string;
  codigo_rm: string;
  centro_custo: string;
  atividade: Atividade;
  orcado: number;
  realizado: number;
  saldo: number;
  pct_execucao: number | null;
}

export interface VCurvaMensal {
  competencia: string;
  orcado_mes: number;
  realizado_mes: number;
  orcado_acum: number;
  realizado_acum: number;
}

export interface VPendencia {
  id: string;
  data_lancamento: string;
  codigo_cc_origem: string;
  conta_contabil: string | null;
  documento: string | null;
  historico: string | null;
  valor: number;
  motivo: "CENTRO DE CUSTO NAO CADASTRADO" | "SEM ITEM VINCULADO";
}

export type Role = "LEITURA" | "GESTOR";
