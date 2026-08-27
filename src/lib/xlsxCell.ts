import * as XLSX from "xlsx";

// Cabeçalhos de planilha podem chegar com acentos corretos ("Competência")
// ou corrompidos por um CSV salvo fora de UTF-8 ("CompetÃªncia"). Reduzir a
// um esqueleto só com [a-z0-9] casa os dois casos com o mesmo alias, já que
// tanto o acento correto quanto os caracteres de mojibake que o substituem
// são descartados pelo strip.
export function normalizeHeader(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function excelSerialToIso(serial: number): string {
  const date = XLSX.SSF.parse_date_code(serial);
  const mm = String(date.m).padStart(2, "0");
  const dd = String(date.d).padStart(2, "0");
  return `${date.y}-${mm}-${dd}`;
}

export function parseDataCell(v: unknown): string {
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

export function parseValorCell(v: unknown): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const normalizado = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  return Number(normalizado) || 0;
}

// Competência aceita "2026-04", "04/2026", data completa (dd/mm/aaaa ou
// serial do Excel) — sempre normalizada para o primeiro dia do mês.
export function parseCompetenciaCell(v: unknown): string {
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-01`;
  }
  if (typeof v === "number") return `${excelSerialToIso(v).slice(0, 7)}-01`;
  const s = String(v ?? "").trim();
  const anoMes = s.match(/^(\d{4})[/-](\d{1,2})$/);
  if (anoMes) return `${anoMes[1]}-${anoMes[2].padStart(2, "0")}-01`;
  const mesAno = s.match(/^(\d{1,2})[/-](\d{4})$/);
  if (mesAno) return `${mesAno[2]}-${mesAno[1].padStart(2, "0")}-01`;
  return `${parseDataCell(v).slice(0, 7)}-01`;
}
