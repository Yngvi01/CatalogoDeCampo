"use client";
import { useState, useEffect } from "react";
import { Sprout, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Mode = "login" | "signup";

function returnPath() {
  const next = new URLSearchParams(location.search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/";
  try {
    const target = new URL(next, location.origin);
    return target.origin === location.origin ? `${target.pathname}${target.search}${target.hash}` : "/";
  } catch {
    return "/";
  }
}

export default function Login() {
  const [professional, setProfessional] = useState(false);
  const [mode, setMode] = useState<Mode>("login");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth").then(r => r.json()).then(d => setProfessional(d.professional === true)).catch(() => {});
    if (new URLSearchParams(location.search).get("confirmation") === "error")
      setError("O link de confirmação expirou ou já foi usado. Entre na sua conta ou solicite um novo cadastro.");
  }, []);

  return (
    <main className="login-wrap">
      <form
        className="panel login-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setNotice("");
          const form = e.currentTarget;
          const values = new FormData(form);
          const password = String(values.get("password") || "");
          if (mode === "signup" && password !== String(values.get("confirmPassword") || "")) {
            setError("As senhas não coincidem.");
            return;
          }
          setBusy(true);
          try {
            const r = await fetch("/api/auth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: mode,
                password,
                ...(professional ? { email: values.get("email") } : {}),
                ...(mode === "signup" ? { next: returnPath() } : {}),
              }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            if (mode === "signup" && d.confirmationRequired) {
              setNotice("Cadastro iniciado. Confira seu e-mail e abra o link de confirmação para acessar seu catálogo.");
              return;
            }
            if (mode === "signup") {
              location.href = returnPath();
              return;
            }
            location.href = returnPath();
          } catch (e) {
            setError((e as Error).message || "Não foi possível concluir. Tente novamente.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Sprout size={40} className="accent" />
        <span className="eyebrow">SEU CATÁLOGO PESSOAL</span>
        <h1>{mode === "signup" ? "Comece seu catálogo." : "Volte ao campo."}</h1>
        <p>{mode === "signup" ? "Crie sua conta para registrar observações e descobertas." : "Entre para acessar suas observações e descobertas."}</p>
        {professional && <label>E-mail<input name="email" type="email" required autoComplete="email" /></label>}
        <label>
          Senha
          <input
            name="password"
            type="password"
            required
            minLength={mode === "signup" ? 12 : undefined}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            autoFocus
          />
        </label>
        {mode === "signup" && (
          <label>
            Confirme a senha
            <input name="confirmPassword" type="password" required minLength={12} autoComplete="new-password" />
          </label>
        )}
        {error && <p role="alert" className="error">{error}</p>}
        {notice && <p role="status" className="login-success">{notice}</p>}
        {!notice && <Button disabled={busy}>
          {busy ? (mode === "signup" ? "Criando conta…" : "Entrando…") : (mode === "signup" ? "Criar conta" : "Entrar no catálogo")}
          <ArrowRight size={17} />
        </Button>}
        {professional && !notice && (
          <button
            className="login-switch"
            type="button"
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
          >
            {mode === "login" ? "Ainda não tem conta? Criar cadastro" : "Já tem uma conta? Entrar"}
          </button>
        )}
        {notice && <button className="login-switch" type="button" onClick={() => { setMode("login"); setNotice(""); }}>Voltar para entrar</button>}
      </form>
    </main>
  );
}
