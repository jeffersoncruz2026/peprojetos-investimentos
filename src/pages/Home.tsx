import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FarolBadge } from "@/components/FarolBadge";
import { useSafra } from "@/hooks/useSafra";
import { fetchCcAcumulado, fetchCurvaMensal, fetchItemAcumulado } from "@/lib/api";
import { competenciaLabel, moeda, percentual } from "@/lib/format";
import { supabaseConfigured } from "@/lib/supabaseClient";

export default function Home() {
  const { safraId } = useSafra();

  const curva = useQuery({
    queryKey: ["curva-mensal", safraId],
    queryFn: () => fetchCurvaMensal(safraId),
    enabled: supabaseConfigured,
  });

  const ccAcumulado = useQuery({
    queryKey: ["cc-acumulado", safraId],
    queryFn: () => fetchCcAcumulado(safraId),
    enabled: supabaseConfigured,
  });

  const itemAcumulado = useQuery({
    queryKey: ["item-acumulado", safraId],
    queryFn: () => fetchItemAcumulado(safraId),
    enabled: supabaseConfigured,
  });

  const totais = useMemo(() => {
    const itens = (itemAcumulado.data ?? []).filter((i) => i.tipo !== "DESINVESTIMENTO");
    const orcado = itens.reduce((s, i) => s + Number(i.orcado), 0);
    const realizado = itens.reduce((s, i) => s + Number(i.realizado), 0);
    const comprometido = itens.reduce((s, i) => s + Number(i.comprometido), 0);
    const saldo = orcado - realizado - comprometido;
    const pctExecucao = orcado === 0 ? null : (realizado / orcado) * 100;

    const desinvestimentos = (itemAcumulado.data ?? []).filter((i) => i.tipo === "DESINVESTIMENTO");
    const desinvestimentoRealizado = desinvestimentos.reduce((s, i) => s + Number(i.realizado), 0);
    const desinvestimentoOrcado = desinvestimentos.reduce((s, i) => s + Number(i.orcado), 0);

    return {
      orcado,
      realizado,
      comprometido,
      saldo,
      pctExecucao,
      desinvestimentoRealizado,
      desinvestimentoOrcado,
    };
  }, [itemAcumulado.data]);

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

  const itensAtencao = useMemo(() => {
    return (itemAcumulado.data ?? [])
      .filter((i) => i.farol !== "OK")
      .sort((a, b) => Number(a.saldo) - Number(b.saldo))
      .slice(0, 15);
  }, [itemAcumulado.data]);

  const curvaChart = (curva.data ?? []).map((c) => ({
    competencia: competenciaLabel(c.competencia),
    "Orçado acumulado": Number(c.orcado_acum),
    "Realizado acumulado": Number(c.realizado_acum),
  }));

  if (!supabaseConfigured) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center text-muted-foreground">
          Configure <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> para conectar
          ao banco e visualizar os dados da safra {safraId}.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Posição da Safra {safraId}</h1>
        <p className="text-sm text-muted-foreground">Orçado x realizado dos investimentos</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Orçado da safra" value={moeda(totais.orcado)} sub={null} />
        <KpiCard
          label="Realizado"
          value={moeda(totais.realizado)}
          sub={`${percentual(totais.pctExecucao)} executado`}
        />
        <KpiCard label="Comprometido" value={moeda(totais.comprometido)} sub="Pedidos abertos" />
        <KpiCard
          label="Saldo disponível"
          value={moeda(totais.saldo)}
          sub={totais.saldo < 0 ? "Estourado" : "Dentro do orçado"}
          negative={totais.saldo < 0}
        />
      </div>

      {(totais.desinvestimentoOrcado > 0 || totais.desinvestimentoRealizado > 0) && (
        <Card className="border-secondary/40">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">Desinvestimento (venda de veículos)</span>
            <span className="text-sm text-muted-foreground">
              Orçado {moeda(totais.desinvestimentoOrcado)} · Realizado{" "}
              {moeda(totais.desinvestimentoRealizado)}
            </span>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Orçado x Realizado acumulado</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curvaChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="competencia" stroke="hsl(var(--muted-foreground))" style={{ fontSize: 12 }} />
                <YAxis
                  tickFormatter={(v) => "R$ " + (v / 1000).toFixed(0) + "k"}
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: 12 }}
                />
                <Tooltip formatter={(v: number) => moeda(v)} />
                <Legend />
                <Line type="monotone" dataKey="Orçado acumulado" stroke="hsl(142 65% 42%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Realizado acumulado" stroke="hsl(210 75% 55%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orçado x Realizado por atividade</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porAtividade} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  tickFormatter={(v) => "R$ " + (v / 1000).toFixed(0) + "k"}
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: 12 }}
                />
                <YAxis
                  dataKey="atividade"
                  type="category"
                  width={140}
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: 11 }}
                />
                <Tooltip formatter={(v: number) => moeda(v)} />
                <Legend />
                <Bar dataKey="orcado" name="Orçado" fill="hsl(142 65% 42%)" radius={[0, 6, 6, 0]} />
                <Bar dataKey="realizado" name="Realizado" fill="hsl(210 75% 55%)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Itens que exigem atenção</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
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
              {itensAtencao.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum item fora do farol OK.
                  </TableCell>
                </TableRow>
              )}
              {itensAtencao.map((item) => (
                <TableRow key={item.item_id}>
                  <TableCell>
                    <Link to={`/itens/${item.item_id}`} className="font-medium hover:underline">
                      {item.codigo} — {item.item}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.centro_custo}</TableCell>
                  <TableCell className="text-right">{moeda(item.orcado)}</TableCell>
                  <TableCell className="text-right">{moeda(item.realizado)}</TableCell>
                  <TableCell className="text-right">{moeda(item.saldo)}</TableCell>
                  <TableCell>
                    <FarolBadge farol={item.farol} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  negative,
}: {
  label: string;
  value: string;
  sub: string | null;
  negative?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4 lg:p-6">
        <p className="text-xs lg:text-sm font-medium text-muted-foreground mb-1.5">{label}</p>
        <p className="text-lg lg:text-2xl font-bold text-foreground break-words">{value}</p>
        {sub && (
          <p className={`text-xs mt-1.5 ${negative ? "text-destructive" : "text-muted-foreground"}`}>{sub}</p>
        )}
      </CardContent>
    </Card>
  );
}
