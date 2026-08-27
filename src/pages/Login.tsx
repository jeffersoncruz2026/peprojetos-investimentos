import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabaseConfigured } from "@/lib/supabaseClient";

export default function Login() {
  const { signInWithPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    const { error } = await signInWithPassword(email, password);
    setLoading(false);
    if (error) setErro(error);
    else navigate("/");
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Entrar</CardTitle>
          <p className="text-sm text-muted-foreground">
            Perfil GESTOR: edita orçamento, importa realizado e vincula lançamentos. Sem login, o
            acesso é somente leitura.
          </p>
        </CardHeader>
        <CardContent>
          {!supabaseConfigured && (
            <p className="text-sm text-destructive mb-4">
              Supabase não configurado nesta instância — configure VITE_SUPABASE_URL e
              VITE_SUPABASE_ANON_KEY.
            </p>
          )}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <Button type="submit" disabled={loading || !supabaseConfigured}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
