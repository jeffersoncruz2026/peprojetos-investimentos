import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  aprenderCodigoProjeto,
  criarCentroCustoEReprocessar,
  fetchItensOrcamentoPorSafra,
  fetchPendencias,
  vincularItemEmLote,
} from "@/lib/api";
import { dataBr, moeda } from "@/lib/format";
import type { Atividade } from "@/lib/types";
import { supabaseConfigured } from "@/lib/supabaseClient";

const ATIVIDADES: Atividade[] = [
  "SERINGUEIRA",
  "PECUARIA",
  "AGRICOLA",
  "ADMINISTRACAO",
  "OFICINA",
  "VEICULOS E MECANIZADOS",
  "VENDA DE VEICULOS",
  "CUSTEIO",
];

export default function Pendencias() {
  const { isGestor } = useAuth();

  if (!isGestor) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center text-muted-foreground">
          Apenas usuários com perfil GESTOR podem resolver pendências.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Pendências</h1>
        <p className="text-sm text-muted-foreground">Fila de trabalho mensal do controller</p>
      </div>
      <Tabs defaultValue="cc">
        <TabsList>
          <TabsTrigger value="cc">Centro de custo não cadastrado</TabsTrigger>
          <TabsTrigger value="item">Sem item vinculado</TabsTrigger>
        </TabsList>
        <TabsContent value="cc" className="mt-4">
          <AbaCentroCusto />
        </TabsContent>
        <TabsContent value="item" className="mt-4">
          <AbaItem />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AbaCentroCusto() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const pendencias = useQuery({
    queryKey: ["pendencias"],
    queryFn: fetchPendencias,
    enabled: supabaseConfigured,
  });

  const grupos = useMemo(() => {
    const linhas = (pendencias.data ?? []).filter((p) => p.motivo === "CENTRO DE CUSTO NAO CADASTRADO");
    const map = new Map<string, { codigo: string; qtd: number; valor: number }>();
    for (const l of linhas) {
      const cur = map.get(l.codigo_cc_origem) ?? { codigo: l.codigo_cc_origem, qtd: 0, valor: 0 };
      cur.qtd += 1;
      cur.valor += Number(l.valor);
      map.set(l.codigo_cc_origem, cur);
    }
    return Array.from(map.values());
  }, [pendencias.data]);

  const [form, setForm] = useState<Record<string, { nome: string; atividade: string }>>({});

  const criar = useMutation({
    mutationFn: (codigo: string) =>
      criarCentroCustoEReprocessar({
        codigoRm: codigo,
        nome: form[codigo]?.nome ?? codigo,
        atividade: form[codigo]?.atividade ?? "ADMINISTRACAO",
      }),
    onSuccess: () => {
      toast({ title: "Centro de custo criado e lançamentos reprocessados." });
      qc.invalidateQueries({ queryKey: ["pendencias"] });
      qc.invalidateQueries({ queryKey: ["cc-acumulado"] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  if (grupos.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Nenhum centro de custo pendente.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {grupos.map((g) => (
        <Card key={g.codigo}>
          <CardContent className="p-4 flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1">
              <p className="font-mono text-sm font-medium">{g.codigo}</p>
              <p className="text-xs text-muted-foreground">
                {g.qtd} lançamento(s) · {moeda(g.valor)}
              </p>
            </div>
            <Input
              placeholder="Nome do centro de custo"
              className="md:w-64"
              value={form[g.codigo]?.nome ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, [g.codigo]: { ...f[g.codigo], nome: e.target.value, atividade: f[g.codigo]?.atividade ?? "ADMINISTRACAO" } }))
              }
            />
            <Select
              value={form[g.codigo]?.atividade ?? "ADMINISTRACAO"}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, [g.codigo]: { nome: f[g.codigo]?.nome ?? "", atividade: v } }))
              }
            >
              <SelectTrigger className="md:w-56">
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
            <Button
              onClick={() => criar.mutate(g.codigo)}
              disabled={!form[g.codigo]?.nome || criar.isPending}
            >
              Criar e reprocessar
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AbaItem() {
  const { safraId } = useSafra();
  const { toast } = useToast();
  const qc = useQueryClient();

  const pendencias = useQuery({
    queryKey: ["pendencias"],
    queryFn: fetchPendencias,
    enabled: supabaseConfigured,
  });

  const itens = useQuery({
    queryKey: ["itens-orcamento", safraId],
    queryFn: () => fetchItensOrcamentoPorSafra(safraId),
    enabled: supabaseConfigured,
  });

  const linhas = useMemo(
    () => (pendencias.data ?? []).filter((p) => p.motivo === "SEM ITEM VINCULADO"),
    [pendencias.data]
  );

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const [itemAlvo, setItemAlvo] = useState<string>("");

  const itensFiltrados = useMemo(() => {
    const q = busca.toLowerCase();
    return (itens.data ?? []).filter(
      (i) => !q || i.codigo.toLowerCase().includes(q) || i.descricao.toLowerCase().includes(q)
    );
  }, [itens.data, busca]);

  const valorSelecionado = useMemo(
    () => linhas.filter((l) => selecionados.has(l.id)).reduce((s, l) => s + Number(l.valor), 0),
    [linhas, selecionados]
  );

  const codigosProjetoSelecionados = useMemo(
    () => new Set(linhas.filter((l) => selecionados.has(l.id)).map((l) => l.codigo_cc_origem)),
    [linhas, selecionados]
  );

  const vincular = useMutation({
    mutationFn: async () => {
      const itemDestino = (itens.data ?? []).find((i) => i.id === itemAlvo);
      if (!itemDestino) throw new Error("Item de destino não encontrado.");
      await vincularItemEmLote(Array.from(selecionados), itemAlvo, itemDestino.centro_custo_id);
      // Se todos os lançamentos selecionados vêm do mesmo projeto do RM,
      // aprende o vínculo para as próximas importações casarem sozinhas.
      if (codigosProjetoSelecionados.size === 1) {
        await aprenderCodigoProjeto(itemAlvo, [...codigosProjetoSelecionados][0]);
      }
    },
    onSuccess: () => {
      toast({ title: `${selecionados.size} lançamento(s) vinculado(s).` });
      setSelecionados(new Set());
      qc.invalidateQueries({ queryKey: ["pendencias"] });
      qc.invalidateQueries({ queryKey: ["item-acumulado"] });
      qc.invalidateQueries({ queryKey: ["cc-acumulado"] });
      qc.invalidateQueries({ queryKey: ["itens-com-codigo-projeto"] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  function toggle(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (linhas.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Nenhum lançamento sem item vinculado.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="sticky top-16 z-10">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium">
              {selecionados.size} selecionado(s) · {moeda(valorSelecionado)}
            </p>
            {selecionados.size > 0 && (
              <p className="text-xs text-muted-foreground">
                {codigosProjetoSelecionados.size === 1
                  ? "Mesmo projeto do RM — o vínculo será lembrado para as próximas importações."
                  : "Projetos diferentes selecionados — o vínculo não será lembrado automaticamente."}
              </p>
            )}
          </div>
          <Input
            placeholder="Buscar item por código ou descrição..."
            className="md:w-72"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <Select value={itemAlvo} onValueChange={setItemAlvo}>
            <SelectTrigger className="md:w-72">
              <SelectValue placeholder="Selecione o item de destino" />
            </SelectTrigger>
            <SelectContent>
              {itensFiltrados.slice(0, 200).map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.codigo} — {i.descricao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => vincular.mutate()}
            disabled={selecionados.size === 0 || !itemAlvo || vincular.isPending}
          >
            Vincular selecionados
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Data</TableHead>
                <TableHead>Projeto (RM)</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Histórico</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l) => (
                <TableRow key={l.id} className="cursor-pointer" onClick={() => toggle(l.id)}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selecionados.has(l.id)} onCheckedChange={() => toggle(l.id)} />
                  </TableCell>
                  <TableCell>{dataBr(l.data_lancamento)}</TableCell>
                  <TableCell className="font-mono text-xs">{l.codigo_cc_origem}</TableCell>
                  <TableCell className="font-mono text-xs">{l.conta_contabil}</TableCell>
                  <TableCell>{l.documento}</TableCell>
                  <TableCell className="max-w-[240px] truncate">{l.historico}</TableCell>
                  <TableCell className="text-right">{moeda(l.valor)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
