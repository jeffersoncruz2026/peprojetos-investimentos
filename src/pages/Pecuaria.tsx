import { useState, useEffect } from "react";
import { KPICard } from "@/components/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Legend,
  Cell,
} from "recharts";

function moeda(v: number | string) {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function numero(v: number | string) {
  return Number(v || 0).toLocaleString("pt-BR");
}

function percentual(v: number | string) {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + "%";
}

interface TotalData {
  estoque_animais: number;
  animais_vendidos: number;
  faturamento_liquido: number;
  cpv: number;
  margem_bruta_valor: number;
  despesa_vendas: number;
  hedge_resultado: number;
  ticketMedio: number;
  custoMedioPorCabeca: number;
  margemBrutaPerc: number;
}

interface RegimeData {
  regime: string;
  estoque_animais: number;
  animais_vendidos: number;
  faturamento_liquido: number;
  cpv: number;
  margem_bruta_valor: number;
  despesa_vendas: number;
  hedge_resultado: number;
  observacao?: string;
}

const COLORS = ['hsl(142 65% 42%)', 'hsl(30 45% 55%)'];

export default function PecuariaPage() {
  const [mesSelecionado, setMesSelecionado] = useState("2025-09");
  const [carregando, setCarregando] = useState(false);

  const [total, setTotal] = useState<TotalData>({
    estoque_animais: 0,
    animais_vendidos: 0,
    faturamento_liquido: 0,
    cpv: 0,
    margem_bruta_valor: 0,
    despesa_vendas: 0,
    hedge_resultado: 0,
    ticketMedio: 0,
    custoMedioPorCabeca: 0,
    margemBrutaPerc: 0,
  });

  const [regimes, setRegimes] = useState<RegimeData[]>([]);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      try {
        // Mock data para demonstração
        const mockData = {
          total: {
            estoque_animais: 2450,
            animais_vendidos: 380,
            faturamento_liquido: 2850000,
            cpv: 1920000,
            margem_bruta_valor: 930000,
            despesa_vendas: 142000,
            hedge_resultado: 85000,
            ticketMedio: 7500.00,
            custoMedioPorCabeca: 5052.63,
            margemBrutaPerc: 32.63,
          },
          regimes: [
            {
              regime: "Pasto",
              estoque_animais: 1650,
              animais_vendidos: 220,
              faturamento_liquido: 1540000,
              cpv: 1045000,
              margem_bruta_valor: 495000,
              despesa_vendas: 77000,
              hedge_resultado: 45000,
              observacao: "Principais vendas para frigoríficos regionais"
            },
            {
              regime: "Confinamento",
              estoque_animais: 800,
              animais_vendidos: 160,
              faturamento_liquido: 1310000,
              cpv: 875000,
              margem_bruta_valor: 435000,
              despesa_vendas: 65000,
              hedge_resultado: 40000,
              observacao: "Animais terminados em 90 dias"
            }
          ]
        };
        
        setTotal(mockData.total);
        setRegimes(mockData.regimes);
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [mesSelecionado]);

  const barData = regimes.map((r) => ({
    regime: r.regime,
    FaturamentoLiquido: Number(r.faturamento_liquido || 0),
    MargemBrutaValor: Number(r.margem_bruta_valor || 0),
  }));

  const pieEstoqueData = regimes.map((r, index) => ({
    name: r.regime,
    value: Number(r.estoque_animais || 0),
    color: COLORS[index % COLORS.length]
  }));

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 flex flex-col gap-6">
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Atividade Pecuária</h1>
            <p className="text-sm text-muted-foreground">
              Visão gerencial Pasto x Confinamento — Estoque, Vendas, CPV, Margem e Hedge
            </p>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-muted-foreground mb-1.5">
              Mês de Referência
            </label>
            <select
              className="border border-input bg-card rounded-lg px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              value={mesSelecionado}
              onChange={(e) => setMesSelecionado(e.target.value)}
            >
              <option value="2025-09">Setembro 2025</option>
              <option value="2025-08">Agosto 2025</option>
              <option value="2025-07">Julho 2025</option>
            </select>
          </div>
        </div>

        {/* KPIs principais (consolidado Pasto+Confinamento) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Estoque de Animais"
            value={numero(total.estoque_animais) + " cabeças"}
            icon={TrendingUp}
            trend={{
              value: "Animais vivos no fim do mês",
              isPositive: true,
            }}
          />

          <KPICard
            title="Animais Vendidos"
            value={numero(total.animais_vendidos) + " cabeças"}
            icon={TrendingDown}
            trend={{
              value: "Saída no mês",
              isPositive: true,
            }}
          />

          <KPICard
            title="Ticket Médio por Cabeça"
            value={moeda(total.ticketMedio)}
            icon={DollarSign}
            trend={{
              value: "Receita líquida / cabeça vendida",
              isPositive: true,
            }}
          />

          <KPICard
            title="Custo Médio por Cabeça"
            value={moeda(total.custoMedioPorCabeca)}
            icon={DollarSign}
            trend={{
              value: "CPV / cabeça vendida",
              isPositive: total.custoMedioPorCabeca <= total.ticketMedio,
            }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Faturamento Líquido"
            value={moeda(total.faturamento_liquido)}
            icon={DollarSign}
            trend={{
              value: "Após impostos e devoluções",
              isPositive: true,
            }}
          />

          <KPICard
            title="Margem Bruta (R$)"
            value={moeda(total.margem_bruta_valor)}
            icon={TrendingUp}
            trend={{
              value: "R$ lucro bruto pecuária",
              isPositive: total.margem_bruta_valor >= 0,
            }}
          />

          <KPICard
            title="Margem Bruta (%)"
            value={percentual(total.margemBrutaPerc)}
            icon={TrendingUp}
            trend={{
              value: "Lucro Bruto / Receita Líquida",
              isPositive: total.margemBrutaPerc >= 0,
            }}
          />

          <KPICard
            title="Resultado de Hedge"
            value={moeda(total.hedge_resultado)}
            icon={TrendingUp}
            trend={{
              value: "Travas de preço no mês",
              isPositive: total.hedge_resultado >= 0,
            }}
          />
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico Receita Líquida x Margem Bruta por regime */}
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Receita Líquida x Margem Bruta</CardTitle>
              <p className="text-sm text-muted-foreground">Comparativo por regime - {mesSelecionado}</p>
            </CardHeader>
            <CardContent className="h-[320px]">
              {carregando ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  Carregando...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="regime" 
                      stroke="hsl(var(--muted-foreground))"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      tickFormatter={(v) => "R$ " + (v / 1000).toFixed(0) + "k"} 
                      stroke="hsl(var(--muted-foreground))"
                      style={{ fontSize: '12px' }}
                    />
                    <Tooltip
                      formatter={(val: number, name: string) =>
                        name === "FaturamentoLiquido"
                          ? [moeda(val), "Faturamento Líquido"]
                          : [moeda(val), "Margem Bruta (R$)"]
                      }
                      labelFormatter={(label) => `Regime: ${label}`}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="FaturamentoLiquido" fill="hsl(142 65% 42%)" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="MargemBrutaValor" fill="hsl(210 75% 55%)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Gráfico Pizza Estoque por regime */}
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Distribuição do Estoque</CardTitle>
              <p className="text-sm text-muted-foreground">Animais por regime - {mesSelecionado}</p>
            </CardHeader>
            <CardContent className="h-[320px]">
              {carregando ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  Carregando...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieEstoqueData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, value }) => `${name}: ${numero(value)}`}
                      labelLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                    >
                      {pieEstoqueData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      formatter={(value) => <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>}
                    />
                    <Tooltip
                      formatter={(val: number) => numero(val) + " cabeças"}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabela detalhada Pasto x Confinamento */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Detalhamento por Regime</CardTitle>
            <p className="text-sm text-muted-foreground">Análise completa - {mesSelecionado}</p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left border-b border-border">
                <tr className="text-muted-foreground">
                  <th className="py-3 pr-4 font-semibold">Regime</th>
                  <th className="py-3 pr-4 font-semibold">Estoque</th>
                  <th className="py-3 pr-4 font-semibold">Vendidos</th>
                  <th className="py-3 pr-4 font-semibold">Fat. Líquido</th>
                  <th className="py-3 pr-4 font-semibold">CPV</th>
                  <th className="py-3 pr-4 font-semibold">Margem Bruta</th>
                  <th className="py-3 pr-4 font-semibold">Desp. Venda</th>
                  <th className="py-3 pr-4 font-semibold">Hedge</th>
                  <th className="py-3 pr-4 font-semibold">Observação</th>
                </tr>
              </thead>
              <tbody>
                {regimes.map((r) => (
                  <tr key={r.regime} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="py-4 pr-4 font-semibold text-foreground">{r.regime}</td>
                    <td className="py-4 pr-4">{numero(r.estoque_animais)} cabeças</td>
                    <td className="py-4 pr-4">{numero(r.animais_vendidos)} cabeças</td>
                    <td className="py-4 pr-4 font-medium text-primary">{moeda(r.faturamento_liquido)}</td>
                    <td className="py-4 pr-4">{moeda(r.cpv)}</td>
                    <td className="py-4 pr-4 font-medium text-accent">{moeda(r.margem_bruta_valor)}</td>
                    <td className="py-4 pr-4">{moeda(r.despesa_vendas)}</td>
                    <td className="py-4 pr-4">{moeda(r.hedge_resultado)}</td>
                    <td className="py-4 pr-4 max-w-[240px] text-muted-foreground">{r.observacao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
