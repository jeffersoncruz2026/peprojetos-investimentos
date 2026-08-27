import * as XLSX from "xlsx";

// Formato real exportado do TOTVS RM (planilha de custos por centro de
// custo/projeto): ROWL, DATA, CODCCUSTO, NOMECUSTO, CONTA_CONTABIL,
// DESCRICAO_CONTABIL, DOCUMENTO, QUANTIDADE, SALDO, "Total Geral".
// Cada CODCCUSTO (ex.: "99.00.1314") é um projeto/obra específico — não um
// centro de custo de fazenda — então o vínculo é feito direto contra
// item_orcamento.codigo_rm_projeto, não contra centro_custo.
export interface LinhaRealizadoBruta {
  data: string; // yyyy-mm-dd
  codigoProjeto: string;
  nomeProjeto: string;
  contaContabil: string;
  descricaoContabil: string;
  documento: string;
  valor: number;
}

export interface LinhaRealizadoPreview extends LinhaRealizadoBruta {
  chaveRm: string;
  competencia: string; // yyyy-mm-01
  itemOrcamentoId: string | null;
  centroCustoId: string | null;
  situacao: "NOVA" | "DUPLICADA" | "SEM_ITEM";
}

const HEADER_ALIASES: Record<string, keyof LinhaRealizadoBruta> = {
  data: "data",
  codccusto: "codigoProjeto",
  "cod ccusto": "codigoProjeto",
  "codigo ccusto": "codigoProjeto",
  nomecusto: "nomeProjeto",
  "nome ccusto": "nomeProjeto",
  conta_contabil: "contaContabil",
  "conta contábil": "contaContabil",
  "conta contabil": "contaContabil",
  descricao_contabil: "descricaoContabil",
  "descrição contábil": "descricaoContabil",
  documento: "documento",
  saldo: "valor",
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
    .filter((r): r is LinhaRealizadoBruta => Boolean(r.data && r.codigoProjeto))
    .map((r) => ({
      data: r.data,
      codigoProjeto: r.codigoProjeto,
      nomeProjeto: r.nomeProjeto ?? "",
      contaContabil: r.contaContabil ?? "",
      descricaoContabil: r.descricaoContabil ?? "",
      documento: r.documento ?? "",
      valor: r.valor ?? 0,
    }));
}

export function montarChaveRm(linha: LinhaRealizadoBruta): string {
  return [linha.data, linha.codigoProjeto, linha.documento, linha.contaContabil, linha.valor].join("|");
}

// O extrato real do RM repete a mesma combinação (data + projeto + documento
// + conta + valor) em ~20% das linhas — geralmente porque o documento vem em
// branco ou é um número de transferência genérico reaproveitado em várias
// linhas distintas do mesmo dia. Tratar essas repetições como "duplicada"
// descartaria lançamentos legítimos. Em vez de mudar a chave base (o que
// enfraqueceria a proteção contra reimportar o mesmo arquivo), desempata só
// quando a MESMA chave aparece mais de uma vez dentro do arquivo sendo
// importado agora, usando a ordem relativa entre as repetições — a 1ª
// ocorrência mantém a chave normal (compatível com o que já foi importado
// antes), a 2ª ganha sufixo "#2", e assim por diante. Reimportar o mesmo
// arquivo de novo reproduz a mesma sequência de sufixos, então a
// idempotência contra reimportação continua funcionando.
export function montarChavesRm(linhas: LinhaRealizadoBruta[]): string[] {
  const ocorrencias = new Map<string, number>();
  return linhas.map((linha) => {
    const base = montarChaveRm(linha);
    const n = (ocorrencias.get(base) ?? 0) + 1;
    ocorrencias.set(base, n);
    return n === 1 ? base : `${base}#${n}`;
  });
}

export function primeiroDiaDoMes(dataIso: string): string {
  return `${dataIso.slice(0, 7)}-01`;
}
