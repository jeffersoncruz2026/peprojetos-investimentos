import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { Printer, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSafra } from "@/hooks/useSafra";
import { fetchCcAcumulado, fetchCurvaMensal, fetchItemAcumulado } from "@/lib/api";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import { competenciaLabel, dataBr, moeda, percentual } from "@/lib/format";
import { FarolBadge } from "@/components/FarolBadge";
import type { Realizado } from "@/lib/types";

export default function Relatorios() {
  const { safraId } = useSafra();

  const itemAcumulado = useQuery({
    queryKey: ["item-acumulado", safraId],
    queryFn: () => fetchItemAcumulado(safraId),
    enabled: supabaseConfigured,
  });
  const ccAcumulado = useQuery({
    queryKey: ["cc-acumulado", safraId],
    queryFn: () => fetchCcAcumulado(safraId),
    enabled: supabaseConfigured,
  });
  const curva = useQuery({
    queryKey: ["curva-mensal", safraId],
    queryFn: () => fetchCurvaMensal(safraId),
    enabled: supabaseConfigured,
  });

  async function exportarRazao() {
    const itemIds = (itemAcumulado.data ?? []).map((i) => i.item_id);
    if (itemIds.length === 0) return;
    const { data, error } = await supabase
      .from("realizado")
      .select("*")
      .in("item_orcamento_id", itemIds)
      .order("data_lancamento", { ascending: false });
    if (error) return;
    exportarExcel(
      "razao_lancamentos",
      (data as Realizado[]).map((r) => ({
        Data: dataBr(r.data_lancamento),
        "Centro de Custo": r.codigo_cc_origem,
        "Conta Contábil": r.conta_contabil,
        Documento: r.documento,
        Histórico: r.historico,
        Valor: r.valor,
      }))
    );
  }

  function exportarPorItem() {
    exportarExcel(
      "orcado_realizado_por_item",
      (itemAcumulado.data ?? []).map((i) => ({
        Código: i.codigo,
        Item: i.item,
        "Centro de Custo": i.centro_custo,
        Atividade: i.atividade,
        Tipo: i.tipo,
        Status: i.status,
        Orçado: i.orcado,
        Realizado: i.realizado,
        Comprometido: i.comprometido,
        Saldo: i.saldo,
        "% Execução": i.pct_execucao,
        Farol: i.farol,
      }))
    );
  }

  function exportarPorCentroCusto() {
    exportarExcel(
      "orcado_realizado_por_centro_custo",
      (ccAcumulado.data ?? []).map((c) => ({
        "Código RM": c.codigo_rm,
        "Centro de Custo": c.centro_custo,
        Atividade: c.atividade,
        Orçado: c.orcado,
        Realizado: c.realizado,
        Saldo: c.saldo,
        "% Execução": c.pct_execucao,
      }))
    );
  }

  const porAtividade = useMemo(() => {
    const map = new Map<string, { atividade: string; orcado: number; realizado: number }>();
    for (const cc of ccAcumulado.data ?? []) {
      const cur = map.get(cc.atividade) ?? { atividade: cc.atividade, orcado: 0, realizado: 0 };
      cur.orcado += Number(cc.orcado);
      cur.realizado += Number(cc.realizado);
      map.set(cc.atividade, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.orcado - a.orcado);
  }, [ccAcumulado.data]);

  const maioresDesvios = useMemo(
    () =>
      [...(itemAcumulado.data ?? [])]
        .sort((a, b) => Number(a.saldo) - Number(b.saldo))
        .slice(0, 10),
    [itemAcumulado.data]
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Exportações e posição da safra {safraId}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
        <Card>
          <CardContent className="p-4 flex flex-col gap-2">
            <p className="text-sm font-medium">Orçado x realizado por item</p>
            <Button size="sm" variant="outline" className="gap-1.5 w-fit" onClick={exportarPorItem}>
              <Download className="h-4 w-4" /> Exportar Excel
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col gap-2">
            <p className="text-sm font-medium">Orçado x realizado por centro de custo</p>
            <Button size="sm" variant="outline" className="gap-1.5 w-fit" onClick={exportarPorCentroCusto}>
              <Download className="h-4 w-4" /> Exportar Excel
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col gap-2">
            <p className="text-sm font-medium">Razão dos lançamentos importados</p>
            <Button size="sm" variant="outline" className="gap-1.5 w-fit" onClick={exportarRazao}>
              <Download className="h-4 w-4" /> Exportar Excel
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between print:hidden">
          <CardTitle>Posição da safra {safraId}</CardTitle>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimir / PDF
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div>
            <h3 className="font-semibold mb-2">Totais por atividade</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Atividade</TableHead>
                  <TableHead className="text-right">Orçado</TableHead>
                  <TableHead className="text-right">Realizado</TableHead>
                  <TableHead className="text-right">% Execução</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porAtividade.map((a) => (
                  <TableRow key={a.atividade}>
                    <TableCell>{a.atividade}</TableCell>
                    <TableCell className="text-right">{moeda(a.orcado)}</TableCell>
                    <TableCell className="text-right">{moeda(a.realizado)}</TableCell>
                    <TableCell className="text-right">
                      {percentual(a.orcado === 0 ? null : (a.realizado / a.orcado) * 100)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Curva mensal</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competência</TableHead>
                  <TableHead className="text-right">Orçado acum.</TableHead>
                  <TableHead className="text-right">Realizado acum.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(curva.data ?? []).map((c) => (
                  <TableRow key={c.competencia}>
                    <TableCell>{competenciaLabel(c.competencia)}</TableCell>
                    <TableCell className="text-right">{moeda(c.orcado_acum)}</TableCell>
                    <TableCell className="text-right">{moeda(c.realizado_acum)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Dez maiores desvios</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Centro de custo</TableHead>
                  <TableHead className="text-right">Orçado</TableHead>
                  <TableHead className="text-right">Realizado</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Farol</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maioresDesvios.map((i) => (
                  <TableRow key={i.item_id}>
                    <TableCell>
                      {i.codigo} — {i.item}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{i.centro_custo}</TableCell>
                    <TableCell className="text-right">{moeda(i.orcado)}</TableCell>
                    <TableCell className="text-right">{moeda(i.realizado)}</TableCell>
                    <TableCell className="text-right">{moeda(i.saldo)}</TableCell>
                    <TableCell>
                      <FarolBadge farol={i.farol} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function exportarExcel(nomeArquivo: string, linhas: Record<string, unknown>[]) {
  const worksheet = XLSX.utils.json_to_sheet(linhas);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");
  XLSX.writeFile(workbook, `${nomeArquivo}.xlsx`);
}
