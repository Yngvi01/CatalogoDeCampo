"use client";

import { useEffect, useState } from "react";
import { Save, LoaderCircle } from "lucide-react";
import { Modal, Field, ErrorText, api, send } from "@/components/shared";
import { Button } from "@/components/ui/button";
import type { Note } from "@/lib/validation/schemas";

export function NoteEditor({
  note,
  onClose,
  onSaved,
}: {
  note?: Note;
  onClose: () => void;
  onSaved: (note: Note) => Promise<void>;
}) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [tags, setTags] = useState(note?.tags.join(", ") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty =
    title !== (note?.title ?? "") ||
    content !== (note?.content ?? "") ||
    tags !== (note?.tags.join(", ") ?? "");
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;

  useEffect(() => {
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);

  function close() {
    if (busy) return;
    if (
      !dirty ||
      window.confirm(
        "Há alterações não salvas nesta página. Descartar as alterações?",
      )
    )
      onClose();
  }

  return (
    <Modal
      title={note ? "Editar página" : "Uma nova página"}
      subtitle="Ideias, leituras, perguntas e anotações — no seu próprio ritmo."
      onClose={close}
      wide
    >
      <form
        className="note-editor"
        onKeyDown={(event) => {
          if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "s"
          ) {
            event.preventDefault();
            if (!busy) event.currentTarget.requestSubmit();
          }
        }}
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          const value = {
            title,
            content,
            tags: tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
          };
          try {
            const saved = await api<Note>(note ? `notes/${note.id}` : "notes", {
              ...send(
                note ? { ...value, expectedUpdatedAt: note.updatedAt } : value,
              ),
              method: note ? "PATCH" : "POST",
            });
            await onSaved(saved);
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Título da página">
          <input
            autoFocus
            required
            maxLength={200}
            value={title}
            disabled={busy}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Uma ideia que merece ficar…"
          />
        </Field>
        <Field label="Anotação">
          <textarea
            className="note-writing"
            rows={13}
            maxLength={100000}
            value={content}
            disabled={busy}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Comece por uma pergunta, uma observação ou uma passagem de um livro. Se for uma citação, anote também o autor e a fonte."
          />
        </Field>
        <Field
          label="Etiquetas"
          hint="Separe por vírgulas. Até 12 etiquetas de 50 caracteres."
        >
          <input
            value={tags}
            disabled={busy}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Ex.: leituras, filosofia, ideias de campo"
          />
        </Field>
        <ErrorText message={error} />
        <div className="modal-footer">
          <span className="muted">
            {words} {words === 1 ? "palavra" : "palavras"} ·{" "}
            {dirty ? "Alterações não salvas" : "Sem alterações"} · Ctrl / ⌘ S
          </span>
          <div className="actions">
            <Button
              variant="outline"
              type="button"
              onClick={close}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={busy || !title.trim()}>
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Save size={16} />
              )}{" "}
              {busy ? "Salvando…" : "Salvar página"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
