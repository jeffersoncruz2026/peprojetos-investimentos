import * as XLSX from "xlsx";

export interface LinhaRealizadoBruta {
  data: string; // yyyy-mm-dd
  centroCustoRm: string;
  contaContabil: string;
  documento: string;
  historico: string;
  valor: number;
}

export interface LinhaRealizadoPreview extends LinhaRealizadoBruta {
  chaveRm: string;
  competencia: string; // yyyy-mm-01
  centroCustoId: string | null;
  situacao: "NOVA" | "DUPLICADA" | "SEM_CENTRO_CUSTO";
}

const HEADER_ALIASES: Record<string, keyof LinhaRealizadoBruta> = {
  data: "data",
  "centro de custo rm": "centroCustoRm",
  "centro de custo": "centroCustoRm",
  "conta contábil": "contaContabil",
  "conta contabil": "contaContabil",
  documento: "documento",
  histórico: "historico",
  historico: "historico",
  "valor realizado": "valor",
  valor: "valor",
};

function excelSerialToIso(serial: number): string {
  const date = XLSX.SSF.parse_date_code(serial);
  const mm = String(date.m).padStart(2, "0");
  const dd = String(date.d).padStart(2, "0");
  return `${date.y}-${mm}-${dd}`;
}

function parseDataCell(v: unknown): string {
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  if (typeof v === "number") return excelSerialToIso(v);
  const s = String(v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return s;
}

function parseValorCell(v: unknown): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const normalizado = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  return Number(normalizado) || 0;
}

export async function parseArquivoRealizado(file: File): Promise<LinhaRealizadoBruta[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return rows
    .map((row) => {
      const normalized: Partial<LinhaRealizadoBruta> = {};
      for (const [rawKey, rawValue] of Object.entries(row)) {
        const key = HEADER_ALIASES[rawKey.trim().toLowerCase()];
        if (!key) continue;
        if (key === "data") normalized.data = parseDataCell(rawValue);
        else if (key === "valor") normalized.valor = parseValorCell(rawValue);
        else normalized[key] = String(rawValue ?? "").trim();
      }
      return normalized;
    })
    .filter((r): r is LinhaRealizadoBruta => Boolean(r.data && r.centroCustoRm))
    .map((r) => ({
      data: r.data,
      centroCustoRm: r.centroCustoRm,
      contaContabil: r.contaContabil ?? "",
      documento: r.documento ?? "",
      historico: r.historico ?? "",
      valor: r.valor ?? 0,
    }));
}

export function montarChaveRm(linha: LinhaRealizadoBruta): string {
  return [linha.data, linha.centroCustoRm, linha.documento, linha.contaContabil, linha.valor].join("|");
}

export function primeiroDiaDoMes(dataIso: string): string {
  return `${dataIso.slice(0, 7)}-01`;
}
