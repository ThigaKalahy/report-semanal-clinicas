"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { GestfyLogo } from "@/components/brand/gestfy-logo";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const from = searchParams.get("from") ?? "/dashboard";
        router.push(from);
        router.refresh();
      } else {
        toast.error("Senha incorreta");
        setPassword("");
      }
    } catch {
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Painel lateral — gradiente da marca */}
      <div className="hidden lg:flex lg:w-1/2 bg-gestfy-gradient flex-col items-center justify-center p-12 gap-8">
        <GestfyLogo variant="full" size={56} showSubtitle onDark />
        <p className="text-white/70 text-sm text-center max-w-xs leading-relaxed">
          Consolide pesquisas, NPS, avaliações Google e metas em um relatório
          semanal pronto para WhatsApp.
        </p>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex flex-1 items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          {/* Logo no mobile */}
          <div className="flex justify-center lg:hidden">
            <GestfyLogo variant="full" size={40} showSubtitle />
          </div>

          <Card className="shadow-lg border-border">
            <CardHeader className="pb-2 space-y-1">
              <h1 className="text-xl font-semibold text-foreground">
                Relatórios Semanais
              </h1>
              <p className="text-sm text-muted-foreground">
                Digite a senha para acessar a ferramenta.
              </p>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-9 pr-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoFocus
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button className="w-full" type="submit" disabled={loading}>
                  {loading ? "Entrando…" : "Entrar"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            Gestfy — Gestão para Clínicas
          </p>
        </div>
      </div>
    </div>
  );
}
