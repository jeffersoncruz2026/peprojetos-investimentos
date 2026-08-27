import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { AlertTriangle, Download, Lock, Pencil, Plus } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useSafra } from "@/hooks/useSafra";
import { useToast } from "@/hooks/use-toast";
import {
  atualizarItemOrcamento,
  criarCentroCusto,
  criarItemOrcamento,
  fetchCentrosCusto,
  fetchItensOrcamentoPorSafra,
  fetchOrcamentoMensalPorItens,
} from "@/lib/api";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import { competenciaLabel, competenciasSafra, mensagemErro, moeda } from "@/lib/format";
import { gerarCodigoUnidade } from "@/lib/xlsxCell";
import { ATIVIDADES, type CentroCusto, type ItemOrcamento } from "@/lib/types";
import { ImportarOrcamentoDialog } from "@/components/ImportarOrcamentoDialog";

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

  const centrosAtividade = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of centros.data ?? []) map.set(c.id, c.atividade);
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
    onError: (e: unknown) => {
      toast({ title: "Erro ao salvar", description: mensagemErro(e), variant: "destructive" });
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

  function exportarExcel() {
    const linhas = (itens.data ?? []).map((item) => {
      const row: Record<string, string | number> = {
        Código: item.codigo,
        CODCCUSTO: item.codigo_rm_projeto ?? "",
        Item: item.descricao,
        "Centro de Custo": centroNome.get(item.centro_custo_id) ?? "",
        Atividade: centrosAtividade.get(item.centro_custo_id) ?? "",
      };
      for (const c of competencias) {
        row[competenciaLabel(c)] = valores.get(`${item.id}_${c}`) ?? 0;
      }
      row["Total"] = totalPorItem(item.id);
      return row;
    });
    const worksheet = XLSX.utils.json_to_sheet(linhas);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Orçamento");
    XLSX.writeFile(workbook, `orcamento_${safraId.replace("/", "-")}.xlsx`);
  }

  const [itemEditando, setItemEditando] = useState<ItemOrcamento | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Orçamento — Safra {safraId}</h1>
          <p className="text-sm text-muted-foreground">Grade editável do orçado mês a mês</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-1.5" onClick={exportarExcel}>
            <Download className="h-4 w-4" /> Exportar Excel
          </Button>
          {editavel && (
            <>
              <ImportarOrcamentoDialog safraId={safraId} centros={centros.data ?? []} itens={itens.data ?? []} />
              <NovoItemOrcamento
                safraId={safraId}
                primeiraCompetencia={competencias[0]}
                centros={centros.data ?? []}
              />
            </>
          )}
        </div>
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
                    <div className="flex items-start gap-1.5">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate max-w-[220px]">{item.descricao}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                          {item.codigo} · {centroNome.get(item.centro_custo_id) ?? ""}
                        </p>
                      </div>
                      {editavel && (
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
                          title="Editar item"
                          onClick={() => setItemEditando(item)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
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

      {itemEditando && (
        <EditarItemOrcamento
          item={itemEditando}
          centros={centros.data ?? []}
          onClose={() => setItemEditando(null)}
        />
      )}
    </div>
  );
}

function EditarItemOrcamento({
  item,
  centros,
  onClose,
}: {
  item: ItemOrcamento;
  centros: CentroCusto[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [codccusto, setCodccusto] = useState(item.codigo_rm_projeto ?? "");
  const [nomecusto, setNomecusto] = useState(item.descricao);
  const [centroCustoId, setCentroCustoId] = useState(item.centro_custo_id);

  const salvar = useMutation({
    mutationFn: () =>
      atualizarItemOrcamento({
        id: item.id,
        codigoRmProjeto: codccusto.trim(),
        descricao: nomecusto.trim(),
        centroCustoId,
      }),
    onSuccess: () => {
      toast({ title: "Item atualizado." });
      onClose();
      qc.invalidateQueries({ queryKey: ["itens-orcamento", item.safra_id] });
      qc.invalidateQueries({ queryKey: ["item-acumulado"] });
      qc.invalidateQueries({ queryKey: ["cc-acumulado"] });
      qc.invalidateQueries({ queryKey: ["itens-com-codigo-projeto"] });
    },
    onError: (e: unknown) =>
      toast({ title: "Erro ao salvar", description: mensagemErro(e), variant: "destructive" }),
  });

  const podeSalvar = codccusto.trim() && nomecusto.trim() && centroCustoId;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar item de orçamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">CODCCUSTO (código do projeto no RM) *</label>
            <Input value={codccusto} onChange={(e) => setCodccusto(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">NOMECUSTO (descrição do item) *</label>
            <Input value={nomecusto} onChange={(e) => setNomecusto(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Área (centro de custo) *</label>
            <Select value={centroCustoId} onValueChange={setCentroCustoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a fazenda/unidade" />
              </SelectTrigger>
              <SelectContent>
                {centros.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} — {c.atividade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Para alterar os valores mensais, edite direto na grade — mudanças aqui são só de
            cadastro (código, nome e área).
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={!podeSalvar || salvar.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovoItemOrcamento({
  safraId,
  primeiraCompetencia,
  centros,
}: {
  safraId: string;
  primeiraCompetencia: string | undefined;
  centros: CentroCusto[];
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [codccusto, setCodccusto] = useState("");
  const [nomecusto, setNomecusto] = useState("");
  const [centroCustoId, setCentroCustoId] = useState("");
  const [valor, setValor] = useState("");

  const [novaArea, setNovaArea] = useState(false);
  const [novaAreaCodigo, setNovaAreaCodigo] = useState("");
  const [novaAreaNome, setNovaAreaNome] = useState("");
  const [novaAreaAtividade, setNovaAreaAtividade] = useState<string>("ADMINISTRACAO");

  function limpar() {
    setCodccusto("");
    setNomecusto("");
    setCentroCustoId("");
    setValor("");
    setNovaArea(false);
    setNovaAreaCodigo("");
    setNovaAreaNome("");
    setNovaAreaAtividade("ADMINISTRACAO");
  }

  const criar = useMutation({
    mutationFn: async () => {
      let ccId = centroCustoId;
      if (novaArea) {
        const cc = await criarCentroCusto({
          codigoRm: novaAreaCodigo.trim() || gerarCodigoUnidade(novaAreaNome),
          nome: novaAreaNome.trim(),
          atividade: novaAreaAtividade,
        });
        ccId = cc.id;
      }
      await criarItemOrcamento({
        safraId,
        codigoRmProjeto: codccusto.trim(),
        descricao: nomecusto.trim(),
        centroCustoId: ccId,
        competencia: primeiraCompetencia!,
        valor: Number(valor.replace(/\./g, "").replace(",", ".")) || 0,
      });
    },
    onSuccess: () => {
      toast({ title: "Item de orçamento cadastrado." });
      setOpen(false);
      limpar();
      qc.invalidateQueries({ queryKey: ["itens-orcamento", safraId] });
      qc.invalidateQueries({ queryKey: ["centros-custo"] });
      qc.invalidateQueries({ queryKey: ["item-acumulado"] });
      qc.invalidateQueries({ queryKey: ["cc-acumulado"] });
      qc.invalidateQueries({ queryKey: ["curva-mensal"] });
      qc.invalidateQueries({ queryKey: ["itens-com-codigo-projeto"] });
    },
    onError: (e: unknown) =>
      toast({ title: "Erro ao cadastrar", description: mensagemErro(e), variant: "destructive" }),
  });

  const areaPreenchida = novaArea ? Boolean(novaAreaNome.trim()) : Boolean(centroCustoId);
  const camposFaltando: string[] = [];
  if (!codccusto.trim()) camposFaltando.push("CODCCUSTO");
  if (!nomecusto.trim()) camposFaltando.push("NOMECUSTO");
  if (!areaPreenchida) camposFaltando.push(novaArea ? "nome da unidade" : "área");
  if (!valor.trim()) camposFaltando.push("valor orçado");
  if (!primeiraCompetencia) camposFaltando.push("safra (ainda carregando)");
  const podeSalvar = camposFaltando.length === 0;

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) limpar();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo item de orçamento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar item de orçamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">CODCCUSTO (código do projeto no RM) *</label>
            <Input
              placeholder="Ex.: 99.00.1314"
              value={codccusto}
              onChange={(e) => setCodccusto(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">NOMECUSTO (descrição do item) *</label>
            <Input
              placeholder="Ex.: Reforma Carreadores"
              value={nomecusto}
              onChange={(e) => setNomecusto(e.target.value)}
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Área (centro de custo) *</label>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => setNovaArea((v) => !v)}
              >
                {novaArea ? "Selecionar unidade existente" : "Não encontrou? Cadastrar nova"}
              </button>
            </div>
            {novaArea ? (
              <div className="space-y-2 mt-1">
                <p className="text-xs text-muted-foreground">
                  Este é o código da fazenda/unidade em si — geralmente diferente do CODCCUSTO do
                  projeto lá em cima. Se não souber, pode repetir o mesmo código; só o nome é
                  obrigatório.
                </p>
                <Input
                  placeholder="Código RM da unidade (ex.: 001.02.01.010)"
                  value={novaAreaCodigo}
                  onChange={(e) => setNovaAreaCodigo(e.target.value)}
                />
                <Input
                  placeholder="Nome da fazenda/unidade *"
                  value={novaAreaNome}
                  onChange={(e) => setNovaAreaNome(e.target.value)}
                />
                <Select value={novaAreaAtividade} onValueChange={setNovaAreaAtividade}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ATIVIDADES.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : centros.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-1">
                Nenhuma unidade cadastrada ainda — clique em "Cadastrar nova" acima.
              </p>
            ) : (
              <Select value={centroCustoId} onValueChange={setCentroCustoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a fazenda/unidade" />
                </SelectTrigger>
                <SelectContent>
                  {centros.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome} — {c.atividade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Valor orçado *</label>
            <Input placeholder="Ex.: 50000" value={valor} onChange={(e) => setValor(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">
              Lançado em {competenciaLabel(primeiraCompetencia)}; redistribua entre os meses na grade
              abaixo se precisar.
            </p>
          </div>
        </div>
        {camposFaltando.length > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Falta preencher: {camposFaltando.join(", ")}.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => criar.mutate()} disabled={!podeSalvar || criar.isPending}>
            Cadastrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
