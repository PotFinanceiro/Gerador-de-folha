"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, LogIn } from "lucide-react";
import { criarClienteNavegador } from "@/lib/supabase/client";

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

    try {
      // 1. Tenta autenticar via Supabase Auth
      const supabase = criarClienteNavegador();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: senha,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          setErro("Email ou senha incorretos.");
        } else if (error.message.includes("Email not confirmed")) {
          setErro("Email ainda não confirmado. Verifique sua caixa de entrada.");
        } else {
          setErro(error.message || "Não foi possível autenticar.");
        }
        setEntrando(false);
        return;
      }

      if (data?.user) {
        // Verifica se o perfil do usuário está ativo
        const { data: perfil } = await supabase
          .from("perfis")
          .select("ativo")
          .eq("id", data.user.id)
          .single();

        if (perfil && !perfil.ativo) {
          await supabase.auth.signOut();
          setErro("Este usuário foi desativado pelo administrador.");
          setEntrando(false);
          return;
        }

        router.replace("/folhas-de-ponto");
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro inesperado ao conectar.";
      setErro(msg);
      setEntrando(false);
    }
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
              required
              autoComplete="email"
              placeholder="seu.email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={entrando}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              disabled={entrando}
            />
          </div>

          <Button type="submit" className="w-full gap-2 cursor-pointer" disabled={entrando}>
            {entrando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Entrando…
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                Entrar no sistema
              </>
            )}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Acesso restrito à equipe autorizada.
        </p>
      </div>
    </div>
  );
}
