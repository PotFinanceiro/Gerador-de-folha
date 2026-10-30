"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CabecalhoSistema, RodapeSistema } from "@/components/marca";
import { KeyRound, Loader2, ShieldCheck, Trash2, UserPlus } from "lucide-react";

type Usuario = {
  id: string;
  nome: string;
  email: string;
  perfil: "ADMIN" | "USUARIO";
  ativo: boolean;
  criadoEm: string;
};

const VAZIO = { nome: "", email: "", senha: "", perfil: "USUARIO" };

export function PainelUsuarios({ euId }: { euId: string }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [novo, setNovo] = useState(false);
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [senhaPara, setSenhaPara] = useState<Usuario | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [excluir, setExcluir] = useState<Usuario | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const r = await fetch("/api/usuarios");
    if (r.ok) {
      const d = await r.json();
      setUsuarios(d.usuarios);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const acao = async (fn: () => Promise<Response>, aoFim?: () => void) => {
    setErro("");
    const r = await fn();
    const d = await r.json().catch(() => ({}));
    if (!r.ok) setErro(d.erro || "Não foi possível concluir a operação.");
    else await carregar();
    aoFim?.();
  };

  const criar = () =>
    acao(
      () =>
        fetch("/api/usuarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }),
      () => {
        setForm(VAZIO);
        setNovo(false);
      }
    );

  const trocarSenha = () =>
    senhaPara &&
    acao(
      () =>
        fetch(`/api/usuarios/${senhaPara.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ senha: novaSenha }),
        }),
      () => {
        setSenhaPara(null);
        setNovaSenha("");
      }
    );

  const mudarPerfil = (u: Usuario, perfil: string) =>
    acao(() =>
      fetch(`/api/usuarios/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfil }),
      })
    );

  const alternarAtivo = (u: Usuario, ativo: boolean) =>
    acao(() =>
      fetch(`/api/usuarios/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo }),
      })
    );

  const confirmarExcluir = () =>
    excluir &&
    acao(
      () => fetch(`/api/usuarios/${excluir.id}`, { method: "DELETE" }),
      () => setExcluir(null)
    );

  return (
    <div className="min-h-screen flex flex-col">
      <CabecalhoSistema />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold flex items-center gap-2">
              <ShieldCheck className="h-6 w-6" aria-hidden /> Usuários
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Cadastre acessos e defina quem administra o sistema.
            </p>
          </div>
          <Button onClick={() => { setForm(VAZIO); setNovo(true); }}>
            <UserPlus className="h-4 w-4" aria-hidden /> Novo usuário
          </Button>
        </div>

        {erro && (
          <Alert variant="destructive">
            <AlertTitle>Atenção</AlertTitle>
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Acessos cadastrados</CardTitle>
            <CardDescription>
              Administradores gerenciam usuários; usuários emitem cartas e geram folhas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {carregando ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Carregando…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2.5 pr-4 font-medium">Nome</th>
                      <th className="py-2.5 pr-4 font-medium">Email</th>
                      <th className="py-2.5 pr-4 font-medium">Perfil</th>
                      <th className="py-2.5 pr-4 font-medium">Ativo</th>
                      <th className="py-2.5 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map((u) => (
                      <tr key={u.id} className={`border-b last:border-0 ${u.ativo ? "" : "opacity-50"}`}>
                        <td className="py-3 pr-4 font-medium">
                          {u.nome}
                          {u.id === euId && (
                            <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">{u.email}</td>
                        <td className="py-3 pr-4">
                          {u.id === euId ? (
                            <Badge variant="default">ADMIN</Badge>
                          ) : (
                            <Select value={u.perfil} onValueChange={(v) => mudarPerfil(u, v)}>
                              <SelectTrigger className="h-8 w-[130px]" aria-label={`Perfil de ${u.nome}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="USUARIO">USUÁRIO</SelectItem>
                                <SelectItem value="ADMIN">ADMIN</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <Switch
                            checked={u.ativo}
                            disabled={u.id === euId}
                            onCheckedChange={(v) => alternarAtivo(u, v)}
                            aria-label={u.ativo ? `Desativar ${u.nome}` : `Ativar ${u.nome}`}
                          />
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setSenhaPara(u); setNovaSenha(""); }}
                              title="Trocar senha"
                            >
                              <KeyRound className="h-4 w-4" aria-hidden />
                              <span className="sr-only">Trocar senha de {u.nome}</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={u.id === euId}
                              onClick={() => setExcluir(u)}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                              <span className="sr-only">Excluir {u.nome}</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <RodapeSistema />

      {/* novo usuário */}
      <Dialog open={novo} onOpenChange={setNovo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
            <DialogDescription>Crie o acesso e escolha o perfil.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                value={form.senha}
                onChange={(e) => setForm({ ...form, senha: e.target.value })}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Perfil</Label>
              <Select value={form.perfil} onValueChange={(v) => setForm({ ...form, perfil: v })}>
                <SelectTrigger aria-label="Perfil do novo usuário">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USUARIO">Usuário — emite cartas e gera folhas</SelectItem>
                  <SelectItem value="ADMIN">Administrador — também cadastra usuários</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovo(false)}>Cancelar</Button>
            <Button onClick={criar} disabled={salvando || !form.nome || !form.email || form.senha.length < 6}>
              {salvando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Criar acesso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* trocar senha */}
      <Dialog open={!!senhaPara} onOpenChange={(v) => !v && setSenhaPara(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trocar senha</DialogTitle>
            <DialogDescription>Defina uma nova senha para {senhaPara?.nome}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="nova-senha">Nova senha</Label>
            <Input
              id="nova-senha"
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSenhaPara(null)}>Cancelar</Button>
            <Button onClick={trocarSenha} disabled={novaSenha.length < 6}>Salvar senha</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* excluir */}
      <AlertDialog open={!!excluir} onOpenChange={(v) => !v && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluir?.nome} perderá o acesso ao sistema. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={confirmarExcluir}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
