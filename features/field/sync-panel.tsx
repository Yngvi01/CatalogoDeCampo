"use client";
import { useCallback, useEffect, useState } from "react";
import { fieldStore, type QueuedCapture } from "@/lib/offline/field";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/shared";

const labels: Record<QueuedCapture["status"], string> = {
  local: "Salva no aparelho",
  pending: "Aguardando envio",
  synced: "Enviada ao catálogo",
  error: "Precisa de atenção",
};

export function SyncPanel({
  refresh,
  onPendingCount,
}: {
  refresh: () => Promise<void>;
  onPendingCount?: (count: number | null) => void;
}) {
  const [records, setRecords] = useState<QueuedCapture[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const current = await (await fieldStore()).list();
      setRecords(current);
      setError("");
      onPendingCount?.(current.filter((record) => record.status !== "synced").length);
    } catch (cause) {
      setError((cause as Error).message);
      onPendingCount?.(null);
    }
  }, [onPendingCount]);

  useEffect(() => {
    const sync = async () => {
      try {
        const store = await fieldStore();
        await store.sync();
        await load();
      } catch (cause) {
        setError((cause as Error).message);
        await load();
      }
    };
    const change = () => { void load(); };
    const online = () => { void sync(); };
    void sync();
    window.addEventListener("campo-field-change", change);
    window.addEventListener("online", online);
    const timer = setInterval(() => { void sync(); }, 20000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("campo-field-change", change);
      window.removeEventListener("online", online);
    };
  }, [load]);

  const pending = records.filter((record) => record.status !== "synced");
  const failed = pending.filter((record) => record.status === "error");
  const waiting = pending.length - failed.length;
  const synced = records.filter((record) => record.status === "synced");

  useEffect(() => {
    if (synced.length) void refresh();
  }, [synced.length, refresh]);

  return (
    <section className="panel field-sync" aria-label="Fila de coletas neste aparelho">
      <div className="section-heading">
        <h2>Coletas neste aparelho</h2>
        <a className="text-button" href="/collect.html">Abrir coleta de campo</a>
      </div>
      {pending.length ? (
        <p className="field-sync-summary" role="status">
          {failed.length > 0 && <strong>{failed.length} {failed.length === 1 ? "precisa" : "precisam"} de atenção. </strong>}
          {waiting > 0 && `${waiting} aguardando envio. `}
          As fotos ficam no aparelho até o catálogo confirmar o recebimento.
        </p>
      ) : records.length ? (
        <p className="field-sync-summary" role="status">Todas as coletas foram enviadas ao catálogo.</p>
      ) : (
        <p className="field-sync-summary">Coletas feitas sem conexão aparecem aqui até serem enviadas.</p>
      )}
      <ErrorText message={error} />
      {pending.map((record) => (
        <div className={`field-queue-row field-queue-${record.status}`} key={record.id}>
          <strong>{record.code || record.data.region || "Coleta sem local informado"}</strong>
          <span>{labels[record.status]}</span>
          {record.error && <small>{record.error}</small>}
          {record.status === "error" && <a href={`/collect.html?edit=${record.id}`}>Corrigir coleta</a>}
        </div>
      ))}
      {synced.length > 0 && (
        <details className="field-synced-list">
          <summary>Coletas já enviadas ({synced.length})</summary>
          {synced.slice(-5).reverse().map((record) => (
            <div className="field-queue-row field-queue-synced" key={record.id}>
              <strong>{record.code || record.data.region || "Coleta sem local informado"}</strong>
              <span>{labels.synced}</span>
            </div>
          ))}
          <Button variant="ghost" onClick={async () => { await (await fieldStore()).clearSynced(); await load(); }}>
            Limpar coletas enviadas deste aparelho
          </Button>
        </details>
      )}
      {pending.length > 0 && (
        <div className="actions">
          <Button variant="outline" disabled={busy} onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await (await fieldStore()).sync(true);
              await load();
              await refresh();
            } catch (cause) {
              setError((cause as Error).message);
            } finally {
              setBusy(false);
            }
          }}>
            {busy ? "Enviando…" : failed.length ? "Tentar enviar novamente" : "Enviar agora"}
          </Button>
        </div>
      )}
    </section>
  );
}
