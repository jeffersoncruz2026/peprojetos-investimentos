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
3. **Rode `supabase/sql/03_projeto_rm.sql`** — adiciona `item_orcamento.codigo_rm_projeto`
   (usado para vincular o realizado, veja "Importação do realizado" abaixo) e corrige a ordem do
   motivo em `v_pendencias`. Sem esse arquivo, a tela Importar Realizado quebra.

Se você conectar este repositório a um Supabase novo do zero (fora do Lovable), rode
`supabase/sql/01_supabase_schema.sql`, depois `02_safra_aware_views.sql`, depois
`03_projeto_rm.sql`, antes do passo de carga acima.

## Importação do realizado

O extrato real do TOTVS RM não vem por centro de custo de fazenda (o formato "001.01.01.001"
usado no orçamento) — vem por **projeto/obra**: colunas `ROWL, DATA, CODCCUSTO, NOMECUSTO,
CONTA_CONTABIL, DESCRICAO_CONTABIL, DOCUMENTO, QUANTIDADE, SALDO`. Cada `CODCCUSTO` (ex.
`99.00.1314`) é um projeto específico (`NOMECUSTO` descreve o quê, ex. "FAZ. AROEIRA -
CORRECAO DE SOLO COM GRID 1/3") — e nem todo projeto do RM é investimento: o extrato real mistura
obras de CAPEX com rateios de despesa, marketing, RH etc.

Por isso o vínculo é direto **projeto → item do orçamento** (não mais projeto → centro de
custo):

1. Na primeira importação, nenhum `CODCCUSTO` bate com nada — todas as linhas de projetos de
   investimento caem em **Pendências → Sem item vinculado**, junto com um monte de projetos que
   não são investimento (esses últimos podem ficar pendentes para sempre, sem efeito nos
   totais).
2. Ao selecionar as linhas de um projeto em Pendências e vincular a um item, o app grava
   `item_orcamento.codigo_rm_projeto` — da próxima importação em diante, esse projeto casa
   sozinho.
3. O centro de custo do lançamento é sempre herdado do item vinculado (não é mais preciso
   cadastrar centro de custo a partir do lançamento).

A chave de idempotência (`chave_rm`) usa data + projeto + documento + conta + valor; quando essa
combinação se repete dentro do mesmo arquivo (comum quando o documento vem em branco ou é um
número de rateio reaproveitado — ~20% das linhas do extrato real), a ordem relativa entre as
repetições desempata a chave, então reimportar o mesmo arquivo continua sendo detectado como
duplicata.

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
  safra está CONGELADA. Cadastro de item novo (CODCCUSTO, NOMECUSTO, área/centro de custo — com
  opção de cadastrar uma unidade nova na hora — e valor orçado) e cadastro em lote por planilha,
  ambos a partir do botão no topo da tela. Cada item já cadastrado pode ser editado (ícone de
  lápis ao lado da descrição — código, nome e área; os valores mensais continuam se editando
  direto na grade) e a grade inteira pode ser exportada para Excel a qualquer momento.
- **Importar Realizado** — upload do extrato de custos por projeto do RM (.xlsx/.csv), preview
  com vinculadas/duplicadas/sem item antes de gravar.
- **Pendências** — lançamentos sem item vinculado (vínculo em lote, aprendido para as próximas
  importações) e centro de custo não cadastrado (fluxo legado, para formatos antigos).
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
