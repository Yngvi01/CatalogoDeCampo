import { randomUUID } from "node:crypto";
import { transaction } from "@/lib/db";
import { get, put } from "@/lib/db/repository";
import { normalize } from "@/lib/utils";
import {
  noteInputSchema,
  noteSchema,
  noteUpdateSchema,
  type Note,
} from "@/lib/validation/schemas";

export class NoteConflictError extends Error {}

function uniqueTags(tags: string[]) {
  return tags.filter(
    (tag, index) =>
      tags.findIndex((t) => normalize(t) === normalize(tag)) === index,
  );
}

export async function createNote(input: unknown): Promise<Note> {
  const value = noteInputSchema.parse(input);
  const now = new Date().toISOString();
  const note = noteSchema.parse({
    ...value,
    tags: uniqueTags(value.tags),
    id: randomUUID(),
    archived: false,
    createdAt: now,
    updatedAt: now,
  });
  await put("notes", note);
  return note;
}

export async function updateNote(id: string, input: unknown): Promise<Note> {
  const { expectedUpdatedAt, ...value } = noteUpdateSchema.parse(input);
  return await transaction(async () => {
    const current = await get<Note>("notes", id);
    if (!current) throw new Error("Página não encontrada.");
    if (current.updatedAt !== expectedUpdatedAt) {
      throw new NoteConflictError(
        "Esta página mudou em outra janela ou foi restaurada. Seu texto continua no editor: copie-o antes de fechar e abrir a versão atual.",
      );
    }
    const note = noteSchema.parse({
      ...current,
      ...value,
      tags: uniqueTags(value.tags ?? current.tags),
      updatedAt: new Date(
        Math.max(Date.now(), Date.parse(current.updatedAt) + 1),
      ).toISOString(),
    });
    await put("notes", note);
    return note;
  });
}
