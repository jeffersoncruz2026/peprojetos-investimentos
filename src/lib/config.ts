// E-mail tratado como GESTOR por padrão, sem exigir login — a pedido do
// usuário, para poder cadastrar o orçamento sem fricção. Usado apenas como
// atribuição de autoria nas tabelas de auditoria (orcamento_revisao,
// importacao) quando não há sessão do Supabase Auth.
export const GESTOR_PADRAO_EMAIL = "jeffersoncardosomb@gmail.com";

// E-mail do administrador que aprova/rejeita solicitações de remanejamento
// de verba — é o mesmo e-mail de GESTOR_PADRAO_EMAIL hoje, mas um conceito
// separado (autoridade de aprovação, não só autoria de auditoria). Precisa
// bater com o e-mail fixo checado em f_aprovar_remanejamento e
// f_rejeitar_remanejamento (supabase/sql/05_solicitacoes_remanejamento.sql)
// se for alterado.
export const ADMIN_EMAIL = "jeffersoncardosomb@gmail.com";
