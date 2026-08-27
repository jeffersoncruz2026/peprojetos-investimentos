import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UploadCloud, FileCheck2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { criarCentroCusto, criarItemOrcamentoComMeses } from "@/lib/api";
import { parseArquivoOrcamento, type LinhaOrcamentoBruta } from "@/lib/importOrcamento";
import { mensagemErro, moeda } from "@/lib/format";
import type { CentroCusto, ItemOrcamento } from "@/lib/types";

interface GrupoOrcamentoPreview {
  chave: string;
  codigoCc: string;
  nomeCc: string;
  atividade: string;
  codigoProjeto: string;
  item: string;
  meses: { competencia: string; valor: number }[];
  valorTotal: number;
  centroCustoExistente: CentroCusto | null;
  itemExistente: ItemOrcamento | null;
}

function agruparLinhas(
  linhas: LinhaOrcamentoBruta[],
  centros: CentroCusto[],
  itens: ItemOrcamento[]
): GrupoOrcamentoPreview[] {
  const porCodigoCc = new Map(centros.map((c) => [c.codigo_rm, c]));
  const porCodigoProjeto = new Map(
    itens.filter((i) => i.codigo_rm_projeto).map((i) => [i.codigo_rm_projeto as string, i])
  );
  const porDescricaoCc = new Map(
    itens.map((i) => [`${i.centro_custo_id}|${i.descricao.toLowerCase().trim()}`, i])
  );

  const grupos = new Map<string, GrupoOrcamentoPreview>();
  for (const linha of linhas) {
    const chave = linha.idItem || `${linha.codigoCc}|${linha.item.toLowerCase().trim()}`;
    let g = grupos.get(chave);
    if (!g) {
      const centroCustoExistente = porCodigoCc.get(linha.codigoCc) ?? null;
      let itemExistente: ItemOrcamento | null = null;
      if (linha.codigoProjeto) itemExistente = porCodigoProjeto.get(linha.codigoProjeto) ?? null;
      if (!itemExistente && centroCustoExistente) {
        itemExistente =
          porDescricaoCc.get(`${centroCustoExistente.id}|${linha.item.toLowerCase().trim()}`) ?? null;
      }
      g = {
        chave,
        codigoCc: linha.codigoCc,
        nomeCc: linha.nomeCc,
        atividade: linha.atividade,
        codigoProjeto: linha.codigoProjeto,
        item: linha.item,
        meses: [],
        valorTotal: 0,
        centroCustoExistente,
        itemExistente,
      };
      grupos.set(chave, g);
    }
    g.meses.push({ competencia: linha.competencia, valor: linha.valor });
    g.valorTotal += linha.valor;
  }
  return [...grupos.values()];
}

