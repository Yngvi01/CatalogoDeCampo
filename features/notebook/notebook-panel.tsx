"use client";

import { useState } from "react";
import {
  NotebookPen,
  Plus,
  Search,
  Pencil,
  Archive,
  ArchiveRestore,
  Download,
  BookOpen,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, ErrorText, api, send } from "@/components/shared";
import { normalize, dateLabel } from "@/lib/utils";
import type { Note } from "@/lib/validation/schemas";
import { NoteEditor } from "./note-editor";

export function NotebookPanel({
  notes,
  query,
  refresh,
}: {
  notes: Note[];
  query: string;
  refresh: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Note | "new" | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const visibleNotes = notes
    .filter((note) => {
      const text = normalize(
        [note.title, note.content, ...note.tags].join(" "),
      );
      return (
        note.archived === archived &&
        [query, search].every((term) => text.includes(normalize(term)))
      );
    })
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
    );
  const selected =
    visibleNotes.find((note) => note.id === selectedId) ?? visibleNotes[0];
  const position = selected
    ? visibleNotes.findIndex((note) => note.id === selected.id)
    : -1;

  async function toggleArchive(note: Note) {
    setBusy(true);
    setError("");
    try {
      await api(`notes/${note.id}`, {
        ...send({
          archived: !note.archived,
          expectedUpdatedAt: note.updatedAt,
        }),
        method: "PATCH",
      });
      await refresh();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function download(note: Note) {
    const text = `${note.title}\n${"—".repeat(30)}\n\n${note.content}\n\n${note.tags.length ? `Etiquetas: ${note.tags.join(", ")}\n` : ""}Criado em: ${dateLabel(note.createdAt)}\nAtualizado em: ${dateLabel(note.updatedAt)}\n`;
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${
      note.title
        .replace(/[^\p{L}\p{N}\-_ ]/gu, "")
        .trim()
        .slice(0, 100) || "campo-pagina"
    }.txt`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="notebook-section" aria-label="Caderno de anotações">
      <div className="notebook-toolbar">
        <div className="notebook-search">
          <Search size={16} />
          <input
            aria-label="Buscar páginas"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar títulos, textos e etiquetas…"
          />
        </div>
        <div className="actions">
          <Button
            size="sm"
            variant="outline"
            aria-pressed={archived}
            onClick={() => setArchived((value) => !value)}
          >
            {archived ? <BookOpen size={15} /> : <Archive size={15} />}{" "}
            {archived ? "Ver caderno" : "Arquivadas"}
          </Button>
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus size={16} /> Nova página
          </Button>
        </div>
      </div>
      <ErrorText message={error} />
      {selected ? (
        <div className="notebook-book panel">
          <aside className="notebook-index" aria-label="Índice do caderno">
            <div className="notebook-index-heading">
              <span className="eyebrow">
                {archived ? "PÁGINAS ARQUIVADAS" : "MEU CADERNO"}
              </span>
              <span>
                {visibleNotes.length}{" "}
                {visibleNotes.length === 1 ? "página" : "páginas"}
              </span>
            </div>
            <nav>
              {visibleNotes.map((note, index) => (
                <button
                  key={note.id}
                  className={selected.id === note.id ? "active" : ""}
                  aria-current={selected.id === note.id ? "page" : undefined}
                  onClick={() => setSelectedId(note.id)}
                >
                  <span className="notebook-page-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <strong>{note.title}</strong>
                    <small>{dateLabel(note.createdAt)}</small>
                  </span>
                </button>
              ))}
            </nav>
          </aside>
          <article className="notebook-page" aria-label="Página do caderno">
            <div className="notebook-page-top">
              <span className="eyebrow">
                {archived ? "ARQUIVO PESSOAL" : "ANOTAÇÕES PESSOAIS"}
              </span>
              <div className="actions">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Baixar página em texto"
                  onClick={() => download(selected)}
                >
                  <Download size={16} />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={
                    selected.archived ? "Restaurar página" : "Arquivar página"
                  }
                  disabled={busy}
                  onClick={() => void toggleArchive(selected)}
                >
                  {selected.archived ? (
                    <ArchiveRestore size={16} />
                  ) : (
                    <Archive size={16} />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(selected)}
                >
                  <Pencil size={14} /> Editar página
                </Button>
              </div>
            </div>
            <header>
              <span className="notebook-date">
                {dateLabel(selected.createdAt)}
              </span>
              <h2>{selected.title}</h2>
              {selected.tags.length > 0 && (
                <div className="notebook-tags">
                  {selected.tags.map((tag) => (
                    <button
                      key={tag}
                      className="tag"
                      onClick={() => setSearch(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </header>
            <div className="notebook-body">
              {selected.content || (
                <span className="muted">
                  Uma página em branco, pronta para a próxima ideia.
                </span>
              )}
            </div>
            <footer>
              <small>
                Atualizada em{" "}
                {new Date(selected.updatedAt).toLocaleString("pt-BR")}
              </small>
              <div className="actions">
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={position === 0}
                  aria-label="Página anterior"
                  onClick={() => setSelectedId(visibleNotes[position - 1].id)}
                >
                  <ChevronLeft size={16} />
                </Button>
                <span>
                  {position + 1} / {visibleNotes.length}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={position === visibleNotes.length - 1}
                  aria-label="Próxima página"
                  onClick={() => setSelectedId(visibleNotes[position + 1].id)}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </footer>
          </article>
        </div>
      ) : (
        <Empty
          icon={<NotebookPen size={34} />}
          title={
            query || search
              ? "Nenhuma página encontrada."
              : archived
                ? "Seu arquivo está vazio."
                : "Toda ideia merece uma página."
          }
          text={
            query || search
              ? "Experimente outros termos na busca do caderno ou na busca global."
              : archived
                ? "As páginas arquivadas continuam guardadas e podem voltar ao caderno quando você quiser."
                : "Guarde pensamentos, leituras e descobertas em um caderno que cresce com você."
          }
          action={
            !archived && !query && !search ? (
              <Button variant="outline" onClick={() => setEditing("new")}>
                <Plus size={16} /> Escrever a primeira página
              </Button>
            ) : undefined
          }
        />
      )}
      <p className="notebook-footnote">
        Suas páginas ficam salvas no catálogo e acompanham o backup completo do
        catálogo.
      </p>
      {editing && (
        <NoteEditor
          note={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={async (note) => {
            setSelectedId(note.id);
            setArchived(note.archived);
            setSearch("");
            setEditing(null);
            await refresh();
          }}
        />
      )}
    </section>
  );
}
