import * as XLSX from "xlsx";
import { normalizeHeader, parseCompetenciaCell, parseValorCell } from "@/lib/xlsxCell";

// Planilha de cadastro em lote do orçamento: uma linha por item x mês,
// no mesmo espírito do seed_orcamento_mensal.csv original. "Centro de
// Custo RM" identifica a fazenda/unidade (cria uma nova se o código não
// existir ainda); CODCCUSTO é opcional — quando informado, é o código do
// projeto no RM e já deixa o item pronto para casar sozinho na importação
// do realizado (veja importRealizado.ts).
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

const HEADER_ALIASES_RAW: Record<string, keyof LinhaOrcamentoBruta> = {
  "id item": "idItem",
  "código cc": "codigoCc",
  "codigo cc": "codigoCc",
  "centro de custo rm": "codigoCc",
  "centro de custo": "codigoCc",
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
  "competência": "competencia",
  competencia: "competencia",
  "valor orçado": "valor",
  "valor orcado": "valor",
  valor: "valor",
};

const HEADER_ALIASES: Record<string, keyof LinhaOrcamentoBruta> = Object.fromEntries(
  Object.entries(HEADER_ALIASES_RAW).map(([k, v]) => [normalizeHeader(k), v])
);

export async function parseArquivoOrcamento(file: File): Promise<LinhaOrcamentoBruta[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return rows
    .map((row) => {
      const normalized: Partial<LinhaOrcamentoBruta> = {};
      for (const [rawKey, rawValue] of Object.entries(row)) {
        const key = HEADER_ALIASES[normalizeHeader(rawKey)];
        if (!key) continue;
        if (key === "valor") normalized.valor = parseValorCell(rawValue);
        else if (key === "competencia") normalized.competencia = parseCompetenciaCell(rawValue);
        else normalized[key] = String(rawValue ?? "").trim();
      }
      return normalized;
    })
    .filter((r): r is LinhaOrcamentoBruta => Boolean(r.codigoCc && r.item && r.competencia))
    .map((r) => ({
      idItem: r.idItem ?? "",
      codigoCc: r.codigoCc,
      nomeCc: r.nomeCc || r.codigoCc,
      atividade: (r.atividade || "ADMINISTRACAO").toUpperCase(),
      codigoProjeto: r.codigoProjeto ?? "",
      item: r.item,
      competencia: r.competencia,
      valor: r.valor ?? 0,
    }));
}
