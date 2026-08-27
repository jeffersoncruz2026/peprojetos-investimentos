# Controle de Investimentos — Orçado x Realizado

Aplicativo web de controle orçamentário de investimentos da safra 2026/2027 (Grupo Otávio
Lage). Orçado por item/mês, realizado importado do TOTVS RM, farol de execução por item e
por centro de custo, importação com preview e fila de pendências.

## Stack

Vite + React + TypeScript + shadcn-ui + Tailwind + Supabase (Postgres + Auth).

## Configuração do banco (Supabase)

O projeto já está conectado a um Supabase real via Lovable (projeto `tcpcnuremjbcrgunpftg`,
veja `supabase/config.toml`), com o schema aplicado em
`supabase/migrations/20260827112659_c1bffe06-0e4b-4c9f-a257-94c62b825b09.sql` — tabelas, views,
as funções `f_cc_acumulado(safra_id)` / `f_curva_mensal(safra_id)` (necessárias para o seletor
de safra) e RLS. Os arquivos em `supabase/sql/` são a referência original usada para gerar essa
migração; não é preciso rodá-los de novo num projeto já conectado pelo Lovable.

Falta só carregar os dados da safra 2026/2027 (a migração cria apenas o registro da safra):

1. No SQL Editor do Supabase, importe `supabase/sql/seed_orcamento_mensal.csv` numa tabela
   temporária pelo Table Editor.
2. Rode o bloco de carga comentado no fim de `supabase/sql/01_supabase_schema.sql` (cria os 25
   centros de custo, os 127 itens e o orçado mensal).

Se você conectar este repositório a um Supabase novo do zero (fora do Lovable), rode primeiro
`supabase/sql/01_supabase_schema.sql` e depois `supabase/sql/02_safra_aware_views.sql`, antes do
passo de carga acima.

## Configuração do app

O Lovable já injeta `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no ambiente hospedado.
Para rodar localmente:

```sh
cp .env.example .env
# preencha VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY com os dados do projeto Supabase
npm install
npm run dev
```

## Perfis de acesso

Por padrão, o app libera acesso de **GESTOR sem exigir login** — edita orçamento (com
justificativa obrigatória por alteração), importa o realizado do RM e resolve pendências de
vínculo. As alterações nas tabelas de auditoria (`orcamento_revisao`, `importacao`) são
atribuídas ao e-mail configurado em `GESTOR_PADRAO_EMAIL` (`src/lib/config.ts`).

Para restringir o acesso no futuro (ex.: dar a alguém apenas leitura), use o login do
Supabase Auth normalmente: um usuário autenticado com `role: "LEITURA"` no `user_metadata`
passa a ver tudo em modo somente leitura.

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
