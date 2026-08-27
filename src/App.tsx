import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import RequireAuth from "@/components/RequireAuth";
import { SafraProvider } from "@/hooks/useSafra";
import { AuthProvider } from "@/hooks/useAuth";
import Home from "./pages/Home";
import CentrosCusto from "./pages/CentrosCusto";
import CentroCustoDetalhe from "./pages/CentroCustoDetalhe";
import ItemDetalhe from "./pages/ItemDetalhe";
import Orcamento from "./pages/Orcamento";
import ImportarRealizado from "./pages/ImportarRealizado";
import Pendencias from "./pages/Pendencias";
import Relatorios from "./pages/Relatorios";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SafraProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/login" element={<Login />} />
                <Route element={<RequireAuth />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/centros-custo" element={<CentrosCusto />} />
                  <Route path="/centros-custo/:id" element={<CentroCustoDetalhe />} />
                  <Route path="/itens/:id" element={<ItemDetalhe />} />
                  <Route path="/orcamento" element={<Orcamento />} />
                  <Route path="/importar" element={<ImportarRealizado />} />
                  <Route path="/pendencias" element={<Pendencias />} />
                  <Route path="/relatorios" element={<Relatorios />} />
                </Route>
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </SafraProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
