import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeftRight, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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
  fetchCentrosCusto,
  fetchItensOrcamentoPorSafra,
  fetchOrcamentoMensalPorItens,
  fetchRemanejamentosPorSafra,
  remanejarVerba,
} from "@/lib/api";
import { supabaseConfigured } from "@/lib/supabaseClient";
import { competenciaLabel, competenciasSafra, mensagemErro, moeda } from "@/lib/format";

export default function RemanejamentoVerba() {
  const { safra, safraId } = useSafra();
  const { isGestor, usuarioAtual } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const congelada = safra?.status === "CONGELADA";
  const editavel = isGestor && !congelada;

  const competencias = useMemo(
    () => (safra ? competenciasSafra(safra.data_inicio, 12) : []),
    [safra]
  );

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

  const itemIds = useMemo(() => (itens.data ?? []).map((i) => i.id), [itens.data]);

  const mensal = useQuery({
    queryKey: ["orcamento-mensal", itemIds],
    queryFn: () => fetchOrcamentoMensalPorItens(itemIds),
    enabled: supabaseConfigured && itemIds.length > 0,
  });

  const historico = useQuery({
    queryKey: ["remanejamentos", safraId],
    queryFn: () => fetchRemanejamentosPorSafra(safraId),
    enabled: supabaseConfigured,
  });

  const centroNome = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of centros.data ?? []) map.set(c.id, c.nome);
    return map;
  }, [centros.data]);

  const valores = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of mensal.data ?? []) {
      map.set(`${m.item_orcamento_id}_${m.competencia.slice(0, 10)}`, Number(m.valor));
    }
    return map;
  }, [mensal.data]);

  const itemLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of itens.data ?? []) {
      map.set(item.id, `${item.codigo} · ${item.descricao} — ${centroNome.get(item.centro_custo_id) ?? ""}`);
    }
    return map;
  }, [itens.data, centroNome]);

  const [itemOrigemId, setItemOrigemId] = useState("");
  const [itemDestinoId, setItemDestinoId] = useState("");
  const [competencia, setCompetencia] = useState("");
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");

  function limpar() {
    setItemOrigemId("");
    setItemDestinoId("");
    setCompetencia("");
    setValor("");
    setMotivo("");
  }

  const valorNumerico = Number(valor.replace(/\./g, "").replace(",", ".")) || 0;
  const saldoOrigem =
    itemOrigemId && competencia ? valores.get(`${itemOrigemId}_${competencia}`) ?? 0 : null;

  const remanejar = useMutation({
    mutationFn: () =>
      remanejarVerba({
        safraId,
        itemOrigemId,
        itemDestinoId,
        competencia,
        valor: valorNumerico,
        motivo: motivo.trim(),
        usuario: usuarioAtual,
      }),
    onSuccess: () => {
      toast({ title: "Verba remanejada." });
      limpar();
      qc.invalidateQueries({ queryKey: ["orcamento-mensal", itemIds] });
      qc.invalidateQueries({ queryKey: ["item-acumulado"] });
      qc.invalidateQueries({ queryKey: ["cc-acumulado"] });
      qc.invalidateQueries({ queryKey: ["curva-mensal"] });
      qc.invalidateQueries({ queryKey: ["remanejamentos", safraId] });
    },
    onError: (e: unknown) =>
      toast({ title: "Erro ao remanejar", description: mensagemErro(e), variant: "destructive" }),
  });

  const camposFaltando: string[] = [];
  if (!itemOrigemId) camposFaltando.push("item de origem");
  if (!itemDestinoId) camposFaltando.push("item de destino");
  if (itemOrigemId && itemDestinoId && itemOrigemId === itemDestinoId)
    camposFaltando.push("origem e destino devem ser diferentes");
  if (!competencia) camposFaltando.push("mês");
  if (valorNumerico <= 0) camposFaltando.push("valor");
  if (!motivo.trim()) camposFaltando.push("motivo");
  const podeRemanejar = editavel && camposFaltando.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
          Remanejamento de Verba — Safra {safraId}
        </h1>
        <p className="text-sm text-muted-foreground">
          Move o orçado de um item de investimento para outro, num mesmo mês.
        </p>
      </div>

      {congelada && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <Lock className="h-4 w-4 shrink-0" /> Esta safra está CONGELADA. Não é possível remanejar.
        </div>
      )}
      {!isGestor && !congelada && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 shrink-0" /> Faça login com perfil GESTOR para remanejar verba.
        </div>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Item de origem *</label>
              <Select value={itemOrigemId} onValueChange={setItemOrigemId} disabled={!editavel}>
                <SelectTrigger>
                  <SelectValue placeholder="De onde sai a verba" />
                </SelectTrigger>
                <SelectContent>
                  {(itens.data ?? []).map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {itemLabel.get(item.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Item de destino *</label>
              <Select value={itemDestinoId} onValueChange={setItemDestinoId} disabled={!editavel}>
                <SelectTrigger>
                  <SelectValue placeholder="Para onde vai a verba" />
                </SelectTrigger>
                <SelectContent>
                  {(itens.data ?? [])
                    .filter((item) => item.id !== itemOrigemId)
                    .map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {itemLabel.get(item.id)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Mês *</label>
              <Select value={competencia} onValueChange={setCompetencia} disabled={!editavel}>
                <SelectTrigger>
                  <SelectValue placeholder="Competência" />
                </SelectTrigger>
                <SelectContent>
                  {competencias.map((c) => (
                    <SelectItem key={c} value={c}>
                      {competenciaLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {saldoOrigem !== null && (
                <p className="text-xs text-muted-foreground mt-1">
                  Saldo orçado atual do item de origem neste mês: {moeda(saldoOrigem)}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Valor do remanejamento *</label>
              <Input
                placeholder="Ex.: 10000"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                disabled={!editavel}
              />
            </div>
          </div>

          {saldoOrigem !== null && valorNumerico > saldoOrigem && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Atenção: o valor é maior que o saldo orçado atual do item de origem neste mês — o item
              ficará com saldo negativo nesta competência.
            </p>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground">Motivo *</label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Obrigatório"
              disabled={!editavel}
            />
          </div>

          {camposFaltando.length > 0 && editavel && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Falta preencher: {camposFaltando.join(", ")}.
            </p>
          )}

          <div className="flex justify-end">
            <Button
              className="gap-1.5"
              onClick={() => remanejar.mutate()}
              disabled={!podeRemanejar || remanejar.isPending}
            >
              <ArrowLeftRight className="h-4 w-4" /> Remanejar
            </Button>
          </div>
        </CardContent>
      </Card>

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
                <TableHead>Usuário</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(historico.data ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate">
                    {itemLabel.get(r.item_origem_id) ?? r.item_origem_id}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate">
                    {itemLabel.get(r.item_destino_id) ?? r.item_destino_id}
                  </TableCell>
                  <TableCell>{competenciaLabel(r.competencia)}</TableCell>
                  <TableCell className="text-right">{moeda(r.valor)}</TableCell>
                  <TableCell className="max-w-[260px] truncate" title={r.motivo}>
                    {r.motivo}
                  </TableCell>
                  <TableCell>{r.usuario ?? "—"}</TableCell>
                </TableRow>
              ))}
              {(historico.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    Nenhum remanejamento registrado nesta safra.
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