export function ImportarOrcamentoDialog({
  safraId,
  centros,
  itens,
}: {
  safraId: string;
  centros: CentroCusto[];
  itens: ItemOrcamento[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [arquivoNome, setArquivoNome] = useState<string | null>(null);
  const [preview, setPreview] = useState<GrupoOrcamentoPreview[] | null>(null);
  const [processando, setProcessando] = useState(false);

  async function handleFile(file: File) {
    setProcessando(true);
    setArquivoNome(file.name);
    try {
      const brutas = await parseArquivoOrcamento(file);
      if (brutas.length === 0) {
        throw new Error(
          "Nenhuma linha reconhecida. Confira se as colunas Centro de Custo RM, Item, Competência e Valor Orçado existem."
        );
      }
      setPreview(agruparLinhas(brutas, centros, itens));
    } catch (e) {
      toast({ title: "Erro ao ler arquivo", description: mensagemErro(e), variant: "destructive" });
      setPreview(null);
    } finally {
      setProcessando(false);
    }
  }

  const resumo = useMemo(() => {
    const grupos = preview ?? [];
    const novos = grupos.filter((g) => !g.itemExistente);
    const existentes = grupos.filter((g) => g.itemExistente);
    const unidadesNovas = new Set(novos.filter((g) => !g.centroCustoExistente).map((g) => g.codigoCc));
    return {
      total: grupos.length,
      novos: novos.length,
      existentes: existentes.length,
      unidadesNovas: unidadesNovas.size,
      valorTotal: novos.reduce((s, g) => s + g.valorTotal, 0),
    };
  }, [preview]);

  const confirmar = useMutation({
    mutationFn: async () => {
      const novos = (preview ?? []).filter((g) => !g.itemExistente);
      const centrosCriados = new Map<string, string>();
      for (const g of novos) {
        if (!g.centroCustoExistente && !centrosCriados.has(g.codigoCc)) {
          const cc = await criarCentroCusto({ codigoRm: g.codigoCc, nome: g.nomeCc, atividade: g.atividade });
          centrosCriados.set(g.codigoCc, cc.id);
        }
      }
      let indiceSemCodigo = 0;
      for (const g of novos) {
        const centroCustoId = g.centroCustoExistente?.id ?? centrosCriados.get(g.codigoCc);
        if (!centroCustoId) throw new Error(`Centro de custo ${g.codigoCc} não pôde ser criado.`);
        indiceSemCodigo += 1;
        await criarItemOrcamentoComMeses({
          safraId,
          codigo: g.codigoProjeto || `${g.codigoCc}#${indiceSemCodigo}`,
          codigoRmProjeto: g.codigoProjeto || null,
          descricao: g.item,
          centroCustoId,
          meses: g.meses,
        });
      }
    },
    onSuccess: () => {
      toast({ title: `${resumo.novos} item(ns) de orçamento cadastrado(s).` });
      setOpen(false);
      setPreview(null);
      setArquivoNome(null);
      if (fileRef.current) fileRef.current.value = "";
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

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      setPreview(null);
      setArquivoNome(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-1.5">
          <UploadCloud className="h-4 w-4" /> Importar por planilha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar orçamento em lote</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Planilha com uma linha por item x mês: Centro de Custo RM, Unidade, Atividade, Item,
          Competência, Valor Orçado — e opcionalmente CODCCUSTO (código do projeto no RM, para já
          deixar o item pronto para casar sozinho ao importar o realizado) e ID Item (para agrupar
          várias linhas do mesmo item em meses diferentes). Fazendas/unidades novas são criadas
          automaticamente; itens que já existem são pulados — para alterá-los, use a grade.
        </p>

        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg py-8 cursor-pointer hover:bg-muted/40 transition-colors">
          <UploadCloud className="h-7 w-7 text-muted-foreground" />
          <span className="text-sm font-medium">Clique para escolher o arquivo</span>
          <span className="text-xs text-muted-foreground">.xlsx, .xls ou .csv</span>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
        {arquivoNome && (
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <FileCheck2 className="h-4 w-4" /> {arquivoNome}
            {processando && " — processando..."}
          </p>
        )}

        {preview && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <ResumoCard label="Itens novos" value={String(resumo.novos)} />
              <ResumoCard label="Já existentes (pulados)" value={String(resumo.existentes)} />
              <ResumoCard label="Novas unidades" value={String(resumo.unidadesNovas)} />
              <ResumoCard label="Valor a cadastrar" value={moeda(resumo.valorTotal)} />
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[320px] border border-border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Centro de custo</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>CODCCUSTO</TableHead>
                    <TableHead className="text-right">Meses</TableHead>
                    <TableHead className="text-right">Valor total</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((g) => (
                    <TableRow key={g.chave}>
                      <TableCell className="max-w-[180px]">
                        <p className="truncate">{g.nomeCc}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {g.codigoCc} {!g.centroCustoExistente && "(nova)"}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{g.item}</TableCell>
                      <TableCell className="font-mono text-xs">{g.codigoProjeto || "—"}</TableCell>
                      <TableCell className="text-right">{g.meses.length}</TableCell>
                      <TableCell className="text-right">{moeda(g.valorTotal)}</TableCell>
                      <TableCell>
                        <Badge variant={g.itemExistente ? "secondary" : "default"}>
                          {g.itemExistente ? "Já existe" : "Nova"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => confirmar.mutate()} disabled={resumo.novos === 0 || confirmar.isPending}>
            Confirmar cadastro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResumoCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-base font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
