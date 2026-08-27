import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSafra } from "@/hooks/useSafra";
import { fetchCcAcumulado } from "@/lib/api";
import { moeda, percentual } from "@/lib/format";
import type { Atividade } from "@/lib/types";
import { supabaseConfigured } from "@/lib/supabaseClient";

const ATIVIDADES: (Atividade | "TODAS")[] = [
  "TODAS",
  "SERINGUEIRA",
  "PECUARIA",
  "AGRICOLA",
  "ADMINISTRACAO",
  "OFICINA",
  "VEICULOS E MECANIZADOS",
  "VENDA DE VEICULOS",
  "CUSTEIO",
];

export default function CentrosCusto() {
  const { safraId } = useSafra();
  const [busca, setBusca] = useState("");
  const [atividade, setAtividade] = useState<string>("TODAS");

  const { data, isLoading } = useQuery({
    queryKey: ["cc-acumulado", safraId],
    queryFn: () => fetchCcAcumulado(safraId),
    enabled: supabaseConfigured,
  });

  const filtrados = useMemo(() => {
    return (data ?? []).filter((cc) => {
      if (atividade !== "TODAS" && cc.atividade !== atividade) return false;
      if (busca) {
        const q = busca.toLowerCase();
        if (!cc.centro_custo.toLowerCase().includes(q) && !cc.codigo_rm.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [data, busca, atividade]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Centros de Custo</h1>
        <p className="text-sm text-muted-foreground">Orçado x realizado por unidade — safra {safraId}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Buscar por nome ou código RM..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={atividade} onValueChange={setAtividade}>
          <SelectTrigger className="sm:w-[220px]">
            <SelectValue placeholder="Atividade" />
          </SelectTrigger>
          <SelectContent>
            {ATIVIDADES.map((a) => (
              <SelectItem key={a} value={a}>
                {a === "TODAS" ? "Todas as atividades" : a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código RM</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Atividade</TableHead>
                <TableHead className="text-right">Orçado</TableHead>
                <TableHead className="text-right">Realizado</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="w-[180px]">% Execução</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum centro de custo encontrado.
                  </TableCell>
                </TableRow>
              )}
              {filtrados.map((cc) => (
                <TableRow key={cc.centro_custo_id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <Link to={`/centros-custo/${cc.centro_custo_id}`} className="font-mono text-xs">
                      {cc.codigo_rm}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link to={`/centros-custo/${cc.centro_custo_id}`} className="font-medium hover:underline">
                      {cc.centro_custo}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{cc.atividade}</TableCell>
                  <TableCell className="text-right">{moeda(cc.orcado)}</TableCell>
                  <TableCell className="text-right">{moeda(cc.realizado)}</TableCell>
                  <TableCell className={`text-right ${Number(cc.saldo) < 0 ? "text-destructive" : ""}`}>
                    {moeda(cc.saldo)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={Math.min(Number(cc.pct_execucao) || 0, 100)} className="h-2" />
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {percentual(cc.pct_execucao)}
                      </span>
                    </div>
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
