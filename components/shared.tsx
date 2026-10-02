"use client";
import { clientScope, setClientScope } from "@/lib/http/scope";
import { useEffect, useId, useRef } from "react";
import { X, LoaderCircle } from "lucide-react";
import { Button } from "./ui/button";
import { readJsonResponse } from "@/lib/http/response";
export async function api<T = unknown>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const headers = new Headers(options?.headers);
  if (clientScope() && !url.startsWith("workspace")) headers.set("X-Campo-Scope", clientScope()!);
  const response = await fetch(`/api/${url}`, { ...options, headers });
  if (response.status === 401) {
    location.href = "/login";
    throw new Error("Entre novamente.");
  }
  const value = await readJsonResponse<T>(response);
  if (url === "catalog" && value && typeof value === "object" && "scope" in value) setClientScope(typeof value.scope === "string" ? value.scope : null);
  return value;
}
export const send = (value: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(value),
});
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
      dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={headingId}
      className={`modal ${wide ? "modal-wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <div>
          <span className="eyebrow">CAMPO · CATÁLOGO</span>
          <h2 id={headingId}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Fechar"
          onClick={onClose}
        >
          <X size={20} />
        </Button>
      </div>
      {children}
    </dialog>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading">
      <LoaderCircle className="spin" size={23} /> Carregando seu catálogo…
    </div>
  );
}
export function ErrorText({ message }: { message: string }) {
  return message ? (
    <div role="alert" className="error">
      {message}
    </div>
  ) : null;
}
export const evidenceLabels: Record<string, string> = {
  personal: "Anotação pessoal",
  anecdotal: "Relato anedótico",
  traditional: "Uso tradicional",
  observation: "Observação botânica/micológica",
  publication: "Publicação (tipo não classificado)",
  in_vitro: "Estudo in vitro",
  animal: "Estudo animal",
  human: "Estudo humano",
  review: "Revisão",
  meta_analysis: "Metanálise",
};
