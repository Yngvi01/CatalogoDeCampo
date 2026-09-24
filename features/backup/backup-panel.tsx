"use client";
import { useState, useEffect } from "react";
import {
  Download,
  Upload,
  FileJson,
  Files,
  Archive,
  ShieldCheck,
} from "lucide-react";
import { Modal, Field, ErrorText, api, send } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { uploadDirect } from "@/lib/http/upload";
type Preview = {
  hash: string;
  isZip: boolean;
  counts: Record<string, number>;
  existing: Record<string, number>;
  codeConflicts: number;
  missingImages: number;
};
const labels: Record<string, string> = {
  species: "Espécies",
  observations: "Observações",
  images: "Imagens",
  identifications: "Identificações",
  history: "Histórico",
  compounds: "Compostos",
  evidence: "Evidências",
  discoveries: "Descobertas",
  research: "Pesquisas",
  settings: "Preferências",
  notes: "Páginas do caderno",
};
export function BackupPanel({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [strategy, setStrategy] = useState("skip"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const [direct, setDirect] = useState(false);
  const [ticket, setTicket] = useState("");
  const [importMax, setImportMax] = useState(256 * 1024 * 1024);
  useEffect(() => {
    api<{ direct: boolean; importMaxBytes: number }>("storage")
      .then((config) => {
        setDirect(config.direct);
        setImportMax(config.importMaxBytes);
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <Modal
      title="Seus dados, com você."
      subtitle="Exporte, transfira ou restaure seu catálogo sem depender de nenhum serviço."
      onClose={onClose}
      wide
    >
      <div className="backup-options">
        {[
          {
            id: "zip",
            icon: Archive,
            title: "Backup completo",
            desc: "Dados, fotos originais e otimizadas, relações e JSON. O formato para transferir seu catálogo.",
            label: "Baixar ZIP",
          },
          {
            id: "json",
            icon: FileJson,
            title: "Catálogo em JSON",
            desc: "Todos os dados estruturados em formato aberto e versionado. Não contém os arquivos das fotos.",
            label: "Baixar JSON",
          },
        ].map((o) => (
          <div className="panel backup-option" key={o.id}>
            <o.icon size={27} />
            <h3>{o.title}</h3>
            <p>{o.desc}</p>
            <Button
              asChild
              variant={o.id === "zip" ? "default" : "outline"}
              size="sm"
            >
              <a href={`/api/export/${o.id}`}>
                <Download size={14} />
                {o.label}
              </a>
            </Button>
          </div>
        ))}
        <div className="panel backup-option">
          <Files size={27} />
          <h3>Planilhas CSV</h3>
          <p>
            Tabelas simples para análise. O CSV não substitui o backup completo.
          </p>
          <div className="csv-links">
            {[
              ["species", "Espécies"],
              ["observations", "Observações"],
              ["compounds", "Compostos"],
            ].map(([k, l]) => (
              <a key={k} href={`/api/export/csv?table=${k}`}>
                {l} ↓
              </a>
            ))}
          </div>
        </div>
      </div>
      <p className="tip">
        <ShieldCheck size={15} /> Chaves de API, senhas e arquivos .env nunca
        entram no backup.
      </p>
      <div className="section-heading">
        <h2>Importar / Restaurar</h2>
        <span>JSON ou ZIP · até {importMax / 1024 / 1024} MB</span>
      </div>
      <div className="import-box panel">
        <Field label="Arquivo do catálogo">
          <input
            type="file"
            accept=".json,.zip,application/json,application/zip"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setTicket("");
              setPreview(null);
              setConfirmed(false);
              setNotice("");
            }}
          />
        </Field>
        <Button
          size="sm"
          variant="outline"
          disabled={!file || busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              if (file!.size > importMax)
                throw new Error(
                  `O arquivo deve ter até ${importMax / 1024 / 1024} MB.`,
                );
              const uploaded = direct
                ? await uploadDirect(file!, "import")
                : "";
              setTicket(uploaded);
              const f = new FormData();
              f.set("file", file!);
              setPreview(
                await api<Preview>(
                  "import/preview",
                  direct
                    ? send({ ticket: uploaded })
                    : { method: "POST", body: f },
                ),
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Upload size={15} />
          {busy ? "Processando…" : "Validar e visualizar"}
        </Button>
        {preview && (
          <div className="import-preview">
            <h3>Resumo do arquivo validado</h3>
            <table>
              <thead>
                <tr>
                  <th>Dados</th>
                  <th>No arquivo</th>
                  <th>Já existentes</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(preview.counts).map(([k, n]) => (
                  <tr key={k}>
                    <td>{labels[k] || k}</td>
                    <td>{n}</td>
                    <td>{preview.existing[k]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.codeConflicts > 0 && (
              <p className="error">
                {preview.codeConflicts} códigos CAMPO pertencem a outros IDs.
                Escolha importar como novo ou restaurar.
              </p>
            )}
            {preview.missingImages > 0 && (
              <p className="error">
                {preview.missingImages} fotos não estão no armazenamento atual.
                Importe o ZIP para preservar as imagens.
              </p>
            )}
            <Field label="Estratégia">
              <select
                value={strategy}
                onChange={(e) => {
                  setStrategy(e.target.value);
                  setConfirmed(false);
                }}
              >
                <option value="skip">Ignorar IDs existentes</option>
                <option value="update">Atualizar IDs existentes</option>
                <option value="new">
                  Importar como novo (novos IDs e códigos)
                </option>
                {preview.isZip && (
                  <option value="restore">
                    Restaurar completamente (substituir catálogo)
                  </option>
                )}
              </select>
            </Field>
            <p className="tip">
              {strategy === "new"
                ? "Cria novos IDs e refaz todas as relações. Os códigos CAMPO serão renumerados."
                : strategy === "restore"
                  ? "Substitui os dados atuais pelos do backup e preserva os IDs originais. Uma cópia automática do estado atual será criada no armazenamento de backups."
                  : strategy === "update"
                    ? "Sobrescreve registros de mesmo ID. Uma cópia automática será criada no armazenamento de backups."
                    : "Registros com o mesmo ID serão preservados. IDs novos serão adicionados."}
            </p>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />{" "}
              Revisei o resumo e a estratégia de importação.
            </label>
            <Button
              disabled={busy || !confirmed}
              variant={strategy === "restore" ? "destructive" : "default"}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const f = new FormData();
                  f.set("file", file!);
                  f.set("strategy", strategy);
                  f.set("hash", preview.hash);
                  const r = await api<{
                    recovery: string | null;
                    missingImages: number;
                  }>(
                    "import/commit",
                    direct
                      ? send({ ticket, strategy, hash: preview.hash })
                      : { method: "POST", body: f },
                  );
                  await onChanged();
                  setNotice(
                    `Importação concluída.${r.recovery ? ` Backup anterior: backups/${r.recovery}.` : ""}${r.missingImages ? " As fotos ausentes precisam ser recuperadas de um ZIP." : ""}`,
                  );
                  setPreview(null);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy
                ? "Importando…"
                : strategy === "restore"
                  ? "Restaurar catálogo"
                  : "Importar catálogo"}
            </Button>
          </div>
        )}
      </div>
      <ErrorText message={error} />
      {notice && (
        <div role="status" className="notice">
          {notice}
        </div>
      )}
    </Modal>
  );
}
