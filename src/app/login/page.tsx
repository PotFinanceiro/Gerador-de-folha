"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, LogIn } from "lucide-react";

export default function PaginaLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setEntrando(true);
    const r = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErro(d.erro || "Não foi possível entrar.");
      setEntrando(false);
      return;
    }
    router.replace("/folhas-de-ponto");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center gap-3 mb-8">
          <img
            src="/waycode-logo.png"
            alt="WayCode — Soluções Tecnológicas"
            className="h-20 w-20 rounded-2xl object-contain ring-1 ring-zinc-200 bg-white shadow-sm"
          />
          <div>
            <h1 className="text-lg font-semibold leading-tight">
              Programa Operação Trabalho
            </h1>
            <p className="text-sm text-muted-foreground">Rede Cidadã · By WayCode</p>
          </div>
        </div>

        <form
          onSubmit={entrar}
          className="bg-white rounded-2xl border shadow-sm p-6 space-y-4"
          aria-label="Formulário de login"
        >
          {erro && (
            <Alert variant="destructive">
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={entrando}>
            {entrando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Entrando…
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" aria-hidden /> Entrar
              </>
            )}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Acesso restrito à equipe do programa.
        </p>
      </div>
    </div>
  );
}
