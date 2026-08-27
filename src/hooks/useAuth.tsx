import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import { ADMIN_EMAIL, GESTOR_PADRAO_EMAIL } from "@/lib/config";
import type { Role } from "@/lib/types";

interface AuthContextValue {
  session: Session | null;
  role: Role;
  loading: boolean;
  isGestor: boolean;
  isAdmin: boolean;
  usuarioAtual: string;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithPassword: (
    email: string,
    password: string
  ) => Promise<{ error: string | null; precisaConfirmar: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function roleFromSession(session: Session | null): Role {
  if (!session) return "LEITURA";
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
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const role = roleFromSession(session);
  const usuarioAtual = session?.user.email ?? GESTOR_PADRAO_EMAIL;

  async function signInWithPassword(email: string, password: string) {
    if (!supabaseConfigured) return { error: "Backend não configurado." };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUpWithPassword(email: string, password: string) {
    if (!supabaseConfigured) return { error: "Backend não configurado.", precisaConfirmar: false };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error: error?.message ?? null, precisaConfirmar: !error && !data.session };
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
        isGestor: !!session && role === "GESTOR",
        isAdmin: !!session && session.user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
        usuarioAtual,
        signInWithPassword,
        signUpWithPassword,
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
