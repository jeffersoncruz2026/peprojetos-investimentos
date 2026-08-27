import { NavLink, Outlet } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard,
  Building2,
  Table2,
  UploadCloud,
  ListChecks,
  FileBarChart2,
  LogIn,
  LogOut,
  Menu,
  X,
  Sprout,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSafra } from "@/hooks/useSafra";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/centros-custo", label: "Centros de Custo", icon: Building2 },
  { to: "/orcamento", label: "Orçamento", icon: Table2 },
  { to: "/importar", label: "Importar Realizado", icon: UploadCloud, gestor: true },
  { to: "/pendencias", label: "Pendências", icon: ListChecks, gestor: true },
  { to: "/relatorios", label: "Relatórios", icon: FileBarChart2 },
];

export default function Layout() {
  const { safras, safraId, setSafraId } = useSafra();
  const { session, role, usuarioAtual, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r border-border bg-card flex-col transition-transform lg:static lg:flex lg:translate-x-0 print:hidden",
          mobileOpen ? "flex translate-x-0" : "hidden -translate-x-full"
        )}
      >
        <div className="flex items-center gap-2 px-5 h-16 border-b border-border">
          <Sprout className="h-6 w-6 text-primary" />
          <div>
            <p className="text-sm font-bold leading-tight">Investimentos</p>
            <p className="text-xs text-muted-foreground leading-tight">Grupo Otávio Lage</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.filter((item) => !item.gestor || role === "GESTOR").map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/80 hover:bg-muted"
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-border space-y-1.5">
          <p className="text-xs text-muted-foreground truncate px-1">
            {role} · {usuarioAtual}
          </p>
          {session ? (
            <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={signOut}>
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          ) : (
            <NavLink to="/login">
              <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                <LogIn className="h-4 w-4" /> Entrar com outra conta
              </Button>
            </NavLink>
          )}
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card flex items-center gap-3 px-4 lg:px-6 sticky top-0 z-20 print:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">Safra</span>
            <Select value={safraId} onValueChange={setSafraId}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Safra" />
              </SelectTrigger>
              <SelectContent>
                {safras.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
