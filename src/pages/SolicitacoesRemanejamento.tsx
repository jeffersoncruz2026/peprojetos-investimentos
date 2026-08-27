import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { useSafra } from "@/hooks/useSafra";
import { useToast } from "@/hooks/use-toast";
import {
  aprovarRemanejamento,
  fetchCentrosCusto,
  fetchItensOrcamentoPorSafra,
  fetchRemanejamentosPorSafra,
  rejeitarRemanejamento,
} from "@/lib/api";
import { supabaseConfigured } from "@/lib/supabaseClient";
import { competenciaLabel, mensagemErro, moeda } from "@/lib/format";
import type { Remanejamento, RemanejamentoStatus } from "@/lib/types";

const FILTROS: { value: RemanejamentoStatus | "TODOS"; label: string }[] = [
  { value: "TODOS", label: "Todos" },
  { value: "PENDENTE", label: "Pendentes" },
  { value: "APROVADO", label: "Aprovados" },
  { value: "REJEITADO", label: "Rejeitados" },
];

function StatusBadge({ status }: { status: RemanejamentoStatus }) {
  if (status === "PENDENTE") return <Badge variant="secondary">Pendente</Badge>;
  if (status === "REJEITADO") return <Badge variant="destructive">Rejeitado</Badge>;
  return <Badge className="bg-emerald-600 hover:bg-emerald-600/90 text-white border-transparent">Aprovado</Badge>;
}

export default function SolicitacoesRemanejamento() {
  const { safraId } = useSafra();
  const { isAdmin, usuarioAtual } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [filtro, setFiltro] = useState<RemanejamentoStatus | "TODOS">("PENDENTE");
  const [rejeitando, setRejeitando] = useState<Remanejamento | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");

  const itens = useQuery({
    queryKey: ["itens-orcamento", safraId],
    queryFn: () => fetchItensOrcamentoPorSafra(safraId),
    enabled: supabaseConfigured,
  });

  const centros = useQuery({
    queryKey: ["centros-custo"],
    queryFn: fetchCentrosCusto,
    enabled: supabaseConfigured,
  });

  const solicitacoes = useQuery({
    queryKey: ["remanejamentos", safraId],
    queryFn: () => fetchRemanejamentosPorSafra(safraId),
    enabled: supabaseConfigured,
  });

  const centroNome = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of centros.data ?? []) map.set(c.id, c.nome);
    return map;
  }, [centros.data]);

  const itemInfo = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of itens.data ?? []) {
      map.set(item.id, `${item.codigo} · ${item.descricao} — ${centroNome.get(item.centro_custo_id) ?? ""}`);
    }
    return map;
  }, [itens.data, centroNome]);

  const listaFiltrada = useMemo(() => {
    const lista = solicitacoes.data ?? [];
    return filtro === "TODOS" ? lista : lista.filter((r) => r.status === filtro);
  }, [solicitacoes.data, filtro]);

  function invalidarTudo() {
    qc.invalidateQueries({ queryKey: ["remanejamentos", safraId] });
    qc.invalidateQueries({ queryKey: ["orcamento-mensal"] });
    qc.invalidateQueries({ queryKey: ["item-acumulado"] });
    qc.invalidateQueries({ queryKey: ["cc-acumulado"] });
    qc.invalidateQueries({ queryKey: ["curva-mensal"] });
  }

  const aprovar = useMutation({
    mutationFn: (id: string) => aprovarRemanejamento(id, usuarioAtual),
    onSuccess: () => {
      toast({ title: "Remanejamento aprovado." });
      invalidarTudo();
    },
    onError: (e: unknown) =>
      toast({ title: "Erro ao aprovar", description: mensagemErro(e), variant: "destructive" }),
  });

  const rejeitar = useMutation({
    mutationFn: () => rejeitarRemanejamento(rejeitando!.id, usuarioAtual, motivoRejeicao.trim()),
    onSuccess: () => {
      toast({ title: "Solicitação rejeitada." });
      setRejeitando(null);
      setMotivoRejeicao("");
      invalidarTudo();
    },
    onError: (e: unknown) =>
      toast({ title: "Erro ao rejeitar", description: mensagemErro(e), variant: "destructive" }),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
            Solicitações de Remanejamento — Safra {safraId}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Aprove ou rejeite as solicitações pendentes."
              : "Acompanhe o status das solicitações de remanejamento."}
          </p>
        </div>
        <Select value={filtro} onValueChange={(v) => setFiltro(v as RemanejamentoStatus | "TODOS")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTROS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
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
                <TableHead>Data</TableHead>
                <TableHead>De</TableHead>
                <TableHead>Para</TableHead>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Solicitante</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Decisão</TableHead>
                {isAdmin && <TableHead>Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {listaFiltrada.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate" title={itemInfo.get(r.item_origem_id)}>
                    {itemInfo.get(r.item_origem_id) ?? r.item_origem_id}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate" title={itemInfo.get(r.item_destino_id)}>
                    {itemInfo.get(r.item_destino_id) ?? r.item_destino_id}
                  </TableCell>
                  <TableCell>{competenciaLabel(r.competencia)}</TableCell>
                  <TableCell className="text-right">{moeda(r.valor)}</TableCell>
                  <TableCell className="max-w-[220px] truncate" title={r.motivo}>
                    {r.motivo}
                  </TableCell>
                  <TableCell>{r.usuario ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="max-w-[220px]">
                    {r.status === "PENDENTE" ? (
                      "—"
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        <p>{r.decidido_por}</p>
                        <p>{r.decidido_em ? new Date(r.decidido_em).toLocaleString("pt-BR") : ""}</p>
                        {r.motivo_decisao && <p className="truncate" title={r.motivo_decisao}>{r.motivo_decisao}</p>}
                      </div>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      {r.status === "PENDENTE" && (
                        <div className="flex gap-1.5">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7 text-emerald-600 hover:text-emerald-600"
                            title="Aprovar"
                            onClick={() => aprovar.mutate(r.id)}
                            disabled={aprovar.isPending}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            title="Rejeitar"
                            onClick={() => setRejeitando(r)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {listaFiltrada.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 10 : 9} className="text-center text-muted-foreground py-6">
                    Nenhuma solicitação encontrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={Boolean(rejeitando)} onOpenChange={(open) => !open && setRejeitando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar solicitação de remanejamento</DialogTitle>
          </DialogHeader>
          {rejeitando && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {itemInfo.get(rejeitando.item_origem_id)} → {itemInfo.get(rejeitando.item_destino_id)} ·{" "}
                {competenciaLabel(rejeitando.competencia)} · {moeda(rejeitando.valor)}
              </p>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Motivo da rejeição *</label>
                <Textarea
                  value={motivoRejeicao}
                  onChange={(e) => setMotivoRejeicao(e.target.value)}
                  placeholder="Obrigatório"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejeitando(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejeitar.mutate()}
              disabled={!motivoRejeicao.trim() || rejeitar.isPending}
            >
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
