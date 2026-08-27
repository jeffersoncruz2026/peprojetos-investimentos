export function moeda(v: number | string | null | undefined) {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export function numero(v: number | string | null | undefined) {
  return Number(v || 0).toLocaleString("pt-BR");
}

export function percentual(v: number | string | null | undefined) {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  return (
    n.toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }) + "%"
  );
}

export function dataBr(v: string | null | undefined) {
  if (!v) return "—";
  const [ano, mes, dia] = v.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

const MESES_ABREV = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

// competencia no formato "abr/26"
export function competenciaLabel(v: string | null | undefined) {
  if (!v) return "—";
  const [ano, mes] = v.slice(0, 10).split("-");
  const idx = Number(mes) - 1;
  return `${MESES_ABREV[idx] ?? mes}/${ano.slice(2)}`;
}

// gera as 12 competências (dia 1) de uma safra, a partir da data de início
export function competenciasSafra(dataInicio: string, meses = 12): string[] {
  const [ano, mes] = dataInicio.slice(0, 10).split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < meses; i++) {
    const m = mes - 1 + i;
    const y = ano + Math.floor(m / 12);
    const mm = (m % 12) + 1;
    out.push(`${y}-${String(mm).padStart(2, "0")}-01`);
  }
  return out;
}

export function farolColor(farol: string | null | undefined) {
  switch (farol) {
    case "OK":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "ATENCAO":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    case "ESTOURADO":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    case "SEM ORCAMENTO":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}
