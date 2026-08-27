import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import { GESTOR_PADRAO_EMAIL } from "@/lib/config";
import type { Role } from "@/lib/types";

interface AuthContextValue {
  session: Session | null;
  role: Role;
  loading: boolean;
  isGestor: boolean;
  usuarioAtual: string;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function roleFromSession(session: Session | null): Role {
  // Sem sessão, o app opera como GESTOR por padrão (sem exigir login).
  if (!session) return "GESTOR";
  const metaRole = (session.user.app_metadata?.role || session.user.user_metadata?.role) as
    | Role
    | undefined;
  return metaRole === "LEITURA" ? "LEITURA" : "GESTOR";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const role = roleFromSession(session);
  const usuarioAtual = session?.user.email ?? GESTOR_PADRAO_EMAIL;

  async function signInWithPassword(email: string, password: string) {
    if (!supabaseConfigured) return { error: "Supabase não configurado." };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    if (!supabaseConfigured) return;
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        role,
        loading,
        isGestor: role === "GESTOR",
        usuarioAtual,
        signInWithPassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
