# Controle de Investimentos — Orçado x Realizado

Aplicativo web de controle orçamentário de investimentos da safra 2026/2027 (Grupo Otávio
Lage). Orçado por item/mês, realizado importado do TOTVS RM, farol de execução por item e
por centro de custo, importação com preview e fila de pendências.

## Stack

Vite + React + TypeScript + shadcn-ui + Tailwind + Supabase (Postgres + Auth).

## Configuração do banco (Supabase)

1. Crie um projeto no [Supabase](https://supabase.com).
2. No SQL Editor, rode **nesta ordem**:
   - `supabase/sql/01_supabase_schema.sql` — tabelas, views e RLS.
   - `supabase/sql/02_safra_aware_views.sql` — ajusta `v_item_mes`, `v_item_acumulado` para
     expor `safra_id` e cria as funções `f_cc_acumulado(safra_id)` / `f_curva_mensal(safra_id)`,
     necessárias para o seletor de safra do app funcionar corretamente (o schema original tem
     `v_cc_acumulado` e `v_curva_mensal` fixos numa única safra).
3. Carregue o orçado inicial: importe `supabase/sql/seed_orcamento_mensal.csv` numa tabela
   temporária pelo Table Editor e rode o bloco de carga comentado no fim do
   `01_supabase_schema.sql` (cria os 25 centros de custo, os 127 itens e o orçado mensal).
4. (Opcional) Para o perfil GESTOR, crie usuários em Authentication → Users. Por padrão, todo
   usuário autenticado é tratado como GESTOR; para deixar alguém como somente leitura, defina
   `role: "LEITURA"` no `user_metadata` do usuário.

## Configuração do app

```sh
cp .env.example .env
# preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY com os dados do projeto Supabase
npm install
npm run dev
```

## Perfis de acesso

- **Sem login**: modo LEITURA — visualiza tudo, não edita.
- **Logado (GESTOR)**: edita orçamento (com justificativa obrigatória por alteração), importa
  o realizado do RM e resolve pendências de vínculo.

## Telas

- **Home** — cartões de orçado/realizado/comprometido/saldo, curva mensal, orçado x realizado
  por atividade, itens fora do farol OK.
- **Centros de Custo** — lista e detalhe por unidade (sempre fecha com o RM, mesmo sem item
  vinculado).
- **Item** — cabeçalho editável, orçado x realizado por mês, lançamentos do RM, compromissos.
- **Orçamento** — grade editável (itens x meses), com histórico de revisão e bloqueio quando a
  safra está CONGELADA.
- **Importar Realizado** — upload de .xlsx/.csv do RM, preview com novas/duplicadas/sem centro
  de custo antes de gravar.
- **Pendências** — centro de custo não cadastrado e lançamentos sem item, com vínculo em lote.
- **Relatórios** — exportação para Excel e posição da safra para impressão/PDF.

## Como editar este código

**Use seu IDE local**

```sh
git clone <URL_DO_REPOSITORIO>
cd peprojetos-investimentos
npm install
npm run dev
```

**Edite direto no GitHub** ou use o **GitHub Codespaces** normalmente.
