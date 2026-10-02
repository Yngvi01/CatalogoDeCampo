"use client";
import { useCallback, useEffect, useState } from "react";
import { fieldStore, type QueuedCapture } from "@/lib/offline/field";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/shared";
const labels = { local: "Salvo localmente", pending: "Aguardando sincronização", synced: "Sincronizado", error: "Erro" };
export function SyncPanel({ refresh }: { refresh: () => Promise<void> }) {
  const [records, setRecords] = useState<QueuedCapture[]>([]), [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setRecords(await (await fieldStore()).list()); } catch (cause) { setError((cause as Error).message); } }, []);
  useEffect(() => {
    const sync = async () => { try { const store = await fieldStore(); await store.sync(); await load(); } catch (cause) { setError((cause as Error).message); } };
    const change = () => { void load(); };
    const online = () => { void sync(); };
    void sync();
    window.addEventListener("campo-field-change", change); window.addEventListener("online", online);
    const timer = setInterval(() => { void sync(); }, 20000);
    return () => { clearInterval(timer); window.removeEventListener("campo-field-change", change); window.removeEventListener("online", online); };
  }, [load]);
  const pending = records.filter(r => r.status !== "synced");
  useEffect(() => { if (records.some(r => r.status === "synced")) void refresh(); }, [records.filter(r => r.status === "synced").length, refresh]);
  return <section className="panel field-sync" aria-label="Fila de coleta rápida">
    <div className="section-heading"><h2>Coleta rápida no aparelho</h2><a className="text-button" href="/collect.html">Abrir coleta rápida</a></div>
    <p>{pending.length ? `${pending.length} registro(s) aguardando envio. As fotos ficam aqui até a confirmação do servidor.` : "Nenhuma coleta pendente neste aparelho."}</p>
    <ErrorText message={error} />
    {records.map(r => <div key={r.id} className="field-queue-row"><strong>{r.code || r.data.region || "Nova observação"}</strong><span>{labels[r.status]}</span>{r.error && <small>{r.error}</small>}{r.status === "error" && <a href={`/collect.html?edit=${r.id}`}>Corrigir coleta</a>}</div>)}
    <div className="actions"><Button variant="outline" disabled={busy || !pending.length} onClick={async () => { setBusy(true); setError(""); try { await (await fieldStore()).sync(true); await load(); await refresh(); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); } }}>{busy ? "Sincronizando…" : "Tentar sincronizar"}</Button>
    {records.some(r => r.status === "synced") && <Button variant="ghost" onClick={async () => { await (await fieldStore()).clearSynced(); await load(); }}>Limpar sincronizados do aparelho</Button>}</div>
  </section>;
}
