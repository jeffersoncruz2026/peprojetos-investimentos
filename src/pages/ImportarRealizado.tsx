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
import { fetchCentrosCusto, fetchChavesExistentes, confirmarImportacao } from "@/lib/api";
import {
  montarChaveRm,
  parseArquivoRealizado,
  primeiroDiaDoMes,
  type LinhaRealizadoPreview,
} from "@/lib/importRealizado";
import { dataBr, moeda } from "@/lib/format";
import { supabaseConfigured } from "@/lib/supabaseClient";

const SITUACAO_LABEL: Record<LinhaRealizadoPreview["situacao"], string> = {
  NOVA: "Nova",
  DUPLICADA: "Duplicada",
  SEM_CENTRO_CUSTO: "Sem centro de custo",
};

const SITUACAO_VARIANT: Record<LinhaRealizadoPreview["situacao"], "default" | "secondary" | "destructive"> = {
  NOVA: "default",
  DUPLICADA: "secondary",
  SEM_CENTRO_CUSTO: "destructive",
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

  const centros = useQuery({
    queryKey: ["centros-custo"],
    queryFn: fetchCentrosCusto,
    enabled: supabaseConfigured,
  });

  async function handleFile(file: File) {
    setProcessando(true);
    setArquivoNome(file.name);
    try {
      const brutas = await parseArquivoRealizado(file);
      const codigoParaId = new Map((centros.data ?? []).map((c) => [c.codigo_rm, c.id]));

      const chaves = brutas.map(montarChaveRm);
      const existentes = await fetchChavesExistentes(chaves);
      const vistasNoArquivo = new Set<string>();

      const linhas: LinhaRealizadoPreview[] = brutas.map((linha) => {
        const chaveRm = montarChaveRm(linha);
        const centroCustoId = codigoParaId.get(linha.centroCustoRm) ?? null;
        let situacao: LinhaRealizadoPreview["situacao"];
        if (existentes.has(chaveRm) || vistasNoArquivo.has(chaveRm)) situacao = "DUPLICADA";
        else if (!centroCustoId) situacao = "SEM_CENTRO_CUSTO";
        else situacao = "NOVA";
        vistasNoArquivo.add(chaveRm);
        return {
          ...linha,
          chaveRm,
          competencia: primeiroDiaDoMes(linha.data),
          centroCustoId,
          situacao,
        };
      });
      setPreview(linhas);
    } catch (e) {
      toast({
        title: "Erro ao ler arquivo",
        description: e instanceof Error ? e.message : String(e),
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
    const semCc = linhas.filter((l) => l.situacao === "SEM_CENTRO_CUSTO");
    return {
      total: linhas.length,
      novas: novas.length,
      duplicadas: duplicadas.length,
      semCc: semCc.length,
      valorTotal: [...novas, ...semCc].reduce((s, l) => s + l.valor, 0),
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
          codigo_cc_origem: l.centroCustoRm,
          conta_contabil: l.contaContabil || null,
          data_lancamento: l.data,
          competencia: l.competencia,
          documento: l.documento || null,
          historico: l.historico || null,
          valor: l.valor,
          chave_rm: l.chaveRm,
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
    },
    onError: (e: Error) => toast({ title: "Erro ao importar", description: e.message, variant: "destructive" }),
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
          Suba o arquivo exportado do TOTVS RM (.xlsx ou .csv) com Data, Centro de Custo RM, Conta
          Contábil, Documento, Histórico e Valor Realizado.
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
            <ResumoCard label="Novas" value={String(resumo.novas)} />
            <ResumoCard label="Duplicadas" value={String(resumo.duplicadas)} />
            <ResumoCard label="Sem centro de custo" value={String(resumo.semCc)} />
            <ResumoCard label="Valor a importar" value={moeda(resumo.valorTotal)} />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Prévia da importação</CardTitle>
              <Button
                onClick={() => confirmar.mutate()}
                disabled={resumo.novas + resumo.semCc === 0 || confirmar.isPending}
              >
                Confirmar importação
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto max-h-[480px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>CC RM</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Histórico</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((l, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{dataBr(l.data)}</TableCell>
                      <TableCell className="font-mono text-xs">{l.centroCustoRm}</TableCell>
                      <TableCell className="font-mono text-xs">{l.contaContabil}</TableCell>
                      <TableCell>{l.documento}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{l.historico}</TableCell>
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
