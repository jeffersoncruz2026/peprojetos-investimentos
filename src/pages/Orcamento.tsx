import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useSafra } from "@/hooks/useSafra";
import { useToast } from "@/hooks/use-toast";
import { fetchCentrosCusto, fetchItensOrcamentoPorSafra, fetchOrcamentoMensalPorItens } from "@/lib/api";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import { competenciaLabel, competenciasSafra, moeda } from "@/lib/format";

interface PendingEdit {
  itemOrcamentoId: string;
  competencia: string;
  valorAnterior: number;
  valorNovo: number;
  itemLabel: string;
}

export default function Orcamento() {
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

  const centroNome = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of centros.data ?? []) map.set(c.id, c.nome);
    return map;
  }, [centros.data]);

  const [valores, setValores] = useState<Map<string, number>>(new Map());
  const [resetTick, setResetTick] = useState(0);

  useEffect(() => {
    const map = new Map<string, number>();
    for (const m of mensal.data ?? []) {
      map.set(`${m.item_orcamento_id}_${m.competencia.slice(0, 10)}`, Number(m.valor));
    }
    setValores(map);
  }, [mensal.data]);

  const [pending, setPending] = useState<PendingEdit | null>(null);
  const [motivo, setMotivo] = useState("");

  const salvar = useMutation({
    mutationFn: async (edit: PendingEdit) => {
      const { error: upsertError } = await supabase.from("orcamento_mensal").upsert(
        {
          item_orcamento_id: edit.itemOrcamentoId,
          competencia: edit.competencia,
          valor: edit.valorNovo,
        },
        { onConflict: "item_orcamento_id,competencia" }
      );
      if (upsertError) throw upsertError;
      const { error: revisaoError } = await supabase.from("orcamento_revisao").insert({
        item_orcamento_id: edit.itemOrcamentoId,
        competencia: edit.competencia,
        valor_anterior: edit.valorAnterior,
        valor_novo: edit.valorNovo,
        motivo,
        usuario: usuarioAtual,
      });
      if (revisaoError) throw revisaoError;
    },
    onSuccess: (_data, edit) => {
      setValores((prev) => {
        const next = new Map(prev);
        next.set(`${edit.itemOrcamentoId}_${edit.competencia}`, edit.valorNovo);
        return next;
      });
      toast({ title: "Orçamento atualizado." });
      setPending(null);
      setMotivo("");
      qc.invalidateQueries({ queryKey: ["item-acumulado"] });
      qc.invalidateQueries({ queryKey: ["cc-acumulado"] });
      qc.invalidateQueries({ queryKey: ["curva-mensal"] });
    },
    onError: (e: Error) => {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
      setResetTick((t) => t + 1);
    },
  });

  function handleBlur(itemId: string, itemLabel: string, competencia: string, raw: string) {
    const key = `${itemId}_${competencia}`;
    const anterior = valores.get(key) ?? 0;
    const novo = Number(raw.replace(/\./g, "").replace(",", ".")) || 0;
    if (novo === anterior) return;
    if (!editavel) {
      setResetTick((t) => t + 1);
      return;
    }
    setPending({ itemOrcamentoId: itemId, competencia, valorAnterior: anterior, valorNovo: novo, itemLabel });
  }

  function cancelarEdicao() {
    setPending(null);
    setMotivo("");
    setResetTick((t) => t + 1);
  }

  const totalPorItem = (itemId: string) =>
    competencias.reduce((s, c) => s + (valores.get(`${itemId}_${c}`) ?? 0), 0);

  const totalPorCompetencia = (c: string) =>
    (itens.data ?? []).reduce((s, i) => s + (valores.get(`${i.id}_${c}`) ?? 0), 0);

  const totalGeral = (itens.data ?? []).reduce((s, i) => s + totalPorItem(i.id), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Orçamento — Safra {safraId}</h1>
        <p className="text-sm text-muted-foreground">Grade editável do orçado mês a mês</p>
      </div>

      {congelada && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <Lock className="h-4 w-4 shrink-0" /> Esta safra está CONGELADA. A grade é somente leitura.
        </div>
      )}
      {!isGestor && !congelada && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 shrink-0" /> Faça login com perfil GESTOR para editar o orçamento.
        </div>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="sticky left-0 bg-muted/50 text-left py-2 px-3 font-semibold min-w-[260px]">
                  Item
                </th>
                {competencias.map((c) => (
                  <th key={c} className="text-right py-2 px-2 font-semibold whitespace-nowrap min-w-[110px]">
                    {competenciaLabel(c)}
                  </th>
                ))}
                <th className="text-right py-2 px-3 font-semibold min-w-[130px]">Total</th>
              </tr>
            </thead>
            <tbody>
              {(itens.data ?? []).map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="sticky left-0 bg-card py-1.5 px-3">
                    <p className="font-medium text-foreground truncate max-w-[240px]">{item.descricao}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[240px]">
                      {item.codigo} · {centroNome.get(item.centro_custo_id) ?? ""}
                    </p>
                  </td>
                  {competencias.map((c) => {
                    const key = `${item.id}_${c}`;
                    const valor = valores.get(key) ?? 0;
                    return (
                      <td key={c} className="py-1 px-1">
                        <Input
                          key={`${key}-${resetTick}`}
                          className="h-8 text-right text-xs"
                          defaultValue={valor === 0 ? "" : valor.toLocaleString("pt-BR")}
                          disabled={!editavel}
                          onBlur={(e) => handleBlur(item.id, item.descricao, c, e.target.value)}
                        />
                      </td>
                    );
                  })}
                  <td className="text-right py-1.5 px-3 font-medium">{moeda(totalPorItem(item.id))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/60 font-semibold">
                <td className="sticky left-0 bg-muted/60 py-2 px-3">Total</td>
                {competencias.map((c) => (
                  <td key={c} className="text-right py-2 px-2 whitespace-nowrap">
                    {moeda(totalPorCompetencia(c))}
                  </td>
                ))}
                <td className="text-right py-2 px-3">{moeda(totalGeral)}</td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      <Dialog open={Boolean(pending)} onOpenChange={(open) => !open && cancelarEdicao()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Justificar alteração do orçado</DialogTitle>
          </DialogHeader>
          {pending && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {pending.itemLabel} · {competenciaLabel(pending.competencia)}
              </p>
              <p className="text-sm">
                De <span className="font-medium">{moeda(pending.valorAnterior)}</span> para{" "}
                <span className="font-medium">{moeda(pending.valorNovo)}</span>
              </p>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Motivo da alteração *</label>
                <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Obrigatório" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={cancelarEdicao}>
              Cancelar
            </Button>
            <Button
              onClick={() => pending && salvar.mutate(pending)}
              disabled={!motivo.trim() || salvar.isPending}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
