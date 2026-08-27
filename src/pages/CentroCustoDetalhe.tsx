import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FarolBadge } from "@/components/FarolBadge";
import { useSafra } from "@/hooks/useSafra";
import { fetchCcAcumulado, fetchCentroCusto, fetchItemAcumuladoPorCc } from "@/lib/api";
import { moeda, percentual } from "@/lib/format";
import { supabaseConfigured } from "@/lib/supabaseClient";

export default function CentroCustoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { safraId } = useSafra();

  const cc = useQuery({
    queryKey: ["centro-custo", id],
    queryFn: () => fetchCentroCusto(id!),
    enabled: supabaseConfigured && Boolean(id),
  });

  const ccAcumulado = useQuery({
    queryKey: ["cc-acumulado", safraId],
    queryFn: () => fetchCcAcumulado(safraId),
    enabled: supabaseConfigured,
  });

  const totalCc = useMemo(
    () => ccAcumulado.data?.find((c) => c.centro_custo_id === id),
    [ccAcumulado.data, id]
  );

  const itens = useQuery({
    queryKey: ["item-acumulado-cc", safraId, cc.data?.codigo_rm],
    queryFn: () => fetchItemAcumuladoPorCc(safraId, cc.data!.codigo_rm),
    enabled: supabaseConfigured && Boolean(cc.data?.codigo_rm),
  });

  return (
    <div className="flex flex-col gap-6">
      <Link to="/centros-custo" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit">
        <ArrowLeft className="h-4 w-4" /> Voltar para centros de custo
      </Link>

      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">{cc.data?.nome ?? "..."}</h1>
        <p className="text-sm text-muted-foreground">
          {cc.data?.codigo_rm} · {cc.data?.atividade}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 lg:p-6">
            <p className="text-xs lg:text-sm text-muted-foreground mb-1.5">Orçado</p>
            <p className="text-lg lg:text-2xl font-bold">{moeda(totalCc?.orcado)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 lg:p-6">
            <p className="text-xs lg:text-sm text-muted-foreground mb-1.5">Realizado</p>
            <p className="text-lg lg:text-2xl font-bold">{moeda(totalCc?.realizado)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 lg:p-6">
            <p className="text-xs lg:text-sm text-muted-foreground mb-1.5">Saldo</p>
            <p className={`text-lg lg:text-2xl font-bold ${Number(totalCc?.saldo) < 0 ? "text-destructive" : ""}`}>
              {moeda(totalCc?.saldo)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 lg:p-6">
            <p className="text-xs lg:text-sm text-muted-foreground mb-1.5">% Execução</p>
            <p className="text-lg lg:text-2xl font-bold">{percentual(totalCc?.pct_execucao)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Itens deste centro de custo</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Orçado</TableHead>
                <TableHead className="text-right">Realizado</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Farol</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(itens.data ?? []).map((item) => (
                <TableRow key={item.item_id}>
                  <TableCell className="font-mono text-xs">{item.codigo}</TableCell>
                  <TableCell>
                    <Link to={`/itens/${item.item_id}`} className="font-medium hover:underline">
                      {item.item}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{item.status}</TableCell>
                  <TableCell className="text-right">{moeda(item.orcado)}</TableCell>
                  <TableCell className="text-right">{moeda(item.realizado)}</TableCell>
                  <TableCell className={`text-right ${Number(item.saldo) < 0 ? "text-destructive" : ""}`}>
                    {moeda(item.saldo)}
                  </TableCell>
                  <TableCell>
                    <FarolBadge farol={item.farol} />
                  </TableCell>
                </TableRow>
              ))}
              {itens.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum item cadastrado para este centro de custo.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
