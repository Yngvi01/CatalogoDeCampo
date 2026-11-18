"use client";
import { useState, useEffect } from "react";
import { Sprout, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Mode = "login" | "signup" | "recover" | "recovery-sent" | "set-password" | "confirmation";

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
  const [pendingEmail, setPendingEmail] = useState("");

  useEffect(() => {
    fetch("/api/auth").then(r => r.json()).then(d => setProfessional(d.professional === true)).catch(() => {});
    const params = new URLSearchParams(location.search);
    if (params.get("recovery") === "1") setMode("set-password");
    if (params.get("recovery") === "error") setError("O link de recuperação expirou ou já foi usado. Solicite outro link.");
    if (params.get("confirmation") === "error")
      setError("O link de confirmação expirou ou já foi usado. Entre na sua conta ou solicite outro link.");
  }, []);

  const resendConfirmation = async () => {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resend", email: pendingEmail, next: returnPath() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNotice("Se o cadastro estiver pendente, um novo link de confirmação foi solicitado. Confira também o spam.");
    } catch (cause) {
      setError((cause as Error).message || "Não foi possível reenviar a confirmação.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-wrap">
      <form
        className="panel login-card"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          setNotice("");
          const form = event.currentTarget;
          const values = new FormData(form);
          const email = String(values.get("email") || "");
          const password = String(values.get("password") || "");
          if (["signup", "set-password"].includes(mode) && password !== String(values.get("confirmPassword") || "")) {
            setError("As senhas não coincidem.");
            return;
          }
          setBusy(true);
          try {
            const action = mode === "recover" ? "recover" : mode === "set-password" ? "updatePassword" : mode;
            const response = await fetch("/api/auth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action,
                ...(professional && ["login", "signup", "recover"].includes(mode) ? { email } : {}),
                ...(["login", "signup", "set-password"].includes(mode) ? { password } : {}),
                ...(mode === "signup" ? { next: returnPath() } : {}),
              }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            if (mode === "signup" && data.confirmationRequired) {
              setPendingEmail(email);
              setNotice("Cadastro solicitado. Confira seu e-mail para confirmar. Se nenhuma mensagem chegar, tente reenviar ou recuperar a senha caso já tenha uma conta.");
              setMode("confirmation");
              return;
            }
            if (mode === "recover") {
              setPendingEmail(email);
              setNotice("Se houver uma conta para esse e-mail, enviaremos um link de recuperação. Confira também o spam.");
              setMode("recovery-sent");
              return;
            }
            if (mode === "set-password") {
              await fetch("/api/auth", { method: "DELETE" });
              setMode("login");
              setNotice("Senha atualizada. Entre com a nova senha.");
              return;
            }
            location.href = returnPath();
          } catch (cause) {
            setError((cause as Error).message || "Não foi possível concluir. Tente novamente.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Sprout size={40} className="accent" />
        <span className="eyebrow">SEU CATÁLOGO PESSOAL</span>
        <h1>{mode === "signup" ? "Comece seu catálogo." : mode === "recover" ? "Recupere seu acesso." : mode === "set-password" ? "Defina uma nova senha." : mode === "confirmation" ? "Confirme seu e-mail." : mode === "recovery-sent" ? "Confira seu e-mail." : "Volte ao campo."}</h1>
        <p>{mode === "signup" ? "Crie sua conta para registrar observações e descobertas." : mode === "recover" ? "Enviaremos um link para redefinir a senha da sua conta." : mode === "set-password" ? "Escolha uma senha nova para continuar." : mode === "confirmation" ? "É necessário confirmar o endereço antes de entrar." : mode === "recovery-sent" ? "Confira sua caixa de entrada e a pasta de spam." : "Entre para acessar suas observações e descobertas."}</p>
        {professional && ["login", "signup", "recover"].includes(mode) && <label>E-mail<input name="email" type="email" required autoComplete="email" defaultValue={pendingEmail} /></label>}
        {["login", "signup", "set-password"].includes(mode) && (
          <>
            <label>
              {mode === "set-password" ? "Nova senha" : "Senha"}
              <input
                name="password"
                type="password"
                required
                minLength={mode === "signup" || mode === "set-password" ? 12 : undefined}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                autoFocus
              />
            </label>
            {["signup", "set-password"].includes(mode) && (
              <label>
                Confirme a senha
                <input name="confirmPassword" type="password" required minLength={12} autoComplete="new-password" />
              </label>
            )}
          </>
        )}
        {error && <p role="alert" className="error">{error}</p>}
        {notice && <p role="status" className="login-success">{notice}</p>}
        {!['confirmation', 'recovery-sent'].includes(mode) && <Button disabled={busy}>
          {busy ? (mode === "signup" ? "Criando conta…" : mode === "recover" ? "Solicitando link…" : mode === "set-password" ? "Atualizando senha…" : "Entrando…") : (mode === "signup" ? "Criar conta" : mode === "recover" ? "Enviar link de recuperação" : mode === "set-password" ? "Salvar nova senha" : "Entrar no catálogo")}
          <ArrowRight size={17} />
        </Button>}
        {mode === "confirmation" && <Button type="button" variant="outline" disabled={busy || !pendingEmail} onClick={resendConfirmation}>{busy ? "Enviando…" : "Reenviar confirmação"}</Button>}
        {professional && mode === "login" && <button className="login-switch" type="button" onClick={() => { setMode("recover"); setNotice(""); setError(""); }}>Esqueceu a senha? Recuperar acesso</button>}
        {professional && ["login", "signup"].includes(mode) && <button className="login-switch" type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setNotice(""); }}>
          {mode === "login" ? "Ainda não tem conta? Criar cadastro" : "Já tem uma conta? Entrar"}
        </button>}
        {["confirmation", "recovery-sent", "recover"].includes(mode) && <button className="login-switch" type="button" onClick={() => { setMode("login"); setError(""); setNotice(""); }}>Voltar para entrar</button>}
        {notice && mode === "login" && <button className="login-switch" type="button" onClick={() => setNotice("")}>Fechar aviso</button>}
      </form>
    </main>
  );
}
