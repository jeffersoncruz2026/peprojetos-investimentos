import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchCompromissosPorItem,
  fetchItemMesPorItem,
  fetchItemOrcamento,
  fetchLancamentosPorItem,
} from "@/lib/api";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import { competenciaLabel, dataBr, moeda, percentual } from "@/lib/format";
import type { ItemStatus } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

const STATUS_OPTIONS: ItemStatus[] = [
  "PLANEJADO",
  "APROVADO",
  "EM_ANDAMENTO",
  "CONCLUIDO",
  "CANCELADO",
  "A_ORCAR",
];

export default function ItemDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { isGestor } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const item = useQuery({
    queryKey: ["item-orcamento", id],
    queryFn: () => fetchItemOrcamento(id!),
    enabled: supabaseConfigured && Boolean(id),
  });

  const mensal = useQuery({
    queryKey: ["item-mes", id],
    queryFn: () => fetchItemMesPorItem(id!),
    enabled: supabaseConfigured && Boolean(id),
  });

  const lancamentos = useQuery({
    queryKey: ["lancamentos", id],
    queryFn: () => fetchLancamentosPorItem(id!),
    enabled: supabaseConfigured && Boolean(id),
  });

  const compromissos = useQuery({
    queryKey: ["compromissos", id],
    queryFn: () => fetchCompromissosPorItem(id!),
    enabled: supabaseConfigured && Boolean(id),
  });

  const [descricao, setDescricao] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [status, setStatus] = useState<ItemStatus>("PLANEJADO");
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (item.data) {
      setDescricao(item.data.descricao);
      setResponsavel(item.data.responsavel ?? "");
      setStatus(item.data.status);
      setObservacao(item.data.observacao ?? "");
    }
  }, [item.data]);

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("item_orcamento")
        .update({
          descricao,
          responsavel: responsavel || null,
          status,
          observacao: observacao || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Item atualizado." });
      qc.invalidateQueries({ queryKey: ["item-orcamento", id] });
      qc.invalidateQueries({ queryKey: ["item-acumulado"] });
    },
    onError: (e: Error) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const totais = (mensal.data ?? []).reduce(
    (acc, m) => {
      acc.orcado += Number(m.orcado);
      acc.realizado += Number(m.realizado);
      return acc;
    },
    { orcado: 0, realizado: 0 }
  );

  return (
    <div className="flex flex-col gap-6">
      <Link to="/centros-custo" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm text-muted-foreground">{item.data?.codigo}</span>
            {item.data?.tipo && <Badge variant="secondary">{item.data.tipo}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Descrição</label>
            <Input value={descricao} disabled={!isGestor} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Responsável</label>
            <Input value={responsavel} disabled={!isGestor} onChange={(e) => setResponsavel(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select value={status} disabled={!isGestor} onValueChange={(v) => setStatus(v as ItemStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Observação</label>
            <Textarea value={observacao} disabled={!isGestor} onChange={(e) => setObservacao(e.target.value)} />
          </div>
          {isGestor && (
            <div className="md:col-span-2">
              <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
                Salvar alterações
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Orçado x realizado por mês</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competência</TableHead>
                <TableHead className="text-right">Orçado</TableHead>
                <TableHead className="text-right">Realizado</TableHead>
                <TableHead className="text-right">Desvio</TableHead>
                <TableHead className="text-right">% Execução</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(mensal.data ?? []).map((m) => (
                <TableRow key={m.competencia}>
                  <TableCell>{competenciaLabel(m.competencia)}</TableCell>
                  <TableCell className="text-right">{moeda(m.orcado)}</TableCell>
                  <TableCell className="text-right">{moeda(m.realizado)}</TableCell>
                  <TableCell className={`text-right ${Number(m.desvio) > 0 ? "text-destructive" : ""}`}>
                    {moeda(m.desvio)}
                  </TableCell>
                  <TableCell className="text-right">{percentual(m.pct_execucao)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold bg-muted/40">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{moeda(totais.orcado)}</TableCell>
                <TableCell className="text-right">{moeda(totais.realizado)}</TableCell>
                <TableCell className="text-right">{moeda(totais.realizado - totais.orcado)}</TableCell>
                <TableCell className="text-right">
                  {percentual(totais.orcado === 0 ? null : (totais.realizado / totais.orcado) * 100)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lançamentos do RM</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Histórico</TableHead>
                <TableHead>Conta contábil</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(lancamentos.data ?? []).map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{dataBr(l.data_lancamento)}</TableCell>
                  <TableCell>{l.documento ?? "—"}</TableCell>
                  <TableCell className="max-w-[280px] truncate">{l.historico ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{l.conta_contabil ?? "—"}</TableCell>
                  <TableCell className="text-right">{moeda(l.valor)}</TableCell>
                </TableRow>
              ))}
              {lancamentos.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum lançamento vinculado a este item ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Compromissos em aberto</CardTitle>
          {isGestor && <NovoCompromisso itemId={id!} />}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Previsão</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(compromissos.data ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.descricao}</TableCell>
                  <TableCell>{c.fornecedor ?? "—"}</TableCell>
                  <TableCell>{c.numero_pedido ?? "—"}</TableCell>
                  <TableCell>{dataBr(c.data_prevista)}</TableCell>
                  <TableCell className="text-right">{moeda(c.valor)}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === "ABERTO" ? "secondary" : "outline"}>{c.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {compromissos.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum compromisso registrado.
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

function NovoCompromisso({ itemId }: { itemId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [numeroPedido, setNumeroPedido] = useState("");
  const [valor, setValor] = useState("");
  const [dataPrevista, setDataPrevista] = useState("");

  const criar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("compromisso").insert({
        item_orcamento_id: itemId,
        descricao,
        fornecedor: fornecedor || null,
        numero_pedido: numeroPedido || null,
        valor: Number(valor.replace(",", ".")) || 0,
        data_prevista: dataPrevista || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Compromisso adicionado." });
      setOpen(false);
      setDescricao("");
      setFornecedor("");
      setNumeroPedido("");
      setValor("");
      setDataPrevista("");
      qc.invalidateQueries({ queryKey: ["compromissos", itemId] });
      qc.invalidateQueries({ queryKey: ["item-acumulado"] });
    },
    onError: (e: Error) => toast({ title: "Erro ao adicionar", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo compromisso
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo compromisso</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          <Input placeholder="Fornecedor" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
          <Input placeholder="Número do pedido" value={numeroPedido} onChange={(e) => setNumeroPedido(e.target.value)} />
          <Input placeholder="Valor" value={valor} onChange={(e) => setValor(e.target.value)} />
          <Input type="date" value={dataPrevista} onChange={(e) => setDataPrevista(e.target.value)} />
        </div>
        <DialogFooter>
          <Button onClick={() => criar.mutate()} disabled={!descricao || !valor || criar.isPending}>
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
