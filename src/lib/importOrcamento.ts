import * as XLSX from "xlsx";
import { normalizeHeader, parseCompetenciaCell, parseValorCell } from "@/lib/xlsxCell";
import { parseCompetenciaLabel } from "@/lib/format";

// Planilha de cadastro em lote do orçamento. Dois formatos são aceitos:
//
// 1. "Largo" — uma linha por item, um mês por coluna (Código, CODCCUSTO,
//    Item, Centro de Custo, Atividade, abr/26, mai/26, ..., Total). É o
//    formato do modelo oficial e também o que a própria tela de Orçamento
//    gera em "Exportar Excel" — permite reimportar a mesma planilha depois
//    de editada.
// 2. "Longo" — uma linha por item x mês (Centro de Custo RM, Unidade,
//    Atividade, Item, Competência, Valor Orçado), no espírito do
//    seed_orcamento_mensal.csv original.
//
// CODCCUSTO é opcional — quando informado, é o código do projeto no RM e
// já deixa o item pronto para casar sozinho na importação do realizado
// (veja importRealizado.ts). "Centro de Custo" pode ser só o nome da
// fazenda/unidade (sem um código próprio) — nesse caso o vínculo com um
// centro_custo já cadastrado é feito pelo nome, não por código.
export interface LinhaOrcamentoBruta {
  idItem: string;
  codigoCc: string;
  nomeCc: string;
  atividade: string;
  codigoProjeto: string;
  item: string;
  competencia: string; // yyyy-mm-01
  valor: number;
}

type CampoTexto = "idItem" | "codigoCc" | "nomeCc" | "atividade" | "codigoProjeto" | "item";

const HEADER_ALIASES_RAW: Record<string, CampoTexto> = {
  código: "idItem",
  codigo: "idItem",
  "id item": "idItem",
  "código cc": "codigoCc",
  "codigo cc": "codigoCc",
  "centro de custo rm": "codigoCc",
  "centro de custo": "nomeCc",
  unidade: "nomeCc",
  "nome cc": "nomeCc",
  atividade: "atividade",
  codccusto: "codigoProjeto",
  "cod ccusto": "codigoProjeto",
  "código projeto": "codigoProjeto",
  "codigo projeto": "codigoProjeto",
  item: "item",
  descricao: "item",
  "descrição": "item",
};

const HEADER_ALIASES: Record<string, CampoTexto> = Object.fromEntries(
  Object.entries(HEADER_ALIASES_RAW).map(([k, v]) => [normalizeHeader(k), v])
);

const HEADER_ALIASES_COMPETENCIA = new Set(["competência", "competencia"].map(normalizeHeader));
const HEADER_ALIASES_VALOR = new Set(["valor orçado", "valor orcado", "valor"].map(normalizeHeader));

export async function parseArquivoOrcamento(file: File): Promise<LinhaOrcamentoBruta[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (rows.length === 0) return [];

  // Colunas de mês são detectadas pelo formato do cabeçalho ("abr/26"), não
  // por um alias fixo — o ano varia de planilha para planilha.
  const colunasMes = Object.keys(rows[0])
    .map((cabecalho) => ({ cabecalho, competencia: parseCompetenciaLabel(cabecalho) }))
    .filter((c): c is { cabecalho: string; competencia: string } => c.competencia !== null);

  const linhas: LinhaOrcamentoBruta[] = [];

  for (const row of rows) {
    const campos: Partial<Record<CampoTexto, string>> = {};
    let competenciaLonga = "";
    let valorLongo = 0;

    for (const [rawKey, rawValue] of Object.entries(row)) {
      const norm = normalizeHeader(rawKey);
      const campo = HEADER_ALIASES[norm];
      if (campo) {
        campos[campo] = String(rawValue ?? "").trim();
      } else if (HEADER_ALIASES_COMPETENCIA.has(norm)) {
        competenciaLonga = parseCompetenciaCell(rawValue);
      } else if (HEADER_ALIASES_VALOR.has(norm)) {
        valorLongo = parseValorCell(rawValue);
      }
    }

    if (!campos.item) continue;
    const comum = {
      idItem: campos.idItem ?? "",
      codigoCc: campos.codigoCc ?? "",
      nomeCc: campos.nomeCc || campos.codigoCc || "",
      atividade: (campos.atividade || "ADMINISTRACAO").toUpperCase(),
      codigoProjeto: campos.codigoProjeto ?? "",
      item: campos.item,
    };
    if (!comum.nomeCc) continue;

    if (colunasMes.length > 0) {
      for (const { cabecalho, competencia } of colunasMes) {
        linhas.push({ ...comum, competencia, valor: parseValorCell(row[cabecalho]) });
      }
    } else if (competenciaLonga) {
      linhas.push({ ...comum, competencia: competenciaLonga, valor: valorLongo });
    }
  }

  return linhas;
}
