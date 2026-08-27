import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import type { Safra } from "@/lib/types";

interface SafraContextValue {
  safras: Safra[];
  safraId: string;
  setSafraId: (id: string) => void;
  safra: Safra | undefined;
  loading: boolean;
  refetch: () => void;
}

const SafraContext = createContext<SafraContextValue | undefined>(undefined);

const DEFAULT_SAFRA_ID = "2026/2027";

export function SafraProvider({ children }: { children: ReactNode }) {
  const [safras, setSafras] = useState<Safra[]>([]);
  const [safraId, setSafraId] = useState<string>(
    () => localStorage.getItem("safra_selecionada") || DEFAULT_SAFRA_ID
  );
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!supabaseConfigured) {
      setSafras([
        { id: DEFAULT_SAFRA_ID, data_inicio: "2026-04-01", data_fim: "2027-03-31", status: "ABERTA" },
      ]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    supabase
      .from("safra")
      .select("*")
      .order("id", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (!error && data) setSafras(data as Safra[]);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tick]);

  useEffect(() => {
    localStorage.setItem("safra_selecionada", safraId);
  }, [safraId]);

  const safra = useMemo(() => safras.find((s) => s.id === safraId), [safras, safraId]);

  return (
    <SafraContext.Provider
      value={{ safras, safraId, setSafraId, safra, loading, refetch: () => setTick((t) => t + 1) }}
    >
      {children}
    </SafraContext.Provider>
  );
}

export function useSafra() {
  const ctx = useContext(SafraContext);
  if (!ctx) throw new Error("useSafra deve ser usado dentro de SafraProvider");
  return ctx;
}
