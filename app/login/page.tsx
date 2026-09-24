"use client";
import { useState } from "react";
import { Sprout, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function Login() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="login-wrap">
      <form
        className="panel login-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await fetch("/api/auth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                password: new FormData(e.currentTarget).get("password"),
              }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            location.href = "/";
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Sprout size={40} className="accent" />
        <span className="eyebrow">SEU CATÁLOGO PESSOAL</span>
        <h1>Volte ao campo.</h1>
        <p>Entre para acessar suas observações e descobertas.</p>
        <label>
          Senha
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            autoFocus
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <Button disabled={busy}>
          {busy ? "Entrando…" : "Entrar no catálogo"}
          <ArrowRight size={17} />
        </Button>
      </form>
    </main>
  );
}
