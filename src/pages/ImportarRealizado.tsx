import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UploadCloud, FileCheck2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { useSafra } from "@/hooks/useSafra";
import { useToast } from "@/hooks/use-toast";
import { fetchChavesExistentesPorPeriodo, fetchItensComCodigoProjeto, confirmarImportacao } from "@/lib/api";
import {
  montarChavesRm,
  parseArquivoRealizado,
  primeiroDiaDoMes,
  type LinhaRealizadoPreview,
} from "@/lib/importRealizado";
import { dataBr, mensagemErro, moeda } from "@/lib/format";
import { supabaseConfigured } from "@/lib/supabaseClient";

const SITUACAO_LABEL: Record<LinhaRealizadoPreview["situacao"], string> = {
  NOVA: "Vinculada",
  DUPLICADA: "Duplicada",
  SEM_ITEM: "Sem item vinculado",
};

const SITUACAO_VARIANT: Record<LinhaRealizadoPreview["situacao"], "default" | "secondary" | "destructive"> = {
  NOVA: "default",
  DUPLICADA: "secondary",
  SEM_ITEM: "destructive",
};

export default function ImportarRealizado() {
  const { isGestor, usuarioAtual } = useAuth();
  const { safraId } = useSafra();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [arquivoNome, setArquivoNome] = useState<string | null>(null);
  const [preview, setPreview] = useState<LinhaRealizadoPreview[] | null>(null);
  const [processando, setProcessando] = useState(false);

  const itensComProjeto = useQuery({
    queryKey: ["itens-com-codigo-projeto", safraId],
    queryFn: () => fetchItensComCodigoProjeto(safraId),
    enabled: supabaseConfigured,
  });

  async function handleFile(file: File) {
    setProcessando(true);
    setArquivoNome(file.name);
    try {
      const brutas = await parseArquivoRealizado(file);
      const projetoParaItem = new Map(
        (itensComProjeto.data ?? []).map((i) => [i.codigo_rm_projeto, i])
      );

      if (brutas.length === 0) {
        throw new Error(
          "Nenhuma linha reconhecida no arquivo. Confira se as colunas DATA e CODCCUSTO existem."
        );
      }
      const datas = brutas.map((r) => r.data).sort();
      const chaves = montarChavesRm(brutas);
      const existentes = await fetchChavesExistentesPorPeriodo(datas[0], datas[datas.length - 1]);

      const linhas: LinhaRealizadoPreview[] = brutas.map((linha, idx) => {
        const chaveRm = chaves[idx];
        const item = projetoParaItem.get(linha.codigoProjeto) ?? null;
        let situacao: LinhaRealizadoPreview["situacao"];
        if (existentes.has(chaveRm)) situacao = "DUPLICADA";
        else if (!item) situacao = "SEM_ITEM";
        else situacao = "NOVA";
        return {
          ...linha,
          chaveRm,
          competencia: primeiroDiaDoMes(linha.data),
          itemOrcamentoId: item?.id ?? null,
          centroCustoId: item?.centro_custo_id ?? null,
          situacao,
        };
      });
      setPreview(linhas);
    } catch (e) {
      toast({
        title: "Erro ao ler arquivo",
        description: mensagemErro(e),
        variant: "destructive",
      });
      setPreview(null);
    } finally {
      setProcessando(false);
    }
  }

  const resumo = useMemo(() => {
    const linhas = preview ?? [];
    const novas = linhas.filter((l) => l.situacao === "NOVA");
    const duplicadas = linhas.filter((l) => l.situacao === "DUPLICADA");
    const semItem = linhas.filter((l) => l.situacao === "SEM_ITEM");
    return {
      total: linhas.length,
      novas: novas.length,
      duplicadas: duplicadas.length,
      semItem: semItem.length,
      valorTotal: [...novas, ...semItem].reduce((s, l) => s + l.valor, 0),
    };
  }, [preview]);

  const confirmar = useMutation({
    mutationFn: async () => {
      const importaveis = (preview ?? []).filter((l) => l.situacao !== "DUPLICADA");
      await confirmarImportacao({
        arquivo: arquivoNome ?? "arquivo",
        usuario: usuarioAtual,
        linhas: importaveis.map((l) => ({
          safra_id: safraId,
          centro_custo_id: l.centroCustoId,
          codigo_cc_origem: l.codigoProjeto,
          conta_contabil: l.contaContabil || null,
          data_lancamento: l.data,
          competencia: l.competencia,
          documento: l.documento || null,
          historico: [l.nomeProjeto, l.descricaoContabil].filter(Boolean).join(" — ") || null,
          valor: l.valor,
          chave_rm: l.chaveRm,
          item_orcamento_id: l.itemOrcamentoId,
        })),
      });
    },
    onSuccess: () => {
      toast({ title: "Importação concluída." });
      setPreview(null);
      setArquivoNome(null);
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["item-acumulado"] });
      qc.invalidateQueries({ queryKey: ["cc-acumulado"] });
      qc.invalidateQueries({ queryKey: ["curva-mensal"] });
      qc.invalidateQueries({ queryKey: ["pendencias"] });
    },
    onError: (e: unknown) => toast({ title: "Erro ao importar", description: mensagemErro(e), variant: "destructive" }),
  });

  if (!isGestor) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center text-muted-foreground">
          Apenas usuários com perfil GESTOR podem importar o realizado.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Importar Realizado</h1>
        <p className="text-sm text-muted-foreground">
          Suba o extrato de custos do TOTVS RM (.xlsx ou .csv) com DATA, CODCCUSTO, NOMECUSTO,
          CONTA_CONTABIL, DESCRICAO_CONTABIL, DOCUMENTO e SALDO. Cada CODCCUSTO é um projeto/obra
          do RM — na primeira vez que aparecer, vincule-o a um item em Pendências; da próxima
          importação em diante ele casa automaticamente.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg py-10 cursor-pointer hover:bg-muted/40 transition-colors">
            <UploadCloud className="h-8 w-8 text-muted-foreground" />
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
            <p className="text-sm text-muted-foreground mt-3 flex items-center gap-1.5">
              <FileCheck2 className="h-4 w-4" /> {arquivoNome}
              {processando && " — processando..."}
            </p>
          )}
        </CardContent>
      </Card>

      {preview && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <ResumoCard label="Total de linhas" value={String(resumo.total)} />
            <ResumoCard label="Vinculadas" value={String(resumo.novas)} />
            <ResumoCard label="Duplicadas" value={String(resumo.duplicadas)} />
            <ResumoCard label="Sem item vinculado" value={String(resumo.semItem)} />
            <ResumoCard label="Valor a importar" value={moeda(resumo.valorTotal)} />
          </div>

          {resumo.semItem > 0 && (
            <p className="text-sm text-muted-foreground">
              {resumo.semItem} lançamento(s) não correspondem a nenhum item cadastrado (podem ser
              projetos que ainda não foram vinculados, ou custos que não são investimento). Eles
              serão importados mesmo assim e aparecem em Pendências para vínculo manual.
            </p>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Prévia da importação</CardTitle>
              <Button
                onClick={() => confirmar.mutate()}
                disabled={resumo.novas + resumo.semItem === 0 || confirmar.isPending}
              >
                Confirmar importação
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto max-h-[480px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Projeto (RM)</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((l, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{dataBr(l.data)}</TableCell>
                      <TableCell className="max-w-[260px]">
                        <p className="truncate">{l.nomeProjeto}</p>
                        <p className="font-mono text-xs text-muted-foreground">{l.codigoProjeto}</p>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{l.contaContabil}</TableCell>
                      <TableCell>{l.documento}</TableCell>
                      <TableCell className="text-right">{moeda(l.valor)}</TableCell>
                      <TableCell>
                        <Badge variant={SITUACAO_VARIANT[l.situacao]}>{SITUACAO_LABEL[l.situacao]}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function ResumoCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
