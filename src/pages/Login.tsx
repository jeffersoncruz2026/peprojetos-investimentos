import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export default function Login() {
  const { signInWithPassword, signUpWithPassword, session } = useAuth();
  const navigate = useNavigate();
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) navigate("/", { replace: true });
  }, [session, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    setAviso(null);
    if (modo === "entrar") {
      const { error } = await signInWithPassword(email, password);
      setLoading(false);
      if (error) setErro(error);
      else navigate("/", { replace: true });
      return;
    }
    const { error, precisaConfirmar } = await signUpWithPassword(email, password);
    setLoading(false);
    if (error) setErro(error);
    else if (precisaConfirmar)
      setAviso("Conta criada. Confirme o e-mail pelo link enviado e depois entre.");
    else navigate("/", { replace: true });
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{modo === "entrar" ? "Entrar" : "Criar conta"}</CardTitle>
          <p className="text-sm text-muted-foreground">
            O acesso ao orçamento exige login. Depois de entrar você pode cadastrar, importar e
            vincular lançamentos.
          </p>
        </CardHeader>
        <CardContent>
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
              minLength={6}
              required
            />
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            {aviso && <p className="text-sm text-muted-foreground">{aviso}</p>}
            <Button type="submit" disabled={loading}>
              {loading ? "Aguarde..." : modo === "entrar" ? "Entrar" : "Criar conta"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setModo(modo === "entrar" ? "criar" : "entrar");
                setErro(null);
                setAviso(null);
              }}
            >
              {modo === "entrar" ? "Não tenho conta" : "Já tenho conta"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
